import { useState, useEffect, useCallback } from "react";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import {
  Cloud, Wind, Droplets, Thermometer,
  Eye, Gauge, Snowflake, AlertTriangle,
  TrendingDown, TrendingUp, Clock, CalendarDays, Zap, RefreshCw,
} from "lucide-react";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, Legend,
} from "recharts";
import { storageGetJSON, storageSetJSON } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";
import "./WeatherPage.css";

// ─── Ulaanbaatar coordinates ──────────────────────────────────────────────────
const LAT = 47.9184;
const LON = 106.9177;

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

const CACHE_KEY = STORAGE_KEYS.weatherCache;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wmoToCode(wmo) {
  if (wmo === 0) return "sunny";
  if (wmo <= 2) return "partly_cloudy";
  if (wmo <= 48) return "cloudy";
  if (wmo <= 67 || (wmo >= 80 && wmo <= 82)) return "rain";
  if ((wmo >= 71 && wmo <= 77) || wmo === 85 || wmo === 86) return "snow";
  return "thunderstorm";
}

const WIND_MN = ["Хойд", "ХЗ", "Зүүн", "ЗУ", "Урд", "УБ", "Баруун", "ХБ"];
const WIND_EN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const windDir = (deg, lang) => (lang === "mn" ? WIND_MN : WIND_EN)[Math.round((deg % 360) / 45) % 8];

const WD_KEYS = ["weekday_sun", "weekday_mon", "weekday_tue", "weekday_wed", "weekday_thu", "weekday_fri", "weekday_sat"];
const dayKey = (dateStr) => WD_KEYS[new Date(dateStr + "T00:00:00").getDay()];

const hdd = (max, min) => Math.max(0, Math.round(18 - (max + min) / 2));
const energyVal = (h) => Math.round(h * 143);
const impactKey = (h) => h > 25 ? "impact_high" : h > 15 ? "impact_medium" : "impact_low";

const HOURLY_SLOTS = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
const nearestSlot = () => {
  const h = new Date().getHours();
  return SLOTS_NUM.reduce((best, s) => Math.abs(h - s) < Math.abs(h - best) ? s : best, 0);
};
const SLOTS_NUM = [0, 3, 6, 9, 12, 15, 18, 21];

function getCached() {
  const c = storageGetJSON(CACHE_KEY, null);
  if (c && Date.now() - c.ts < CACHE_TTL) return { data: c.data, ts: c.ts };
  return null;
}
function setCached(data) {
  storageSetJSON(CACHE_KEY, { ts: Date.now(), data });
}

function parseResponse(meteo, aq) {
  const { current, daily, hourly } = meteo;
  const todayIdx = 7; // past_days=7
  const todayDate = daily.time[todayIdx];

  function buildDay(i, useCurrent = false) {
    const h = hdd(daily.temperature_2m_max[i], daily.temperature_2m_min[i]);
    return {
      date: daily.time[i],
      weekday_key: dayKey(daily.time[i]),
      temp: useCurrent
        ? Math.round(current.temperature_2m)
        : Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      feels_like: useCurrent
        ? Math.round(current.apparent_temperature)
        : Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2 - 4),
      temp_max: Math.round(daily.temperature_2m_max[i]),
      temp_min: Math.round(daily.temperature_2m_min[i]),
      code: useCurrent ? wmoToCode(current.weather_code) : wmoToCode(daily.weather_code[i]),
      humidity: useCurrent ? Math.round(current.relative_humidity_2m) : 60,
      wind: useCurrent
        ? Math.round(current.wind_speed_10m)
        : Math.round(daily.wind_speed_10m_max[i]),
      wind_deg: useCurrent ? current.wind_direction_10m : 0,
      visibility: useCurrent ? Math.round((current.visibility || 10000) / 1000) : 10,
      pressure: useCurrent ? Math.round(current.surface_pressure) : 1015,
      snow_chance: Math.round(daily.precipitation_probability_max[i] || 0),
      sunrise: (daily.sunrise[i] || "").slice(11, 16) || "--:--",
      sunset:  (daily.sunset[i]  || "").slice(11, 16) || "--:--",
      aqi: Math.round(aq?.current?.us_aqi || 0),
      hdd: h,
      energy_val: energyVal(h),
      impact_key: impactKey(h),
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
      code: wmoToCode(daily.weather_code[i]),
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
      hour: slot,
      temp: Math.round(hourly.temperature_2m[idx]),
      feels: Math.round(hourly.apparent_temperature[idx]),
      code: wmoToCode(hourly.weather_code[idx]),
      precip: Math.round(hourly.precipitation_probability[idx] || 0),
    });
  });

  const historyChart = [];
  for (let i = 0; i <= todayIdx + 1; i++) {
    if (!daily.time[i]) break;
    const h = hdd(daily.temperature_2m_max[i], daily.temperature_2m_min[i]);
    const [, mm, dd] = daily.time[i].split("-");
    historyChart.push({
      date: `${mm}/${dd}`,
      temp: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      hdd: h,
      energy: energyVal(h),
      forecast: i > todayIdx,
    });
  }

  return { todayData, tomorrowData, weekForecast, hourlyToday, historyChart };
}

