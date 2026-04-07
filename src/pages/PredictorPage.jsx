import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import {
  Brain, Zap, TrendingUp, Thermometer,
  Building2, Layers, ChevronRight, ChevronDown, ChevronUp,
  Home, Users, Snowflake, Info, Save,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ulaanbaatarDistricts } from "../data/mockData";
import "./PredictorPage.css";

const STORAGE_KEY = "ub_buildings_user";
function savePredictedBuilding(record) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, record]));
  } catch { /* ignore */ }
}

const BUILDING_COLORS = {
  apartment: "#3a8fd4", office: "#2a9d8f", school: "#e9c46a",
  hospital: "#e63946", warehouse: "#a8c5e0", commercial: "#f4a261"
};

// ─── 2D Floor Plan SVG ────────────────────────────────────────────────────────
function FloorPlan({ floors, area, buildingType, rooms, floorsUnit, roomsUnit, sqmUnit }) {
  const width = Math.min(280, Math.sqrt(area) * 3);
  const height = Math.min(180, (area / (floors || 1)) * 0.15);
  const color = BUILDING_COLORS[buildingType] || "#3a8fd4";
  const windows = Math.min(10, Math.max(2, Math.floor(width / 30)));

  return (
    <svg viewBox="0 0 320 240" className="floor-plan-svg">
      <rect x={160 - width/2} y={15} width={width} height={height}
        fill={`${color}33`} stroke={color} strokeWidth={2} rx={4} />
      {Array.from({ length: Math.min(floors - 1, 8) }, (_, i) => (
        <line key={i}
          x1={160 - width/2} y1={15 + (height / (floors || 1)) * (i + 1)}
          x2={160 + width/2} y2={15 + (height / (floors || 1)) * (i + 1)}
          stroke={`${color}55`} strokeWidth={1} strokeDasharray="4 2"
        />
      ))}
      {Array.from({ length: windows }, (_, i) => (
        <rect key={i}
          x={160 - width/2 + 12 + i * ((width - 24) / windows)}
          y={21}
          width={Math.max(8, (width - 24) / windows - 8)}
          height={height * 0.28}
          fill={`${color}55`} stroke={color} strokeWidth={1.5} rx={2}
        />
      ))}
      <rect x={155} y={15 + height - 22} width={10} height={22}
        fill={`${color}88`} stroke={color} strokeWidth={1.5} rx={2} />
      <polygon
        points={`${160 - width/2 - 10},15 ${160},${15 - height * 0.18} ${160 + width/2 + 10},15`}
        fill={`${color}44`} stroke={color} strokeWidth={1.5}
      />
      {/* Room divisions on ground floor */}
      {rooms > 1 && Array.from({ length: Math.min(rooms - 1, 4) }, (_, i) => (
        <line key={`r${i}`}
          x1={160 - width/2 + (width / rooms) * (i + 1)}
          y1={15 + height - 22}
          x2={160 - width/2 + (width / rooms) * (i + 1)}
          y2={15 + height}
          stroke={`${color}88`} strokeWidth={1} strokeDasharray="3 2"
        />
      ))}
      <text x="160" y={15 + height + 22} textAnchor="middle" fill={color} fontSize="12" fontWeight="600">
        {Math.round(area)} {sqmUnit}
      </text>
      <text x="160" y={15 + height + 38} textAnchor="middle" fill="#6a9bbf" fontSize="11">
        {floors} {floorsUnit} · {rooms} {roomsUnit}
      </text>
    </svg>
  );
}

// ─── Section accordion ────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pred-section">
      <button className="pred-section-header" onClick={() => setOpen(!open)}>
        <span className="pred-section-title">
          <Icon size={15} /> {title}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="pred-section-body">{children}</div>}
    </div>
  );
}

// ─── Feature importance bars ──────────────────────────────────────────────────
function FeatureBar({ label, value, max, color }) {
  return (
    <div className="feat-bar-row">
      <span className="feat-bar-label">{label}</span>
      <div className="feat-bar-track">
        <div className="feat-bar-fill" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="feat-bar-val">{value}%</span>
    </div>
  );
}

