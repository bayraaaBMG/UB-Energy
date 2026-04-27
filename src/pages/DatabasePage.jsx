import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useConfirm } from "../hooks/useConfirm";
import { useAuth } from "../contexts/AuthContext";
import {
  Database, Download, Search, Trash2, Filter, UserCheck,
  BarChart2, Zap, Ruler, TrendingUp, TrendingDown,
  CheckCircle, Lightbulb, ChevronsUpDown, ChevronUp, ChevronDown, X, Star,
  History, Clock, Info, ChevronRight, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, ComposedChart, Line, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { monthlyEnergyData, yearlyEnergyData } from "../data/mockData";
import { getAllBuildings, deleteUserBuilding } from "../utils/buildingStorage";
import { toggleFavorite, getFavorites } from "../utils/userDataStorage";
import "./DatabasePage.css";

// ─── Colors ───────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  apartment: "#3a8fd4", office: "#2a9d8f", school: "#e9c46a",
  hospital: "#e63946", warehouse: "#a8c5e0", commercial: "#f4a261",
};

// ─── Monthly climate fractions (for modal chart) ─────────────────────────────
const INSUL_FACTOR = { good: 0.78, medium: 1.0, poor: 1.28 };
const WINDOW_FACTOR = { single: 1.12, double: 1.0, triple: 0.88 };

const GRADE_COLORS = {
  A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20",
};
const GRADES = ["A","B","C","D","E","F","G"];

// Base year for scaling building-level yearly trend
const BASE_YEAR_USAGE = yearlyEnergyData.find(d => d.year === "2025")?.usage || 1152059;

