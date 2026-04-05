import { useState, useEffect } from "react";
import { useLang } from "../contexts/LanguageContext";
import {
  Cloud, Sun, CloudSnow, Wind, Droplets, Thermometer,
  Eye, Gauge, CloudRain, Snowflake, AlertTriangle,
  TrendingDown, TrendingUp, Clock, CalendarDays, Zap
} from "lucide-react";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, Legend
} from "recharts";
import "./WeatherPage.css";

// ─── Static weather data (2026-04-01 Ulaanbaatar) ────────────────────────────
const TODAY = {
  date: "2026-04-01",
  weekday_key: "weekday_wed",
  temp: -4, feels_like: -9, temp_max: 2, temp_min: -9,
  code: "snow", humidity: 72, wind: 18, wind_dir_mn: "ХБ", wind_dir_en: "NW",
  visibility: 6, pressure: 1018, uv: 3, snow_chance: 80, hdd: 29,
  sunrise: "06:58", sunset: "19:42", aqi: 178,
  energy_val: 4150,
  impact_key: "impact_high",
};

const TOMORROW = {
  date: "2026-04-02",
  weekday_key: "weekday_thu",
  temp: 1, feels_like: -4, temp_max: 6, temp_min: -5,
  code: "partly_cloudy", humidity: 55, wind: 12, wind_dir_mn: "Б", wind_dir_en: "N",
  visibility: 14, pressure: 1022, uv: 5, snow_chance: 20, hdd: 24,
  sunrise: "06:56", sunset: "19:44", aqi: 95,
  energy_val: 3820,
  impact_key: "impact_medium",
};

const WEEK_FORECAST = [
  { weekday_key: "weekday_fri", code: "sunny",        temp_max: 8,  temp_min: -2, hdd: 17 },
  { weekday_key: "weekday_sat", code: "cloudy",       temp_max: 5,  temp_min: -4, hdd: 22 },
  { weekday_key: "weekday_sun", code: "snow",         temp_max: -1, temp_min: -10, hdd: 31 },
  { weekday_key: "weekday_mon", code: "partly_cloudy",temp_max: 4,  temp_min: -6, hdd: 26 },
  { weekday_key: "weekday_tue", code: "sunny",        temp_max: 10, temp_min: -1, hdd: 15 },
];

const HOURLY_TODAY = [
  { hour: "00:00", temp: -8, feels: -13, code: "snow",          precip: 75 },
  { hour: "03:00", temp: -9, feels: -14, code: "snow",          precip: 80 },
  { hour: "06:00", temp: -8, feels: -13, code: "snow",          precip: 70 },
  { hour: "09:00", temp: -5, feels: -10, code: "cloudy",        precip: 40 },
  { hour: "12:00", temp: -2, feels: -7,  code: "partly_cloudy", precip: 25 },
  { hour: "15:00", temp: 2,  feels: -3,  code: "partly_cloudy", precip: 20 },
  { hour: "18:00", temp: -1, feels: -6,  code: "cloudy",        precip: 35 },
  { hour: "21:00", temp: -5, feels: -10, code: "snow",          precip: 60 },
];

const ENERGY_WEATHER_HISTORY = [
  { date: "03/25", temp: -12, hdd: 37, energy: 4820 },
  { date: "03/26", temp: -10, hdd: 35, energy: 4650 },
  { date: "03/27", temp: -7,  hdd: 32, energy: 4380 },
  { date: "03/28", temp: -3,  hdd: 28, energy: 4100 },
  { date: "03/29", temp: 0,   hdd: 23, energy: 3750 },
  { date: "03/30", temp: -5,  hdd: 30, energy: 4200 },
  { date: "03/31", temp: -6,  hdd: 31, energy: 4290 },
  { date: "04/01", temp: -4,  hdd: 29, energy: 4150 },
  { date: "04/02", temp: 1,   hdd: 24, energy: 3820, forecast: true },
  { date: "04/03", temp: 8,   hdd: 17, energy: 3100, forecast: true },
];

