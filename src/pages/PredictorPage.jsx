import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import { useAuth } from "../contexts/AuthContext";
import {
  Brain, Zap, TrendingUp,
  Building2, Layers, ChevronRight, ChevronDown, ChevronUp,
  Home, Snowflake, Info, Save, X, Bookmark,
  Flame, Lightbulb, AlertTriangle, CheckCircle, DollarSign, FlaskConical,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ulaanbaatarDistricts } from "../data/mockData";
import {
  predict, METRICS, GRADE_COLORS,
  convertElecMoneyToKwh, convertHeatBillToEstimates,
  predictHeating, generateRecommendations, CASE_STUDIES,
  TARIFF_TIERS,
} from "../ml/model";
import { saveUserBuilding } from "../utils/buildingStorage";
import { savePrediction, saveScenario } from "../utils/userDataStorage";
import "./PredictorPage.css";

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
  const bodyId = `pred-section-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="pred-section">
      <button
        className="pred-section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="pred-section-title">
          <Icon size={15} /> {title}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div id={bodyId} className="pred-section-body">{children}</div>}
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

// ─── Page ─────────────────────────────────────────────────────────────────────
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
  usePageTitle(t.nav.predictor);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
  });
  const [result, setResult] = useState(null);
  const [heating, setHeating] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resultTab, setResultTab] = useState("elec");
  const [elecBill, setElecBill] = useState("");
  const [heatBill, setHeatBill] = useState("");
  const [baseline, setBaseline] = useState(null); // { form, result, label }
  const [scenLabel, setScenLabel] = useState("");
  const [showScenModal, setShowScenModal] = useState(false);
  const [scenSaved, setScenSaved] = useState(false);

  // Load scenario from My Space
  useEffect(() => {
    const s = location.state?.scenario;
    if (s?.form) {
      setForm(f => ({ ...f, ...s.form }));
    }
  }, [location.state]);

  const handleChange = (e) => {
    const val = e.target.type === "number" || e.target.type === "range"
      ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const runModel = () => {
    setLoading(true);
    setSaved(false);
    setResultTab("elec");
    setTimeout(() => {
      // Auto-derive occupancy/equipment from area + building type (hidden from UI)
      const resPer100 = { apartment: 5, office: 3, school: 4, hospital: 6, commercial: 2, warehouse: 1 };
      const appPer100 = { apartment: 8, office: 5, school: 4, hospital: 10, commercial: 6, warehouse: 3 };
      const enriched = {
        ...form,
        hdd:       4500,
        residents: Math.max(1, Math.round(form.area / 100 * (resPer100[form.building_type] || 4))),
        appliances: Math.min(50, Math.max(2, Math.round(form.area / 100 * (appPer100[form.building_type] || 6)))),
      };
      const r   = predict(enriched);
      const h   = predictHeating(enriched);
      const rec = generateRecommendations(enriched, r, lang);
      setResult(r);
      setHeating(h);
      setRecs(rec);
      setLoading(false);
      // Auto-save to prediction history
      if (user?.id) {
        savePrediction(user.id, {
          form: { ...enriched, name: form.building_name || `${form.area}м² ${form.building_type}`, grade: r.grade },
          result: r.annual,
          heating: h,
        });
      }
    }, 900);
  };

  const bTypes = t.predictor.building_types;
  const wMaterials = t.predictor.wall_materials;
  const hTypes = t.predictor.heating_types;

  // Maps ML feature keys → human-readable labels
  const FEAT_LABELS = {
    area: t.predictor.area,
    age: t.predictor.year,
    floors: t.predictor.floors,
    rooms: t.predictor.rooms,
    hdd: t.predictor.hdd_climate,
    density: t.predictor.density_label,
    appliances: t.predictor.appliances,
    window_ratio: t.predictor.window_ratio,
    bt_apartment: bTypes.apartment, bt_office: bTypes.office,
    bt_school: bTypes.school, bt_hospital: bTypes.hospital, bt_warehouse: bTypes.warehouse,
    mat_panel: wMaterials.panel, mat_brick: wMaterials.brick,
    mat_concrete: wMaterials.concrete, mat_wood: wMaterials.wood,
    heat_central: hTypes.central, heat_local: hTypes.local, heat_electric: hTypes.electric,
    ins_good: t.predictor.insulation_good, ins_medium: t.predictor.insulation_medium,
    win_single: t.predictor.window_single, win_double: t.predictor.window_double,
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
                  <label className="form-label" htmlFor="pred-building_name">{t.dataInput.building_name}</label>
                  <input id="pred-building_name" type="text" name="building_name" value={form.building_name} onChange={handleChange}
                    className="form-input" placeholder={t.predictor.building_name_placeholder} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-district">{t.dataInput.district}</label>
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

            {/* ── Сарын зардалаас тооцоолох ── */}
            <Section icon={DollarSign} title={lang === "mn" ? "Сарын зардалаас тооцоолох" : "Estimate from monthly costs"} defaultOpen={true}>
              <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: "0.9rem", lineHeight: 1.6 }}>
                {lang === "mn"
                  ? "Сарын нэхэмжлэлийн дүнгээ оруулна уу. Тариф болон норматив дээр үндэслэн автоматаар тооцоолно."
                  : "Enter your monthly bill amounts. Estimates are calculated automatically based on tariffs and norms."}
              </p>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">
                    <Zap size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {lang === "mn" ? "Цахилгааны зардал (₮/сар)" : "Electricity cost (₮/month)"}
                  </label>
                  <input className="form-input" type="number"
                    placeholder={lang === "mn" ? "Жишээ: 35,000" : "e.g. 35,000"}
                    value={elecBill} onChange={e => setElecBill(e.target.value)} min={0} />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <Flame size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {lang === "mn" ? "Халаалтын зардал (₮/сар)" : "Heating cost (₮/month)"}
                  </label>
                  <input className="form-input" type="number"
                    placeholder={lang === "mn" ? "Жишээ: 80,000" : "e.g. 80,000"}
                    value={heatBill} onChange={e => setHeatBill(e.target.value)} min={0} />
                </div>
              </div>

              {(parseFloat(elecBill) > 0 || parseFloat(heatBill) > 0) && (() => {
                const ec = parseFloat(elecBill) > 0 ? convertElecMoneyToKwh(parseFloat(elecBill)) : null;
                const hc = parseFloat(heatBill) > 0 ? convertHeatBillToEstimates(parseFloat(heatBill)) : null;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", marginTop: "0.85rem" }}>
                    {ec && (<>
                      <div style={{ background: "rgba(26,110,181,0.09)", border: "1px solid rgba(26,110,181,0.28)", borderRadius: 10, padding: "0.85rem" }}>
                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1a6eb5" }}>{ec.kwh_monthly.toLocaleString()} кВт·цаг</div>
                        <div style={{ fontSize: "0.71rem", color: "var(--text3)", marginTop: 3 }}>{lang === "mn" ? "Сарын цахилгааны хэрэглээ" : "Monthly electricity use"}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4, padding: "0.2rem 0.5rem", background: "rgba(26,110,181,0.12)", borderRadius: 6, display: "inline-block" }}>
                          {lang === "mn" ? `${ec.effective_rate}₮/кВт·цаг · шат ${ec.tier}` : `${ec.effective_rate}₮/kWh · tier ${ec.tier}`}
                        </div>
                      </div>
                      <div style={{ background: "rgba(58,143,212,0.09)", border: "1px solid rgba(58,143,212,0.28)", borderRadius: 10, padding: "0.85rem" }}>
                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#3a8fd4" }}>{ec.kwh_annual.toLocaleString()} кВт·цаг</div>
                        <div style={{ fontSize: "0.71rem", color: "var(--text3)", marginTop: 3 }}>{lang === "mn" ? "Жилийн тооцоолол" : "Annual estimate"}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>{lang === "mn" ? "× 12 сар" : "× 12 months"}</div>
                      </div>
                    </>)}
                    {hc && (<>
                      <div style={{ background: "rgba(244,162,97,0.09)", border: "1px solid rgba(244,162,97,0.28)", borderRadius: 10, padding: "0.85rem" }}>
                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f4a261" }}>{hc.heat_gcal_monthly} Гкал</div>
                        <div style={{ fontSize: "0.71rem", color: "var(--text3)", marginTop: 3 }}>{lang === "mn" ? "Сарын дулаан" : "Monthly heating"}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>≈ {hc.heat_tugrug_monthly.toLocaleString()}₮ · {hc.heat_gcal_annual} Гкал/{lang === "mn" ? "жил" : "yr"}</div>
                      </div>
                      <div style={{ background: "rgba(42,157,143,0.09)", border: "1px solid rgba(42,157,143,0.28)", borderRadius: 10, padding: "0.85rem" }}>
                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#2a9d8f" }}>{hc.water_m3_monthly} м³</div>
                        <div style={{ fontSize: "0.71rem", color: "var(--text3)", marginTop: 3 }}>{lang === "mn" ? "Сарын усны хэрэглээ" : "Monthly water use"}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>≈ {hc.water_tugrug_monthly.toLocaleString()}₮ · {hc.water_m3_annual} м³/{lang === "mn" ? "жил" : "yr"}</div>
                      </div>
                    </>)}
                  </div>
                );
              })()}

              {(parseFloat(elecBill) > 0 || parseFloat(heatBill) > 0) && (
                <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: "0.65rem", lineHeight: 1.6, display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {TARIFF_TIERS.map((tier, i) => (
                    <span key={i} style={{ padding: "0.15rem 0.55rem", borderRadius: 20, fontSize: "0.69rem", fontWeight: 600, background: "var(--bg3)", color: "var(--text3)", border: "1px solid var(--border)" }}>
                      {tier.label}: {tier.rate}₮
                    </span>
                  ))}
                  <span style={{ marginLeft: "auto" }}>{lang === "mn" ? "Эх сурвалж: УБЦТС, УСУГ, УБ ДС ТӨХК 2024" : "Sources: УБЦТС, УСУГ, UB DHN ТӨХК 2024"}</span>
                </div>
              )}
            </Section>

            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button
                className={`btn btn-accent predict-btn ${loading ? "loading" : ""}`}
                onClick={runModel}
                disabled={loading}
                aria-busy={loading}
                style={{ flex: 1 }}
              >
                {loading ? (
                  <><span className="spinner" />{ t.predictor.calculating }</>
                ) : (
                  <><Brain size={18} />{t.predictor.predict_btn}<ChevronRight size={16} /></>
                )}
              </button>
              {result && (
                <button
                  className="btn btn-secondary"
                  title={lang === "mn" ? "Одоогийн үр дүнг суурь болгон хадгалах" : "Save current result as baseline for comparison"}
                  onClick={() => setBaseline({ form: { ...form }, result, label: form.building_name || `${form.area}m² ${form.building_type}` })}
                  style={{ flexShrink: 0 }}
                >
                  <FlaskConical size={14} />
                  {lang === "mn" ? "Суурь хадгалах" : "Set baseline"}
                </button>
              )}
            </div>
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
              </div>
            </div>

            {result && (
              <div className="result-card card animate-fade" aria-live="polite" aria-atomic="true">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>
                  <Zap size={16} style={{ marginLeft: 8 }} />
                  {t.predictor.result_title}
                </h3>

                {/* Result Tabs */}
                <div className="result-tabs" style={{ display: "flex", gap: "0.3rem", marginBottom: "1.1rem", background: "var(--bg3)", padding: "0.3rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  {[
                    { id: "elec", icon: Zap, label: lang === "mn" ? "Цахилгаан" : "Electricity" },
                    { id: "heat", icon: Flame, label: lang === "mn" ? "Дулаан" : "Heating" },
                    { id: "recs", icon: Lightbulb, label: lang === "mn" ? "Зөвлөмж" : "Recommendations" },
                    { id: "cases", icon: FlaskConical, label: lang === "mn" ? "Жишээ" : "Case Studies" },
                  ].map(tab => {
                    const TIcon = tab.icon;
                    return (
                      <button key={tab.id}
                        onClick={() => setResultTab(tab.id)}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem",
                          padding: "0.4rem 0.5rem", borderRadius: 6, border: "none", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                          background: resultTab === tab.id ? "var(--primary)" : "transparent",
                          color: resultTab === tab.id ? "#fff" : "var(--text3)",
                          transition: "0.2s",
                        }}>
                        <TIcon size={13} />{tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* ── Electricity Tab ── */}
                {resultTab === "elec" && (<div className="animate-fade"><div className="result-metrics">
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
                      {result.co2} {t.predictor.co2_unit}
                    </div>
                    <div className="metric-label">{t.predictor.co2_yr_label}</div>
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
                    {t.predictor.efficiency_grade}
                    <span className="pred-grade-badge" style={{ background: GRADE_COLORS[result.grade] }}>{result.grade}</span>
                  </div>
                  <GradeBar grade={result.grade} />
                  <div className="pred-grade-hint">
                    {t.predictor.intensity_detail.replace("{val}", result.intensity)}
                  </div>
                </div>

                {/* Confidence interval */}
                {(() => {
                  const mape = METRICS.mape / 100;
                  const lo = Math.round(result.annual * (1 - mape));
                  const hi = Math.round(result.annual * (1 + mape));
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", padding: "0.65rem 0.9rem", background: "rgba(58,143,212,0.07)", border: "1px solid rgba(58,143,212,0.2)", borderRadius: 8, fontSize: "0.8rem" }}>
                      <Info size={13} style={{ color: "#3a8fd4", flexShrink: 0 }} />
                      <span style={{ color: "var(--text2)" }}>
                        {lang === "mn" ? "Магадлалын муж" : "Confidence range"}:&nbsp;
                        <strong style={{ color: "#3a8fd4" }}>{lo.toLocaleString()} – {hi.toLocaleString()} kWh</strong>
                        &nbsp;({lang === "mn" ? `±${METRICS.mape}% MAPE` : `±${METRICS.mape}% MAPE`})
                      </span>
                    </div>
                  );
                })()}

                {/* Scenario comparison */}
                {baseline && (
                  <div style={{ marginTop: "1rem", padding: "0.9rem 1rem", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text2)", marginBottom: "0.65rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <FlaskConical size={13} style={{ color: "#e9c46a" }} />
                        {lang === "mn" ? "Хувилбар харьцуулалт" : "Scenario comparison"}
                      </span>
                      <button onClick={() => setBaseline(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: "0.2rem" }}>
                        <X size={13} />
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.5rem", alignItems: "center" }}>
                      <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "0.65rem 0.75rem" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginBottom: 3 }}>{lang === "mn" ? "Суурь" : "Baseline"}: {baseline.label}</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: GRADE_COLORS[baseline.result.grade] }}>{baseline.result.annual.toLocaleString()} kWh</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{lang === "mn" ? "Зэрэглэл" : "Grade"}: {baseline.result.grade} · {baseline.result.intensity} kWh/m²</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "0 0.25rem" }}>
                        {(() => {
                          const diff = result.annual - baseline.result.annual;
                          const pct = ((diff / baseline.result.annual) * 100).toFixed(1);
                          const color = diff > 0 ? "#e63946" : diff < 0 ? "#2a9d8f" : "#a8c5e0";
                          return (
                            <div style={{ color, fontWeight: 800, fontSize: "0.85rem" }}>
                              {diff > 0 ? "+" : ""}{diff.toLocaleString()} kWh
                              <div style={{ fontSize: "0.7rem" }}>({diff > 0 ? "+" : ""}{pct}%)</div>
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "0.65rem 0.75rem" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginBottom: 3 }}>{lang === "mn" ? "Одоогийн" : "Current"}</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: GRADE_COLORS[result.grade] }}>{result.annual.toLocaleString()} kWh</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{lang === "mn" ? "Зэрэглэл" : "Grade"}: {result.grade} · {result.intensity} kWh/m²</div>
                      </div>
                    </div>
                  </div>
                )}

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
                      <Bar dataKey="usage" fill="#1a6eb5" name={t.predictor.predicted_usage} radius={[3, 3, 0, 0]} />
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

                </div>)}

                {/* ── Heating Tab ── */}
                {resultTab === "heat" && heating && (
                  <div className="animate-fade">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                      {[
                        { label: lang === "mn" ? "Жилийн дулааны хэрэглээ" : "Annual heating consumption", value: `${heating.annual_gcal} Гкал`, color: "#f4a261" },
                        { label: lang === "mn" ? "Сарын дундаж (9 сар)" : "Monthly avg (9 months)", value: `${heating.monthly_avg} Гкал`, color: "#e9c46a" },
                        { label: lang === "mn" ? "1-р сарын оргил" : "January peak", value: `${heating.monthly_peak} Гкал`, color: "#e63946" },
                        { label: lang === "mn" ? "Дулааны эквивалент" : "Heating equivalent", value: `${heating.annual_kwh_equiv.toLocaleString()} кВт·цаг`, color: "#3a8fd4" },
                      ].map(m => (
                        <div key={m.label} style={{ background: "var(--bg3)", borderRadius: 10, padding: "0.85rem", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: m.color }}>{m.value}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 3 }}>{m.label}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: "rgba(244,162,97,0.07)", border: "1px solid rgba(244,162,97,0.2)", borderRadius: 10, padding: "1rem", marginBottom: "0.75rem" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem", display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <Flame size={14} style={{ color: "#f4a261" }} />
                        {lang === "mn" ? "Дулааны зардал (тооцоолол)" : "Estimated heating cost"}
                      </div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#f4a261" }}>
                        {heating.annual_heat_cost.toLocaleString()} ₮
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: 4 }}>
                        {lang === "mn" ? `≈ 4,500₮/м²/сар × 9 сар (УБ ДС ТӨХК дундаж тариф)` : `≈ 4,500₮/m²/month × 9 months (UB DHN avg tariff)`}
                      </div>
                    </div>

                    <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "0.85rem", border: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.7 }}>
                      <strong style={{ display: "block", marginBottom: 4 }}>{lang === "mn" ? "Загварын тухай" : "About this model"}</strong>
                      {lang === "mn"
                        ? `БНТУ 23-02-09 стандартын дулааны ачааллын томьёонд үндэслэсэн. Суурь ${heating.gcal_per_m2} Гкал/м²/жил × ${form.area} м² = ${heating.annual_gcal} Гкал. Дулааны алдагдал: хана ${form.wall_material}, дулаалга ${form.insulation_quality}, HDD ${form.hdd}.`
                        : `Based on БНТУ 23-02-09 thermal load formula. Base ${heating.gcal_per_m2} Gcal/m²/year × ${form.area} m² = ${heating.annual_gcal} Gcal. Heat loss factors: wall ${form.wall_material}, insulation ${form.insulation_quality}, HDD ${form.hdd}.`}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.5rem" }}>
                      {lang === "mn" ? "Эх сурвалж: БНТУ 23-02-09; Улаанбаатар Дулааны Сүлжээ ТӨХК" : "Source: БНТУ 23-02-09; Ulaanbaatar Heating Network ТӨХК"}
                    </div>
                  </div>
                )}

                {/* ── Recommendations Tab ── */}
                {resultTab === "recs" && (
                  <div className="animate-fade">
                    {recs.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text3)" }}>
                        <CheckCircle size={32} style={{ color: "#2a9d8f", marginBottom: 8 }} />
                        <div>{lang === "mn" ? "Барилга үр ашигтай байна. Тусгай зөвлөмж алга." : "Building is already efficient. No specific recommendations."}</div>
                      </div>
                    ) : recs.map((rec, i) => (
                      <div key={i} style={{
                        marginBottom: "0.85rem", padding: "0.9rem 1rem",
                        background: `${rec.color}11`, border: `1px solid ${rec.color}44`,
                        borderLeft: `4px solid ${rec.color}`, borderRadius: 10,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.4rem" }}>
                          <strong style={{ color: "var(--text)", fontSize: "0.9rem" }}>{rec.action}</strong>
                          <span style={{ background: rec.color, color: "#fff", padding: "0.15rem 0.6rem", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {lang === "mn" ? "Хэмнэлт" : "Saving"}: {rec.saving}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.65, margin: "0 0 0.3rem" }}>{rec.detail}</p>
                        <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>{lang === "mn" ? "Эх сурвалж" : "Source"}: {rec.ref}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.5rem" }}>
                      {lang === "mn"
                        ? "Зөвлөмжүүд нь rule-based logic-д суурилсан. Бодит аудитыг мэргэжлийн байгуулагаас авна уу."
                        : "Recommendations are rule-based. For precise savings, consult a certified energy auditor."}
                    </div>
                  </div>
                )}

                {/* ── Case Studies Tab ── */}
                {resultTab === "cases" && (
                  <div className="animate-fade">
                    <p style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: "0.9rem", lineHeight: 1.6 }}>
                      {lang === "mn"
                        ? "Загварын үр дүнг бодит УБ барилгуудтай харьцуулна. Тооцоолсон утга бодит өгөгдлөөс ±15% дотор байвал хүлцэж болно."
                        : "Model predictions compared against real UB buildings. Predictions within ±15% of actual values are acceptable."}
                    </p>
                    {CASE_STUDIES.map(cs => {
                      const predicted = predict(cs);
                      const errPct = Math.abs((predicted.annual - cs.actual_kwh) / cs.actual_kwh * 100);
                      const ok = errPct < 15;
                      return (
                        <div key={cs.id} style={{ marginBottom: "1rem", padding: "0.9rem 1rem", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)", marginBottom: "0.5rem" }}>
                            {lang === "mn" ? cs.name_mn : cs.name_en}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <div>
                              <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{lang === "mn" ? "Бодит хэрэглээ" : "Actual"}</div>
                              <div style={{ fontWeight: 700, color: "#f4a261", fontSize: "0.95rem" }}>{cs.actual_kwh.toLocaleString()} кВт·цаг</div>
                            </div>
                            <div>
                              <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{lang === "mn" ? "Загварын таамаглал" : "Model prediction"}</div>
                              <div style={{ fontWeight: 700, color: "#3a8fd4", fontSize: "0.95rem" }}>{predicted.annual.toLocaleString()} кВт·цаг</div>
                            </div>
                            <div>
                              <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{lang === "mn" ? "Алдаа" : "Error"}</div>
                              <div style={{ fontWeight: 700, color: ok ? "#2a9d8f" : "#e63946", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 4 }}>
                                {ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                                {errPct.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text3)", lineHeight: 1.5 }}>
                            {lang === "mn" ? cs.note_mn : cs.note_en}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 4 }}>
                            {lang === "mn" ? "Эх сурвалж" : "Source"}: {cs.source}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: "0.5rem", padding: "0.7rem 0.9rem", background: "rgba(58,143,212,0.07)", border: "1px solid rgba(58,143,212,0.2)", borderRadius: 8, fontSize: "0.75rem", color: "var(--text2)", lineHeight: 1.6 }}>
                      {lang === "mn"
                        ? "Загвар нь физик EUI томьёо + OLS regression хосолсон. Бодит өгөгдлийн хязгаарлалтаас болж synthetic dataset ашигласан. Жишилтийн утгуудыг тооцоологдсон болохыг анхаарна уу."
                        : "Model uses physics-informed EUI formula + OLS regression. Synthetic dataset used due to limited public Mongolian building data. Note: actual consumption figures are referenced from published sources."}
                    </div>
                  </div>
                )}

                {/* Model info + save */}
                <div className="model-info-row">
                  <span className="model-badge" title="Physics-informed OLS regression trained on 600 UB buildings">OLS + EUI</span>
                  <span className="model-badge" title={`n_train=${METRICS.n_train}, n_test=${METRICS.n_test}`}>
                    R² = {METRICS.r2}
                  </span>
                  <span className="model-badge" title="Mean Absolute Percentage Error on held-out test set">
                    MAPE = {METRICS.mape}%
                  </span>
                  <span className="model-badge" title={`MAE = ${METRICS.mae.toLocaleString()} kWh on test set`}>
                    MAE = {METRICS.mae.toLocaleString()} kWh
                  </span>
                  <span className="model-badge" title="Macro-averaged F1 score for energy grade (A–G) classification on held-out test set">
                    F1 = {METRICS.f1}
                  </span>
                  {user && (
                    <button
                      className="btn btn-secondary pred-save-btn"
                      onClick={() => { setScenLabel(""); setShowScenModal(true); }}
                      title={lang === "mn" ? "Сценари хадгалах" : "Save scenario"}
                    >
                      <Bookmark size={14} />
                      {lang === "mn" ? "Сценари" : "Scenario"}
                    </button>
                  )}
                  <button
                    className="btn btn-secondary pred-save-btn"
                    onClick={() => {
                      saveUserBuilding({
                        id: `pred_${Date.now()}`,
                        name: form.building_name.trim() ||
                          `${form.area}${t.common.units_sqm} ${t.predictor.building_types[form.building_type] || form.building_type}`,
                        type: form.building_type,
                        area: form.area,
                        floors: form.floors,
                        year: form.year,
                        district: form.district,
                        rooms: form.rooms,
                        wall_material: form.wall_material,
                        heating_type: form.heating_type,
                        insulation_quality: form.insulation_quality,
                        window_type: form.window_type,
                        latitude: 47.9184,
                        longitude: 106.9177,
                        source: "predictor",
                        userId: user?.id || null,
                        submittedAt: new Date().toISOString(),
                      });
                      setSaved(true);
                      setTimeout(() => navigate("/database"), 900);
                    }}
                    title={t.predictor.save_to_db}
                  >
                    <Save size={14} />
                    {saved ? t.predictor.saved : t.common.save}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scenario save modal */}
      {showScenModal && (
        <div className="pred-modal-overlay" onClick={() => setShowScenModal(false)}>
          <div className="pred-modal card" onClick={e => e.stopPropagation()}>
            <div className="pred-modal-header">
              <strong>{lang === "mn" ? "Сценари хадгалах" : "Save Scenario"}</strong>
              <button className="pred-modal-close" onClick={() => setShowScenModal(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text3)", marginBottom: "0.75rem" }}>
              {lang === "mn" ? "Энэ тохиргоог хадгалж 'Миний орон зай' хуудаснаас дахин ачааллах боломжтой." : "Save this configuration to reload it later from My Space."}
            </p>
            <input
              className="form-input"
              placeholder={lang === "mn" ? "Сценарийн нэр..." : "Scenario name..."}
              value={scenLabel}
              onChange={e => setScenLabel(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && scenLabel.trim()) {
                  saveScenario(user.id, { label: scenLabel.trim(), form, id: Date.now() });
                  setShowScenModal(false);
                  setScenSaved(true);
                  setTimeout(() => setScenSaved(false), 2500);
                }
              }}
            />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowScenModal(false)}>
                {lang === "mn" ? "Болих" : "Cancel"}
              </button>
              <button
                className="btn btn-primary"
                disabled={!scenLabel.trim()}
                onClick={() => {
                  saveScenario(user.id, { label: scenLabel.trim(), form, id: Date.now() });
                  setShowScenModal(false);
                  setScenSaved(true);
                  setTimeout(() => setScenSaved(false), 2500);
                }}
              >
                <Bookmark size={14} /> {lang === "mn" ? "Хадгалах" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario saved toast */}
      {scenSaved && (
        <div className="pred-toast">
          <CheckCircle size={16} style={{ color: "#2a9d8f" }} />
          {lang === "mn" ? "Сценари хадгалагдлаа!" : "Scenario saved!"}
        </div>
      )}
    </div>
  );
}