// Monthly climate fractions
const CITY_ANNUAL = monthlyEnergyData.reduce((s, m) => s + m.usage, 0);
const MONTH_FRACS = monthlyEnergyData.map(m => m.usage / CITY_ANNUAL);
const MONTHS_MN = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Download helpers ─────────────────────────────────────────────────────────
function downloadCSV(data, typeLabels, headers) {
  const rows = data.map(d => [
    d.id, `"${d.name}"`, typeLabels[d.type] || d.type,
    d.area, d.predicted_kwh || 0, d.intensity || 0, d.grade || "",
    d.year, d.district, d.floors,
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "buildings_data.csv"; a.click();
}
function downloadJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "buildings_data.json"; a.click();
}

// ─── Grade bar ────────────────────────────────────────────────────────────────
function GradeBar({ grade }) {
  return (
    <div className="res-grade-row">
      {GRADES.map(g => (
        <div key={g} className={`res-grade-cell${g === grade ? " active" : ""}`}
          style={{
            background: g === grade ? GRADE_COLORS[g] : `${GRADE_COLORS[g]}22`,
            color:      g === grade ? "#fff"          : GRADE_COLORS[g],
          }}>
          {g}
        </div>
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, color, sub }) {
  return (
    <div className="res-stat">
      <div className="res-stat-val" style={{ color }}>{value}</div>
      <div className="res-stat-unit">{unit}</div>
      <div className="res-stat-lbl">{label}</div>
      {sub && <div className="res-stat-sub">{sub}</div>}
    </div>
  );
}

// ─── Results modal ────────────────────────────────────────────────────────────
function ResultsModal({ building, lang, t, onClose }) {
  const mn   = lang === "mn";
  const months = mn ? MONTHS_MN : MONTHS_EN;

  // Use pre-computed ML fields; fall back gracefully for legacy records
  const totalKwh   = building.predicted_kwh || 0;
  const monthlyPred = building.monthly_kwh || Math.round(totalKwh / 12);
  const intensity   = building.intensity   || 0;
  const grade       = building.grade       || "G";
  const co2         = building.co2         || 0;
  const pm25        = building.pm25        || 0;
  const impactColor = co2 > 60 ? "#e63946" : co2 > 30 ? "#f4a261" : "#2a9d8f";

  const actualMonthly = building.has_actual_data ? monthlyPred : null;
  const diff = null; // actual vs predicted tracked via has_actual_data badge

  // Monthly chart data — predicted bars + actual line reference
  const chartData = MONTH_FRACS.map((frac, i) => ({
    m:    months[i],
    pred: Math.round(totalKwh * frac),
    act:  actualMonthly != null ? Math.round(actualMonthly) : null,
  }));

  // Simple recs based on what they entered
  const recs = [];
  if (building.insulation_quality === "poor")
    recs.push(t.database.rec_insulation);
  if (building.window_type === "single")
    recs.push(t.database.rec_glazing);
  if (building.heating_type === "electric")
    recs.push(t.database.rec_district_heat);
  if ((building.occupancy || 0) > 0 && (building.area || 0) / building.occupancy < 15)
    recs.push(t.database.rec_ventilation);
  if (recs.length === 0)
    recs.push(t.database.rec_ok);

  const typeLabel = t.predictor.building_types[building.type] || building.type;

  // Yearly trend scaled to this building's predicted_kwh
  const bldgYearlyData = yearlyEnergyData.map(d => ({
    year: d.year,
    usage:    d.usage    != null ? Math.round(totalKwh * d.usage    / BASE_YEAR_USAGE) : null,
    forecast: d.usage    == null ? Math.round(totalKwh * (d.predicted || 0) / BASE_YEAR_USAGE) : null,
  }));

  // EUI factor labels
  const EUI_BASE = { apartment: 175, office: 230, school: 155, hospital: 360, warehouse: 95, commercial: 275 };
  const baseEUI  = EUI_BASE[building.type] || 175;
  const ageFactor   = building.year ? (1 + Math.max(0, (2000 - building.year)) * 0.004).toFixed(3) : "1.000";
  const insulFactor = INSUL_FACTOR[building.insulation_quality] || 1.0;
  const winFactor   = WINDOW_FACTOR[building.window_type] || 1.0;
  const heatLabels  = { central: "×1.00", local: "×1.25", electric: "×1.08", gas: "×0.88" };

  return (
    <div className="building-detail-panel card" id="db-detail-panel">

        {/* Header */}
        <div className="res-header">
          <div className="res-header-left">
            <span className="res-type-dot" style={{ background: TYPE_COLORS[building.type] || "#888" }} />
            <div>
              <div className="res-name">{building.name}</div>
              <div className="res-meta">{typeLabel} · {building.district} · {building.year}</div>
            </div>
          </div>
          <div className="res-header-right">
            <div className="res-grade-badge" style={{ background: GRADE_COLORS[grade] }}>
              {grade}
            </div>
            <button className="chatbot-close" onClick={onClose} aria-label={t.common.close}><X size={14} /></button>
          </div>
        </div>

        <div className="res-body">

          {/* ── Key stats ── */}
          <div className="res-stats-row">
            <StatCard
              label={t.database.modal_annual_calc}
              value={totalKwh.toLocaleString()}
              unit={t.database.modal_kwh_yr}
              color="#3a8fd4"
            />
            <StatCard
              label={t.database.modal_monthly_pred}
              value={monthlyPred.toLocaleString()}
              unit={t.database.modal_kwh_mo}
              color="#9b72cf"
            />
            <StatCard
              label={t.database.modal_co2}
              value={co2}
              unit={t.database.modal_co2_yr}
              color={impactColor}
              sub={`≈ ${pm25.toLocaleString()} μg PM2.5`}
            />
            <StatCard
              label={t.database.modal_intensity}
              value={intensity}
              unit="kWh/m²"
              color={GRADE_COLORS[grade]}
            />
          </div>

          {/* ── Grade ── */}
          <div className="res-section">
            <div className="res-section-title">
              <BarChart2 size={14} />
              {t.predictor.efficiency_grade}
            </div>
            <GradeBar grade={grade} />
            <div className="res-grade-hint">
              {mn
                ? `Эрч: ${intensity} kWh/м²/жил · Зэрэглэл ${grade} (${
                    grade === "A" ? "маш үр ашигтай" :
                    grade === "B" ? "үр ашигтай" :
                    grade === "C" ? "дунд" :
                    grade === "D" ? "хэвийн" :
                    grade === "E" ? "их хэрэглээтэй" :
                    grade === "F" ? "маш их хэрэглээтэй" : "хэт их хэрэглээтэй"
                  })`
                : `Intensity: ${intensity} kWh/m²/yr · Grade ${grade}`}
            </div>
          </div>

          {/* ── Actual vs Predicted ── */}
          {actualMonthly != null && (
            <div className="res-section">
              <div className="res-section-title">
                <TrendingUp size={14} />
                {t.database.modal_actual_vs_pred}
              </div>
              <div className="res-compare-row">
                <div className="res-compare-box actual">
                  <div className="rcb-label">{t.database.modal_actual}</div>
                  <div className="rcb-value">{actualMonthly.toLocaleString()}</div>
                  <div className="rcb-unit">{t.database.modal_kwh_mo}</div>
                </div>
                <div className={`res-compare-arrow ${diff > 0 ? "over" : "under"}`}>
                  {diff > 0
                    ? <TrendingUp size={20} />
                    : diff < 0
                      ? <TrendingDown size={20} />
                      : <CheckCircle size={20} />}
                  <span>{diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : "0%"}</span>
                </div>
                <div className="res-compare-box pred">
                  <div className="rcb-label">{t.database.modal_pred_model}</div>
                  <div className="rcb-value">{monthlyPred.toLocaleString()}</div>
                  <div className="rcb-unit">{t.database.modal_kwh_mo}</div>
                </div>
              </div>
              <div className={`res-compare-note ${Math.abs(diff) <= 15 ? "ok" : Math.abs(diff) <= 30 ? "warn" : "bad"}`}>
                {Math.abs(diff) <= 15
                  ? t.database.modal_match
                  : Math.abs(diff) <= 30
                    ? t.database.modal_deviation
                    : t.database.modal_large_dev}
              </div>
            </div>
          )}

          {/* ── Monthly chart ── */}
          <div className="res-section">
            <div className="res-section-title">
              <Zap size={14} />
              {t.database.modal_monthly_dist}
            </div>

            {/* Source legend with explanation */}
            <div className="res-source-legend">
              <div className="rsl-item">
                <span className="rsl-swatch bar" style={{ background: "#3a8fd4" }} />
                <div>
                  <span className="rsl-name">{t.database.modal_pred_bars}</span>
                  <span className="rsl-desc">
                    {mn
                      ? "EUI загвар: талбай × тохируулагдсан коэффициент — УБ-ын цаг агаарын хэв маягаар 12 сард хуваарилсан"
                      : "EUI model: area × adjusted coefficient — distributed across 12 months using UB climate pattern"}
                  </span>
                </div>
              </div>
              {actualMonthly != null && (
                <div className="rsl-item">
                  <span className="rsl-swatch line" />
                  <div>
                    <span className="rsl-name">{t.database.modal_actual_dashed}</span>
                    <span className="rsl-desc">
                      {mn
                        ? "Таны оруулсан сарын цахилгааны хэрэглээ — Өгөгдөл оруулах хуудаснаас"
                        : "Your submitted monthly electricity usage — from the Data Input page"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="res-chart-wrap">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={chartData} margin={{ top: 4, right: 48, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="m" tick={{ fill: "#667788", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#667788", fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#0e1825", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 11 }}
                    formatter={(v, name) => [
                      `${v.toLocaleString()} kWh`,
                      name === "pred"
                        ? t.database.modal_pred_model
                        : t.database.modal_actual,
                    ]}
                  />
                  <Bar dataKey="pred" fill="#3a8fd4" radius={[3,3,0,0]} maxBarSize={22} name="pred" />
                  {actualMonthly != null && (
                    <ReferenceLine y={actualMonthly} stroke="#f4a261" strokeDasharray="5 3"
                      label={{ value: t.database.modal_actual_short, fill: "#f4a261", fontSize: 9, position: "insideRight" }} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Methodology note */}
            <div className="res-method-note">
              <span className="rmn-label">{t.database.modal_methodology}</span>
              {mn
                ? `ML загвараар тооцсон жилийн нийт хэрэглээ (${totalKwh.toLocaleString()} kWh)-г УБ-ын сарын хэрэглээний харьцаагаар хуваарилав.`
                : `ML-predicted annual total (${totalKwh.toLocaleString()} kWh) split by UB monthly consumption ratios.`}
            </div>
          </div>

          {/* ── Energy breakdown ── */}
          <div className="res-section">
            <div className="res-section-title">
              <Ruler size={14} />
              {t.database.modal_energy_breakdown}
            </div>
            <div className="res-breakdown">
              <div className="res-bd-row">
                <span className="rbd-label">{mn ? "Талбай" : "Area"}</span>
                <span className="rbd-formula">{(building.area||0).toLocaleString()} {t.common.units_sqm}</span>
                <span className="rbd-val">{building.floors || "?"} {t.database.modal_floors_unit}</span>
              </div>
              <div className="res-bd-row">
                <span className="rbd-label">{mn ? "Жилийн нийт" : "Annual total"}</span>
                <span className="rbd-formula">ML {mn ? "загвар" : "model"}</span>
                <span className="rbd-val">{totalKwh.toLocaleString()} kWh</span>
              </div>
              <div className="res-bd-row">
                <span className="rbd-label">{mn ? "Эрчим хүчний эрчим" : "Energy intensity"}</span>
                <span className="rbd-formula">{totalKwh.toLocaleString()} ÷ {building.area||0} {t.common.units_sqm}</span>
                <span className="rbd-val" style={{ color: GRADE_COLORS[grade] }}>{intensity} kWh/m²</span>
              </div>
              <div className="res-bd-row total">
                <span className="rbd-label">CO₂</span>
                <span className="rbd-formula">{mn ? "Эрчим хүчний хүчин зүйл" : "Emission factor"}</span>
                <span className="rbd-val" style={{ color: impactColor }}>{co2} {t.predictor.co2_unit}</span>
              </div>
              <div className="res-adj-note">
                {mn
                  ? `Дулаалга: ${building.insulation_quality || "—"} · Цонх: ${building.window_type || "—"} · Дулаалт: ${building.heating_type || "—"}`
                  : `Insulation: ${building.insulation_quality || "—"} · Window: ${building.window_type || "—"} · Heating: ${building.heating_type || "—"}`}
              </div>
            </div>
          </div>

          {/* ── Recommendations ── */}
          <div className="res-section">
            <div className="res-section-title">
              <Lightbulb size={14} />
              {t.database.modal_recommendations}
            </div>
            <ul className="res-recs">
              {recs.map((r, i) => (
                <li key={i} className="res-rec-item">
                  <span className="res-rec-dot">→</span>{r}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Жилийн хандлага ба Forecast (2020–2027) ── */}
          <div className="res-section">
            <div className="res-section-title">
              <TrendingUp size={14} />
              {mn ? "Жилийн хэрэглээний хандлага ба прогноз (2020–2027)" : "Annual Trend & Forecast (2020–2027)"}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "var(--text3)" }}>
                <span style={{ width: 10, height: 10, background: "#3a8fd4", borderRadius: 2 }} />
                {mn ? "Өнгөрсөн хэрэглээ (kWh)" : "Past usage (kWh)"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "var(--text3)" }}>
                <span style={{ width: 10, height: 10, background: "#f4a26188", borderRadius: 2, border: "1.5px dashed #f4a261" }} />
                {mn ? "Прогноз (2026–2027)" : "Forecast (2026–2027)"}
              </span>
            </div>
            <div className="res-chart-wrap">
              <ResponsiveContainer width="100%" height={175}>
                <ComposedChart data={bldgYearlyData} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: "#667788", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#667788", fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#0e1825", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 11 }}
                    formatter={(v, name) => [
                      v != null ? `${v.toLocaleString()} kWh` : "—",
                      name === "usage" ? (mn ? "Хэрэглээ" : "Usage") : (mn ? "Прогноз" : "Forecast"),
                    ]}
                  />
                  <Bar dataKey="usage"    radius={[3,3,0,0]} maxBarSize={28} name="usage">
                    {bldgYearlyData.map((d, i) => (
                      <Cell key={i} fill={d.usage != null ? "#3a8fd4" : "transparent"} />
                    ))}
                  </Bar>
                  <Bar dataKey="forecast" radius={[3,3,0,0]} maxBarSize={28} name="forecast" fill="#f4a261" fillOpacity={0.55} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="res-method-note">
              {mn
                ? "Прогноз нь 2025 оны хэрэглээнд ±1.1% жилийн өсөлтийн хүчин зүйл хэрэглэж тооцсон. Цэнхэр = өнгөрсөн синтетик, шар = ML прогноз."
                : "Forecast applies ±1.1% annual growth to 2025 baseline. Blue = past synthetic data, orange = ML forecast."}
            </div>
          </div>

          {/* ── Тооцооллын алхамууд ── */}
          <div className="res-section">
            <div className="res-section-title">
              <Info size={14} />
              {mn ? "Яаж тооцоолсон бэ? — Тооцооллын алхамууд" : "How was this calculated? — Calculation steps"}
            </div>
            <div style={{ background: "rgba(58,143,212,0.07)", border: "1px solid rgba(58,143,212,0.2)", borderRadius: 8, padding: "0.85rem 1rem" }}>
              <div style={{ display: "grid", gap: "0.55rem" }}>
                {[
                  {
                    step: "1",
                    color: "#3a8fd4",
                    title: mn ? "Суурь EUI (Барилгын төрлөөс)" : "Base EUI (from building type)",
                    formula: `${typeLabel} → ${baseEUI} kWh/m²`,
                    note: mn
                      ? "IEA 2022, БНТУ 23-02-09 норматив дээр суурилсан Улаанбаатарын барилгын суурь эрчим хүчний эрч"
                      : "Baseline energy intensity for Ulaanbaatar buildings per IEA 2022, БНТУ 23-02-09",
                  },
                  {
                    step: "2",
                    color: "#2a9d8f",
                    title: mn ? "Засварын коэффициентүүд" : "Adjustment factors",
                    formula: `Он: ×${ageFactor}  |  Дулаалга: ×${insulFactor}  |  Цонх: ×${winFactor}  |  Халаалт: ${heatLabels[building.heating_type] || "×1.00"}`,
                    note: mn
                      ? "Барилгасан он (хуучин = бага үр ашигтай), дулаалгын чанар, цонхны төрөл, халаалтын систем"
                      : "Year built (older = less efficient), insulation quality, window type, and heating system",
                  },
                  {
                    step: "3",
                    color: "#e9c46a",
                    title: mn ? "OLS ML загварын таамаглал" : "OLS ML model prediction",
                    formula: `${(building.area||0).toLocaleString()} м² × ${baseEUI} × (коэффициентүүд) ≈ ${totalKwh.toLocaleString()} kWh/жил`,
                    note: mn
                      ? "600 синтетик барилга дээр сургасан OLS регрессийн загвар — R² ≥ 0.87, MAE ≈ 5,400 kWh"
                      : "OLS regression trained on 600 synthetic buildings — R² ≥ 0.87, MAE ≈ 5,400 kWh",
                  },
                  {
                    step: "4",
                    color: "#f4a261",
                    title: mn ? "Сарын хуваарилалт" : "Monthly distribution",
                    formula: `Сар_і = ${totalKwh.toLocaleString()} × w_і  |  w_і = Баянмонгол-1-ийн сарын харьцаа`,
                    note: mn
                      ? "УБ-ын жилийн сарын хэрэглээний хэв маяг — 1-р сар хамгийн их (14%), 7-р сар хамгийн бага (3%)"
                      : "UB seasonal pattern — January highest (14%), July lowest (3%) of annual total",
                  },
                ].map(({ step, color, title, formula, note }) => (
                  <div key={step} style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%", background: color,
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.7rem", fontWeight: 700, flexShrink: 0, marginTop: 1,
                    }}>{step}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.78rem", color: "var(--text)", marginBottom: "0.2rem" }}>{title}</div>
                      <code style={{ fontSize: "0.72rem", color: color, display: "block", background: "rgba(255,255,255,0.04)", borderRadius: 5, padding: "3px 7px", marginBottom: "0.2rem", wordBreak: "break-word" }}>
                        {formula}
                      </code>
                      <div style={{ fontSize: "0.68rem", color: "var(--text3)", lineHeight: 1.5 }}>{note}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "var(--text3)", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "0.5rem" }}>
                {mn
                  ? "CO₂ = жилийн kWh × 0.0007 т CO₂/kWh (Монголын нүүрсний эрчим хүчний хүчин зүйл)"
                  : "CO₂ = annual kWh × 0.0007 t CO₂/kWh (Mongolian coal-based electricity emission factor)"}
              </div>
            </div>
          </div>

          {/* ── Зардал хэмнэх зөвлөгөө ── */}
          {(() => {
            const elecPrice = building.type === "apartment" ? 82.6
              : building.type === "office" || building.type === "commercial" ? 145
              : building.type === "school" || building.type === "hospital" ? 95
              : 120;

            const rlist = [];

            // 1. Insulation
            if (building.insulation_quality === "poor") {
              const sk = Math.round(totalKwh * 0.25);
              rlist.push({ pri: 1, priLabel: mn ? "Тэргүүлэх" : "High", priColor: "#e76f51",
                icon: "🏠",
                title: mn ? "Ханын дулаалгыг сайжруулах" : "Upgrade wall insulation",
                desc:  mn ? `Одоогийн МУУ дулаалга жилийн хэрэглээнд ~25% нэмэлт зардал нэмж байна. Дулаалгыг САЙН түвшинд хүргэснээр ${sk.toLocaleString()} kWh хэмнэнэ.`
                           : `Poor insulation adds ~25% to annual energy use. Upgrading to good standard saves ${sk.toLocaleString()} kWh/yr.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "3–8 сая ₮" : "3–8M MNT",
                payback: mn ? "4–8 жил" : "4–8 yrs",
                gov: mn ? "УБЕГ «Дулааны менежмент» хөтөлбөр — зардлын 30% хүртэл дэмжлэг боломжтой"
                         : "UBEG 'Heat Management' program — up to 30% cost subsidy available",
              });
            } else if (building.insulation_quality === "medium") {
              const sk = Math.round(totalKwh * 0.12);
              rlist.push({ pri: 2, priLabel: mn ? "Дунд" : "Medium", priColor: "#e9c46a",
                icon: "🏠",
                title: mn ? "Ханын дулаалгыг сайжруулах" : "Improve wall insulation",
                desc:  mn ? `ДУНД дулаалгыг САЙН болгосноор ${sk.toLocaleString()} kWh/жил хэмнэгдэнэ — голчлон өвлийн улирлын халаалтын зардал буурна.`
                           : `Upgrading from medium to good insulation saves ${sk.toLocaleString()} kWh/yr — mainly winter heating costs.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "2–5 сая ₮" : "2–5M MNT",
                payback: mn ? "4–7 жил" : "4–7 yrs",
                gov: mn ? "УБЕГ дэмжлэг: 20–30% дэмжлэг боломжтой" : "UBEG subsidy: 20–30% available",
              });
            }

            // 2. Window
            if (building.window_type === "single") {
              const sk = Math.round(totalKwh * 0.14);
              rlist.push({ pri: 1, priLabel: mn ? "Тэргүүлэх" : "High", priColor: "#e76f51",
                icon: "🪟",
                title: mn ? "Цонхыг давхар шилтэй болгох" : "Replace single-pane windows",
                desc:  mn ? `Нэг давхар цонх дулааны алдагдлын 25–30%-ийг үүсгэдэг. Давхар шил суурилуулснаар ${sk.toLocaleString()} kWh/жил хэмнэнэ.`
                           : `Single-pane windows cause 25–30% of heat loss. Double-pane saves ${sk.toLocaleString()} kWh/yr.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "0.8–2 сая ₮ (цонх бүрт ~150–300к ₮)" : "0.8–2M MNT (~150–300k per window)",
                payback: mn ? "3–6 жил" : "3–6 yrs",
                gov: mn ? "Ногоон хөгжлийн сан: эрчим хүчний үр ашгийн зээл боломжтой" : "Green Development Fund: energy efficiency loan available",
              });
            } else if (building.window_type === "double") {
              const sk = Math.round(totalKwh * 0.07);
              rlist.push({ pri: 3, priLabel: mn ? "Урт хугацааны" : "Long-term", priColor: "#2a9d8f",
                icon: "🪟",
                title: mn ? "Цонхыг вакуум шилтэй болгох" : "Upgrade to triple/vacuum-pane windows",
                desc:  mn ? `Давхар цонхноос вакуум шил руу шилжсэнээр ${sk.toLocaleString()} kWh/жил хэмнэгдэнэ — удаан хугацааны хөрөнгө оруулалт.`
                           : `Upgrading from double to vacuum-pane saves ${sk.toLocaleString()} kWh/yr — long-term investment.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "1.5–4 сая ₮" : "1.5–4M MNT",
                payback: mn ? "8–15 жил" : "8–15 yrs",
                gov: null,
              });
            }

            // 3. Heating upgrade
            if (building.heating_type === "electric") {
              const sk = Math.round(totalKwh * 0.35);
              rlist.push({ pri: 1, priLabel: mn ? "Тэргүүлэх" : "High", priColor: "#e76f51",
                icon: "🔥",
                title: mn ? "Цахилгаан халаалтаас төвлөрсөн халаалт руу шилжих" : "Switch from electric to district heating",
                desc:  mn ? `Цахилгаан халаалт нь хамгийн үнэтэй. Төвлөрсөн халаалт руу шилжсэнээр ${sk.toLocaleString()} kWh/жил (≈ ${Math.round(sk * elecPrice / 1000000 * 10) / 10}M ₮/жил) хэмнэнэ.`
                           : `Electric heating is the most expensive. District heating saves ${sk.toLocaleString()} kWh/yr (≈ ${Math.round(sk * elecPrice / 1000000 * 10) / 10}M MNT/yr).`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "Байршлаас хамаарна — УБЦТС-д хандах" : "Location-dependent — contact UBCTS",
                payback: mn ? "2–4 жил" : "2–4 yrs",
                gov: mn ? "УБЕГ холболтын зардлын дэмжлэг боломжтой" : "UBEG connection cost subsidy available",
              });
            } else if (building.heating_type === "local") {
              const sk = Math.round(totalKwh * 0.12);
              rlist.push({ pri: 2, priLabel: mn ? "Дунд" : "Medium", priColor: "#e9c46a",
                icon: "🔥",
                title: mn ? "Орон нутгийн халаалтаас төвлөрсөн руу шилжих" : "Local to district heating",
                desc:  mn ? `Орон нутгийн халаалтыг солиход ${sk.toLocaleString()} kWh/жил хэмнэнэ — дулааны алдагдал болон үр ашиггүй шаталт буурна.`
                           : `Switching saves ${sk.toLocaleString()} kWh/yr by reducing heat loss and inefficient combustion.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "0.5–2 сая ₮" : "0.5–2M MNT",
                payback: mn ? "3–5 жил" : "3–5 yrs",
                gov: null,
              });
            }

            // 4. Smart thermostat (always)
            {
              const sk = Math.round(totalKwh * 0.07);
              rlist.push({ pri: 2, priLabel: mn ? "Дунд" : "Medium", priColor: "#e9c46a",
                icon: "🌡️",
                title: mn ? "Ухаалаг термостат суурилуулах" : "Install smart thermostat",
                desc:  mn ? `Өрөө бүрийн температурыг зохицуулснаар ${sk.toLocaleString()} kWh/жил хэмнэнэ. Шөнийн цагаар 16°C, өдрийн хооронд 18°C байлгах нь оновчтой.`
                           : `Room-by-room temperature control saves ${sk.toLocaleString()} kWh/yr. Optimal: 16°C at night, 18°C during day.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "150,000–400,000 ₮" : "150–400k MNT",
                payback: mn ? "1–2 жил" : "1–2 yrs",
                gov: null,
              });
            }

            // 5. LED lighting (always)
            {
              const sk = Math.round(totalKwh * 0.09);
              rlist.push({ pri: 2, priLabel: mn ? "Дунд" : "Medium", priColor: "#e9c46a",
                icon: "💡",
                title: mn ? "Бүх гэрэлтүүлгийг LED болгох" : "Full LED lighting upgrade",
                desc:  mn ? `Уламжлалт чийдэнгийн оронд LED хэрэглэснээр ${sk.toLocaleString()} kWh/жил хэмнэнэ. LED-ийн наслалт 25,000 цаг — 10 дахин удаан.`
                           : `Replacing all bulbs with LED saves ${sk.toLocaleString()} kWh/yr. LED lifespan 25,000 hrs — 10× longer.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "50,000–300,000 ₮ (барилгын хэмжээнээс хамаарна)" : "50–300k MNT",
                payback: mn ? "6 сар – 1.5 жил" : "6 mo – 1.5 yrs",
                gov: null,
              });
            }

            // 6. Solar (long-term, apartment/office/commercial)
            if (["apartment","office","commercial","school"].includes(building.type)) {
              const sk = Math.round(totalKwh * 0.15);
              rlist.push({ pri: 3, priLabel: mn ? "Урт хугацааны" : "Long-term", priColor: "#2a9d8f",
                icon: "☀️",
                title: mn ? "Нарны цахилгааны панел суурилуулах" : "Install rooftop solar panels",
                desc:  mn ? `Дээвэрт нарны панел суурилуулснаар ${sk.toLocaleString()} kWh/жил цахилгааны хэрэглээ орлоно. УБ-ын жилийн нарны цацраг ~2,300 цаг — Монгол дэлхийн хамгийн нарлаг газруудын нэг.`
                           : `Rooftop solar offsets ${sk.toLocaleString()} kWh/yr. UB gets ~2,300 solar hours/yr — Mongolia is one of the sunniest countries.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "8–20 сая ₮ (3–10 кВт систем)" : "8–20M MNT (3–10 kW system)",
                payback: mn ? "7–12 жил" : "7–12 yrs",
                gov: mn ? "Монгол Улсын Засгийн газрын «Ногоон эрчим хүч» хөтөлбөр — 30% татаас боломжтой"
                         : "Government 'Green Energy' program — 30% subsidy possible",
              });
            }

            // 7. Behavioral changes (free)
            {
              const sk = Math.round(totalKwh * 0.05);
              rlist.push({ pri: 3, priLabel: mn ? "Үнэгүй" : "Free", priColor: "#57cc99",
                icon: "✅",
                title: mn ? "Зан үйлийн өөрчлөлт (зардалгүй)" : "Behavioural changes (no cost)",
                desc:  mn ? `Ашиглагдахгүй байх үед унтраах, шөнийн цагт халаалтыг бууруулах, цонх нэмэлт хаах зэргээр ${sk.toLocaleString()} kWh/жил (≈ ${Math.round(sk * elecPrice / 1000).toLocaleString()}к ₮) хэмнэнэ.`
                           : `Turn off unused devices, lower heating at night, seal gaps — saves ${sk.toLocaleString()} kWh/yr with no investment.`,
                sk, smnt: Math.round(sk * elecPrice), co2: Math.round(sk * 0.0007),
                invest: mn ? "0 ₮ — нэмэлт зардалгүй" : "0 MNT — no investment",
                payback: mn ? "Шууд" : "Immediate",
                gov: null,
              });
            }

            rlist.sort((a, b) => a.pri - b.pri);

            const totalSaveKwh = rlist.reduce((s, r) => s + r.sk, 0);
            const totalSaveMnt = rlist.reduce((s, r) => s + r.smnt, 0);

            return (
              <div className="res-section">
                <div className="res-section-title">
                  <TrendingDown size={14} />
                  {mn ? "Зардал хэмнэх зөвлөгөө — Бодит тооцоолол" : "Energy Savings Recommendations — With Real Numbers"}
                </div>

                {/* Summary banner */}
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
                  {[
                    { label: mn ? "Нийт боломжит хэмнэлт" : "Total potential savings", val: `${totalSaveKwh.toLocaleString()} kWh/жил`, color: "#3a8fd4" },
                    { label: mn ? "Мөнгөн хэмнэлт" : "Money savings", val: `≈ ${(totalSaveMnt / 1_000_000).toFixed(1)} сая ₮/жил`, color: "#2a9d8f" },
                    { label: mn ? "Цахилгааны тариф" : "Elec. tariff used", val: `${elecPrice} ₮/kWh`, color: "#e9c46a" },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 8, padding: "0.4rem 0.75rem", flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: "0.67rem", color: "var(--text3)", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Recommendation cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {rlist.map((r, i) => (
                    <div key={i} style={{
                      border: `1px solid ${r.priColor}30`,
                      borderLeft: `3px solid ${r.priColor}`,
                      borderRadius: 8, padding: "0.7rem 0.85rem",
                      background: `${r.priColor}07`,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.4rem" }}>
                        <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>{r.title}</span>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, background: `${r.priColor}22`, color: r.priColor, borderRadius: 5, padding: "1px 7px" }}>
                              {r.priLabel}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.72rem", color: "var(--text2)", margin: 0, lineHeight: 1.55 }}>{r.desc}</p>
                        </div>
                      </div>

                      {/* Savings metrics row */}
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                        {[
                          { icon: "⚡", label: "kWh/жил", val: r.sk.toLocaleString() },
                          { icon: "💰", label: mn ? "₮/жил" : "MNT/yr", val: `${(r.smnt / 1000).toFixed(0)}к` },
                          { icon: "🌿", label: "CO₂ т/жил", val: r.co2.toFixed(2) },
                          { icon: "🔧", label: mn ? "Хөрөнгө оруулалт" : "Investment", val: r.invest },
                          { icon: "📅", label: mn ? "Нөхөн төлөгдөх" : "Payback", val: r.payback },
                        ].map(({ icon, label, val }) => (
                          <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "0.25rem 0.5rem", fontSize: "0.68rem" }}>
                            <span style={{ marginRight: 3 }}>{icon}</span>
                            <span style={{ color: "var(--text3)" }}>{label}: </span>
                            <span style={{ color: "var(--text)", fontWeight: 600 }}>{val}</span>
                          </div>
                        ))}
                      </div>

                      {r.gov && (
                        <div style={{ marginTop: "0.4rem", fontSize: "0.67rem", color: "#2a9d8f", background: "rgba(42,157,143,0.08)", borderRadius: 5, padding: "0.25rem 0.5rem" }}>
                          🏛️ {r.gov}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "0.65rem", fontSize: "0.67rem", color: "var(--text3)", lineHeight: 1.5 }}>
                  {mn
                    ? `* Тооцоолол нь УБЦТС 2024 оны тариф (${elecPrice} ₮/kWh), ML загварын таамаглал болон БНТУ норматив дээр суурилсан. Бодит хэмнэлт байшингийн нөхцөл, хэрэглэгчийн зан үйл, цаг уурын нөхцөлөөс хамаарч өөрчлөгдөнө.`
                    : `* Calculations based on UBCTS 2024 tariff (${elecPrice} MNT/kWh), ML model prediction, and БНТУ standards. Actual savings depend on building condition, occupant behaviour, and weather.`}
                </div>
              </div>
            );
          })()}

        </div>
      </div>
  );
}

// ─── Activity log helpers ─────────────────────────────────────────────────────
const LOG_KEY = (uid) => `ubenergy_log_${uid || "anon"}`;
const MAX_LOG = 50;

function readLog(uid) {
  try { return JSON.parse(localStorage.getItem(LOG_KEY(uid)) || "[]"); } catch { return []; }
}
function appendLog(uid, entry) {
  const log = [entry, ...readLog(uid)].slice(0, MAX_LOG);
  try { localStorage.setItem(LOG_KEY(uid), JSON.stringify(log)); } catch {}
}

// ─── Pagination helper ────────────────────────────────────────────────────────
const PAGE_SIZES = [10, 25, 50, 100];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DatabasePage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.database);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [resultsBuilding, setResultsBuilding] = useState(null);
  const { confirmId, ask, confirm, cancel } = useConfirm();
  const isAdmin = user?.role === "admin";
  const [gradeFilter, setGradeFilter] = useState("all");
  const [allBuildingsState, setAllBuildingsState] = useState(() => getAllBuildings(isAdmin ? null : user?.id));
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [favorites, setFavorites] = useState(() => user ? getFavorites(user.id) : []);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [showNote, setShowNote] = useState(true);
  const [activityLog, setActivityLog] = useState(() => readLog(user?.id));
  const favIds = new Set(favorites.map(f => f.id));

  const handleToggleFav = (b) => {
    if (!user) return;
    toggleFavorite(user.id, b);
    setFavorites(getFavorites(user.id));
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Close modal on Escape key
  useEffect(() => {
    if (!resultsBuilding) return;
    const handler = (e) => { if (e.key === "Escape") setResultsBuilding(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [resultsBuilding]);

  const typeLabels = t.predictor.building_types;
  const csvHeaders = ["ID", t.database.building, t.database.type, t.database.area, "kWh/yr", "intensity", "grade", t.database.year, t.database.district, t.database.floors];

  const userRecords = allBuildingsState.filter(b => b.source === "user" || b.source === "predictor");

  const SORT_FNS = {
    name:          (a, b) => a.name.localeCompare(b.name),
    type:          (a, b) => a.type.localeCompare(b.type),
    area:          (a, b) => (a.area || 0) - (b.area || 0),
    predicted_kwh: (a, b) => (a.predicted_kwh || 0) - (b.predicted_kwh || 0),
    intensity:     (a, b) => (a.intensity || 0) - (b.intensity || 0),
    year:          (a, b) => (a.year || 0) - (b.year || 0),
    district:      (a, b) => (a.district || "").localeCompare(b.district || ""),
    floors:        (a, b) => (a.floors || 0) - (b.floors || 0),
    submittedAt:   (a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0),
  };

  const q = search.toLowerCase().trim();
  const allFiltered = allBuildingsState
    .filter(b => {
      const matchSearch = !q
        || b.name.toLowerCase().includes(q)
        || (b.district || "").toLowerCase().includes(q)
        || (b.type || "").toLowerCase().includes(q)
        || String(b.year || "").includes(q)
        || (typeLabels[b.type] || "").toLowerCase().includes(q);
      const matchType   = typeFilter === "all" || b.type === typeFilter;
      const matchGrade  = gradeFilter === "all" || b.grade === gradeFilter;
      const isUserRecord = b.source === "user" || b.source === "predictor";
      const matchSource = sourceFilter === "all"
        || (sourceFilter === "mock" && b.source === "mock")
        || (sourceFilter === "mine" && isUserRecord);
      return matchSearch && matchType && matchGrade && matchSource;
    })
    .sort((a, b) => {
      const cmp = (SORT_FNS[sortKey] || SORT_FNS.name)(a, b);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(allFiltered.length / pageSize));
  const safePage   = Math.min(currentPage, totalPages);
  const filtered   = allFiltered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleDelete = (id) => {
    const b = allBuildingsState.find(x => x.id === id);
    deleteUserBuilding(id);
    if (b) {
      const entry = { action: "delete", buildingName: b.name, buildingId: id, timestamp: new Date().toISOString() };
      appendLog(user?.id, entry);
      setActivityLog(readLog(user?.id));
    }
    setAllBuildingsState(getAllBuildings(isAdmin ? null : user?.id));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearch(""); setTypeFilter("all"); setSourceFilter("all"); setGradeFilter("all"); setCurrentPage(1);
  };
  const activeFilterCount = [typeFilter !== "all", sourceFilter !== "all", gradeFilter !== "all", search.trim() !== ""].filter(Boolean).length;

  return (
    <div className="database-page">
      <div className="container">
        <div className="page-header flex-between" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1><Database size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.database.title}</h1>
            <p>{t.database.subtitle}</p>
          </div>
          <button className={`db-history-toggle ${showHistory ? "active" : ""}`} onClick={() => setShowHistory(s => !s)}>
            <History size={15} />
            {lang === "mn" ? "Түүх" : "History"}
            {activityLog.length > 0 && <span className="db-history-count">{activityLog.length}</span>}
          </button>
        </div>

        {/* Backend note */}
        {showNote && (
          <div className="db-backend-note mb-3">
            <Info size={14} className="dbn-i" />
            <span>
              {lang === "mn"
                ? "Өгөгдөл localStorage-д хадгалагдаж байна — жинхэнэ аналитик хийхийн тулд backend интеграци шаардлагатай."
                : "Data is stored in localStorage — real analytics requires backend integration."}
            </span>
            <button className="dbn-x" onClick={() => setShowNote(false)}><X size={12} /></button>
          </div>
        )}

        {/* History panel */}
        {showHistory && (
          <div className="db-history-panel card mb-3 animate-fade">
            <div className="dhp-header">
              <History size={14} />
              <span>{lang === "mn" ? "Идэвхийн түүх" : "Activity Log"}</span>
              <span className="dhp-sub">
                {lang === "mn" ? "Барилга нэмсэн / устгасан бүртгэл" : "Building add / delete events"}
              </span>
            </div>

            {/* Per-building "added" list from submittedAt */}
            {allBuildingsState.filter(b => b.submittedAt).length > 0 && (
              <div className="dhp-section">
                <div className="dhp-section-title">
                  {lang === "mn" ? "Оруулсан барилгууд" : "Saved buildings"}
                </div>
                <div className="dhp-list">
                  {[...allBuildingsState]
                    .filter(b => b.submittedAt)
                    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                    .slice(0, 10)
                    .map(b => (
                      <div key={b.id} className="dhp-row">
                        <span className="dhp-action add">{lang === "mn" ? "Нэмэгдсэн" : "Added"}</span>
                        <span className="dhp-name">{b.name}</span>
                        <span className="dhp-time">
                          <Clock size={10} />
                          {new Date(b.submittedAt).toLocaleString(lang === "mn" ? "mn-MN" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Deletion log */}
            {activityLog.length > 0 && (
              <div className="dhp-section">
                <div className="dhp-section-title">
                  {lang === "mn" ? "Устгасан бүртгэл" : "Deletion log"}
                </div>
                <div className="dhp-list">
                  {activityLog.map((e, i) => (
                    <div key={i} className="dhp-row">
                      <span className="dhp-action del">{lang === "mn" ? "Устгагдсан" : "Deleted"}</span>
                      <span className="dhp-name">{e.buildingName}</span>
                      <span className="dhp-time">
                        <Clock size={10} />
                        {new Date(e.timestamp).toLocaleString(lang === "mn" ? "mn-MN" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activityLog.length === 0 && allBuildingsState.filter(b => b.submittedAt).length === 0 && (
              <div className="dhp-empty">
                <AlertCircle size={16} opacity={0.3} />
                <span>{lang === "mn" ? "Бүртгэл байхгүй" : "No activity yet"}</span>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="db-controls card mb-3">
          <div className="db-controls-left">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input className="search-input" placeholder={t.database.search}
                aria-label={t.database.search}
                value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
              {search && (
                <button className="search-clear" onClick={() => { setSearch(""); setCurrentPage(1); }} aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="type-filter">
              <Filter size={14} />
              <select className="form-select" style={{ width: "auto" }}
                value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}>
                <option value="all">{t.database.all_types}</option>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="type-filter">
              <UserCheck size={14} />
              <select className="form-select" style={{ width: "auto" }}
                value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setCurrentPage(1); }}>
                <option value="all">{t.database.filter_all}</option>
                <option value="mock">{t.database.filter_sample}</option>
                <option value="mine">{isAdmin ? t.database.filter_user_all : t.database.filter_mine}</option>
              </select>
            </div>
            <div className="type-filter">
              <BarChart2 size={14} />
              <select className="form-select" style={{ width: "auto" }}
                value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setCurrentPage(1); }}>
                <option value="all">{lang === "mn" ? "Бүх зэрэглэл" : "All grades"}</option>
                {["A","B","C","D","E","F","G"].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            {activeFilterCount > 0 && (
              <button className="db-clear-filters" onClick={clearFilters}>
                <X size={12} />
                {lang === "mn" ? `${activeFilterCount} шүүлт арилгах` : `Clear ${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
          <div className="db-download-btns">
            <button className="btn btn-secondary" onClick={() => downloadCSV(allFiltered, typeLabels, csvHeaders)}>
              <Download size={16} />{t.database.download_csv}
            </button>
            <button className="btn btn-secondary" onClick={() => downloadJSON(allFiltered)}>
              <Download size={16} />{t.database.download_json}
            </button>
          </div>
        </div>

        {/* Stats + active filter chips */}
        <div className="db-stats-row mb-3">
          <div className="db-stats">
            <span className="db-stat-badge">{t.database.total_buildings}: <strong>{allFiltered.length}</strong> {t.database.buildings_unit}</span>
            <span className="db-stat-badge">
              {t.database.total_area}: <strong>{allFiltered.reduce((s, b) => s + (b.area || 0), 0).toLocaleString()}</strong> {t.common.units_sqm}
            </span>
            <span className="db-stat-badge">
              {t.database.total_usage}: <strong>{Math.round(allFiltered.reduce((s, b) => s + (b.predicted_kwh || 0), 0) / 1000).toLocaleString()}</strong> MWh
            </span>
            {userRecords.length > 0 && (
              <span className="db-stat-badge user-badge">
                <UserCheck size={13} />
                {isAdmin ? t.database.user_records_label : t.database.my_records_label}: <strong>{userRecords.length} {t.admin.buildings_unit}</strong>
              </span>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="db-filter-chips">
              {search && <span className="db-chip">{lang === "mn" ? "Хайлт" : "Search"}: "{search}" <button onClick={() => { setSearch(""); setCurrentPage(1); }}><X size={10}/></button></span>}
              {typeFilter !== "all" && <span className="db-chip">{typeLabels[typeFilter]} <button onClick={() => { setTypeFilter("all"); setCurrentPage(1); }}><X size={10}/></button></span>}
              {gradeFilter !== "all" && <span className="db-chip">{lang === "mn" ? "Зэрэглэл" : "Grade"}: {gradeFilter} <button onClick={() => { setGradeFilter("all"); setCurrentPage(1); }}><X size={10}/></button></span>}
              {sourceFilter !== "all" && <span className="db-chip">{sourceFilter === "mine" ? (lang === "mn" ? "Миний" : "Mine") : (lang === "mn" ? "Жишээ" : "Sample")} <button onClick={() => { setSourceFilter("all"); setCurrentPage(1); }}><X size={10}/></button></span>}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="data-table-wrap card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                {[
                  { key: "name",          label: t.database.building },
                  { key: "type",          label: t.database.type },
                  { key: "area",          label: t.database.area },
                  { key: "predicted_kwh", label: lang === "mn" ? "Жилийн kWh" : "Annual kWh" },
                  { key: "intensity",     label: "kWh/m²" },
                  { key: "year",          label: t.database.year },
                  { key: "district",      label: t.database.district },
                  { key: "floors",        label: t.database.floors },
                  { key: "submittedAt",  label: lang === "mn" ? "Нэмэгдсэн" : "Added" },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    scope="col"
                    className="sortable-th"
                    onClick={() => toggleSort(key)}
                    onKeyDown={e => (e.key === "Enter" || e.key === " ") && toggleSort(key)}
                    tabIndex={0}
                    aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <span className="th-inner">
                      {label}
                      <span className="sort-icon" style={{ opacity: sortKey === key ? 1 : 0.4, color: sortKey === key ? "var(--primary-light)" : "inherit" }}>
                        {sortKey === key
                          ? sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          : <ChevronsUpDown size={12} />}
                      </span>
                    </span>
                  </th>
                ))}
                <th scope="col">{t.database.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, idx) => {
                const isMine = b.source === "user" || b.source === "predictor";
                return (
                <tr key={b.id} className={isMine ? "user-row" : ""}>
                  <td className="text-muted">{idx + 1}</td>
                  <td>
                    <div className="building-name-cell">
                      {isMine && <span className="user-dot" />}
                      <span>{b.name}</span>
                      {b.source === "predictor" && (
                        <span className="src-tag pred-tag">{t.database.predicted_tag}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="type-badge" style={{
                      background: `${TYPE_COLORS[b.type] || "#888"}22`,
                      color: TYPE_COLORS[b.type] || "#888",
                      border: `1px solid ${TYPE_COLORS[b.type] || "#888"}55`,
                    }}>
                      {typeLabels[b.type] || b.type}
                    </span>
                  </td>
                  <td>{(b.area || 0).toLocaleString()} {t.common.units_sqm}</td>
                  <td>
                    <span className={`usage-val ${(b.predicted_kwh||0) > 80000 ? "high" : (b.predicted_kwh||0) > 40000 ? "mid" : "low"}`}>
                      {(b.predicted_kwh || 0).toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: GRADE_COLORS[b.grade] || "#888", fontWeight: 600 }}>
                      {b.intensity || 0}
                      {" "}
                      <span className="text-muted" style={{ fontWeight: 400, fontSize: "0.75rem" }}>({b.grade})</span>
                    </span>
                  </td>
                  <td>{b.year}</td>
                  <td>{b.district}</td>
                  <td>{b.floors != null ? `${b.floors} ${t.database.floors_display}` : "—"}</td>
                  <td className="db-added-cell">
                    {b.submittedAt
                      ? <span className="db-added-time" title={new Date(b.submittedAt).toLocaleString()}>
                          <Clock size={10} />
                          {new Date(b.submittedAt).toLocaleDateString(lang === "mn" ? "mn-MN" : "en-US", { month: "short", day: "numeric", year: "2-digit" })}
                        </span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="action-btn"
                        title={lang === "mn" ? "Дэлгэрэнгүй харах" : "View detail"}
                        aria-label={lang === "mn" ? "Дэлгэрэнгүй харах" : "View detail"}
                        onClick={() => navigate(`/building/${b.id}`)}
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        className="action-btn view results-btn"
                        title={t.database.view_results}
                        aria-label={t.database.view_results}
                        onClick={() => {
                          setResultsBuilding(b);
                          setTimeout(() => {
                            document.getElementById("db-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 80);
                        }}
                      >
                        <BarChart2 size={14} />
                      </button>
                      {user && (
                        <button
                          className="action-btn"
                          title={favIds.has(b.id) ? (lang === "mn" ? "Дуртайгаас хасах" : "Remove from favorites") : (lang === "mn" ? "Дуртайд нэмэх" : "Add to favorites")}
                          onClick={() => handleToggleFav(b)}
                          style={{ color: favIds.has(b.id) ? "#f4a261" : undefined }}
                        >
                          <Star size={14} fill={favIds.has(b.id) ? "#f4a261" : "none"} />
                        </button>
                      )}
                      {isMine && confirmId === b.id ? (
                        <>
                          <button className="action-btn delete" onClick={() => confirm(handleDelete)} aria-label={t.admin.confirm_delete}>
                            {t.admin.confirm_yes}
                          </button>
                          <button className="action-btn" onClick={cancel} aria-label={t.common.close}>
                            {t.admin.confirm_no}
                          </button>
                        </>
                      ) : isMine && (
                        <button className="action-btn delete" title={t.database.delete} aria-label={t.database.delete}
                          onClick={() => ask(b.id)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {allFiltered.length === 0 && (
            <div className="empty-state">
              <Database size={40} opacity={0.3} />
              <p>{t.database.no_data}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {allFiltered.length > 0 && (
          <div className="db-pagination">
            <div className="dbp-left">
              <span className="dbp-info">
                {lang === "mn"
                  ? `${allFiltered.length}-аас ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, allFiltered.length)} харуулж байна`
                  : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, allFiltered.length)} of ${allFiltered.length}`}
              </span>
              <select className="dbp-size-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s} {lang === "mn" ? "мөр" : "rows"}</option>)}
              </select>
            </div>
            <div className="dbp-pages">
              <button className="dbp-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>«</button>
              <button className="dbp-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
                const pg = start + i;
                return pg <= totalPages ? (
                  <button key={pg} className={`dbp-btn ${pg === safePage ? "active" : ""}`} onClick={() => setCurrentPage(pg)}>{pg}</button>
                ) : null;
              })}
              <button className="dbp-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
              <button className="dbp-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</button>
            </div>
          </div>
        )}

        {/* ── Building detail panel (inline, below pagination) ── */}
        {resultsBuilding && (
          <ResultsModal
            building={resultsBuilding}
            lang={lang}
            t={t}
            onClose={() => setResultsBuilding(null)}
          />
        )}
      </div>
    </div>
  );
}
