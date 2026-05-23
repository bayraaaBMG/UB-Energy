import React, { useState } from "react";
import { useApp } from "../hooks/useApp";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, AlertTriangle, TrendingUp, TrendingDown,
  Zap, Thermometer, Activity, X,
  Building2, Database, ArrowRight,
  Download, FileText, Clock, SlidersHorizontal, Info,
  Gauge, ShieldCheck, Radio, Award, Brain, ChevronDown, ChevronUp,
  Wind, Droplets, CloudSnow, WifiOff,
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
import EnergyDualChart from "../components/charts/EnergyDualChart";
import { METRICS, ACTUAL_VS_PREDICTED, MODEL_COMPARISON, FEATURE_IMPORTANCE } from "../ml/model";
import { computeStats } from "../utils/buildingStorage";
import { useData } from "../contexts/DataContext";
import "./DashboardPage.css";

function MetricCard({ icon: Icon, label, value, unit, trend, color = "#3a8fd4", title }) {
  return (
    <div className="metric-card card" title={title}>
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

function exportPDFReport(buildings, userStats, lang) {
  const mn   = lang === "mn";
  const date = new Date().toLocaleDateString(mn ? "mn-MN" : "en-US", { dateStyle: "long" });
  const gradeColors = { A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20" };
  const retrofits = [
    { name: mn ? "Дулаалга сайжруулалт"    : "Insulation upgrade",         pct: 22, payback: 3.5 },
    { name: mn ? "3-давхар шилтэй цонх"    : "Triple-pane windows",         pct: 15, payback: 5.2 },
    { name: mn ? "Халаалтын систем"         : "Heating system retrofit",     pct: 12, payback: 4.8 },
    { name: mn ? "Хослол (дулаалга + цонх)" : "Combined (insul. + windows)", pct: 35, payback: 4.1 },
  ];
  const gradeOf = i => i < 50 ? "A" : i < 100 ? "B" : i < 150 ? "C" : i < 200 ? "D" : i < 250 ? "E" : i < 300 ? "F" : "G";

  const bldgRows = buildings.slice(0, 10).map(b => `
    <tr>
      <td>${b.name || "—"}</td>
      <td>${b.district || "—"}</td>
      <td>${b.area?.toLocaleString() || "—"} m²</td>
      <td>${b.year || "—"}</td>
      <td style="color:${gradeColors[b.grade] || '#888'};font-weight:700">${b.grade || "—"}</td>
      <td>${b.intensity || "—"} kWh/m²</td>
      <td>${Math.round(b.predicted_kwh || 0).toLocaleString()} kWh</td>
      <td>${b.co2 || "—"} t</td>
    </tr>`).join("");

  const retRows = userStats ? retrofits.map(r => {
    const newInt = Math.round(userStats.avgIntensity * (1 - r.pct / 100));
    const delta  = userStats.avgIntensity - newInt;
    const saved  = Math.round(userStats.totalAnnual * r.pct / 100);
    const co2    = Math.round(saved * 0.73 / 100) / 10;
    const ng     = gradeOf(newInt);
    return `<tr>
      <td>${r.name}</td>
      <td>−${r.pct}%</td>
      <td>${newInt} kWh/m² <span style="color:${gradeColors[ng]}">${ng}</span></td>
      <td style="color:#2a9d8f">−${delta} kWh/m²</td>
      <td style="color:#57cc99">−${co2} tCO₂</td>
      <td style="color:#3a8fd4">${r.payback} ${mn ? "жил (simple)" : "yr (simple)"}</td>
    </tr>`;
  }).join("") : "";

  const html = `<!DOCTYPE html><html lang="${mn ? "mn" : "en"}">
<head><meta charset="UTF-8"><title>UB Energy Report · ${date}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a2a3a; padding: 24px; }
  h1 { font-size: 16px; color: #1a4a7a; margin-bottom: 4px; }
  h2 { font-size: 12px; color: #1a4a7a; margin: 18px 0 6px; border-bottom: 1px solid #c0d8f0; padding-bottom: 3px; }
  .meta { font-size: 10px; color: #666; margin-bottom: 18px; }
  .disclaimer { font-size: 9px; color: #888; border: 1px solid #ddd; padding: 6px 9px; border-radius: 4px; margin-bottom: 14px; background: #fafafa; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #e8f0f8; text-align: left; padding: 4px 6px; font-size: 9.5px; border: 1px solid #c0d0e0; }
  td { padding: 3px 6px; border: 1px solid #dde; font-size: 10px; }
  tr:nth-child(even) td { background: #f5f8fc; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .sum-box { border: 1px solid #c0d8f0; border-radius: 4px; padding: 8px; text-align: center; }
  .sum-val { font-size: 16px; font-weight: 800; color: #1a4a7a; }
  .sum-lbl { font-size: 9px; color: #666; margin-top: 2px; }
  .rec-list li { padding: 2px 0; font-size: 10px; }
  @media print { body { padding: 12px; } }
</style></head>
<body>
<h1>UB Energy — ${mn ? "Эрчим хүчний урьдчилсан үнэлгээний тайлан" : "Preliminary Energy Assessment Report"}</h1>
<div class="meta">${mn ? "Огноо" : "Date"}: ${date} &nbsp;·&nbsp; ${mn ? "Загвар" : "Model"}: XGBoost Gradient Boosting (R²=${METRICS.r2}) &nbsp;·&nbsp; ${mn ? "Датасет" : "Dataset"}: 600 ${mn ? "синтетик барилга" : "synthetic buildings"}</div>
<div class="disclaimer">⚠ ${mn
  ? "Энэхүү тайлан нь урьдчилсан эрчим хүчний үнэлгээнд зориулагдсан бөгөөд дэлгэрэнгүй инженерийн аудитыг орлохгүй. Тооцоолол синтетик пилот датасет дээр суурилна (estimated)."
  : "This report is for preliminary energy assessment only and is not a substitute for a detailed engineering audit. Calculations are based on a synthetic pilot dataset (estimated)."}
</div>

${userStats ? `
<h2>${mn ? "Хэрэглэгчийн барилгуудын хураангуй" : "My Buildings — Summary"}</h2>
<div class="summary-grid">
  <div class="sum-box"><div class="sum-val">${buildings.length}</div><div class="sum-lbl">${mn ? "Барилгын тоо" : "Buildings"}</div></div>
  <div class="sum-box"><div class="sum-val" style="color:${gradeColors[userStats.grade]}">${userStats.grade}</div><div class="sum-lbl">${mn ? "Дундаж зэрэглэл" : "Avg grade"}</div></div>
  <div class="sum-box"><div class="sum-val">${userStats.avgIntensity}</div><div class="sum-lbl">kWh/m²/yr</div></div>
  <div class="sum-box"><div class="sum-val">${(userStats.totalAnnual / 1000).toFixed(1)} MWh</div><div class="sum-lbl">${mn ? "Жилийн нийт" : "Annual total"}</div></div>
</div>` : ""}

<h2>${mn ? "Барилгуудын жагсаалт" : "Building List"}</h2>
<table>
  <thead><tr>
    <th>${mn ? "Нэр" : "Name"}</th><th>${mn ? "Дүүрэг" : "District"}</th>
    <th>${mn ? "Талбай" : "Area"}</th><th>${mn ? "Он" : "Year"}</th>
    <th>${mn ? "Зэрэглэл" : "Grade"}</th><th>kWh/m²</th>
    <th>${mn ? "Жилийн kWh" : "Annual kWh"}</th><th>CO₂ (t)</th>
  </tr></thead>
  <tbody>${bldgRows || `<tr><td colspan="8" style="text-align:center;color:#888">${mn ? "Барилга байхгүй" : "No buildings"}</td></tr>`}</tbody>
</table>

${userStats ? `
<h2>${mn ? "Baseline vs Retrofit харьцуулалт" : "Baseline vs Retrofit Comparison"}</h2>
<table>
  <thead><tr>
    <th>${mn ? "Retrofit хувилбар" : "Retrofit scenario"}</th>
    <th>${mn ? "Хэмнэлт %" : "Savings %"}</th>
    <th>${mn ? "Шинэ эрч" : "New EUI"}</th>
    <th>Δ kWh/m²</th>
    <th>CO₂ ${mn ? "бууралт" : "reduction"}</th>
    <th>${mn ? "Нөхөх хугацаа" : "Payback"}</th>
  </tr></thead>
  <tbody>${retRows}</tbody>
</table>
<p style="font-size:9px;color:#888;margin-top:4px">${mn
  ? "* Simple payback (хөнгөлөлтгүй) · УБЦТС тариф ~256₮/kWh · CO₂: нүүрс 0.73 kg/kWh"
  : "* Simple payback (no discounting) · UBEG tariff ~256₮/kWh · CO₂: coal factor 0.73 kg/kWh"}</p>
` : ""}

<h2>${mn ? "Зөвлөмж" : "Recommendations"}</h2>
<ul class="rec-list">
  ${mn ? `
  <li>• Дулаалга сайжруулалт — панель барилгын хамгийн өндөр өгөөжтэй арга (−22%, 3.5 жил)</li>
  <li>• 3-давхар шилтэй цонх — дулааны алдагдлыг 15% бууруулна</li>
  <li>• Хослол retrofit — хамгийн их хэмнэлт (−35%) боловч хөрөнгө оруулалт илүү</li>
  <li>• Дэлгэрэнгүй инженерийн аудит хийлгэхийг зөвлөнө (энэ тайлан урьдчилсан үнэлгээ)</li>
  ` : `
  <li>• Insulation upgrade — highest ROI for panel buildings (−22%, 3.5 yr payback)</li>
  <li>• Triple-pane windows — reduces heat loss by 15%</li>
  <li>• Combined retrofit — highest savings (−35%) but larger upfront cost</li>
  <li>• A detailed engineering audit is recommended (this report is a preliminary screening)</li>
  `}
</ul>

<div style="margin-top:20px;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:8px">
  UB Energy Research Platform · XGBoost Gradient Boosting · ${mn ? "Монголын нөхцөлд" : "Mongolia-adapted"} · ${date}
</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

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
  const { t, lang, user } = useApp();
  const { buildings: allBuildings, weatherData, currentHdd, currentTemp, currentAqi, isOffline, isStale, weatherTs } = useData();
  usePageTitle(t.nav.dashboard);
  const [period, setPeriod]         = useState("monthly");
  const [showAlert, setShowAlert]   = useState(true);
  const [showNote, setShowNote]     = useState(true);
  const [showExplain, setShowExplain] = useState(true);
  const [districtFilter, setDistrictFilter] = useState("all");
  const [typeFilter, setTypeFilter]         = useState("all");

  const GRADE_COLORS = { A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20" };

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

  // XGBoost feature importance — normalized gain across all splits
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
            <button className="dash-export-btn" onClick={() => exportPDFReport(filteredBuildings, userStats, lang)}>
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

        {/* ── Live weather card ── */}
        {weatherData ? (
          <div className="card mb-3" style={{ padding: "0.85rem 1.1rem", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap", background: "linear-gradient(135deg, rgba(58,143,212,0.08) 0%, rgba(42,157,143,0.06) 100%)", border: "1px solid rgba(58,143,212,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 120 }}>
              <Thermometer size={18} style={{ color: "#3a8fd4" }} />
              <div>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
                  {currentTemp != null ? `${currentTemp > 0 ? "+" : ""}${currentTemp}°C` : "—"}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{lang === "mn" ? "Одоогийн температур" : "Current temp"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 100 }}>
              <Zap size={18} style={{ color: "#f4a261" }} />
              <div>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f4a261", lineHeight: 1 }}>{currentHdd}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>HDD {lang === "mn" ? "(Халааны өдөр)" : "(Heating days)"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 100 }}>
              <Wind size={18} style={{ color: "#8899aa" }} />
              <div>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{weatherData.todayData.wind} <span style={{ fontSize: "0.72rem" }}>km/h</span></div>
                <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{lang === "mn" ? "Салхи" : "Wind speed"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 100 }}>
              <CloudSnow size={18} style={{ color: currentAqi > 100 ? "#e63946" : currentAqi > 50 ? "#f4a261" : "#2a9d8f" }} />
              <div>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: currentAqi > 100 ? "#e63946" : currentAqi > 50 ? "#f4a261" : "#2a9d8f", lineHeight: 1 }}>
                  {currentAqi ?? "—"}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>AQI</div>
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              {isOffline && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "#f4a261", background: "rgba(244,162,97,0.12)", borderRadius: 6, padding: "0.25rem 0.55rem", border: "1px solid rgba(244,162,97,0.3)" }}>
                  <WifiOff size={11} /> {lang === "mn" ? "Офлайн · кэш" : "Offline · cached"}
                </span>
              )}
              {isStale && !isOffline && (
                <span style={{ fontSize: "0.68rem", color: "var(--text3)" }}>
                  {lang === "mn" ? `${Math.round((Date.now() - weatherTs) / 60000)}мин өмнө` : `${Math.round((Date.now() - weatherTs) / 60000)}min ago`}
                </span>
              )}
              <Link to="/weather" style={{ fontSize: "0.72rem", color: "#3a8fd4", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                {lang === "mn" ? "Цаг агаар" : "Weather"} <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="card mb-3" style={{ padding: "0.75rem 1.1rem", display: "flex", alignItems: "center", gap: "0.6rem", opacity: 0.6, border: "1px solid var(--border)" }}>
            <Thermometer size={16} style={{ color: "var(--text3)" }} />
            <span style={{ fontSize: "0.8rem", color: "var(--text3)" }}>{lang === "mn" ? "Цаг агаарын мэдээ ачааллаж байна…" : "Loading weather data…"}</span>
          </div>
        )}

        {/* ── User buildings summary ── */}
        {userStats ? (
          <>
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

          {/* ── ML тайлбарын хэсэг ── */}
          <div className="card usbe-card mb-0" style={{ marginTop: "0.6rem", borderTop: "1px solid var(--border)" }}>
            <button
              className="usbe-toggle"
              onClick={() => setShowExplain(s => !s)}
            >
              <Brain size={14} style={{ color: "#9b72cf" }} />
              <span>{lang === "mn"
                ? "Яагаад ийм тооцоолол гарав? — ML загварын тайлбар"
                : "Why these numbers? — ML model explanation"}</span>
              {showExplain ? <ChevronUp size={14} style={{ marginLeft: "auto", opacity: 0.5 }} />
                           : <ChevronDown size={14} style={{ marginLeft: "auto", opacity: 0.5 }} />}
            </button>

            {showExplain && (
              <div className="usbe-body">

                {/* ML загварын мэдээлэл */}
                <div className="usbe-model-row">
                  <div className="usbe-model-badge">XGB</div>
                  <div>
                    <div className="usbe-model-title">
                      {lang === "mn"
                        ? "XGBoost Gradient Boosting — Үндсэн ML загвар"
                        : "XGBoost Gradient Boosting — Main ML model in use"}
                    </div>
                    <div className="usbe-model-sub">
                      {lang === "mn"
                        ? `600 синтетик Монгол барилга дээр сургасан · R² = ${METRICS.r2} · MAE = ${METRICS.mae.toLocaleString()} kWh · MAPE = ${METRICS.mape}%`
                        : `Trained on 600 synthetic Mongolian buildings · R² = ${METRICS.r2} · MAE = ${METRICS.mae.toLocaleString()} kWh · MAPE = ${METRICS.mape}%`}
                    </div>
                    <div className="usbe-model-sub" style={{ marginTop: 2 }}>
                      {lang === "mn"
                        ? "Оролтууд: Талбай · Он · Давхар · Дулаалга · Цонх · Халаалт · Материал · HDD (30+ feature)"
                        : "Inputs: Area · Year · Floors · Insulation · Window · Heating · Material · HDD (30+ features)"}
                    </div>
                  </div>
                </div>

                {/* Барилга бүрийн тооцооллын тайлбар */}
                {userBuildings.slice(0, 3).map((b, bi) => {
                  const kw   = b.predicted_kwh || 0;
                  const area = b.area || 1;
                  const int  = b.intensity || Math.round(kw / area);
                  const grd  = b.grade || (int < 50 ? "A" : int < 100 ? "B" : int < 150 ? "C" : int < 200 ? "D" : int < 250 ? "E" : int < 300 ? "F" : "G");
                  const gradeLbl = lang === "mn"
                    ? { A:"маш үр ашигтай",B:"үр ашигтай",C:"дунд",D:"хэвийн",E:"их хэрэглээтэй",F:"маш их хэрэглээтэй",G:"хэт их" }[grd] || ""
                    : { A:"very efficient",B:"efficient",C:"average",D:"normal",E:"high usage",F:"very high",G:"extremely high" }[grd] || "";
                  const insl  = { poor: lang==="mn"?"Муу":"Poor", medium: lang==="mn"?"Дунд":"Medium", good: lang==="mn"?"Сайн":"Good" }[b.insulation_quality] || "—";
                  const win   = { single: lang==="mn"?"Нэг давхар":"Single", double: lang==="mn"?"Хос":"Double", vacuum: lang==="mn"?"Вакуум":"Vacuum" }[b.window_type] || "—";
                  const heat  = { central: lang==="mn"?"Дүүргийн":"District", local: lang==="mn"?"Орон нутаг":"Local", electric: lang==="mn"?"Цахилгаан":"Electric", gas: "Gas" }[b.heating_type] || "—";
                  const mat   = { panel: lang==="mn"?"Панель":"Panel", brick: lang==="mn"?"Тоосго":"Brick", concrete: lang==="mn"?"Бетон":"Concrete", wood: lang==="mn"?"Мод":"Wood", metal: lang==="mn"?"Метал":"Metal" }[b.wall_material] || "—";
                  return (
                    <div key={b.id} className="usbe-bldg">
                      <div className="usbe-bldg-header">
                        <Building2 size={12} style={{ color: "#3a8fd4", flexShrink: 0 }} />
                        <span className="usbe-bldg-name">{b.name || `${lang === "mn" ? "Барилга" : "Building"} ${bi + 1}`}</span>
                        {b.type && (
                          <span className="usbe-type-tag">{lang === "mn"
                            ? { apartment:"Орон сууц",office:"Оффис",school:"Сургууль",hospital:"Эмнэлэг",commercial:"Худалдаа",warehouse:"Агуулах" }[b.type] || b.type
                            : b.type}</span>
                        )}
                      </div>

                      {/* Оролтын параметрүүд */}
                      <div className="usbe-inputs">
                        {[
                          { k: lang==="mn"?"Талбай":"Area",     v: `${area.toLocaleString()} m²` },
                          { k: lang==="mn"?"Он":"Year",         v: b.year || "~1990" },
                          { k: lang==="mn"?"Давхар":"Floors",   v: `${b.floors || "?"}` },
                          { k: lang==="mn"?"Дулаалга":"Insul",  v: insl },
                          { k: lang==="mn"?"Цонх":"Window",     v: win },
                          { k: lang==="mn"?"Халаалт":"Heating", v: heat },
                          { k: lang==="mn"?"Хана":"Wall",       v: mat },
                        ].map(({ k, v }) => (
                          <span key={k} className="usbe-chip">
                            <span className="usbe-chip-k">{k}:</span>
                            <span className="usbe-chip-v">{v}</span>
                          </span>
                        ))}
                      </div>

                      {/* Тооцооллын 3 алхам */}
                      <div className="usbe-steps">
                        <div className="usbe-step">
                          <span className="usbe-snum">①</span>
                          <span className="usbe-stxt">
                            {lang === "mn"
                              ? `Эдгээр параметрийг XGBoost загварт оруулна: area=${area} m², year=${b.year||"~1990"}, floors=${b.floors||"?"}, insulation=${b.insulation_quality||"medium"}...`
                              : `Feed parameters to XGBoost: area=${area} m², year=${b.year||"~1990"}, floors=${b.floors||"?"}, insulation=${b.insulation_quality||"medium"}...`}
                          </span>
                        </div>
                        <div className="usbe-step">
                          <span className="usbe-snum">②</span>
                          <span className="usbe-stxt">
                            {lang === "mn"
                              ? `XGBoost шийдвэрийн модны ensemble таамаглал: annual_kWh = `
                              : `XGBoost decision trees ensemble prediction: annual_kWh = `}
                            <strong style={{ color: "#f4a261" }}>{kw.toLocaleString()} kWh/жил</strong>
                          </span>
                        </div>
                        <div className="usbe-step">
                          <span className="usbe-snum">③</span>
                          <span className="usbe-stxt">
                            {lang === "mn"
                              ? `Эрч = ${kw.toLocaleString()} ÷ ${area} m² = `
                              : `Intensity = ${kw.toLocaleString()} ÷ ${area} m² = `}
                            <strong style={{ color: "#9b72cf" }}>{int} kWh/m²</strong>
                            {" → "}
                            <strong style={{ color: GRADE_COLORS[grd] }}>{grd} зэрэглэл</strong>
                            <span style={{ fontSize: "0.7rem", color: "var(--text3)", marginLeft: 4 }}>({gradeLbl})</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {userBuildings.length > 3 && (
                  <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text3)", padding: "0.4rem 0" }}>
                    {lang === "mn" ? `+${userBuildings.length - 3} барилга нэмэлтэд байна` : `+${userBuildings.length - 3} more buildings`}
                  </div>
                )}

                {/* Нийт тооцооллын хураангуй */}
                <div className="usbe-summary">
                  <div className="usbe-sum-title">
                    {lang === "mn" ? "Нийт тооцооллын хураангуй" : "Summary calculation"}
                  </div>
                  <div className="usbe-sum-row">
                    <span className="usbe-sum-lbl">{lang === "mn" ? "Нийт хэрэглээ" : "Total usage"}</span>
                    <code className="usbe-sum-eq">= Σ({lang === "mn" ? "барилга бүрийн" : "each building's"} kWh)</code>
                    <span className="usbe-sum-val" style={{ color: "#f4a261" }}>{userStats.totalAnnual.toLocaleString()} kWh/жил</span>
                  </div>
                  <div className="usbe-sum-row">
                    <span className="usbe-sum-lbl">{lang === "mn" ? "Сарын дундаж" : "Monthly avg"}</span>
                    <code className="usbe-sum-eq">= {userStats.totalAnnual.toLocaleString()} ÷ 12</code>
                    <span className="usbe-sum-val" style={{ color: "#3a8fd4" }}>{userStats.avgMonthly.toLocaleString()} kWh/сар</span>
                  </div>
                  <div className="usbe-sum-row">
                    <span className="usbe-sum-lbl">{lang === "mn" ? "Дундаж эрч" : "Avg intensity"}</span>
                    <code className="usbe-sum-eq">= {userStats.totalAnnual.toLocaleString()} ÷ {userStats.totalArea.toLocaleString()} m²</code>
                    <span className="usbe-sum-val" style={{ color: GRADE_COLORS[userStats.grade] }}>
                      {userStats.avgIntensity} kWh/m² → {userStats.grade}
                    </span>
                  </div>
                </div>

                {/* Зэрэглэлийн тайлбар — bullet format */}
                {(() => {
                  const g = userStats.grade;
                  const gc = GRADE_COLORS[g];
                  const bullets = lang === "mn" ? {
                    A: ["Зэрэглэл: A · эрч < 50 kWh/m²/жил", "Үнэлгээ: Дэлхийн стандартад нийцнэ", "Зөвлөмж: Тогтмол хяналт хангалттай", "Итгэлцэл: Өндөр"],
                    B: ["Зэрэглэл: B · эрч 50–100 kWh/m²/жил", "Үнэлгээ: Монголын нөхцөлд үр ашигтай", "Зөвлөмж: Цонхны шил сайжруулаарай", "Итгэлцэл: Өндөр"],
                    C: ["Зэрэглэл: C · эрч 100–150 kWh/m²/жил", "Үнэлгээ: Дунд зэрэг — сайжруулах боломжтой", "Зөвлөмж: Дулаалга → −15–20% хэмнэлт", "Итгэлцэл: Дунд"],
                    D: ["Зэрэглэл: D · эрч 150–200 kWh/m²/жил", "Үнэлгээ: Хэвийн, шинэчлэл зөвлөгдөж байна", "Зөвлөмж: Дулаалга + цонх → −22–35% хэмнэлт", "Payback: 3–5 жил (simple)"],
                    E: ["Зэрэглэл: E · эрч 200–250 kWh/m²/жил", "Үнэлгээ: Их хэрэглээ — яаралтай анхаарна уу", "Зөвлөмж: Дулаалга + цонх + халаалт → −30–40%", "Payback: 4–6 жил (simple)"],
                    F: ["Зэрэглэл: F · эрч 250–300 kWh/m²/жил", "Үнэлгээ: Маш их хэрэглээ — яаралтай шинэчлэл", "Зөвлөмж: Цогц retrofit → CO₂ −35%+ бууруулна", "Payback: 4–7 жил (simple)"],
                    G: ["Зэрэглэл: G · эрч > 300 kWh/m²/жил", "Үнэлгээ: Хэт их — цогц шинэчлэл зайлшгүй", "Зөвлөмж: Бүрэн тусгаарлалт + халаалтын систем", "Payback: 5–8 жил (simple)"],
                  }[g] : {
                    A: ["Grade A · EUI < 50 kWh/m²/yr", "Assessment: World-class efficiency", "Recommendation: Monitor only", "Confidence: High"],
                    B: ["Grade B · EUI 50–100 kWh/m²/yr", "Assessment: Efficient by Mongolian standards", "Recommendation: Consider window glazing upgrade", "Confidence: High"],
                    C: ["Grade C · EUI 100–150 kWh/m²/yr", "Assessment: Average — improvement feasible", "Recommendation: Insulation → −15–20% savings", "Confidence: Medium"],
                    D: ["Grade D · EUI 150–200 kWh/m²/yr", "Assessment: Normal — retrofit recommended", "Recommendation: Insulation + windows → −22–35%", "Payback: 3–5 yr (simple)"],
                    E: ["Grade E · EUI 200–250 kWh/m²/yr", "Assessment: High usage — urgent attention needed", "Recommendation: Insulation + windows + heating → −30–40%", "Payback: 4–6 yr (simple)"],
                    F: ["Grade F · EUI 250–300 kWh/m²/yr", "Assessment: Very high — immediate retrofit needed", "Recommendation: Full envelope retrofit → CO₂ −35%+", "Payback: 4–7 yr (simple)"],
                    G: ["Grade G · EUI > 300 kWh/m²/yr", "Assessment: Extremely high — full retrofit essential", "Recommendation: Complete insulation + heating system", "Payback: 5–8 yr (simple)"],
                  }[g] || ["—","—","—","—"];
                  return (
                    <div className="usbe-grade-note usbe-grade-bullets" style={{ borderLeftColor: gc }}>
                      {bullets.map((line, i) => (
                        <div key={i} className={`ugb-line ${i === 0 ? "ugb-line-title" : ""}`} style={i === 0 ? { color: gc } : {}}>
                          {i > 0 && <span className="ugb-dot" style={{ background: gc }} />}
                          {line}
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>
            )}
          </div>
          </>
        ) : userBuildingCount === 0 && (
          <div className="card user-summary-empty mb-3">
            <Building2 size={20} opacity={0.3} />
            <span>{t.dashboard.no_buildings_msg}</span>
            <Link to="/data-input" className="btn btn-primary" style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}>
              {t.dashboard.add_building}
            </Link>
          </div>
        )}

        {/* ── Baseline vs Retrofit + ROI ── */}
        {userStats && (
          <div className="card mb-3 bvr-card">
            <div className="bvr-header">
              <div>
                <h3 className="section-title" style={{ marginBottom: 2, fontSize: "1rem" }}>
                  {lang === "mn" ? "Baseline vs Retrofit харьцуулалт" : "Baseline vs Retrofit Comparison"}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text3)", margin: 0 }}>
                  {lang === "mn"
                    ? "Одоогийн зэрэглэл + retrofit хувилбар бүрийн таамаглал"
                    : "Current grade vs estimated outcome per retrofit scenario"}
                </p>
              </div>
            </div>

            <div className="bvr-baseline-row">
              <span className="bvr-lbl">{lang === "mn" ? "Одоогийн (Baseline)" : "Current (Baseline)"}</span>
              <span className="bvr-int">{userStats.avgIntensity} kWh/m²/жил</span>
              <span className="bvr-grade" style={{ background: { A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20" }[userStats.grade] || "#888" }}>
                {userStats.grade}
              </span>
            </div>

            {/* BvR column headers */}
            <div className="bvr-col-headers">
              <span>{lang === "mn" ? "Retrofit хувилбар" : "Retrofit scenario"}</span>
              <span>{lang === "mn" ? "Шинэ эрч" : "New EUI"}</span>
              <span>Δ kWh/m²</span>
              <span>CO₂ {lang === "mn" ? "бууралт" : "reduction"}</span>
              <span>{lang === "mn" ? "Нөхөх хугацаа" : "Payback"}</span>
            </div>

            <div className="bvr-scenarios">
              {[
                { name: lang === "mn" ? "Дулаалга сайжруулалт"        : "Insulation upgrade",
                  pct: 22, cost: lang === "mn" ? "~₮2,500/м²"          : "~₮2,500/m²", payback: 3.5 },
                { name: lang === "mn" ? "3-давхар шилтэй цонх"         : "Triple-pane windows",
                  pct: 15, cost: lang === "mn" ? "~₮180,000/цонх"       : "~₮180k/window", payback: 5.2 },
                { name: lang === "mn" ? "Халаалтын системийг шинэчлэх" : "Heating system retrofit",
                  pct: 12, cost: lang === "mn" ? "~₮3,200,000/нэгж"     : "~₮3.2M/unit", payback: 4.8 },
                { name: lang === "mn" ? "Хослол (дулаалга + цонх)"     : "Combined (insul. + windows)",
                  pct: 35, cost: lang === "mn" ? "~₮3,000/м² нийт"      : "~₮3,000/m²", payback: 4.1 },
              ].map(({ name, pct, cost, payback }) => {
                const newInt       = Math.round(userStats.avgIntensity * (1 - pct / 100));
                const deltaInt     = userStats.avgIntensity - newInt;
                const gradeOf      = i => i < 50 ? "A" : i < 100 ? "B" : i < 150 ? "C" : i < 200 ? "D" : i < 250 ? "E" : i < 300 ? "F" : "G";
                const gradeColors  = { A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20" };
                const newGrade     = gradeOf(newInt);
                const annualSaving = Math.round(userStats.totalAnnual * pct / 100);
                const co2saved     = Math.round(annualSaving * 0.73 / 100) / 10;
                return (
                  <div key={name} className="bvr-row bvr-row-grid">
                    <span className="bvr-row-name">{name}</span>
                    <span className="bvr-eui-cell">
                      <span className="bvr-new-grade" style={{ background: gradeColors[newGrade] }}>{newGrade}</span>
                      <span className="bvr-saving">{newInt}</span>
                    </span>
                    <span className="bvr-delta">−{deltaInt} kWh/m²</span>
                    <span className="bvr-co2">−{co2saved} tCO₂/yr</span>
                    <span className="bvr-payback">{payback} {lang === "mn" ? "жил" : "yr"}</span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: "0.69rem", color: "var(--text3)", marginTop: "0.75rem", fontStyle: "italic", borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
              {lang === "mn"
                ? "* Simple payback (хөнгөлөлтгүй) · EUI загвар + УБЦТС тариф (~256₮/kWh) · CO₂: нүүрсний сүлжээний коэффициент 0.73 kg/kWh ашигласан · Бодит нөхцөл өөр байж болно."
                : "* Simple payback (no discounting, i=8% not applied) · EUI model + UBEG tariff (~256₮/kWh) · CO₂: coal grid factor 0.73 kg/kWh · Actual results may vary."}
            </p>
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
          <MetricCard icon={Activity}   label={lang === "mn" ? "Дундаж эрчим хүчний эрчим" : "Avg. Energy Intensity"} value={stats?.avgIntensity ?? "—"} unit="kWh/m²" color="#57cc99" title={lang === "mn" ? "Жилийн халааны эрчим хүчний эрчимжилт — нийт хэрэглээ ÷ нийт талбай" : "Annual heating energy intensity — total consumption ÷ total area"} />
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
              {/* UB benchmark reference */}
              <div className="gdb-benchmark">
                <div className="gdb-bm-dot" />
                <span className="gdb-bm-text">
                  {lang === "mn"
                    ? "УБ дундаж: ~180 kWh/m²/жил (D зэрэглэл) · синтетик пилот"
                    : "UB avg: ~180 kWh/m²/yr (grade D) · synthetic pilot estimate"}
                </span>
              </div>
              {stats.avgIntensity > 0 && (
                <div className="gdb-your-val" title={lang === "mn" ? "Жилийн халааны эрчим хүчний эрчимжилт" : "Annual heating energy intensity"}>
                  {lang === "mn" ? "Таны датасетийн дундаж" : "Your dataset avg"}:{" "}
                  <strong style={{ color: GRADE_COLORS[
                    stats.avgIntensity < 50 ? "A" : stats.avgIntensity < 100 ? "B" : stats.avgIntensity < 150 ? "C"
                    : stats.avgIntensity < 200 ? "D" : stats.avgIntensity < 250 ? "E" : stats.avgIntensity < 300 ? "F" : "G"
                  ] }}>{stats.avgIntensity} kWh/m²</strong>
                </div>
              )}
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
                <span style={{ width: 12, height: 12, borderRadius: 2, background: "#e63946", display: "inline-block" }} />
                {lang === "mn" ? "Дулаалга" : "Heating"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text2)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: "#1a6eb5", display: "inline-block" }} />
                {lang === "mn" ? "Цахилгаан" : "Electric"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text2)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: "#2a9d8f", display: "inline-block" }} />
                {lang === "mn" ? "Нийт" : "Total"}
              </span>
            </div>
          </div>

          <EnergyDualChart
            lang={lang}
            height={240}
            leftTitle={lang === "mn" ? "Stacked: Дулаалга + Цахилгаан = Нийт" : "Stacked: Heating + Electric = Use"}
            rightTitle={lang === "mn" ? "Сар бүрийн нийт хэрэглээ (MWh)" : "Monthly total consumption (MWh)"}
            data={monthlyData.map(d => ({
              month:    lang === "mn" ? d.month : d.month_en,
              heating:  d.heating,
              electric: d.electric,
              total:    d.usage,
            }))}
          />

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
                    {lang === "mn" ? d.month : d.month_en}
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
          {/* ── Model scorecard cards ── */}
          {(() => {
            const maxMae   = Math.max(...MODEL_COMPARISON.map(m => m.mae));
            const winnerId = MODEL_COMPARISON.reduce((a, b) => b.r2 > a.r2 ? b : a).id;
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: "0.7rem", marginBottom: "1rem" }}>
                {MODEL_COMPARISON.map(m => {
                  const isWinner = m.id === winnerId;
                  const rows = [
                    { lbl: "R²",                                                      val: m.r2,              max: 1, fmt: m.r2.toFixed(4) },
                    { lbl: lang === "mn" ? "Итгэлцлэл ±15%" : "Confidence ±15%",   val: m.confidence / 100, max: 1, fmt: `${m.confidence}%` },
                    { lbl: lang === "mn" ? "F1 оноо" : "F1 score",                 val: m.f1,              max: 1, fmt: m.f1.toFixed(4) },
                    { lbl: lang === "mn" ? "MAE (бага = сайн)" : "MAE (lower = better)", val: 1 - m.mae / maxMae, max: 1, fmt: `${m.mae.toLocaleString()} kWh` },
                    { lbl: lang === "mn" ? "MAPE (бага = сайн)" : "MAPE (lower = better)", val: 1 - m.mape / 100, max: 1, fmt: `${m.mape}%` },
                  ];
                  return (
                    <div key={m.id} style={{
                      border: `1.5px solid ${isWinner ? m.color : "rgba(255,255,255,0.09)"}`,
                      borderRadius: 10, padding: "0.8rem",
                      background: isWinner ? `${m.color}0e` : "rgba(255,255,255,0.02)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: "0.79rem", color: "var(--text)", flex: 1 }}>
                          {lang === "mn" ? m.name_mn : m.name}
                        </span>
                        {isWinner && (
                          <span style={{ fontSize: "0.63rem", background: `${m.color}28`, color: m.color, borderRadius: 5, padding: "2px 7px", fontWeight: 700 }}>
                            {lang === "mn" ? "Шилдэг" : "Best"}
                          </span>
                        )}
                      </div>
                      {rows.map(({ lbl, val, max, fmt }) => {
                        const pct = Math.max(0, Math.min(1, val / max)) * 100;
                        return (
                          <div key={lbl} style={{ marginBottom: "0.38rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.69rem", marginBottom: "0.15rem" }}>
                              <span style={{ color: "var(--text3)" }}>{lbl}</span>
                              <span style={{ color: "var(--text)", fontWeight: 600 }}>{fmt}</span>
                            </div>
                            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: m.color, borderRadius: 3 }} />
                            </div>
                          </div>
                        );
                      })}
                      <p style={{ fontSize: "0.67rem", color: "var(--text3)", marginTop: "0.45rem", marginBottom: 0, lineHeight: 1.45 }}>
                        {lang === "mn" ? m.note_mn : m.note_en}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Multi-metric grouped bar chart ── */}
          {(() => {
            const mmData = [
              { metric: "R² × 100",
                xgb:   +(MODEL_COMPARISON[0].r2 * 100).toFixed(1),
                ridge: +(MODEL_COMPARISON[1].r2 * 100).toFixed(1),
                dt:    +(MODEL_COMPARISON[2].r2 * 100).toFixed(1) },
              { metric: lang === "mn" ? "Итгэлцлэл %" : "Confidence %",
                xgb:   MODEL_COMPARISON[0].confidence,
                ridge: MODEL_COMPARISON[1].confidence,
                dt:    MODEL_COMPARISON[2].confidence },
              { metric: lang === "mn" ? "F1 × 100" : "F1 × 100",
                xgb:   +(MODEL_COMPARISON[0].f1 * 100).toFixed(1),
                ridge: +(MODEL_COMPARISON[1].f1 * 100).toFixed(1),
                dt:    +(MODEL_COMPARISON[2].f1 * 100).toFixed(1) },
              { metric: lang === "mn" ? "Хамрах %" : "Coverage %",
                xgb:   MODEL_COMPARISON[0].coverage,
                ridge: MODEL_COMPARISON[1].coverage,
                dt:    MODEL_COMPARISON[2].coverage },
            ];
            const xgbLbl   = lang === "mn" ? "XGBoost"           : "XGBoost";
            const ridgeLbl = lang === "mn" ? "Ридж Регресс"       : "Ridge Regression";
            const dtLbl    = lang === "mn" ? "Шийдвэрийн Мод"     : "Decision Tree";
            return (
              <div style={{ marginBottom: "0.8rem" }}>
                <div style={{ fontSize: "0.74rem", color: "var(--text3)", marginBottom: "0.4rem" }}>
                  {lang === "mn"
                    ? "3 загварын 4 метрикийн зэрэгцсэн харьцуулалт — бүх утга 0–100 хүртэл (R²×100, F1×100)"
                    : "Side-by-side 4-metric comparison across all 3 models — values normalized 0–100 (R²×100, F1×100)"}
                </div>
                <ResponsiveContainer width="100%" height={148}>
                  <BarChart data={mmData} margin={{ top: 4, right: 12, left: -18, bottom: 0 }} barCategoryGap="22%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" />
                    <XAxis dataKey="metric" tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }}
                      formatter={(v, name) => [`${v}`, name]}
                    />
                    <Legend wrapperStyle={{ color: "var(--text2)", fontSize: 10 }} />
                    <Bar dataKey="xgb"   name={xgbLbl}   fill="#e9c46a" radius={[3,3,0,0]} />
                    <Bar dataKey="ridge" name={ridgeLbl} fill="#2a9d8f" radius={[3,3,0,0]} />
                    <Bar dataKey="dt"    name={dtLbl}    fill="#f4a261" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
          <div className="mc-table-wrap">
            <table className="mc-table" aria-label={lang === "mn" ? "Загваруудын харьцуулалт" : "Model comparison"}>
              <caption className="visually-hidden">{lang === "mn" ? "Машин сургалтын загваруудын гүйцэтгэлийн харьцуулалт" : "Machine learning model performance comparison"}</caption>
              <thead>
                <tr>
                  <th scope="col">{lang === "mn" ? "Загвар" : "Model"}</th>
                  <th scope="col">R²</th>
                  <th scope="col">MAE <em>kWh</em></th>
                  <th scope="col">RMSE</th>
                  <th scope="col">{lang === "mn" ? "Итгэлцлэл" : "Confidence"}</th>
                  <th scope="col">F1</th>
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
              ? "Яагаад XGBoost сонгов? — Монголын нөхцөлд тохирсон шалтгаан"
              : "Why XGBoost? — Justification for Mongolian Context"}
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
                  ? `Сонгосон загвар: XGBoost Gradient Boosting  ·  R² = ${METRICS.r2}  ·  MAE = ${METRICS.mae.toLocaleString()} kWh`
                  : `Chosen model: XGBoost Gradient Boosting  ·  R² = ${METRICS.r2}  ·  MAE = ${METRICS.mae.toLocaleString()} kWh`}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.5rem" }}>
              {[
                {
                  mn: "Шугаман бус хамаарлыг барина",
                  en: "Captures non-linear patterns",
                  desc_mn: "Барилгын бүх параметрийн харилцан нөлөөллийг (interaction) автоматаар олж харна. Шугаман загваруудын давуу биш.",
                  desc_en: "Automatically finds feature interactions that linear models cannot capture — e.g. insulation × age × HDD.",
                },
                {
                  mn: "Монголын HDD-тэй сайн нийцнэ",
                  en: "Strong fit for UB climate patterns",
                  desc_mn: "УБ-ын ~4500 HDD ба барилгын нас зэрэг олон хувьсагч нь шугаман бус хамааралтай. XGBoost энийг автоматаар барина.",
                  desc_en: "UB's extreme climate creates non-linear interactions between HDD, age, and insulation that XGBoost captures well.",
                },
                {
                  mn: "Regularization дотроосоо",
                  en: "Built-in regularization",
                  desc_mn: "Subsample=0.8, min_child_weight=5 нь 600 синтетик дата дээр хэт тохируулалтаас хамгаалдаг.",
                  desc_en: "Subsample=0.8, min_child_weight=5 prevent overfitting on 600 synthetic buildings.",
                },
                {
                  mn: "Хөтөч дотор ажиллана",
                  en: "Browser-deployable",
                  desc_mn: "~30мс сургалт, backend server шаардлагагүй. Vercel дээр бүрэн ажиллана.",
                  desc_en: "~30ms training, no backend server needed. Fully deployable on Vercel.",
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
              ? "XGBoost нь Монголын барилгын эрчим хүчний физик EUI томьёотой (IEA 2022, БНТУ 23-02-09) нийцдэг, шугаман бус хамаарлыг барьж чадах, browser-deployable gradient boosting загвар юм. n=60, depth=4, eta=0.15, subsample=0.8 — хэт тохируулалтаас хамгаалсан. Бодит НЭТЭГ өгөгдөл ирэхэд параметрүүдийг шинэчлэх боломжтой."
              : "XGBoost aligns with Mongolia's physics-based EUI formula (IEA 2022, БНТУ 23-02-09), captures non-linear feature interactions, and is browser-deployable. Parameters n=60, depth=4, eta=0.15, subsample=0.8 prevent overfitting on 600 synthetic buildings. Can be retrained when real НЭТЭГ data becomes available."}
          </p>
        </div>

        {/* Feature importance + SHAP */}
        <div className="grid grid-2">
          <div className="card">
            <div className="chart-header flex-between" style={{ marginBottom: "0.75rem" }}>
              <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
                {lang === "mn" ? "XGBoost Feature Importance" : "XGBoost Feature Importance"}
              </h3>
              <span className="avp-badge" style={{ fontSize: "0.7rem" }}>
                {lang === "mn" ? "XGBoost gain" : "XGBoost gain"}
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
                ? "XGBoost-ийн нийт gain-ийн нийлбэрийг нормчилж тооцсон. Тухайн feature хуваагдалт бүрт олсон мэдээллийн ашиг. Өндөр gain = энергийн таамаглалд илүү нөлөөтэй хувьсагч."
                : "Normalized total gain across all XGBoost splits per feature. Higher gain = stronger influence on the energy prediction."}
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
                ? "Attribution proxy: β·x тооцоолол — XGBoost-ийн шинжилгээг тайлбарлах surrogate. 1200м², 1995 он, 9 давхар орон сууцны жишээ. Цэнхэр = хэрэглээ нэмэгдүүлэх, улаан = бууруулах нөлөө."
                : "Attribution proxy: β·x as interpretable surrogate for XGBoost analysis. Sample: 1200m² apartment, 1995, 9 fl. Blue = increases usage, red = reduces."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
