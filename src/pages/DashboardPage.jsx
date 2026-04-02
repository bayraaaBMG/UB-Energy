import { useState } from "react";
import { useLang } from "../contexts/LanguageContext";
import {
  LayoutDashboard, AlertTriangle, TrendingUp, TrendingDown,
  Zap, Thermometer, Activity, Info, X
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Area, AreaChart
} from "recharts";
import {
  monthlyEnergyData, dailyEnergyData, yearlyEnergyData,
  featureImportanceData, shapData, modelMetrics
} from "../data/mockData";
import "./DashboardPage.css";

function MetricCard({ icon: Icon, label, value, unit, trend, color = "#3a8fd4" }) {
  return (
    <div className="metric-card card">
      <div className="mc-icon" style={{ background: `${color}22`, color }}>
        <Icon size={20} />
      </div>
      <div className="mc-content">
        <div className="mc-value">{value} <span className="mc-unit">{unit}</span></div>
        <div className="mc-label">{label}</div>
      </div>
      {trend !== undefined && (
        <div className={`mc-trend ${trend >= 0 ? "up" : "down"}`}>
          {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  );
}

function AlertBox({ title, message, onClose }) {
  return (
    <div className="alert-box animate-fade">
      <AlertTriangle size={20} />
      <div className="alert-content">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button className="alert-close" onClick={onClose}><X size={16} /></button>
    </div>
  );
}

export default function DashboardPage() {
  const { t, lang } = useLang();
  const [period, setPeriod] = useState("monthly");
  const [showAlert, setShowAlert] = useState(true);

  // Bilingual month labels for charts
  const monthlyData = monthlyEnergyData.map(d => ({ ...d, month: lang === "mn" ? d.month : d.month_en }));
  const featData    = featureImportanceData.map(d => ({ ...d, feature: lang === "mn" ? d.feature : d.feature_en }));
  const shapBiData  = shapData.map(d => ({ ...d, feature: lang === "mn" ? d.feature : d.feature_en }));

  const chartData = {
    daily:   dailyEnergyData,
    monthly: monthlyData,
    yearly:  yearlyEnergyData,
  }[period];

  const xKey = { daily: "day", monthly: "month", yearly: "year" }[period];

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="page-header flex-between" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1><LayoutDashboard size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.dashboard.title}</h1>
            <p>{t.dashboard.subtitle}</p>
          </div>
        </div>

        {showAlert && (
          <AlertBox
            title={t.dashboard.alert_title}
            message={t.dashboard.alert_msg}
            onClose={() => setShowAlert(false)}
          />
        )}

        {/* Metrics row */}
        <div className="grid grid-4 mb-3">
          <MetricCard icon={Zap} label={t.dashboard.current_usage} value="4,280" unit={t.common.units_kwh} trend={8.2} color="#e9c46a" />
          <MetricCard icon={Activity} label={t.dashboard.avg_usage} value="2,450" unit={t.common.units_kwh} trend={-2.1} color="#3a8fd4" />
          <MetricCard icon={TrendingUp} label={t.dashboard.peak_usage} value="6,100" unit={t.common.units_kwh} trend={12.5} color="#e63946" />
          <MetricCard icon={Thermometer} label={t.dashboard.temperature} value="-18" unit={t.common.units_c} trend={-5} color="#a8c5e0" />
        </div>

        {/* Main chart */}
        <div className="card mb-3">
          <div className="chart-header flex-between">
            <h3 className="section-title" style={{ marginBottom: 0 }}>{t.dashboard.energy_usage}</h3>
            <div className="period-tabs">
              {["daily", "monthly", "yearly"].map(p => (
                <button key={p} className={`period-tab ${period === p ? "active" : ""}`}
                  onClick={() => setPeriod(p)}>
                  {t.dashboard[p]}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradUsage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a6eb5" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1a6eb5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" />
              <XAxis dataKey={xKey} tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }} labelStyle={{ color: "var(--accent)" }} />
              <Legend wrapperStyle={{ color: "var(--text2)", fontSize: 12 }} />
              <Area type="monotone" dataKey="usage" fill="url(#gradUsage)" stroke="#1a6eb5" strokeWidth={2} name={t.common.usage} />
              <Line type="monotone" dataKey="predicted" stroke="#2a9d8f" strokeWidth={2} strokeDasharray="5 5" dot={false} name={t.common.predicted} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Weather correlation + Model performance */}
        <div className="grid grid-2 mb-3">
          <div className="card">
            <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.dashboard.weather_correlation}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" />
                <XAxis dataKey="month" tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }} />
                <Legend wrapperStyle={{ color: "var(--text2)", fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="usage" fill="#1a6eb5" name={t.common.usage} radius={[3, 3, 0, 0]} opacity={0.8} />
                <Line yAxisId="right" type="monotone" dataKey="hdd" stroke="#e9c46a" strokeWidth={2} dot={false} name="HDD" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.dashboard.model_performance}</h3>
            <div className="metrics-grid">
              <div className="perf-metric">
                <div className="perf-label">MAE</div>
                <div className="perf-value">{modelMetrics.mae}</div>
                <div className="perf-unit">{t.common.units_kwh}</div>
              </div>
              <div className="perf-metric">
                <div className="perf-label">RMSE</div>
                <div className="perf-value">{modelMetrics.rmse}</div>
                <div className="perf-unit">{t.common.units_kwh}</div>
              </div>
              <div className="perf-metric highlight">
                <div className="perf-label">R²</div>
                <div className="perf-value accent">{modelMetrics.r2}</div>
                <div className="perf-unit">{t.dashboard.accuracy}</div>
              </div>
              <div className="perf-metric">
                <div className="perf-label">MAPE</div>
                <div className="perf-value">{modelMetrics.mape}%</div>
                <div className="perf-unit">{t.dashboard.error_label}</div>
              </div>
            </div>
            <div className="r2-bar-wrap">
              <div className="r2-label">R² = {modelMetrics.r2} ({Math.round(modelMetrics.r2 * 100)}{t.dashboard.r2_explains})</div>
              <div className="r2-track">
                <div className="r2-fill" style={{ width: `${modelMetrics.r2 * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Feature importance + SHAP */}
        <div className="grid grid-2">
          <div className="card">
            <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.dashboard.feature_importance}</h3>
            <div className="feature-bars">
              {featData.map(({ feature, importance }) => (
                <div key={feature} className="feat-row">
                  <div className="feat-label">{feature}</div>
                  <div className="feat-track">
                    <div className="feat-fill" style={{ width: `${importance * 100}%` }} />
                  </div>
                  <div className="feat-val">{(importance * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.dashboard.shap_analysis}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shapBiData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="feature" tick={{ fill: "#a8c5e0", fontSize: 10 }} width={100} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }} />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]}
                  fill="#3a8fd4"
                  name={t.dashboard.shap_label}
                  label={{ position: "right", fill: "#6a9bbf", fontSize: 10 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
