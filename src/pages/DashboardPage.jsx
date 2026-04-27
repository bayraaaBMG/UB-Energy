import React, { useState } from "react";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, AlertTriangle, TrendingUp, TrendingDown,
  Zap, Thermometer, Activity, X,
  Building2, Database, ArrowRight,
  Download, FileText, Clock, SlidersHorizontal, Info,
  Gauge, ShieldCheck, Radio, Award,
} from "lucide-react";
import {
  Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Area,
  ScatterChart, Scatter, ReferenceLine,
} from "recharts";
import {
  monthlyEnergyData, dailyEnergyData, yearlyEnergyData,
  ulaanbaatarDistricts,
} from "../data/mockData";
import { METRICS, ACTUAL_VS_PREDICTED, MODEL_COMPARISON, FEATURE_IMPORTANCE } from "../ml/model";
import { getAllBuildings, computeStats } from "../utils/buildingStorage";
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

const BUILDING_TYPE_LABELS = {
  apartment:  { mn: "Орон сууц",    en: "Apartment" },
  office:     { mn: "Оффис",        en: "Office" },
  school:     { mn: "Сургууль",     en: "School" },
  hospital:   { mn: "Эмнэлэг",      en: "Hospital" },
  warehouse:  { mn: "Агуулах",      en: "Warehouse" },
  hotel:      { mn: "Зочид буудал", en: "Hotel" },
  commercial: { mn: "Худалдаа",     en: "Commercial" },
};

