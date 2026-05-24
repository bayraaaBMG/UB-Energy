import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { MOCK_BUILDINGS, normalizeBuilding, computeStats } from "../utils/buildingStorage";
import {
  saveFirestoreBuilding, updateFirestoreBuilding, deleteFirestoreBuilding,
  batchSaveFirestoreBuildings, subscribeUserBuildings, subscribeAllBuildings,
  saveFirestorePrediction, deleteFirestorePrediction, subscribePredictions,
  saveFirestoreScenario, deleteFirestoreScenario, subscribeScenarios,
  saveFirestoreFavorite, deleteFirestoreFavorite, subscribeFavorites,
} from "../utils/firestoreStorage";
import { storageGetJSON, storageSetJSON } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";
import { FIREBASE_CONFIGURED } from "../lib/firebase";

// ─── Weather config ────────────────────────────────────────────────────────────
const LAT = 47.9184;
const LON = 106.9177;
const CACHE_TTL = 30 * 60 * 1000;

const METEO_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code` +
  `,wind_speed_10m,wind_direction_10m,surface_pressure,visibility,precipitation_probability` +
  `&hourly=temperature_2m,apparent_temperature,weather_code,precipitation_probability` +
  `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
  `,wind_speed_10m_max,sunrise,sunset` +
  `&past_days=7&forecast_days=8&timezone=Asia%2FUlaanbaatar`;

