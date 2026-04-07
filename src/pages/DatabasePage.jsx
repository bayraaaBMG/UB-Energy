import { useState, useEffect } from "react";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useConfirm } from "../hooks/useConfirm";
import { useAuth } from "../contexts/AuthContext";
import {
  Database, Download, Search, Trash2, Filter, UserCheck,
  BarChart2, Zap, Ruler, TrendingUp, TrendingDown,
  CheckCircle, Lightbulb, ChevronsUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { buildingsData, monthlyEnergyData } from "../data/mockData";
import { getUserBuildings, deleteUserBuilding } from "../utils/buildingStorage";
import "./DatabasePage.css";

// ─── Colors ───────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  apartment: "#3a8fd4", office: "#2a9d8f", school: "#e9c46a",
  hospital: "#e63946", warehouse: "#a8c5e0", commercial: "#f4a261",
};

// ─── Calculation engine (same as MapPage + insulation/window adjustment) ──────
const FLOOR_HEIGHT = 3.0;
const TYPE_EUI = {
  apartment:  { heating: 120, electric: 35 },
  office:     { heating:  90, electric: 60 },
  school:     { heating: 100, electric: 40 },
  hospital:   { heating: 130, electric: 80 },
  commercial: { heating:  80, electric: 90 },
};
const EF_HEAT = 0.28;
const EF_ELEC = 0.73;
const INSUL_FACTOR = { good: 0.78, medium: 1.0, poor: 1.28 };
const WINDOW_FACTOR = { single: 1.12, double: 1.0, triple: 0.88 };

function calcBuilding(b) {
  const baseEUI  = TYPE_EUI[b.type] || TYPE_EUI.apartment;
  const iF       = INSUL_FACTOR[b.insulation_quality] || 1.0;
  const wF       = WINDOW_FACTOR[b.window_type]       || 1.0;
  const adj      = iF * wF;

  const floors   = b.floors || parseInt(b.total_floors) || 3;
  const height   = floors * FLOOR_HEIGHT;
  const volume   = (b.area || 0) * height;

  const euiH     = Math.round(baseEUI.heating  * adj);
  const euiE     = Math.round(baseEUI.electric * adj);
  const heating  = Math.round((b.area || 0) * euiH);
  const electric = Math.round((b.area || 0) * euiE);
  const total    = heating + electric;
  const co2      = +((heating * EF_HEAT + electric * EF_ELEC) / 1000).toFixed(1);
  const pm25     = Math.round(co2 * 1350);
  const intensity = Math.round(total / (b.area || 1));
  const monthlyPred = Math.round(total / 12);

  const grade =
    intensity < 50  ? "A" : intensity < 100 ? "B" :
    intensity < 150 ? "C" : intensity < 200 ? "D" :
    intensity < 250 ? "E" : intensity < 300 ? "F" : "G";

  const impactLabel = co2 > 60 ? "high" : co2 > 30 ? "medium" : "low";
  const impactColor = { high: "#e63946", medium: "#f4a261", low: "#2a9d8f" }[impactLabel];

  return {
    height, volume, heating, electric, total, co2, pm25, intensity,
    grade, impactLabel, impactColor, monthlyPred,
    euiH, euiE, adj,
  };
}

const GRADE_COLORS = {
  A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20",
};
const GRADES = ["A","B","C","D","E","F","G"];