// ─── Weather icon ─────────────────────────────────────────────────────────────
function WeatherIcon({ code, size = 40, animated = false }) {
  const cls = `weather-icon-svg ${animated ? "animated" : ""}`;
  if (code === "sunny")
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} className={cls}>
        <circle cx="40" cy="40" r="16" fill="#e9c46a" className="sun-core" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
          <line key={i}
            x1={40 + Math.cos(a * Math.PI / 180) * 22} y1={40 + Math.sin(a * Math.PI / 180) * 22}
            x2={40 + Math.cos(a * Math.PI / 180) * 30} y2={40 + Math.sin(a * Math.PI / 180) * 30}
            stroke="#e9c46a" strokeWidth="3" strokeLinecap="round" />
        ))}
      </svg>
    );
  if (code === "snow")
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} className={cls}>
        <ellipse cx="42" cy="32" rx="22" ry="14" fill="#a8c5e0" opacity={0.9} />
        <ellipse cx="28" cy="36" rx="14" ry="10" fill="#c5d8ea" opacity={0.85} />
        {[35, 42, 49, 56].map((x, i) => (
          <g key={i}>
            <line x1={x} y1="48" x2={x} y2="62" stroke="#8ec6f0" strokeWidth="2" strokeLinecap="round" />
            <line x1={x - 4} y1="53" x2={x + 4} y2="53" stroke="#8ec6f0" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    );
  if (code === "rain" || code === "thunderstorm")
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} className={cls}>
        <ellipse cx="44" cy="28" rx="22" ry="13" fill="#7090b0" opacity={0.9} />
        <ellipse cx="30" cy="34" rx="14" ry="9" fill="#8098b0" opacity={0.85} />
        {[32, 40, 48, 56].map((x, i) => (
          <line key={i} x1={x} y1="48" x2={x - 4} y2="64"
            stroke={code === "thunderstorm" && i === 2 ? "#e9c46a" : "#5a8ec0"}
            strokeWidth={code === "thunderstorm" && i === 2 ? "2.5" : "2"}
            strokeLinecap="round" />
        ))}
      </svg>
    );
  if (code === "partly_cloudy")
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} className={cls}>
        <circle cx="28" cy="30" r="14" fill="#e9c46a" opacity={0.9} />
        {[270, 315, 0, 45].map((a, i) => (
          <line key={i}
            x1={28 + Math.cos(a * Math.PI / 180) * 18} y1={30 + Math.sin(a * Math.PI / 180) * 18}
            x2={28 + Math.cos(a * Math.PI / 180) * 24} y2={30 + Math.sin(a * Math.PI / 180) * 24}
            stroke="#e9c46a" strokeWidth="2.5" strokeLinecap="round" />
        ))}
        <ellipse cx="50" cy="44" rx="22" ry="13" fill="#a8c5e0" opacity={0.95} />
        <ellipse cx="36" cy="48" rx="14" ry="9" fill="#c5d8ea" opacity={0.9} />
      </svg>
    );
  // cloudy (default)
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className={cls}>
      <ellipse cx="44" cy="34" rx="22" ry="14" fill="#8098b0" opacity={0.9} />
      <ellipse cx="30" cy="40" rx="16" ry="11" fill="#a0b8cc" opacity={0.85} />
      <ellipse cx="52" cy="42" rx="14" ry="10" fill="#90abbe" opacity={0.8} />
    </svg>
  );
}