const AQI_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}` +
  `&current=us_aqi,pm2_5&timezone=Asia%2FUlaanbaatar`;

// ─── Weather helpers ───────────────────────────────────────────────────────────
function wmoToCode(wmo) {
  if (wmo === 0) return "sunny";
  if (wmo <= 2) return "partly_cloudy";
  if (wmo <= 48) return "cloudy";
  if (wmo <= 67 || (wmo >= 80 && wmo <= 82)) return "rain";
  if ((wmo >= 71 && wmo <= 77) || wmo === 85 || wmo === 86) return "snow";
  return "thunderstorm";
}

const WD_KEYS = ["weekday_sun","weekday_mon","weekday_tue","weekday_wed","weekday_thu","weekday_fri","weekday_sat"];
const dayKey  = (dateStr) => WD_KEYS[new Date(dateStr + "T00:00:00").getDay()];
const hdd     = (max, min) => Math.max(0, Math.round(18 - (max + min) / 2));
const energyVal = (h) => Math.round(h * 143);
const impactKey = (h) => h > 25 ? "impact_high" : h > 15 ? "impact_medium" : "impact_low";
const HOURLY_SLOTS = ["00:00","03:00","06:00","09:00","12:00","15:00","18:00","21:00"];

function parseWeatherResponse(meteo, aq) {
  const { current, daily, hourly } = meteo;
  const todayIdx  = 7;
  const todayDate = daily.time[todayIdx];

  function buildDay(i, useCurrent = false) {
    const h = hdd(daily.temperature_2m_max[i], daily.temperature_2m_min[i]);
    return {
      date:        daily.time[i],
      weekday_key: dayKey(daily.time[i]),
      temp: useCurrent
        ? Math.round(current.temperature_2m)
        : Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      feels_like: useCurrent
        ? Math.round(current.apparent_temperature)
        : Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2 - 4),
      temp_max:     Math.round(daily.temperature_2m_max[i]),
      temp_min:     Math.round(daily.temperature_2m_min[i]),
      code: useCurrent ? wmoToCode(current.weather_code) : wmoToCode(daily.weather_code[i]),
      humidity: useCurrent ? Math.round(current.relative_humidity_2m) : 60,
      wind: useCurrent
        ? Math.round(current.wind_speed_10m)
        : Math.round(daily.wind_speed_10m_max[i]),
      wind_deg:    useCurrent ? current.wind_direction_10m : 0,
      visibility:  useCurrent ? Math.round((current.visibility || 10000) / 1000) : 10,
      pressure:    useCurrent ? Math.round(current.surface_pressure) : 1015,
      snow_chance: Math.round(daily.precipitation_probability_max[i] || 0),
      sunrise:     (daily.sunrise[i] || "").slice(11,16) || "--:--",
      sunset:      (daily.sunset[i]  || "").slice(11,16) || "--:--",
      aqi:         Math.round(aq?.current?.us_aqi || 0),
      hdd:         h,
      energy_val:  energyVal(h),
      impact_key:  impactKey(h),
    };
  }

  const todayData    = buildDay(todayIdx, true);
  const tomorrowData = buildDay(todayIdx + 1, false);

  const weekForecast = [];
  for (let i = todayIdx + 2; i < todayIdx + 7; i++) {
    if (!daily.time[i]) break;
    const h = hdd(daily.temperature_2m_max[i], daily.temperature_2m_min[i]);
    weekForecast.push({
      weekday_key: dayKey(daily.time[i]),
      code:     wmoToCode(daily.weather_code[i]),
      temp_max: Math.round(daily.temperature_2m_max[i]),
      temp_min: Math.round(daily.temperature_2m_min[i]),
      hdd: h,
    });
  }

  const hourlyToday = [];
  hourly.time.forEach((ts, idx) => {
    if (!ts.startsWith(todayDate)) return;
    const slot = ts.slice(11, 16);
    if (!HOURLY_SLOTS.includes(slot)) return;
    hourlyToday.push({
      hour:   slot,
      temp:   Math.round(hourly.temperature_2m[idx]),
      feels:  Math.round(hourly.apparent_temperature[idx]),
      code:   wmoToCode(hourly.weather_code[idx]),
      precip: Math.round(hourly.precipitation_probability[idx] || 0),
    });
  });

  const historyChart = [];
  for (let i = 0; i <= todayIdx + 1; i++) {
    if (!daily.time[i]) break;
    const h = hdd(daily.temperature_2m_max[i], daily.temperature_2m_min[i]);
    const [, mm, dd] = daily.time[i].split("-");
    historyChart.push({
      date:     `${mm}/${dd}`,
      temp:     Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      hdd:      h,
      energy:   energyVal(h),
      forecast: i > todayIdx,
    });
  }

  return { todayData, tomorrowData, weekForecast, hourlyToday, historyChart };
}

// ─── Context ───────────────────────────────────────────────────────────────────
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();

  // ── Weather ──────────────────────────────────────────────────────────────────
  const [weatherData, setWeatherData]       = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError]     = useState(null);
  const [weatherTs, setWeatherTs]           = useState(null);

  const fetchWeather = useCallback(async (force = false) => {
    const cached = storageGetJSON(STORAGE_KEYS.weatherCache, null);
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
      setWeatherData(cached.data);
      setWeatherTs(cached.ts);
      return;
    }
    if (!navigator.onLine) {
      if (cached) { setWeatherData(cached.data); setWeatherTs(cached.ts); }
      setWeatherError("offline");
      return;
    }
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const [meteoRes, aqRes] = await Promise.all([
        fetch(METEO_URL),
        fetch(AQI_URL).catch(() => null),
      ]);
      if (!meteoRes.ok) throw new Error(`HTTP ${meteoRes.status}`);
      const [meteoData, aqData] = await Promise.all([
        meteoRes.json(),
        aqRes ? aqRes.json().catch(() => null) : null,
      ]);
      const parsed = parseWeatherResponse(meteoData, aqData);
      storageSetJSON(STORAGE_KEYS.weatherCache, { ts: Date.now(), data: parsed });
      setWeatherData(parsed);
      setWeatherTs(Date.now());
      setWeatherError(null);
    } catch (e) {
      const cached2 = storageGetJSON(STORAGE_KEYS.weatherCache, null);
      if (cached2) { setWeatherData(cached2.data); setWeatherTs(cached2.ts); }
      setWeatherError(e.message);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  // ── Buildings — Firestore real-time subscription ──────────────────────────────
  const [buildings, setBuildings]         = useState(MOCK_BUILDINGS);
  const [buildingStats, setBuildingStats] = useState(() => computeStats(MOCK_BUILDINGS));
  const unsubBuildingsRef = useRef(null);

  useEffect(() => {
    // Clean up previous subscription
    if (unsubBuildingsRef.current) {
      unsubBuildingsRef.current();
      unsubBuildingsRef.current = null;
    }

    if (!user?.id || !FIREBASE_CONFIGURED) {
      setBuildings(MOCK_BUILDINGS);
      setBuildingStats(computeStats(MOCK_BUILDINGS));
      return;
    }

    const handleUserBuildings = (userBuildings) => {
      const userIds = new Set(userBuildings.map(b => b.id));
      const all = [
        ...MOCK_BUILDINGS.filter(b => !userIds.has(b.id)),
        ...userBuildings,
      ];
      setBuildings(all);
      setBuildingStats(computeStats(all));
    };

    const handleAllBuildings = (allUserBuildings) => {
      const userIds = new Set(allUserBuildings.map(b => b.id));
      const combined = [
        ...MOCK_BUILDINGS.filter(b => !userIds.has(b.id)),
        ...allUserBuildings,
      ];
      setBuildings(combined);
      setBuildingStats(computeStats(combined));
    };

    if (user.role === "admin") {
      unsubBuildingsRef.current = subscribeAllBuildings(handleAllBuildings);
    } else {
      unsubBuildingsRef.current = subscribeUserBuildings(user.id, handleUserBuildings);
    }

    return () => {
      if (unsubBuildingsRef.current) {
        unsubBuildingsRef.current();
        unsubBuildingsRef.current = null;
      }
    };
  }, [user?.id, user?.role]);

  const addBuilding = useCallback(async (record) => {
    if (!user?.id) return;
    const normalized = normalizeBuilding({
      ...record,
      source: record.source || "user",
      userId: user.id,
      submittedAt: new Date().toISOString(),
    });
    await saveFirestoreBuilding(user.id, normalized);
    // onSnapshot updates state automatically
  }, [user?.id]);

  const batchAddBuildings = useCallback(async (records) => {
    if (!user?.id) return;
    const normalized = records.map(r => normalizeBuilding({
      ...r,
      source: "user",
      userId: user.id,
      submittedAt: new Date().toISOString(),
    }));
    await batchSaveFirestoreBuildings(user.id, normalized);
  }, [user?.id]);

  const updateBuilding = useCallback(async (id, updates) => {
    if (!user?.id) return;
    const current = buildings.find(b => b.id === id);
    if (!current) return;
    const normalized = normalizeBuilding({ ...current, ...updates });
    await updateFirestoreBuilding(user.id, id, normalized);
  }, [user?.id, buildings]);

  const removeBuilding = useCallback(async (id) => {
    if (!user?.id) return;
    await deleteFirestoreBuilding(user.id, id);
  }, [user?.id]);

  // ── User data — Firestore real-time subscriptions ─────────────────────────────
  const [predictions, setPredictions] = useState([]);
  const [scenarios, setScenarios]     = useState([]);
  const [favorites, setFavorites]     = useState([]);

  const unsubPredRef  = useRef(null);
  const unsubScenRef  = useRef(null);
  const unsubFavRef   = useRef(null);

  useEffect(() => {
    // Clean up previous subscriptions
    [unsubPredRef, unsubScenRef, unsubFavRef].forEach(ref => {
      if (ref.current) { ref.current(); ref.current = null; }
    });

    if (!user?.id || !FIREBASE_CONFIGURED) {
      setPredictions([]);
      setScenarios([]);
      setFavorites([]);
      return;
    }

    unsubPredRef.current = subscribePredictions(user.id, setPredictions);
    unsubScenRef.current = subscribeScenarios(user.id, setScenarios);
    unsubFavRef.current  = subscribeFavorites(user.id, setFavorites);

    return () => {
      [unsubPredRef, unsubScenRef, unsubFavRef].forEach(ref => {
        if (ref.current) { ref.current(); ref.current = null; }
      });
    };
  }, [user?.id]);

  const addPrediction = useCallback(async (entry) => {
    if (!user?.id) return;
    await saveFirestorePrediction(user.id, { ...entry, id: Date.now() });
  }, [user?.id]);

  const removePrediction = useCallback(async (id) => {
    if (!user?.id) return;
    await deleteFirestorePrediction(user.id, id);
  }, [user?.id]);

  const addScenario = useCallback(async (scenario) => {
    if (!user?.id) return;
    await saveFirestoreScenario(user.id, scenario);
  }, [user?.id]);

  const removeScenario = useCallback(async (id) => {
    if (!user?.id) return;
    await deleteFirestoreScenario(user.id, id);
  }, [user?.id]);

  const toggleFav = useCallback(async (building) => {
    if (!user?.id) return;
    const isFaved = favorites.some(f => f.id === building.id);
    if (isFaved) {
      await deleteFirestoreFavorite(user.id, building.id);
    } else {
      await saveFirestoreFavorite(user.id, building);
    }
  }, [user?.id, favorites]);

  const isFav = useCallback((buildingId) =>
    favorites.some(f => f.id === buildingId),
  [favorites]);

  // ── Cross-page predictor result ──────────────────────────────────────────────
  const [lastPrediction, setLastPrediction] = useState(null);

  // ── Initialization ───────────────────────────────────────────────────────────
  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  useEffect(() => {
    const id = setInterval(() => fetchWeather(true), CACHE_TTL);
    return () => clearInterval(id);
  }, [fetchWeather]);

  useEffect(() => {
    const handleOnline  = () => { setWeatherError(null); fetchWeather(true); };
    const handleOffline = () => setWeatherError("offline");
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchWeather]);

  return (
    <DataContext.Provider value={{
      // Weather
      weatherData,
      weatherLoading,
      weatherError,
      weatherTs,
      refreshWeather: () => fetchWeather(true),
      isOffline:   weatherError === "offline",
      isStale:     weatherTs != null && (Date.now() - weatherTs) > CACHE_TTL,
      currentHdd:  weatherData?.todayData?.hdd  ?? 4500,
      currentTemp: weatherData?.todayData?.temp  ?? null,
      currentAqi:  weatherData?.todayData?.aqi   ?? null,

      // Buildings
      buildings,
      buildingStats,
      refreshBuildings: () => {},  // no-op: onSnapshot handles updates
      addBuilding,
      batchAddBuildings,
      updateBuilding,
      removeBuilding,

      // Predictions
      predictions,
      addPrediction,
      removePrediction,

      // Scenarios
      scenarios,
      addScenario,
      removeScenario,

      // Favorites
      favorites,
      toggleFav,
      isFav,
      refreshUserData: () => {},  // no-op: onSnapshot handles updates

      // Cross-page predictor result
      lastPrediction,
      setLastPrediction,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