// Monthly climate fractions
const CITY_ANNUAL = monthlyEnergyData.reduce((s, m) => s + m.usage, 0);
const MONTH_FRACS = monthlyEnergyData.map(m => m.usage / CITY_ANNUAL);
const MONTHS_MN = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Download helpers ─────────────────────────────────────────────────────────
function downloadCSV(data, typeLabels, headers) {
  const rows = data.map(d => [d.id, d.name, typeLabels[d.type] || d.type, d.area, d.usage, d.year, d.district, d.floors]);
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
  const calc = calcBuilding(building);
  const months = mn ? MONTHS_MN : MONTHS_EN;

  const actualMonthly = building.monthly_usage || null;
  const diff = actualMonthly != null
    ? Math.round(((actualMonthly - calc.monthlyPred) / calc.monthlyPred) * 100)
    : null;

  // Monthly chart data — predicted bars + actual line reference
  const chartData = MONTH_FRACS.map((frac, i) => ({
    m:    months[i],
    pred: Math.round(calc.total * frac),
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

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="results-modal card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

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
            <div className="res-grade-badge" style={{ background: GRADE_COLORS[calc.grade] }}>
              {calc.grade}
            </div>
            <button className="chatbot-close" onClick={onClose} aria-label={t.common.close}>✕</button>
          </div>
        </div>

        <div className="res-body">

          {/* ── Key stats ── */}
          <div className="res-stats-row">
            <StatCard
              label={t.database.modal_annual_calc}
              value={calc.total.toLocaleString()}
              unit={t.database.modal_kwh_yr}
              color="#3a8fd4"
            />
            <StatCard
              label={t.database.modal_monthly_pred}
              value={calc.monthlyPred.toLocaleString()}
              unit={t.database.modal_kwh_mo}
              color="#9b72cf"
            />
            <StatCard
              label={t.database.modal_co2}
              value={calc.co2}
              unit={t.database.modal_co2_yr}
              color={calc.impactColor}
              sub={`≈ ${calc.pm25.toLocaleString()} μg PM2.5`}
            />
            <StatCard
              label={t.database.modal_intensity}
              value={calc.intensity}
              unit="kWh/m²"
              color={GRADE_COLORS[calc.grade]}
            />
          </div>

          {/* ── Grade ── */}
          <div className="res-section">
            <div className="res-section-title">
              <BarChart2 size={14} />
              {t.predictor.efficiency_grade}
            </div>
            <GradeBar grade={calc.grade} />
            <div className="res-grade-hint">
              {mn
                ? `Эрч: ${calc.intensity} kWh/м²/жил · Зэрэглэл ${calc.grade} (${
                    calc.grade === "A" ? "маш үр ашигтай" :
                    calc.grade === "B" ? "үр ашигтай" :
                    calc.grade === "C" ? "дунд" :
                    calc.grade === "D" ? "хэвийн" :
                    calc.grade === "E" ? "их хэрэглээтэй" :
                    calc.grade === "F" ? "маш их хэрэглээтэй" : "хэт их хэрэглээтэй"
                  })`
                : `Intensity: ${calc.intensity} kWh/m²/yr · Grade ${calc.grade}`}
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
                  <div className="rcb-value">{calc.monthlyPred.toLocaleString()}</div>
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
                ? `Жилийн нийт тооцоог (${calc.total.toLocaleString()} kWh) УБ-ын сарын хэрэглээний харьцаагаар хуваарилав. Дулаалга: ×${(INSUL_FACTOR[building.insulation_quality]||1).toFixed(2)}, цонх: ×${(WINDOW_FACTOR[building.window_type]||1).toFixed(2)}.`
                : `Annual total (${calc.total.toLocaleString()} kWh) split by UB monthly consumption ratios. Insulation adj: ×${(INSUL_FACTOR[building.insulation_quality]||1).toFixed(2)}, window adj: ×${(WINDOW_FACTOR[building.window_type]||1).toFixed(2)}.`}
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
                <span className="rbd-label">{t.database.modal_height_label}</span>
                <span className="rbd-formula">
                  {building.floors ?? parseInt(building.total_floors) ?? "?"} {t.database.modal_floors_unit} × {FLOOR_HEIGHT}m
                </span>
                <span className="rbd-val">{calc.height} {t.database.modal_height_unit}</span>
              </div>
              <div className="res-bd-row">
                <span className="rbd-label">{t.database.modal_volume_label}</span>
                <span className="rbd-formula">
                  {(building.area||0).toLocaleString()} {t.common.units_sqm} × {calc.height} {t.database.modal_height_unit}
                </span>
                <span className="rbd-val">{calc.volume.toLocaleString()} {t.database.modal_volume_unit}</span>
              </div>
              <div className="res-bd-row">
                <span className="rbd-label">{t.database.modal_heating_load}</span>
                <span className="rbd-formula">
                  {(building.area||0).toLocaleString()} × {calc.euiH} kWh/{t.common.units_sqm}
                </span>
                <span className="rbd-val">{calc.heating.toLocaleString()} kWh</span>
              </div>
              <div className="res-bd-row">
                <span className="rbd-label">{t.database.modal_electricity}</span>
                <span className="rbd-formula">
                  {(building.area||0).toLocaleString()} × {calc.euiE} kWh/{t.common.units_sqm}
                </span>
                <span className="rbd-val">{calc.electric.toLocaleString()} kWh</span>
              </div>
              <div className="res-bd-row total">
                <span className="rbd-label">{t.database.modal_total}</span>
                <span className="rbd-formula">{t.database.modal_heat_elec}</span>
                <span className="rbd-val">{calc.total.toLocaleString()} kWh</span>
              </div>
              <div className="res-bd-row">
                <span className="rbd-label">CO₂</span>
                <span className="rbd-formula">
                  ({calc.heating.toLocaleString()}×0.28 + {calc.electric.toLocaleString()}×0.73) / 1000
                </span>
                <span className="rbd-val" style={{ color: calc.impactColor }}>{calc.co2} {t.predictor.co2_unit}</span>
              </div>
              {calc.adj !== 1 && (
                <div className="res-adj-note">
                  {mn
                    ? `Дулаалга: ${building.insulation_quality || "—"} · Цонх: ${building.window_type || "—"} → тохируулга ×${calc.adj.toFixed(2)}`
                    : `Insulation: ${building.insulation_quality || "—"} · Window: ${building.window_type || "—"} → adjustment ×${calc.adj.toFixed(2)}`}
                </div>
              )}
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

        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DatabasePage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.database);
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [resultsBuilding, setResultsBuilding] = useState(null);
  const { confirmId, ask, confirm, cancel } = useConfirm();
  const isAdmin = user?.role === "admin";
  const [userRecords, setUserRecords] = useState(() => getUserBuildings(isAdmin ? null : user?.id));
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

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
  const csvHeaders = ["ID", t.database.building, t.database.type, t.database.area, t.common.usage, t.database.year, t.database.district, t.database.floors];

  const allBuildings = [
    ...buildingsData.map(b => ({ ...b, source: "mock" })),
    ...userRecords,
  ];

  const SORT_FNS = {
    name:          (a, b) => a.name.localeCompare(b.name),
    type:          (a, b) => a.type.localeCompare(b.type),
    area:          (a, b) => (a.area || 0) - (b.area || 0),
    monthly_usage: (a, b) => (a.monthly_usage || 0) - (b.monthly_usage || 0),
    usage:         (a, b) => (a.usage || 0) - (b.usage || 0),
    year:          (a, b) => (a.year || 0) - (b.year || 0),
    district:      (a, b) => (a.district || "").localeCompare(b.district || ""),
    floors:        (a, b) => (a.floors || 0) - (b.floors || 0),
  };

  const filtered = allBuildings
    .filter(b => {
      const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.district || "").toLowerCase().includes(search.toLowerCase());
      const matchType   = typeFilter === "all" || b.type === typeFilter;
      const isUserRecord = b.source === "user" || b.source === "predictor";
      const matchSource = sourceFilter === "all"
        || (sourceFilter === "mock" && b.source === "mock")
        || (sourceFilter === "mine" && isUserRecord);
      return matchSearch && matchType && matchSource;
    })
    .sort((a, b) => {
      const cmp = (SORT_FNS[sortKey] || SORT_FNS.name)(a, b);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const handleDelete = (id) => {
    deleteUserBuilding(id);
    setUserRecords(getUserBuildings(isAdmin ? null : user?.id));
  };

  return (
    <div className="database-page">
      <div className="container">
        <div className="page-header">
          <h1><Database size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.database.title}</h1>
          <p>{t.database.subtitle}</p>
        </div>

        {/* Controls */}
        <div className="db-controls card mb-3">
          <div className="db-controls-left">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input className="search-input" placeholder={t.database.search}
                aria-label={t.database.search}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="type-filter">
              <Filter size={14} />
              <select className="form-select" style={{ width: "auto" }}
                value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">{t.database.all_types}</option>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="type-filter">
              <UserCheck size={14} />
              <select className="form-select" style={{ width: "auto" }}
                value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                <option value="all">{t.database.filter_all}</option>
                <option value="mock">{t.database.filter_sample}</option>
                <option value="mine">{isAdmin ? t.database.filter_user_all : t.database.filter_mine}</option>
              </select>
            </div>
          </div>
          <div className="db-download-btns">
            <button className="btn btn-secondary" onClick={() => downloadCSV(filtered, typeLabels, csvHeaders)}>
              <Download size={16} />{t.database.download_csv}
            </button>
            <button className="btn btn-secondary" onClick={() => downloadJSON(filtered)}>
              <Download size={16} />{t.database.download_json}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="db-stats mb-3">
          <span className="db-stat-badge">{t.database.total_buildings}: <strong>{filtered.length}</strong> {t.database.buildings_unit}</span>
          <span className="db-stat-badge">
            {t.database.total_area}: <strong>{filtered.reduce((s, b) => s + (b.area || 0), 0).toLocaleString()}</strong> {t.common.units_sqm}
          </span>
          <span className="db-stat-badge">
            {t.database.total_usage}: <strong>{filtered.reduce((s, b) => s + (b.usage || 0), 0).toLocaleString()}</strong> {t.common.units_kwh}
          </span>
          {userRecords.length > 0 && (
            <span className="db-stat-badge user-badge">
              <UserCheck size={13} />
              {isAdmin ? t.database.user_records_label : t.database.my_records_label}: <strong>{userRecords.length} {t.admin.buildings_unit}</strong>
              {userRecords.filter(b => b.source === "predictor").length > 0 && (
                <span style={{ opacity: 0.7, fontWeight: 400, fontSize: "0.75rem" }}>
                  {" "}({userRecords.filter(b => b.source === "predictor").length} {t.database.predicted_tag})
                </span>
              )}
            </span>
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
                  { key: "monthly_usage", label: t.database.monthly_kwh_col },
                  { key: "usage",         label: t.database.usage },
                  { key: "year",          label: t.database.year },
                  { key: "district",      label: t.database.district },
                  { key: "floors",        label: t.database.floors },
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
                    {b.monthly_usage != null
                      ? <span className="usage-val mid">{Number(b.monthly_usage).toLocaleString()} {t.common.units_kwh}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <span className={`usage-val ${(b.usage || 0) > 80000 ? "high" : (b.usage || 0) > 40000 ? "mid" : "low"}`}>
                      {(b.usage || 0).toLocaleString()} {t.common.units_kwh}
                    </span>
                  </td>
                  <td>{b.year}</td>
                  <td>{b.district}</td>
                  <td>{b.floors != null ? `${b.floors} ${t.database.floors_display}` : "—"}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="action-btn view results-btn"
                        title={t.database.view_results}
                        aria-label={t.database.view_results}
                        onClick={() => setResultsBuilding(b)}
                      >
                        <BarChart2 size={14} />
                      </button>
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

          {filtered.length === 0 && (
            <div className="empty-state">
              <Database size={40} opacity={0.3} />
              <p>{t.database.no_data}</p>
            </div>
          )}
        </div>
      </div>

      {resultsBuilding && (
        <ResultsModal
          building={resultsBuilding}
          lang={lang}
          t={t}
          onClose={() => setResultsBuilding(null)}
        />
      )}
    </div>
  );
}