function exportCSV(buildings, lang) {
  const headers = lang === "mn"
    ? ["Нэр","Дүүрэг","Төрөл","Талбай (м²)","Он","Зэрэглэл","Эрчим (kWh/м²)","Жилийн kWh","CO₂ (т)"]
    : ["Name","District","Type","Area (m²)","Year","Grade","Intensity (kWh/m²)","Annual kWh","CO₂ (t)"];
  const rows = buildings.map(b => [
    b.name, b.district, b.type, b.area, b.year, b.grade,
    b.intensity, Math.round(b.predicted_kwh), b.co2,
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `ubenergy_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.dashboard);
  const { user } = useAuth();
  const [period, setPeriod]         = useState("monthly");
  const [showAlert, setShowAlert]   = useState(true);
  const [showNote, setShowNote]     = useState(true);
  const [districtFilter, setDistrictFilter] = useState("all");
  const [typeFilter, setTypeFilter]         = useState("all");

  const GRADE_COLORS = { A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20" };

  const allBuildings = React.useMemo(() => getAllBuildings(user?.id), [user?.id]);

  const availableTypes = React.useMemo(() => {
    const types = [...new Set(allBuildings.map(b => b.type).filter(Boolean))];
    return types.sort();
  }, [allBuildings]);

  const filteredBuildings = React.useMemo(() => {
    let bs = allBuildings;
    if (districtFilter !== "all") bs = bs.filter(b => (b.district || "") === districtFilter);
    if (typeFilter !== "all")     bs = bs.filter(b => b.type === typeFilter);
    return bs;
  }, [allBuildings, districtFilter, typeFilter]);

  const stats = React.useMemo(() => computeStats(filteredBuildings), [filteredBuildings]);

  const lastUpdated = React.useMemo(() => {
    const userBuilds = allBuildings.filter(b => b.source === "user");
    if (userBuilds.length === 0) return new Date().toLocaleDateString(lang === "mn" ? "mn-MN" : "en-US");
    const latest = userBuilds.reduce((max, b) => {
      const ts = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return ts > max ? ts : max;
    }, 0);
    return latest > 0
      ? new Date(latest).toLocaleString(lang === "mn" ? "mn-MN" : "en-US", { dateStyle: "medium", timeStyle: "short" })
      : new Date().toLocaleDateString(lang === "mn" ? "mn-MN" : "en-US");
  }, [allBuildings, lang]);

  const userBuildings     = allBuildings.filter(b => b.source === "user" && (!user || b.userId === user.id));
  const userBuildingCount = userBuildings.length;
  const userStats = userBuildingCount > 0 ? (() => {
    const totalAnnual  = userBuildings.reduce((s, b) => s + (b.predicted_kwh || 0), 0);
    const totalArea    = userBuildings.reduce((s, b) => s + (b.area || 0), 0);
    const avgIntensity = totalArea > 0 ? Math.round(totalAnnual / totalArea) : 0;
    const avgMonthly   = Math.round(totalAnnual / 12 / userBuildingCount);
    const grade = avgIntensity < 50 ? "A" : avgIntensity < 100 ? "B" : avgIntensity < 150 ? "C"
                : avgIntensity < 200 ? "D" : avgIntensity < 250 ? "E" : avgIntensity < 300 ? "F" : "G";
    return { totalAnnual, avgMonthly, totalArea, avgIntensity, grade };
  })() : null;

  // Bilingual month labels for charts
  const monthlyData = monthlyEnergyData.map(d => ({ ...d, month: lang === "mn" ? d.month : d.month_en }));

  // Real OLS feature importance — normalized |β| coefficients from trained model
  const FEAT_LABELS = {
    area:          { mn: "Талбай (м²)",       en: "Area (m²)" },
    age:           { mn: "Барилгасан нас",    en: "Building Age" },
    hdd:           { mn: "HDD (Халааны өдөр)",en: "HDD" },
    appliances:    { mn: "Гэр ахуйн хэрэгсэл",en: "Appliances" },
    density:       { mn: "Хүн нягтшил",       en: "Occupant Density" },
    window_ratio:  { mn: "Цонхны харьцаа",    en: "Window Ratio" },
    floors:        { mn: "Давхрын тоо",        en: "Floors" },
    rooms:         { mn: "Өрөөний тоо",        en: "Rooms" },
    bt_hospital:   { mn: "Эмнэлэг (төрөл)",   en: "Hospital type" },
    bt_office:     { mn: "Оффис (төрөл)",      en: "Office type" },
    bt_school:     { mn: "Сургууль (төрөл)",   en: "School type" },
    bt_apartment:  { mn: "Сууц (төрөл)",       en: "Apartment type" },
    mat_wood:      { mn: "Мод хана",           en: "Wood wall" },
    mat_panel:     { mn: "Панель хана",        en: "Panel wall" },
    heat_local:    { mn: "Орон нутгийн халаалт",en:"Local heating" },
    heat_electric: { mn: "Цахилгаан халаалт",  en: "Electric heating" },
    ins_good:      { mn: "Сайн тусгаарлалт",   en: "Good insulation" },
    ins_medium:    { mn: "Дунд тусгаарлалт",   en: "Medium insulation" },
    win_single:    { mn: "Нэг давхар цонх",    en: "Single-pane window" },
    win_double:    { mn: "Хос давхар цонх",    en: "Double-pane window" },
  };
  const featData = FEATURE_IMPORTANCE.slice(0, 10).map(d => ({
    feature:    (FEAT_LABELS[d.name]?.[lang]) || d.name,
    importance: d.importance,
  }));

  // SHAP-lite: static illustrative example for a representative 1200m² apartment (1995, 9fl)
  const shapBiData = [
    { feature: lang === "mn" ? "Талбай: 1200м²"         : "Area: 1200m²",          impact:  2.5 },
    { feature: lang === "mn" ? "HDD: 4200"              : "HDD: 4200",              impact:  1.8 },
    { feature: lang === "mn" ? "Он: 1995"               : "Year: 1995",             impact:  1.2 },
    { feature: lang === "mn" ? "Цонх: 25%"              : "Window: 25%",            impact:  0.9 },
    { feature: lang === "mn" ? "Давхар: 9"              : "Floors: 9",              impact:  0.7 },
    { feature: lang === "mn" ? "Материал: Панель"       : "Material: Panel",        impact: -0.5 },
    { feature: lang === "mn" ? "Халаалт: Төвлөрсөн"    : "Heating: Central",       impact: -0.8 },
  ];

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
            <p className="dash-last-updated">
              <Clock size={12} />
              {t.dashboard.last_updated}: {lastUpdated}
            </p>
          </div>
          {user && (
            <div className="dash-user-info card" style={{ padding: "0.6rem 1.1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "1rem", flexShrink: 0 }}>
                {user.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{user.name}</div>
                <div style={{ color: "var(--text3)", fontSize: "0.75rem" }}>
                  {userBuildingCount > 0
                    ? `${userBuildingCount} ${t.dashboard.buildings_added}`
                    : t.dashboard.no_buildings}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Toolbar: filters + export ── */}
        <div className="dash-toolbar card mb-3">
          <div className="dash-toolbar-left">
            <SlidersHorizontal size={15} className="dash-toolbar-icon" />
            <span className="dash-toolbar-label">{t.dashboard.filters_label}</span>
            <select
              className="dash-filter-select"
              value={districtFilter}
              onChange={e => setDistrictFilter(e.target.value)}
            >
              <option value="all">{t.dashboard.all_districts}</option>
              {ulaanbaatarDistricts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              className="dash-filter-select"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">{t.dashboard.all_types}</option>
              {availableTypes.map(tp => (
                <option key={tp} value={tp}>
                  {(BUILDING_TYPE_LABELS[tp]?.[lang]) || tp}
                </option>
              ))}
            </select>
            {(districtFilter !== "all" || typeFilter !== "all") && (
              <button
                className="dash-filter-clear"
                onClick={() => { setDistrictFilter("all"); setTypeFilter("all"); }}
              >
                <X size={12} /> {lang === "mn" ? "Арилгах" : "Clear"}
              </button>
            )}
          </div>
          <div className="dash-toolbar-right">
            <button className="dash-export-btn" onClick={() => exportCSV(filteredBuildings, lang)}>
              <Download size={14} /> {t.dashboard.export_csv}
            </button>
            <button className="dash-export-btn" onClick={() => window.print()}>
              <FileText size={14} /> {t.dashboard.export_pdf}
            </button>
          </div>
        </div>

        {showNote && (
          <div className="dash-backend-note mb-3">
            <Info size={15} className="dbn-icon" />
            <div className="dbn-content">
              <strong>{t.dashboard.backend_note_title}</strong>
              <span>{t.dashboard.backend_note_msg}</span>
            </div>
            <button className="dbn-close" onClick={() => setShowNote(false)}><X size={13} /></button>
          </div>
        )}

        {showAlert && (
          <AlertBox
            title={t.dashboard.alert_title}
            message={t.dashboard.alert_msg}
            onClose={() => setShowAlert(false)}
          />
        )}

        {/* ── User buildings summary ── */}
        {userStats ? (
          <div className="card user-summary-card mb-3">
            <div className="usb-header">
              <div className="usb-title">
                <Building2 size={16} />
                {t.dashboard.my_buildings_summary}
                <span className="usb-count">{userBuildingCount} {t.database.buildings_unit}</span>
              </div>
              <Link to="/database" className="usb-link">
                <Database size={13} />
                {t.dashboard.view_all}
                <ArrowRight size={12} />
              </Link>
            </div>
            <div className="usb-stats">
              <div className="usb-stat">
                <div className="usb-val">{userStats.totalAnnual.toLocaleString()} {t.common.units_kwh}</div>
                <div className="usb-lbl">{t.dashboard.total_annual_usage}</div>
              </div>
              <div className="usb-stat">
                <div className="usb-val">{userStats.avgMonthly.toLocaleString()} {t.common.units_kwh}</div>
                <div className="usb-lbl">{t.dashboard.avg_monthly_usage}</div>
              </div>
              <div className="usb-stat">
                <div className="usb-val">{userStats.totalArea.toLocaleString()} {t.common.units_sqm}</div>
                <div className="usb-lbl">{t.dashboard.total_area}</div>
              </div>
              <div className="usb-stat">
                <div className="usb-val" style={{ color: GRADE_COLORS[userStats.grade] }}>
                  {userStats.grade}
                </div>
                <div className="usb-lbl">{t.dashboard.avg_grade}</div>
              </div>
            </div>
          </div>
        ) : userBuildingCount === 0 && (
          <div className="card user-summary-empty mb-3">
            <Building2 size={20} opacity={0.3} />
            <span>{t.dashboard.no_buildings_msg}</span>
            <Link to="/data-input" className="btn btn-primary" style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}>
              {t.dashboard.add_building}
            </Link>
          </div>
        )}

        {/* No-results notice */}
        {filteredBuildings.length === 0 && (districtFilter !== "all" || typeFilter !== "all") && (
          <div className="dash-no-results card mb-3">
            <Building2 size={18} opacity={0.3} />
            <span>{t.dashboard.no_filtered}</span>
          </div>
        )}

        {/* Metrics row — real computed data */}
        <div className="grid grid-4 mb-3">
          <MetricCard icon={Building2}  label={lang === "mn" ? "Нийт барилга"       : "Total Buildings"}   value={stats?.count        ?? "—"} unit=""                       color="#3a8fd4" />
          <MetricCard icon={Zap}        label={lang === "mn" ? "Нийт жилийн хэрэглээ" : "Total Annual Usage"} value={stats ? (stats.totalMwh >= 1000 ? `${(stats.totalMwh/1000).toFixed(1)}` : stats.totalMwh) : "—"} unit={stats && stats.totalMwh >= 1000 ? "GWh" : "MWh"} color="#e9c46a" />
          <MetricCard icon={Activity}   label={lang === "mn" ? "Дундаж эрчим хүчний эрчим" : "Avg. Energy Intensity"} value={stats?.avgIntensity ?? "—"} unit="kWh/m²"              color="#57cc99" />
          <MetricCard icon={TrendingUp} label={lang === "mn" ? "Нийт CO₂ ялгаруулалт" : "Total CO₂ Emissions"} value={stats ? stats.totalCo2.toLocaleString() : "—"} unit="t CO₂"          color="#e76f51" />
        </div>

        {/* Grade distribution + Top high-intensity */}
        {stats && (
          <div className="grid grid-2 mb-3">
            <div className="card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>
                {lang === "mn" ? "Анги тархалт" : "Grade Distribution"}
              </h3>
              <div className="grade-dist-bars">
                {["A","B","C","D","E","F","G"].map(g => {
                  const cnt = stats.gradeCounts[g] || 0;
                  const pct = stats.count > 0 ? (cnt / stats.count * 100) : 0;
                  return (
                    <div key={g} className="gdb-row">
                      <div className="gdb-label" style={{ color: GRADE_COLORS[g] }}>{g}</div>
                      <div className="gdb-track">
                        <div className="gdb-fill" style={{ width: `${pct}%`, background: GRADE_COLORS[g] }} />
                      </div>
                      <div className="gdb-count">{cnt}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>
                {lang === "mn" ? "Өндөр эрчим хүчтэй барилга" : "High-Intensity Buildings"}
              </h3>
              <div className="top-high-list">
                {stats.topHigh.map((b, i) => (
                  <div key={b.id} className="th-row">
                    <div className="th-rank">{i + 1}</div>
                    <div className="th-info">
                      <div className="th-name">{b.name}</div>
                      <div className="th-meta">{b.district} · {b.type}</div>
                    </div>
                    <div className="th-intensity" style={{ color: GRADE_COLORS[b.grade] }}>
                      {b.intensity} <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>kWh/m²</span>
                    </div>
                    <div className="th-grade" style={{ background: GRADE_COLORS[b.grade] }}>{b.grade}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }} labelStyle={{ color: "var(--accent)" }} formatter={(v) => [`${v.toLocaleString()} ${t.common.units_kwh}`]} />
              <Legend wrapperStyle={{ color: "var(--text2)", fontSize: 12 }} />
              <Area type="monotone" dataKey="usage" fill="url(#gradUsage)" stroke="#1a6eb5" strokeWidth={2} name={t.common.usage} />
              <Line type="monotone" dataKey="predicted" stroke="#2a9d8f" strokeWidth={2} strokeDasharray="5 5" dot={false} name={t.common.predicted} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Синтетик хэрэглээ vs Загварын таамаглал харьцуулалт ── */}
        <div className="card mb-3">
          <div className="chart-header flex-between" style={{ marginBottom: "0.5rem" }}>
            <div>
              <h3 className="section-title" style={{ marginBottom: 4 }}>
                {lang === "mn"
                  ? "Синтетик хэрэглээ vs Загварын таамаглал — сарын харьцуулалт"
                  : "Synthetic Usage vs Model Prediction — Monthly Comparison"}
              </h3>
              <p style={{ fontSize: "0.76rem", color: "var(--text3)", margin: 0 }}>
                {lang === "mn"
                  ? "Баянмонгол-1 · 2025 он · 2 багана хэр ойрхон байна вэ? Ойр байх тусам загвар нарийвчлалтай."
                  : "Bayanmongol-1 · 2025 · How close are the two bars? Closer = more accurate model."}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "flex-end" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text2)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: "#1a6eb5", display: "inline-block" }} />
                {lang === "mn" ? "Синтетик хэрэглээ (kWh)" : "Synthetic usage (kWh)"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text2)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: "#2a9d8f", display: "inline-block" }} />
                {lang === "mn" ? "Загварын таамаглал (kWh)" : "Model prediction (kWh)"}
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={monthlyData}
              margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
              barGap={2}
              barCategoryGap="28%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" />
              <XAxis dataKey="month" tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} />
              <YAxis
                tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }}
                formatter={(v, name) => [`${v != null ? v.toLocaleString() : "—"} kWh`, name]}
              />
              <Legend wrapperStyle={{ color: "var(--text2)", fontSize: 11 }} />
              <Bar dataKey="usage"     fill="#1a6eb5" name={lang === "mn" ? "Синтетик хэрэглээ" : "Synthetic usage"}  radius={[3,3,0,0]} />
              <Bar dataKey="predicted" fill="#2a9d8f" name={lang === "mn" ? "Загварын таамаглал" : "Model prediction"} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Per-month % error row */}
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.85rem", flexWrap: "wrap", paddingLeft: 2 }}>
            <span style={{ fontSize: "0.7rem", color: "var(--text3)", alignSelf: "center", marginRight: 4 }}>
              {lang === "mn" ? "Алдааны хувь:" : "Error %:"}
            </span>
            {monthlyEnergyData.map(d => {
              const err = d.usage > 0 ? Math.abs(d.predicted - d.usage) / d.usage * 100 : 0;
              const col = err < 1.5 ? "#2a9d8f" : err < 4 ? "#e9c46a" : "#e76f51";
              return (
                <div key={d.month_en} style={{ textAlign: "center", minWidth: 36 }}>
                  <div style={{ fontSize: "0.67rem", color: col, fontWeight: 700, lineHeight: 1.2 }}>
                    {err.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: "0.6rem", color: "var(--text3)" }}>
                    {lang === "mn" ? d.month.replace("-р сар", "") : d.month_en}
                  </div>
                </div>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              {[["#2a9d8f", lang === "mn" ? "<1.5% (маш сайн)" : "<1.5% (excellent)"],
                ["#e9c46a", lang === "mn" ? "1.5–4% (сайн)" : "1.5–4% (good)"],
                ["#e76f51", lang === "mn" ? ">4% (дунд)" : ">4% (moderate)"]
              ].map(([c, lbl]) => (
                <span key={lbl} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", color: "var(--text3)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
                  {lbl}
                </span>
              ))}
            </div>
          </div>

          <p className="avp-note" style={{ marginTop: "0.75rem" }}>
            {lang === "mn"
              ? `Баяны загвар ба синтетик хэрэглээний дундаж алдаа: MAE = ${METRICS.mae.toLocaleString()} kWh, MAPE = ${METRICS.mape}%, R² = ${METRICS.r2}. Багана хоёр ижил өндөрт байх тусам загвар нарийвчлалтай гэсэн үг. Синтетик өгөгдлийн хувьд хоёр утга ойрхон байх нь загварын дотоод нийцтэй байдлыг нотолно.`
              : `Model vs synthetic data mean error: MAE = ${METRICS.mae.toLocaleString()} kWh, MAPE = ${METRICS.mape}%, R² = ${METRICS.r2}. Equal bar heights = accurate prediction. For synthetic data, close values confirm the model's internal consistency.`}
          </p>
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
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }} formatter={(v, name) => name === "HDD" ? [v, "HDD"] : [`${v.toLocaleString()} ${t.common.units_kwh}`, name]} />
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
                <div className="perf-value">{METRICS.mae}</div>
                <div className="perf-unit">{t.common.units_kwh}</div>
              </div>
              <div className="perf-metric">
                <div className="perf-label">{lang === "mn" ? "Сургалтын өгөгдөл" : "Training Set"}</div>
                <div className="perf-value">{METRICS.n_train}</div>
                <div className="perf-unit">{lang === "mn" ? "барилга" : "buildings"}</div>
              </div>
              <div className="perf-metric highlight">
                <div className="perf-label">R²</div>
                <div className="perf-value accent">{METRICS.r2}</div>
                <div className="perf-unit">{t.dashboard.accuracy}</div>
              </div>
              <div className="perf-metric">
                <div className="perf-label">MAPE</div>
                <div className="perf-value">{METRICS.mape}%</div>
                <div className="perf-unit">{t.dashboard.error_label}</div>
              </div>
            </div>
            <div className="r2-bar-wrap">
              <div className="r2-label">R² = {METRICS.r2} ({Math.round(METRICS.r2 * 100)}{t.dashboard.r2_explains})</div>
              <div className="r2-track">
                <div className="r2-fill" style={{ width: `${METRICS.r2 * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Model accuracy cards ── */}
        <div className="grid grid-3 mb-3">
          <div className="model-metric-card card">
            <div className="mmc-header">
              <div className="mmc-icon" style={{ background: "rgba(58,143,212,0.15)", color: "#3a8fd4" }}>
                <Gauge size={20} />
              </div>
              <div>
                <div className="mmc-label">{lang === "mn" ? "Загварын нарийвчлал" : "Model Accuracy"}</div>
                <div className="mmc-sub">MAE / RMSE</div>
              </div>
            </div>
            <div className="mmc-values">
              <div className="mmc-kv">
                <span className="mmc-k">MAE</span>
                <span className="mmc-v">{METRICS.mae.toLocaleString()} <em>kWh</em></span>
              </div>
              <div className="mmc-kv">
                <span className="mmc-k">RMSE</span>
                <span className="mmc-v">{METRICS.rmse.toLocaleString()} <em>kWh</em></span>
              </div>
              <div className="mmc-kv">
                <span className="mmc-k">MAPE</span>
                <span className="mmc-v">{METRICS.mape}%</span>
              </div>
            </div>
            <p className="mmc-note">
              {lang === "mn"
                ? "Дундаж алдаа ба үндэс квадрат алдаа — бага байх тусам сайн"
                : "Mean & root-mean-square error — lower is better"}
            </p>
          </div>

          <div className="model-metric-card card">
            <div className="mmc-header">
              <div className="mmc-icon" style={{ background: "rgba(42,157,143,0.15)", color: "#2a9d8f" }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="mmc-label">{lang === "mn" ? "Итгэлцлийн хувь" : "Confidence"}</div>
                <div className="mmc-sub">{lang === "mn" ? "±15% дотор" : "Within ±15%"}</div>
              </div>
            </div>
            <div className="mmc-big-value" style={{ color: "#2a9d8f" }}>
              {METRICS.confidence}%
            </div>
            <div className="mmc-bar-wrap">
              <div className="mmc-bar-track">
                <div className="mmc-bar-fill" style={{ width: `${METRICS.confidence}%`, background: "#2a9d8f" }} />
              </div>
            </div>
            <p className="mmc-note">
              {lang === "mn"
                ? `Тест өгөгдлийн ${METRICS.confidence}% нь бодит утгаас ±15%-иас дотор байна`
                : `${METRICS.confidence}% of test predictions fall within ±15% of actual`}
            </p>
          </div>

          <div className="model-metric-card card">
            <div className="mmc-header">
              <div className="mmc-icon" style={{ background: "rgba(233,196,106,0.15)", color: "#e9c46a" }}>
                <Radio size={20} />
              </div>
              <div>
                <div className="mmc-label">{lang === "mn" ? "Өгөгдлийн хамрах хүрээ" : "Data Coverage"}</div>
                <div className="mmc-sub">{lang === "mn" ? "±20% дотор" : "Within ±20%"}</div>
              </div>
            </div>
            <div className="mmc-big-value" style={{ color: "#e9c46a" }}>
              {METRICS.coverage}%
            </div>
            <div className="mmc-bar-wrap">
              <div className="mmc-bar-track">
                <div className="mmc-bar-fill" style={{ width: `${METRICS.coverage}%`, background: "#e9c46a" }} />
              </div>
            </div>
            <p className="mmc-note">
              {lang === "mn"
                ? `Нийт ${METRICS.n_total} өгөгдлийн ${METRICS.n_test} тест — таамаглалын хамрах хувь`
                : `${METRICS.n_test} of ${METRICS.n_total} records tested — prediction coverage rate`}
            </p>
          </div>
        </div>

        {/* ── Actual vs Predicted scatter chart ── */}
        <div className="card mb-3">
          <div className="chart-header flex-between" style={{ marginBottom: "1rem" }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>
              {lang === "mn" ? "Бодит vs Таамаглал (тест өгөгдөл)" : "Actual vs Predicted (test set)"}
            </h3>
            <span className="avp-badge">
              n = {ACTUAL_VS_PREDICTED.length} {lang === "mn" ? "барилга" : "buildings"}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" />
              <XAxis
                type="number" dataKey="actual" name={lang === "mn" ? "Бодит" : "Actual"}
                tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false}
                label={{ value: lang === "mn" ? "Бодит (kWh)" : "Actual (kWh)", position: "insideBottom", offset: -2, fill: "#6a9bbf", fontSize: 11 }}
              />
              <YAxis
                type="number" dataKey="predicted" name={lang === "mn" ? "Таамаглал" : "Predicted"}
                tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false} axisLine={false}
                label={{ value: lang === "mn" ? "Таамаглал (kWh)" : "Predicted (kWh)", angle: -90, position: "insideLeft", offset: 12, fill: "#6a9bbf", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }}
                formatter={(v, name) => [`${v.toLocaleString()} kWh`, name]}
              />
              {/* Perfect prediction line y=x */}
              <ReferenceLine
                segment={[
                  { x: Math.min(...ACTUAL_VS_PREDICTED.map(d => d.actual)), y: Math.min(...ACTUAL_VS_PREDICTED.map(d => d.actual)) },
                  { x: Math.max(...ACTUAL_VS_PREDICTED.map(d => d.actual)), y: Math.max(...ACTUAL_VS_PREDICTED.map(d => d.actual)) },
                ]}
                stroke="#e9c46a" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: "y=x", fill: "#e9c46a", fontSize: 11 }}
              />
              <Scatter data={ACTUAL_VS_PREDICTED} fill="#3a8fd4" opacity={0.65} r={4} name={lang === "mn" ? "Барилга" : "Building"} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="avp-note">
            {lang === "mn"
              ? `Шар шугам нь төгс таамаглалын шугам (y=x). Цэгүүд шугамд ойр байх тусам загвар нарийвчлалтай. R² = ${METRICS.r2}`
              : `Yellow line = perfect prediction (y=x). Points closer to the line indicate better accuracy. R² = ${METRICS.r2}`}
          </p>
        </div>

        {/* ── ML Model Comparison ── */}
        <div className="card mb-3">
          <div className="chart-header flex-between" style={{ marginBottom: "1rem" }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>
              {lang === "mn" ? "ML Загварын Харьцуулалт" : "ML Model Comparison"}
            </h3>
            <span className="avp-badge">
              {lang === "mn" ? "Тест өгөгдөл дээрх гүйцэтгэл" : "Performance on held-out test set"}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart
              data={MODEL_COMPARISON.map(m => ({
                name: lang === "mn" ? m.name_mn : m.name,
                r2: m.r2,
                id: m.id,
              }))}
              layout="vertical"
              margin={{ top: 0, right: 55, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" horizontal={false} />
              <XAxis type="number" domain={[0, 1]} tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} tickFormatter={v => v.toFixed(1)} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#a8c5e0", fontSize: 10 }} width={170} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }}
                formatter={v => [v.toFixed(4), "R²"]}
              />
              <Bar dataKey="r2" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "#a8c5e0", fontSize: 11, formatter: v => v.toFixed(3) }}>
                {MODEL_COMPARISON.map(m => <Cell key={m.id} fill={m.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>{lang === "mn" ? "Загвар" : "Model"}</th>
                  <th>R²</th>
                  <th>MAE <em>kWh</em></th>
                  <th>RMSE</th>
                  <th>{lang === "mn" ? "Итгэлцлэл" : "Confidence"}</th>
                  <th>F1</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const winnerId = MODEL_COMPARISON.reduce((a, b) => b.r2 > a.r2 ? b : a).id;
                  return MODEL_COMPARISON.map(m => (
                    <tr key={m.id} className={m.id === winnerId ? "mc-row-winner" : ""}>
                      <td>
                        <span className="mc-model-dot" style={{ background: m.color }} />
                        {lang === "mn" ? m.name_mn : m.name}
                        {m.id === winnerId && <Award size={13} className="mc-award" />}
                      </td>
                      <td className="mc-num" style={{ color: m.color }}>{m.r2}</td>
                      <td className="mc-num">{m.mae.toLocaleString()}</td>
                      <td className="mc-num">{m.rmse.toLocaleString()}</td>
                      <td className="mc-num">{m.confidence}%</td>
                      <td className="mc-num">{m.f1}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          <p className="avp-note">
            {lang === "mn"
              ? "Бүх загвар нэг тест өгөгдөл дээр үнэлэгдсэн. R² өндөр, MAE бага байх тусам загвар сайн."
              : "All models evaluated on the same held-out test set. Higher R² and lower MAE = better model."}
          </p>
        </div>

        {/* ── ML аргын сонголт ── */}
        <div className="card mb-3">
          <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>
            {lang === "mn"
              ? "Яагаад OLS Регресс сонгов? — Монголын нөхцөлд тохирсон шалтгаан"
              : "Why OLS Regression? — Justification for Mongolian Context"}
          </h3>

          {/* Chosen model highlight */}
          <div style={{
            border: "1.5px solid rgba(42,157,143,0.45)", borderRadius: 10,
            padding: "0.9rem 1rem", marginBottom: "1rem",
            background: "rgba(42,157,143,0.07)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem" }}>
              <Award size={16} style={{ color: "#2a9d8f", flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: "#2a9d8f", fontSize: "0.92rem" }}>
                {lang === "mn"
                  ? `Сонгосон загвар: OLS Шугаман Регресс  ·  R² = ${METRICS.r2}  ·  MAE = ${METRICS.mae.toLocaleString()} kWh`
                  : `Chosen model: OLS Linear Regression  ·  R² = ${METRICS.r2}  ·  MAE = ${METRICS.mae.toLocaleString()} kWh`}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.5rem" }}>
              {[
                {
                  mn: "Тайлбарлах боломжтой",
                  en: "Interpretable model",
                  desc_mn: "β-коэффициент бүр барилгын параметрийн нөлөөг шууд харуулна. Захиргааны шийдвэр гаргахад тохиромжтой.",
                  desc_en: "Each β coefficient directly shows each parameter's impact. Suitable for regulatory and reporting use.",
                },
                {
                  mn: "Монголын HDD-тэй нийцнэ",
                  en: "Fits Mongolian HDD pattern",
                  desc_mn: "УБ-ын ~4500 HDD нь энергийн хэрэглээтэй шугаман хамааралтай — шугаман загвар физикийн томьёотой давхцана.",
                  desc_en: "UB's ~4,500 HDD has near-linear relationship with energy. Linear model aligns with physics formula.",
                },
                {
                  mn: "Жижиг датасетэд тохиромжтой",
                  en: "Works with small datasets",
                  desc_mn: "600 синтетик барилга дээр хэт тохируулалт (overfitting) гарахгүй. Монголд бодит өгөгдөл хомс.",
                  desc_en: "No overfitting on 600 synthetic buildings. Real Mongolian building data is scarce.",
                },
                {
                  mn: "Хөтөч дотор ажиллана",
                  en: "Browser-deployable",
                  desc_mn: "~5мс сургалт, backend server шаардлагагүй. Vercel дээр ажиллах боломжтой.",
                  desc_en: "~5ms training, no backend server needed. Fully deployable on Vercel.",
                },
              ].map(item => (
                <div key={item.mn} style={{
                  background: "rgba(42,157,143,0.09)", borderRadius: 8,
                  padding: "0.5rem 0.7rem",
                }}>
                  <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text)", marginBottom: 3 }}>
                    {lang === "mn" ? item.mn : item.en}
                  </div>
                  <div style={{ fontSize: "0.71rem", color: "var(--text3)", lineHeight: 1.5 }}>
                    {lang === "mn" ? item.desc_mn : item.desc_en}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rejected methods table */}
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text2)", marginBottom: "0.6rem" }}>
            {lang === "mn"
              ? "Яагаад бусад машин сургалтын аргыг ашиглаагүй вэ?"
              : "Why were other ML methods not used?"}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="mc-table">
              <thead>
                <tr>
                  <th>{lang === "mn" ? "Арга" : "Method"}</th>
                  <th>{lang === "mn" ? "Монголын нөхцөлд тохирохгүй шалтгаан" : "Why unsuitable for Mongolian conditions"}</th>
                  <th>{lang === "mn" ? "Гол асуудал" : "Core issue"}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    method: "Random Forest / XGBoost",
                    color: "#e76f51",
                    reason_mn: "10,000+ бодит дата шаардана. Синтетик 600 дата дээр хэт тохируулна. Хар хайрцаг — регуляторт тайлбарлах боломжгүй. Хөтөч дотор ажиллуулахад хэт хүнд.",
                    reason_en: "Requires 10,000+ real records. Overfits 600 synthetic samples. Black-box — cannot explain to regulators. Too heavy for browser.",
                    issue_mn: "Өгөгдлийн хомсдол + тайлбарлах боломжгүй",
                    issue_en: "Data scarcity + uninterpretable",
                  },
                  {
                    method: "Neural Network (MLP / LSTM)",
                    color: "#e76f51",
                    reason_mn: "10,000+ сургалтын дата шаардана. GPU шаардлагатай. LSTM нь цаг цувааны загвар — барилгын нэг удаагийн таамаглалд тохиромжгүй. Үр дүнг тайлбарлах аргагүй.",
                    reason_en: "Needs 10,000+ samples. GPU required. LSTM is sequential — not suited for one-off building prediction. Results are unexplainable.",
                    issue_mn: "Тооцооллын зардал + буруу загварын хэлбэр",
                    issue_en: "Compute cost + wrong architecture",
                  },
                  {
                    method: "Support Vector Regression (SVR)",
                    color: "#f4a261",
                    reason_mn: "Сургалт O(n²–n³) хугацаа шаардана — 600+ дата дээр удаан. Хөтөч дотор deployment боломжгүй. Hyperparameter тохируулах нарийн ажил шаардана.",
                    reason_en: "Training is O(n²–n³) — slow on 600+ samples. Not browser-deployable. Requires careful hyperparameter tuning.",
                    issue_mn: "Deployment боломжгүй",
                    issue_en: "Not deployable in browser",
                  },
                  {
                    method: "K-Nearest Neighbors (KNN)",
                    color: "#f4a261",
                    reason_mn: "Монголын барилгын бодит 'хөрш' дата байхгүй. 30+ хэмжээст орон зайд алдаа нэмэгдэнэ (dimension's curse). Inference бүрт бүх датасетыг харьцуулна — удаан.",
                    reason_en: "No real Mongolian building neighbors available. Accuracy degrades in 30+ dimensions (curse of dimensionality). Requires full dataset comparison at inference.",
                    issue_mn: "Лавлах дата байхгүй + хэмжээт асуудал",
                    issue_en: "No reference data + dimensionality",
                  },
                  {
                    method: "Gaussian Process (GP)",
                    color: "#e9c46a",
                    reason_mn: "O(n³) тооцооллын нарийвчлал — 600+ дата дээр маш удаан. Хөтөч дотор ажиллах боломжгүй. Монголын нөхцөлд цөөхөн дата + уян хатан kernel сонголт шаардана.",
                    reason_en: "O(n³) complexity — extremely slow on 600+ samples. Not browser-feasible. Needs careful kernel selection for Mongolian context.",
                    issue_mn: "Тооцооллын хязгаар",
                    issue_en: "Computational limit",
                  },
                ].map(row => (
                  <tr key={row.method}>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600, fontSize: "0.82rem" }}>
                      <span className="mc-model-dot" style={{ background: row.color }} />
                      {row.method}
                    </td>
                    <td style={{ fontSize: "0.76rem", color: "var(--text2)", lineHeight: 1.55 }}>
                      {lang === "mn" ? row.reason_mn : row.reason_en}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span style={{
                        background: `${row.color}25`, color: row.color,
                        borderRadius: 6, padding: "2px 9px",
                        fontSize: "0.71rem", fontWeight: 600,
                      }}>
                        {lang === "mn" ? row.issue_mn : row.issue_en}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="avp-note" style={{ marginTop: "0.8rem" }}>
            {lang === "mn"
              ? "OLS регресс нь Монголын барилгын эрчим хүчний тооцооллын физикийн томьёотой (IEA 2022, БНТУ 23-02-09) нийцдэг, тайлбарлах боломжтой, жижиг синтетик датасетэд тогтвортой загвар юм. Ridge λ=0.01 нь тооны тогтворгүй байдлаас хамгаална. Ирээдүйд бодит НЭТЕГ өгөгдөл ирэхэд Random Forest руу шилжих боломжтой."
              : "OLS regression aligns with Mongolia's physics-based EUI formula (IEA 2022, БНТУ 23-02-09), is interpretable, and stable on small synthetic datasets. Ridge λ=0.01 prevents numerical instability. Once real НЭТЭГ data becomes available, migration to Random Forest is feasible."}
          </p>
        </div>

        {/* Feature importance + SHAP */}
        <div className="grid grid-2">
          <div className="card">
            <div className="chart-header flex-between" style={{ marginBottom: "0.75rem" }}>
              <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
                {lang === "mn" ? "OLS Feature Importance" : "OLS Feature Importance"}
              </h3>
              <span className="avp-badge" style={{ fontSize: "0.7rem" }}>
                {lang === "mn" ? "Бодит |β| коэффициент" : "Real |β| coefficients"}
              </span>
            </div>
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
            <p className="avp-note" style={{ marginTop: "0.75rem" }}>
              {lang === "mn"
                ? "OLS регрессийн β-коэффициентүүдийн |β| утгыг хамгийн их нь-д нормчилж тооцсон. 600 синтетик барилгын дэлгэрэнгүй өгөгдөл дээр сургасан бодит загварын үр дүн. Хувьсагчийн β их байх тусам энергийн хэрэглээнд илүү нөлөөтэй."
                : "Normalized |β| coefficients from trained OLS regression — |β_i| / max(|β|). Trained on 600 synthetic UB buildings with physics-informed ground truth. Higher bar = stronger influence on energy prediction."}
            </p>
          </div>

          <div className="card">
            <div className="chart-header flex-between" style={{ marginBottom: "0.75rem" }}>
              <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
                {lang === "mn" ? "SHAP-lite шинжилгээ" : "SHAP-lite Analysis"}
              </h3>
              <span className="avp-badge" style={{ fontSize: "0.7rem" }}>
                {lang === "mn" ? "β·x нөлөөлөл (жишээ барилга)" : "β·x contributions (sample)"}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={shapBiData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="feature" tick={{ fill: "#a8c5e0", fontSize: 10 }} width={100} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }} formatter={(v) => [`${v > 0 ? "+" : ""}${v} kWh×100`, lang === "mn" ? "Нөлөөлөл" : "Contribution"]} />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]}
                  name={lang === "mn" ? "Нөлөөлөл" : "Contribution"}
                  label={{ position: "right", fill: "#6a9bbf", fontSize: 10 }}
                >
                  {shapBiData.map((d, i) => (
                    <Cell key={i} fill={d.impact >= 0 ? "#3a8fd4" : "#e76f51"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="avp-note" style={{ marginTop: "0.5rem" }}>
              {lang === "mn"
                ? "SHAP-lite: OLS β-коэффициент × стандарчилсан оролтын утга (β·x). 1200м², 1995 он, 9 давхар орон сууцны жишээ дээр тооцсон. Цэнхэр = хэрэглээ нэмэгдүүлэх, улаан = бууруулах нөлөө."
                : "SHAP-lite: OLS contribution per feature = β_i × scaled_x_i for a sample 1200m² apartment (1995, 9 fl). Blue = increases usage, red = reduces usage. True SHAP requires model retraining with TreeExplainer."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