function AQIBar({ aqi, t }) {
  const pct = Math.min(100, (aqi / 300) * 100);
  const color = aqi < 50 ? "#2a9d8f" : aqi < 100 ? "#e9c46a" : aqi < 150 ? "#f4a261" : "#e63946";
  const label = aqi < 50 ? t.weather.aqi_good : aqi < 100 ? t.weather.aqi_medium : aqi < 150 ? t.weather.aqi_bad : t.weather.aqi_danger;
  return (
    <div className="aqi-bar-wrap">
      <div className="aqi-track">
        <div className="aqi-gradient" />
        <div className="aqi-pointer" style={{ left: `${pct}%` }} />
      </div>
      <div className="aqi-labels-row">
        <span style={{ color: "#2a9d8f" }}>{t.weather.aqi_good}</span>
        <span style={{ color: "#e9c46a" }}>{t.weather.aqi_medium}</span>
        <span style={{ color: "#f4a261" }}>{t.weather.aqi_bad}</span>
        <span style={{ color: "#e63946" }}>{t.weather.aqi_danger}</span>
      </div>
      <div className="aqi-current" style={{ color }}>AQI {aqi} — {label}</div>
    </div>
  );
}

function DayCard({ day, active, onClick, t }) {
  const condKey = `cond_${day.code}`;
  return (
    <button className={`day-card ${active ? "active" : ""}`} onClick={onClick}>
      <span className="day-name">{t.weather[day.weekday_key] || day.weekday_key}</span>
      <WeatherIcon code={day.code} size={36} />
      <span className="day-cond">{t.weather[condKey] || day.code}</span>
      <span className="day-max">{day.temp_max > 0 ? "+" : ""}{day.temp_max}°C</span>
      <span className="day-min">{day.temp_min}°C</span>
      <div className="day-hdd">{day.hdd} HDD</div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WeatherPage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.weather);
  const mn = lang === "mn";

  const [weather, setWeather] = useState(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [activeDay, setActiveDay]  = useState("today");
  const [now, setNow] = useState(new Date());

  // Real-time clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchWeather = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached();
      if (cached) { setWeather(cached.data); setLoading(false); setFetchedAt(new Date(cached.ts)); return; }
    }
    setLoading(true);
    setError(null);
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
      const parsed = parseResponse(meteoData, aqData);
      setWeather(parsed);
      setCached(parsed);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  // ── Render states ──
  if (loading && !weather)
    return (
      <div className="weather-page">
        <div className="weather-loading" aria-live="polite" aria-busy="true">
          <div className="wl-spinner" />
          <p>{mn ? "Цаг уурын мэдээлэл ачааллаж байна..." : "Loading weather data..."}</p>
          <p className="wl-sub">{mn ? "Open-Meteo API · Улаанбаатар" : "Open-Meteo API · Ulaanbaatar"}</p>
        </div>
      </div>
    );

  if (error && !weather)
    return (
      <div className="weather-page">
        <div className="weather-loading" role="alert">
          <AlertTriangle size={40} style={{ color: "#e63946" }} />
          <p style={{ color: "#e63946" }}>{mn ? "Цаг уурын мэдээлэл авахад алдаа гарлаа" : "Failed to load weather data"}</p>
          <p className="wl-sub">{error}</p>
          <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => fetchWeather(true)}>
            <RefreshCw size={15} /> {mn ? "Дахин оролдох" : "Retry"}
          </button>
        </div>
      </div>
    );

  const data = activeDay === "today" ? weather.todayData : weather.tomorrowData;

  const timeStr  = now.toLocaleTimeString(mn ? "mn-MN" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateLabel = mn
    ? `${now.getFullYear()} оны ${now.getMonth() + 1}-р сарын ${now.getDate()} — ${t.weather[data.weekday_key] || ""} гараг`
    : now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const impactColor = { impact_high: "#e63946", impact_medium: "#f4a261", impact_low: "#2a9d8f" }[data.impact_key];
  const aqiColor = data.aqi < 100 ? "#2a9d8f" : data.aqi < 150 ? "#f4a261" : "#e63946";

  const impactDesc = data.impact_key === "impact_high"
    ? t.weather.impact_high_desc.replace("{val}", data.energy_val.toLocaleString())
    : t.weather.impact_low_desc.replace("{val}", data.energy_val.toLocaleString());

  const nowSlot = `${String(nearestSlot()).padStart(2, "0")}:00`;

  return (
    <div className="weather-page">
      {/* ─── Hero ─── */}
      <div className="weather-hero">
        <div className="weather-hero-bg" />
        <div className="container weather-hero-inner">
          <div className="weather-location">
            <div className="location-pin">📍</div>
            <div>
              <h1 className="location-name">{t.weather.city_name}</h1>
              <p className="location-sub">{t.weather.country} · {t.weather.info_sub}</p>
            </div>
            <div className="live-clock">
              <Clock size={16} />
              <span className="clock-time">{timeStr}</span>
              <span className="clock-date">{dateLabel}</span>
            </div>
            <button
              className="weather-refresh-btn"
              onClick={() => fetchWeather(true)}
              title={mn ? "Шинэчлэх" : "Refresh"}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>

          <div className="day-selector">
            <button className={`day-sel-btn ${activeDay === "today" ? "active" : ""}`} onClick={() => setActiveDay("today")}>
              <CalendarDays size={15} /> {t.weather.today}
            </button>
            <button className={`day-sel-btn ${activeDay === "tomorrow" ? "active" : ""}`} onClick={() => setActiveDay("tomorrow")}>
              <CalendarDays size={15} /> {t.weather.tomorrow}
            </button>
          </div>

          <div className="main-weather-card animate-fade">
            <div className="mwc-left">
              <WeatherIcon code={data.code} size={100} animated />
              <div className="mwc-condition">{t.weather[`cond_${data.code}`] || data.code}</div>
            </div>

            <div className="mwc-center">
              <div className="mwc-temp">{data.temp > 0 ? "+" : ""}{data.temp}<span className="deg">°C</span></div>
              <div className="mwc-feels">{t.weather.feels_like}: {data.feels_like}°C</div>
              <div className="mwc-range">
                <TrendingUp size={14} style={{ color: "#e63946" }} />
                <span style={{ color: "#e63946" }}>{data.temp_max > 0 ? "+" : ""}{data.temp_max}°C</span>
                <TrendingDown size={14} style={{ color: "#3a8fd4", marginLeft: 8 }} />
                <span style={{ color: "#3a8fd4" }}>{data.temp_min}°C</span>
              </div>
            </div>

            <div className="mwc-right">
              <div className="mwc-stats">
                <div className="mwc-stat">
                  <Droplets size={16} style={{ color: "#3a8fd4" }} />
                  <span>{data.humidity}%</span>
                  <span className="stat-lbl">{t.weather.humidity}</span>
                </div>
                <div className="mwc-stat">
                  <Wind size={16} style={{ color: "#a8c5e0" }} />
                  <span>{data.wind} {t.common.unit_kmh}</span>
                  <span className="stat-lbl">{t.weather.wind} {windDir(data.wind_deg, lang)}</span>
                </div>
                <div className="mwc-stat">
                  <Eye size={16} style={{ color: "#6a9bbf" }} />
                  <span>{data.visibility} {t.common.unit_km}</span>
                  <span className="stat-lbl">{t.weather.visibility}</span>
                </div>
                <div className="mwc-stat">
                  <Gauge size={16} style={{ color: "#e9c46a" }} />
                  <span>{data.pressure} hPa</span>
                  <span className="stat-lbl">{t.weather.pressure}</span>
                </div>
              </div>

              <div className="sun-row">
                <span>🌅 {data.sunrise}</span>
                <span>🌇 {data.sunset}</span>
              </div>

              {data.snow_chance >= 40 && (
                <div className="snow-alert">
                  <Snowflake size={14} />
                  {t.weather.snow_chance}: <strong>{data.snow_chance}%</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="container weather-content">

        {/* HDD + Energy impact + AQI */}
        <div className="grid grid-3 mb-3">
          <div className="card hdd-card">
            <div className="hdd-header">
              <Thermometer size={20} style={{ color: "#3a8fd4" }} />
              <span>{t.weather.hdd_title}</span>
            </div>
            <div className="hdd-value">{data.hdd} HDD</div>
            <div className="hdd-base">{t.weather.hdd_base}: {data.temp}°C</div>
            <div className="hdd-formula">HDD = max(0, 18 − ({data.temp})) = <strong>{Math.max(0, 18 - data.temp)} HDD</strong></div>
            <div className="hdd-bar-wrap">
              <div className="hdd-bar" style={{ width: `${Math.min(100, (data.hdd / 40) * 100)}%` }} />
            </div>
          </div>

          <div className="card energy-impact-card">
            <div className="hdd-header">
              <Zap size={20} style={{ color: impactColor }} />
              <span>{t.weather.energy_impact}</span>
            </div>
            <div className="impact-value" style={{ color: impactColor }}>{t.weather[data.impact_key]}</div>
            <div className="impact-desc">{impactDesc}</div>
            <div className="impact-badge" style={{ background: `${impactColor}22`, color: impactColor, border: `1px solid ${impactColor}44` }}>
              HDD {data.hdd} → ~{data.energy_val.toLocaleString()} {t.common.units_kwh}/{t.weather.city_label}
            </div>
          </div>

          <div className="card aqi-card">
            <div className="hdd-header">
              <Cloud size={20} style={{ color: aqiColor }} />
              <span>{t.weather.aqi_title}</span>
            </div>
            <AQIBar aqi={data.aqi} t={t} />
            <p className="aqi-note">
              {data.aqi > 150 ? t.weather.mask_advice : t.weather.good_air}
            </p>
          </div>
        </div>

        {/* Hourly (today only) */}
        {activeDay === "today" && weather.hourlyToday.length > 0 && (
          <div className="card mb-3">
            <h3 className="section-title">{t.weather.hourly_title}</h3>
            <div className="hourly-scroll">
              {weather.hourlyToday.map(h => (
                <div key={h.hour} className={`hourly-item ${h.hour === nowSlot ? "now" : ""}`}>
                  <span className="h-time">{h.hour}</span>
                  <WeatherIcon code={h.code} size={32} />
                  <span className="h-temp">{h.temp > 0 ? "+" : ""}{h.temp}°C</span>
                  <span className="h-feels">{h.feels}°C</span>
                  {h.precip > 0 && (
                    <span className="h-precip"><Snowflake size={10} />{h.precip}%</span>
                  )}
                </div>
              ))}
            </div>
            <div className="hourly-legend"><span>{t.weather.hourly_legend}</span></div>
          </div>
        )}

        {/* 7-day forecast */}
        <div className="card mb-3">
          <h3 className="section-title">{t.weather.weekly_title}</h3>
          <div className="week-scroll">
            <DayCard day={{ ...weather.todayData }}    active={activeDay === "today"}    onClick={() => setActiveDay("today")}    t={t} lang={lang} />
            <DayCard day={{ ...weather.tomorrowData }} active={activeDay === "tomorrow"} onClick={() => setActiveDay("tomorrow")} t={t} lang={lang} />
            {weather.weekForecast.map((d, i) => (
              <DayCard key={i} day={d} active={false} onClick={() => {}} t={t} lang={lang} />
            ))}
          </div>
        </div>

        {/* Energy-weather correlation chart */}
        <div className="card mb-3">
          <h3 className="section-title">{t.weather.correlation_title}</h3>
          <div className="chart-note">{mn ? "Сүүлийн 7 хоног + өнөөдрийн таамаглал (Open-Meteo)" : "Last 7 days + today's forecast (Open-Meteo)"}</div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={weather.historyChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a6eb5" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#1a6eb5" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" />
              <XAxis dataKey="date" tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false} />
              <YAxis yAxisId="energy" tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="temp" orientation="right" tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }} labelStyle={{ color: "var(--accent)" }} formatter={(v, name) => name === t.weather.temp_c ? [`${v}°C`, name] : [`${v.toLocaleString()} kWh`, name]} />
              <Legend wrapperStyle={{ color: "var(--text2)", fontSize: 12 }} />
              <Bar yAxisId="energy" dataKey="energy" name={t.weather.energy_kwh}
                fill="url(#energyGrad)" radius={[4, 4, 0, 0]}
                label={{ position: "top", fill: "#6a9bbf", fontSize: 10 }}
              />
              <Line yAxisId="temp" type="monotone" dataKey="temp" stroke="#e9c46a"
                strokeWidth={2} dot={{ r: 4, fill: "#e9c46a" }} name={t.weather.temp_c} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="forecast-legend">
            <span className="fl-item"><span className="fl-dot" style={{ background: "#1a6eb5" }} />{mn ? "Тооцоолсон эрчим хүч (kWh)" : "Estimated energy (kWh)"}</span>
            <span className="fl-item"><span className="fl-dot" style={{ background: "#e9c46a" }} />{mn ? "Дундаж температур (°C)" : "Mean temperature (°C)"}</span>
          </div>

          {/* Data source methodology */}
          <div className="energy-source-box">
            <div className="esb-title">
              {mn ? "📊 Эрчим хүчний өгөгдөл хаанаас ирж байна вэ?" : "📊 Where does the energy data come from?"}
            </div>
            <div className="esb-chain">
              <div className="esb-step">
                <div className="esb-step-badge api">API</div>
                <div className="esb-step-body">
                  <strong>{mn ? "Open-Meteo температур" : "Open-Meteo temperature"}</strong>
                  <span>{mn ? "Улаанбаатарын бодит хэмжсэн өдрийн хамгийн өндөр/доод температур" : "Measured daily max/min temperature for Ulaanbaatar"}</span>
                </div>
              </div>
              <div className="esb-arrow">→</div>
              <div className="esb-step">
                <div className="esb-step-badge calc">HDD</div>
                <div className="esb-step-body">
                  <strong>{mn ? "Халааны зэрэг-өдөр тооцоолол" : "Heating Degree Day calculation"}</strong>
                  <span>HDD = max(0,&nbsp;18°C&nbsp;−&nbsp;T<sub>дундаж</sub>)&nbsp;&nbsp;·&nbsp;&nbsp;T<sub>дундаж</sub> = (T<sub>max</sub>&nbsp;+&nbsp;T<sub>min</sub>)&nbsp;÷&nbsp;2</span>
                </div>
              </div>
              <div className="esb-arrow">→</div>
              <div className="esb-step">
                <div className="esb-step-badge est">kWh</div>
                <div className="esb-step-body">
                  <strong>{mn ? "Барилгын дулааны хэрэглээний таамаглал" : "Building heating demand estimate"}</strong>
                  <span>{mn
                    ? "Эрчим хүч = HDD × 143 kWh — УБ-ын дундаж орон сууцны барилгын нэг өдрийн дулааны хэрэглээний коэффициент"
                    : "Energy = HDD × 143 kWh — coefficient based on average UB apartment building's daily heating demand"}</span>
                </div>
              </div>
            </div>
            <div className="esb-note">
              {mn
                ? "⚠️ Энэ нь ойролцоо таамаглал бөгөөд бодит барилга бүрийн хэрэглээ нь талбай, дулаалга, халаалтын системийн төрлөөс хамаарч өөр байна."
                : "⚠️ This is an approximation. Actual consumption per building varies by area, insulation quality, and heating system type."}
            </div>
          </div>
        </div>

        {/* Air quality warning */}
        {data.aqi > 150 && (
          <div className="air-warning card mb-3 animate-fade">
            <AlertTriangle size={24} />
            <div>
              <h3>{t.weather.air_warning_title}</h3>
              <p>{t.weather.air_warning_desc.replace("{aqi}", data.aqi)}</p>
            </div>
          </div>
        )}

        {/* Source */}
        <div className="weather-source card">
          <div className="ws-inner">
            <div>
              <h4>{t.weather.source_title}</h4>
              <p>{mn
                ? "Open-Meteo API (open-meteo.com) · Цаг агаарын бодит өгөгдөл · API түлхүүр шаардлагагүй"
                : "Open-Meteo API (open-meteo.com) · Real weather data · No API key required"}</p>
            </div>
            <div className="ws-badges">
              <span className="ws-badge">🕐 {timeStr}</span>
              <span className="ws-badge">🔄 {fetchedAt ? (() => {
                const hh = String(fetchedAt.getHours()).padStart(2,"0");
                const mm = String(fetchedAt.getMinutes()).padStart(2,"0");
                return mn ? `${hh}:${mm} шинэчлэгдсэн` : `Updated ${hh}:${mm}`;
              })() : "—"}</span>
              <span className="ws-badge">🌡️ {t.weather.city_name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