// ─── Weather icon SVG ─────────────────────────────────────────────────────────
function WeatherIcon({ code, size = 40, animated = false }) {
  const cls = `weather-icon-svg ${animated ? "animated" : ""}`;
  if (code === "sunny")
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} className={cls}>
        <circle cx="40" cy="40" r="16" fill="#e9c46a" className="sun-core" />
        {[0,45,90,135,180,225,270,315].map((a, i) => (
          <line key={i}
            x1={40 + Math.cos(a*Math.PI/180)*22} y1={40 + Math.sin(a*Math.PI/180)*22}
            x2={40 + Math.cos(a*Math.PI/180)*30} y2={40 + Math.sin(a*Math.PI/180)*30}
            stroke="#e9c46a" strokeWidth="3" strokeLinecap="round" />
        ))}
      </svg>
    );
  if (code === "snow")
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} className={cls}>
        <ellipse cx="42" cy="32" rx="22" ry="14" fill="#a8c5e0" opacity={0.9} />
        <ellipse cx="28" cy="36" rx="14" ry="10" fill="#c5d8ea" opacity={0.85} />
        {[35,42,49,56].map((x, i) => (
          <g key={i}>
            <line x1={x} y1="48" x2={x} y2="62" stroke="#8ec6f0" strokeWidth="2" strokeLinecap="round"/>
            <line x1={x-4} y1="53" x2={x+4} y2="53" stroke="#8ec6f0" strokeWidth="1.5" strokeLinecap="round"/>
          </g>
        ))}
      </svg>
    );
  if (code === "partly_cloudy")
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} className={cls}>
        <circle cx="28" cy="30" r="14" fill="#e9c46a" opacity={0.9} />
        {[270,315,0,45].map((a, i) => (
          <line key={i}
            x1={28 + Math.cos(a*Math.PI/180)*18} y1={30 + Math.sin(a*Math.PI/180)*18}
            x2={28 + Math.cos(a*Math.PI/180)*24} y2={30 + Math.sin(a*Math.PI/180)*24}
            stroke="#e9c46a" strokeWidth="2.5" strokeLinecap="round" />
        ))}
        <ellipse cx="50" cy="44" rx="22" ry="13" fill="#a8c5e0" opacity={0.95} />
        <ellipse cx="36" cy="48" rx="14" ry="9" fill="#c5d8ea" opacity={0.9} />
      </svg>
    );
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
      <div className="aqi-current" style={{ color }}>AQI: {aqi} — {label}</div>
    </div>
  );
}

function DayCard({ day, active, onClick, t, lang }) {
  const condKey = `cond_${day.code}`;
  return (
    <button className={`day-card ${active ? "active" : ""}`} onClick={onClick}>
      <span className="day-name">{t.weather[day.weekday_key] || day.weekday_key}</span>
      <WeatherIcon code={day.code} size={36} />
      <span className="day-cond">{t.weather[condKey] || day.code}</span>
      <span className="day-max">{day.temp_max > 0 ? "+" : ""}{day.temp_max}°</span>
      <span className="day-min">{day.temp_min}°</span>
      <div className="day-hdd">HDD: {day.hdd}</div>
    </button>
  );
}