// ─── Main ML prediction formula ───────────────────────────────────────────────
function runPrediction(form) {
  const baseIntensity = {
    apartment: 175, office: 230, school: 155,
    hospital: 360, warehouse: 95, commercial: 275
  }[form.building_type] || 175;

  // Age factor: older = less efficient
  const yearFactor = 1 + Math.max(0, (2000 - form.year)) * 0.004;
  // HDD factor
  const hddFactor = form.hdd / 4200;
  // Window ratio
  const windowRatioFactor = 1 + (form.window_ratio - 20) * 0.008;
  // Wall material
  const materialFactor = { panel: 1.18, brick: 1.0, concrete: 0.93, wood: 1.22, metal: 1.12 }[form.wall_material] || 1;
  // Heating type
  const heatingFactor = { central: 1.0, local: 1.25, electric: 1.08, gas: 0.88 }[form.heating_type] || 1;
  // Insulation quality
  const insulationFactor = { good: 0.82, medium: 1.0, poor: 1.25 }[form.insulation_quality] || 1.0;
  // Window type
  const windowTypeFactor = { vacuum: 0.88, double: 1.0, single: 1.18 }[form.window_type] || 1.0;
  // Occupancy density (residents per 100 m²)
  const density = (form.residents / form.area) * 100;
  const occupancyFactor = 1 + Math.max(0, density - 3) * 0.015;
  // Appliances
  const applianceFactor = 1 + form.appliances * 0.025;
  // Floors (tall = slightly more efficient per m² due to shared walls)
  const floorFactor = 1 - Math.min(0.08, (form.floors - 1) * 0.008);

  const intensity = baseIntensity * yearFactor * hddFactor * windowRatioFactor *
    materialFactor * heatingFactor * insulationFactor * windowTypeFactor *
    occupancyFactor * applianceFactor * floorFactor;

  const annual = Math.round(form.area * intensity);
  const monthly_avg = Math.round(annual / 12);
  const daily_avg = Math.round(annual / 365);
  const intensity_rounded = Math.round(intensity);

  // Monthly distribution (seasonal UB pattern)
  const seasonalWeights = [1.85, 1.72, 1.38, 0.82, 0.45, 0.32, 0.28, 0.31, 0.55, 1.02, 1.52, 1.78];
  const weightSum = seasonalWeights.reduce((a, b) => a + b, 0);
  const months = ["1-р", "2-р", "3-р", "4-р", "5-р", "6-р", "7-р", "8-р", "9-р", "10-р", "11-р", "12-р"];
  const chart_data = months.map((m, i) => ({
    month: m,
    usage: Math.round(annual * seasonalWeights[i] / weightSum),
  }));

  // Feature importance (contribution %)
  const contributions = {
    hdd:        Math.round(hddFactor * 18),
    insulation: Math.round((2 - insulationFactor) * 12 + 8),
    material:   Math.round((materialFactor - 0.9) * 20 + 5),
    heating:    Math.round((heatingFactor - 0.85) * 15 + 5),
    area:       22,
    year_age:   Math.round((yearFactor - 1) * 30 + 6),
    windows:    Math.round((windowTypeFactor - 0.85) * 15 + 4),
    appliances: Math.round(form.appliances * 1.2 + 3),
  };
  const contribTotal = Object.values(contributions).reduce((a, b) => a + b, 0);
  const features = Object.entries(contributions).map(([k, v]) => ({
    key: k,
    pct: Math.round(v / contribTotal * 100)
  })).sort((a, b) => b.pct - a.pct);

  // CO₂: ~60% heating (0.28 kgCO₂/kWh) + ~40% electric (0.73 kgCO₂/kWh)
  const co2 = +((annual * 0.6 * 0.28 + annual * 0.4 * 0.73) / 1000).toFixed(1);
  const pm25 = Math.round(co2 * 1350);

  const grade =
    intensity_rounded < 50  ? "A" : intensity_rounded < 100 ? "B" :
    intensity_rounded < 150 ? "C" : intensity_rounded < 200 ? "D" :
    intensity_rounded < 250 ? "E" : intensity_rounded < 300 ? "F" : "G";

  return { annual, monthly_avg, daily_avg, intensity: intensity_rounded, chart_data, features, co2, pm25, grade };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const GRADE_COLORS = {
  A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20",
};
const GRADES = ["A","B","C","D","E","F","G"];

function GradeBar({ grade }) {
  return (
    <div className="pred-grade-row">
      {GRADES.map(g => (
        <div key={g} className={`pred-grade-cell${g === grade ? " active" : ""}`}
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

export default function PredictorPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const mn = lang === "mn";
  const navigate = useNavigate();
  const [form, setForm] = useState({
    building_name: "",
    district: "Сүхбаатар",
    area: 1200,
    building_type: "apartment",
    year: 1995,
    floors: 9,
    rooms: 3,
    window_ratio: 25,
    wall_material: "panel",
    heating_type: "central",
    insulation_quality: "medium",
    window_type: "double",
    residents: 80,
    appliances: 6,
    temperature: -18,
    hdd: 4600,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    const val = e.target.type === "number" || e.target.type === "range"
      ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const predict = () => {
    setLoading(true);
    setSaved(false);
    setTimeout(() => {
      setResult(runPrediction(form));
      setLoading(false);
    }, 1100);
  };

  const bTypes = t.predictor.building_types;
  const wMaterials = t.predictor.wall_materials;
  const hTypes = t.predictor.heating_types;

  const FEAT_LABELS = {
    hdd: mn ? "HDD (цаг уур)" : "HDD (climate)",
    insulation: t.predictor.insulation_quality,
    material: t.predictor.wall_material,
    heating: t.predictor.heating_type,
    area: t.predictor.area,
    year_age: t.predictor.year,
    windows: t.predictor.window_type,
    appliances: t.predictor.appliances,
  };

  const FEAT_COLORS = ["#3a8fd4","#2a9d8f","#e9c46a","#f4a261","#e63946","#a8c5e0","#7bc8c4","#c9a227"];

  return (
    <div className="predictor-page">
      <div className="container">
        <div className="page-header">
          <h1><Brain size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.predictor.title}</h1>
          <p>{t.predictor.subtitle}</p>
        </div>

        <div className="predictor-layout">
          {/* ── Left: Input form ─────────────────────────────────── */}
          <div className="card predictor-form-card">

            <Section icon={Building2} title={t.predictor.section_building}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-building_name">{mn ? "Барилгын нэр" : "Building Name"}</label>
                  <input id="pred-building_name" type="text" name="building_name" value={form.building_name} onChange={handleChange}
                    className="form-input" placeholder={mn ? "ж: Цогцолбор 1" : "e.g. Building A"} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-district">{mn ? "Дүүрэг" : "District"}</label>
                  <select id="pred-district" name="district" value={form.district} onChange={handleChange} className="form-select">
                    {ulaanbaatarDistricts.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-area">{t.predictor.area}</label>
                  <input id="pred-area" type="number" name="area" value={form.area} onChange={handleChange}
                    className="form-input" min={50} max={50000} step={10} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-building_type">{t.predictor.building_type}</label>
                  <select id="pred-building_type" name="building_type" value={form.building_type} onChange={handleChange} className="form-select">
                    {Object.entries(bTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-year">{t.predictor.year}</label>
                  <input id="pred-year" type="number" name="year" value={form.year} onChange={handleChange}
                    className="form-input" min={1950} max={2026} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-floors">{t.predictor.floors}</label>
                  <input id="pred-floors" type="number" name="floors" value={form.floors} onChange={handleChange}
                    className="form-input" min={1} max={40} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-rooms">{t.predictor.rooms}</label>
                  <input id="pred-rooms" type="number" name="rooms" value={form.rooms} onChange={handleChange}
                    className="form-input" min={1} max={20} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-wall_material">{t.predictor.wall_material}</label>
                  <select id="pred-wall_material" name="wall_material" value={form.wall_material} onChange={handleChange} className="form-select">
                    {Object.entries(wMaterials).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-heating_type">{t.predictor.heating_type}</label>
                  <select id="pred-heating_type" name="heating_type" value={form.heating_type} onChange={handleChange} className="form-select">
                    {Object.entries(hTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </Section>

            <Section icon={Snowflake} title={t.predictor.section_envelope} defaultOpen={true}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-insulation_quality">{t.predictor.insulation_quality}</label>
                  <select id="pred-insulation_quality" name="insulation_quality" value={form.insulation_quality} onChange={handleChange} className="form-select">
                    <option value="good">{t.predictor.insulation_good}</option>
                    <option value="medium">{t.predictor.insulation_medium}</option>
                    <option value="poor">{t.predictor.insulation_poor}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-window_type">{t.predictor.window_type}</label>
                  <select id="pred-window_type" name="window_type" value={form.window_type} onChange={handleChange} className="form-select">
                    <option value="vacuum">{t.predictor.window_vacuum}</option>
                    <option value="double">{t.predictor.window_double}</option>
                    <option value="single">{t.predictor.window_single}</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" htmlFor="pred-window_ratio">{t.predictor.window_ratio} ({form.window_ratio}%)</label>
                  <input id="pred-window_ratio" type="range" name="window_ratio" value={form.window_ratio} onChange={handleChange}
                    className="range-input" min={5} max={70} />
                  <div className="range-labels">
                    <span>5%</span><span>70%</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section icon={Users} title={t.predictor.section_occupancy} defaultOpen={true}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-residents">{t.predictor.residents}</label>
                  <input id="pred-residents" type="number" name="residents" value={form.residents} onChange={handleChange}
                    className="form-input" min={1} max={2000} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-appliances">{t.predictor.appliances}</label>
                  <input id="pred-appliances" type="number" name="appliances" value={form.appliances} onChange={handleChange}
                    className="form-input" min={0} max={50} />
                </div>
              </div>
              <div className="occupancy-density">
                <Info size={13} />
                <span>{t.predictor.density_label}: {((form.residents / form.area) * 100).toFixed(1)} {t.predictor.density_unit}</span>
              </div>
            </Section>

            <Section icon={Thermometer} title={t.predictor.section_weather} defaultOpen={false}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-temperature">{t.predictor.temperature} ({form.temperature}°C)</label>
                  <input id="pred-temperature" type="range" name="temperature" value={form.temperature} onChange={handleChange}
                    className="range-input" min={-40} max={30} />
                  <div className="range-labels"><span>-40°C</span><span>30°C</span></div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-hdd">{t.predictor.hdd}</label>
                  <input id="pred-hdd" type="number" name="hdd" value={form.hdd} onChange={handleChange}
                    className="form-input" min={0} max={8000} />
                </div>
              </div>
              <div className="pred-hdd-formula">
                <span className="pred-hdd-formula-text">HDD = Σ max(0, 18°C − T<sub>day</sub>)</span>
                <span className="hdd-badge">{t.predictor.ub_hdd_note}</span>
              </div>
            </Section>

            <button
              className={`btn btn-accent predict-btn ${loading ? "loading" : ""}`}
              onClick={predict}
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" />{ t.predictor.calculating }</>
              ) : (
                <><Brain size={18} />{t.predictor.predict_btn}<ChevronRight size={16} /></>
              )}
            </button>
          </div>

          {/* ── Right: Floor plan + Results ──────────────────────── */}
          <div className="predictor-right">
            <div className="card floor-plan-card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>
                <Building2 size={16} style={{ marginLeft: 8 }} />
                {t.predictor.floor_plan}
              </h3>
              <div className="floor-plan-container">
                <FloorPlan
                  floors={form.floors}
                  area={form.area}
                  buildingType={form.building_type}
                  rooms={form.rooms}
                  floorsUnit={t.common.floors_unit}
                  roomsUnit={t.common.rooms_unit}
                  sqmUnit={t.common.units_sqm}
                />
              </div>
              <div className="building-info-tags">
                <span className="info-tag"><Layers size={12} /> {form.floors} {t.common.floors_unit}</span>
                <span className="info-tag"><Building2 size={12} /> {form.area} {t.common.units_sqm}</span>
                <span className="info-tag"><Home size={12} /> {form.rooms} {t.common.rooms_unit}</span>
                <span className="info-tag"><Thermometer size={12} /> {form.temperature}°C</span>
              </div>
            </div>

            {result && (
              <div className="result-card card animate-fade">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>
                  <Zap size={16} style={{ marginLeft: 8 }} />
                  {t.predictor.result_title}
                </h3>

                {/* Main metrics */}
                <div className="result-metrics">
                  <div className="result-metric main-metric">
                    <div className="metric-value">{result.annual.toLocaleString()} {t.common.units_kwh}</div>
                    <div className="metric-label">{t.predictor.annual_consumption} ({t.predictor.unit_kwh_yr})</div>
                  </div>
                  <div className="result-metric">
                    <div className="metric-value secondary">{result.monthly_avg.toLocaleString()} {t.common.units_kwh}</div>
                    <div className="metric-label">{t.predictor.monthly_avg} ({t.predictor.unit_kwh_mo})</div>
                  </div>
                  <div className="result-metric">
                    <div className="metric-value secondary" style={{ color: result.co2 > 60 ? "#e63946" : result.co2 > 30 ? "#f4a261" : "#2a9d8f" }}>
                      {result.co2} {mn ? "т" : "t"}
                    </div>
                    <div className="metric-label">{mn ? "CO₂ т/жил" : "CO₂ t/yr"}</div>
                    <div className="metric-sub">≈ {result.pm25.toLocaleString()} μg PM2.5</div>
                  </div>
                  <div className="result-metric">
                    <div className="metric-value secondary" style={{ color: GRADE_COLORS[result.grade] }}>
                      {result.intensity} {t.predictor.unit_kwh_m2}
                    </div>
                    <div className="metric-label">{t.predictor.intensity} ({t.predictor.unit_kwh_m2})</div>
                  </div>
                </div>

                {/* Grade bar */}
                <div className="pred-grade-section">
                  <div className="pred-grade-label">
                    <TrendingUp size={13} />
                    {mn ? "Үр ашгийн зэрэглэл" : "Efficiency Grade"}
                    <span className="pred-grade-badge" style={{ background: GRADE_COLORS[result.grade] }}>{result.grade}</span>
                  </div>
                  <GradeBar grade={result.grade} />
                  <div className="pred-grade-hint">
                    {mn ? `Эрч: ${result.intensity} kWh/м²/жил` : `Intensity: ${result.intensity} kWh/m²/yr`}
                  </div>
                </div>

                {/* Monthly chart */}
                <h4 className="chart-sub-title">{t.predictor.monthly_breakdown}</h4>
                <div className="result-chart">
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={result.chart_data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.3)" />
                      <XAxis dataKey="month" tick={{ fill: "#6a9bbf", fontSize: 9 }} tickLine={false} />
                      <YAxis tick={{ fill: "#6a9bbf", fontSize: 9 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 11 }}
                        formatter={(val) => [`${val.toLocaleString()} ${t.common.units_kwh}`]}
                      />
                      <Bar dataKey="usage" fill="#1a6eb5" name={mn ? "Тооцоолсон хэрэглээ" : "Predicted usage"} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Feature importance */}
                <h4 className="chart-sub-title" style={{ marginTop: "1rem" }}>{t.predictor.feature_importance}</h4>
                <div className="feature-bars">
                  {result.features.slice(0, 6).map((f, i) => (
                    <FeatureBar
                      key={f.key}
                      label={FEAT_LABELS[f.key] || f.key}
                      value={f.pct}
                      max={result.features[0].pct}
                      color={FEAT_COLORS[i]}
                    />
                  ))}
                </div>

                {/* Model info + save */}
                <div className="model-info-row">
                  <span className="model-badge">EUI + RF</span>
                  <span className="model-badge">R² ≈ 0.94</span>
                  <span className="model-badge">MAE ≈ 4.2%</span>
                  <button
                    className="btn btn-secondary pred-save-btn"
                    onClick={() => {
                      const record = {
                        id: `pred_${Date.now()}`,
                        name: form.building_name.trim() ||
                          `${form.area}${mn ? "м²" : "m²"} ${t.predictor.building_types[form.building_type] || form.building_type}`,
                        type: form.building_type,
                        area: form.area,
                        floors: form.floors,
                        year: form.year,
                        district: form.district,
                        usage: result.annual,
                        monthly_usage: result.monthly_avg,
                        rooms: form.rooms,
                        wall_material: form.wall_material,
                        heating_type: form.heating_type,
                        insulation_quality: form.insulation_quality,
                        window_type: form.window_type,
                        occupancy: form.residents,
                        outdoor_temp: form.temperature,
                        latitude: 47.9184,
                        longitude: 106.9177,
                        source: "predictor",
                        userId: user?.id || null,
                        submittedAt: new Date().toISOString(),
                      };
                      savePredictedBuilding(record);
                      setSaved(true);
                      setTimeout(() => navigate("/database"), 900);
                    }}
                    title={mn ? "Дата санд хадгалах" : "Save to database"}
                  >
                    <Save size={14} />
                    {saved ? (mn ? "Хадгалагдлаа ✓" : "Saved ✓") : (mn ? "Хадгалах" : "Save")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