export default function WeatherPage() {
  const { t, lang } = useLang();
  const [activeDay, setActiveDay] = useState("today");
  const [now, setNow] = useState(new Date("2026-04-01T14:23:00"));

  useEffect(() => {
    const id = setInterval(() => setNow(d => new Date(d.getTime() + 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const data = activeDay === "today" ? TODAY : TOMORROW;
  const timeStr = now.toLocaleTimeString(lang === "mn" ? "mn-MN" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateLabel = lang === "mn"
    ? `2026 оны 4-р сарын ${now.getDate()} — ${t.weather[data.weekday_key]} гараг`
    : `April ${now.getDate()}, 2026 — ${t.weather[data.weekday_key]}`;

  const impactColor = { impact_high: "#e63946", impact_medium: "#f4a261", impact_low: "#2a9d8f" }[data.impact_key] || "#3a8fd4";
  const aqiColor = data.aqi < 100 ? "#2a9d8f" : data.aqi < 150 ? "#f4a261" : "#e63946";
  const windDir = lang === "mn" ? data.wind_dir_mn : data.wind_dir_en;

  const impactDesc = data.impact_key === "impact_high"
    ? t.weather.impact_high_desc.replace("{val}", data.energy_val.toLocaleString())
    : t.weather.impact_low_desc.replace("{val}", data.energy_val.toLocaleString());

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
          </div>

          {/* Day selector */}
          <div className="day-selector">
            <button className={`day-sel-btn ${activeDay === "today" ? "active" : ""}`} onClick={() => setActiveDay("today")}>
              <CalendarDays size={15} /> {t.weather.today}
            </button>
            <button className={`day-sel-btn ${activeDay === "tomorrow" ? "active" : ""}`} onClick={() => setActiveDay("tomorrow")}>
              <CalendarDays size={15} /> {t.weather.tomorrow}
            </button>
          </div>

          {/* Main weather card */}
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
                <span style={{ color: "#e63946" }}>{data.temp_max > 0 ? "+" : ""}{data.temp_max}°</span>
                <TrendingDown size={14} style={{ color: "#3a8fd4", marginLeft: 8 }} />
                <span style={{ color: "#3a8fd4" }}>{data.temp_min}°</span>
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
                  <span className="stat-lbl">{t.weather.wind} {windDir}</span>
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

              {data.snow_chance >= 70 && (
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
            <div className="hdd-value">{data.hdd}</div>
            <div className="hdd-base">{t.weather.hdd_base}: {data.temp}°C</div>
            <div className="hdd-formula">HDD = 18 − ({data.temp}) = <strong>{18 - data.temp}</strong></div>
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
              HDD {data.hdd} → ~{Math.round(data.hdd * 143).toLocaleString()} {t.common.units_kwh}/{t.weather.city_label}
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
        {activeDay === "today" && (
          <div className="card mb-3">
            <h3 className="section-title">{t.weather.hourly_title}</h3>
            <div className="hourly-scroll">
              {HOURLY_TODAY.map(h => (
                <div key={h.hour} className={`hourly-item ${h.hour === "15:00" ? "now" : ""}`}>
                  <span className="h-time">{h.hour}</span>
                  <WeatherIcon code={h.code} size={32} />
                  <span className="h-temp">{h.temp > 0 ? "+" : ""}{h.temp}°</span>
                  <span className="h-feels">{h.feels}°</span>
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
            <DayCard day={{ ...TODAY, label: t.weather.today }} active={activeDay === "today"}
              onClick={() => setActiveDay("today")} t={t} lang={lang} />
            <DayCard day={{ ...TOMORROW, label: t.weather.tomorrow }} active={activeDay === "tomorrow"}
              onClick={() => setActiveDay("tomorrow")} t={t} lang={lang} />
            {WEEK_FORECAST.map(d => (
              <DayCard key={d.weekday_key} day={d} active={false} onClick={() => {}} t={t} lang={lang} />
            ))}
          </div>
        </div>

        {/* Energy-weather correlation chart */}
        <div className="card mb-3">
          <h3 className="section-title">{t.weather.correlation_title}</h3>
          <div className="chart-note">{t.weather.chart_note}</div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={ENERGY_WEATHER_HISTORY} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }} labelStyle={{ color: "var(--accent)" }} />
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
            <span className="fl-item"><span className="fl-dot" style={{ background: "#1a6eb5" }} />{t.weather.forecast_actual}</span>
            <span className="fl-item"><span className="fl-dot" style={{ background: "#2a9d8f" }} />{t.weather.forecast_predicted}</span>
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
              <p>{t.weather.source_desc}</p>
            </div>
            <div className="ws-badges">
              <span className="ws-badge">🕐 {timeStr}</span>
              <span className="ws-badge">📅 {t.weather.source_updated}</span>
              <span className="ws-badge">🌡️ {t.weather.city_name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
