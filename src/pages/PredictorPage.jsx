import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  Brain, Zap, TrendingUp,
  Building2, ChevronRight, ChevronDown, ChevronUp,
  Home, Info, X, Bookmark,
  Flame, Lightbulb, CheckCircle, DollarSign, FlaskConical,
  Clock, Upload, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import EnergyDualChart from "../components/charts/EnergyDualChart";
import {
  predict, METRICS, GRADE_COLORS,
  convertElecMoneyToKwh, convertHeatBillToEstimates,
  predictHeating, generateRecommendations, CASE_STUDIES,
  TARIFF_TIERS,
} from "../ml/model";
import { useData } from "../contexts/DataContext";
import { splitMonthlyEnergy } from "../data/mockData";
import "./PredictorPage.css";

const BUILDING_COLORS = {
  apartment: "#3a8fd4", office: "#2a9d8f", school: "#e9c46a",
  hospital: "#e63946", warehouse: "#a8c5e0", commercial: "#f4a261"
};

// ─── 3 Demo scenarios for thesis defense ─────────────────────────────────────
const DEMO_SCENARIOS = [
  {
    id: "apartment",
    color: "#3a8fd4",
    label_mn: "Орон сууц",    label_en: "Apartment",
    desc_mn:  "12 давхар · 96 м² · 1995 он · панель",
    desc_en:  "12-floor · 96 m² · 1995 · panel",
    form: {
      building_name: "Орон сууц (жишээ)",
      district: "Баянзүрх", area: 96, building_type: "apartment",
      year: 1995, floors: 12, rooms: 3, window_ratio: 25,
      wall_material: "panel", heating_type: "central",
      insulation_quality: "medium", window_type: "double",
    },
  },
  {
    id: "office",
    color: "#2a9d8f",
    label_mn: "Оффис",        label_en: "Office",
    desc_mn:  "6 давхар · 350 м² · 2005 он · бетон",
    desc_en:  "6-floor · 350 m² · 2005 · concrete",
    form: {
      building_name: "Оффис (жишээ)",
      district: "Сүхбаатар", area: 350, building_type: "office",
      year: 2005, floors: 6, rooms: 15, window_ratio: 30,
      wall_material: "concrete", heating_type: "central",
      insulation_quality: "good", window_type: "double",
    },
  },
  {
    id: "school",
    color: "#e9c46a",
    label_mn: "Сургуулийн байр", label_en: "School",
    desc_mn:  "3 давхар · 600 м² · 1980 он · тоосго",
    desc_en:  "3-floor · 600 m² · 1980 · brick",
    form: {
      building_name: "Сургуулийн байр (жишээ)",
      district: "Чингэлтэй", area: 600, building_type: "school",
      year: 1980, floors: 3, rooms: 20, window_ratio: 20,
      wall_material: "brick", heating_type: "central",
      insulation_quality: "poor", window_type: "single",
    },
  },
];

// Hourly consumption weight profile (sums to 24 — average weight = 1.0)
// Represents typical UB apartment load curve (heating-heavy winter city)
const HOUR_W = [0.52, 0.44, 0.40, 0.38, 0.40, 0.62, 1.10, 1.45, 1.35, 1.15, 1.10, 1.05,
                1.00, 1.00, 1.00, 1.08, 1.18, 1.42, 1.55, 1.52, 1.30, 1.12, 0.90, 0.67];
const HOUR_W_SUM = HOUR_W.reduce((a, b) => a + b, 0); // ≈ 24

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
  const { t, lang, user } = useApp();
  const { buildings, addPrediction, addScenario, setLastPrediction, currentHdd } = useData();
  usePageTitle(t.nav.predictor);
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
  const [selectedId, setSelectedId] = useState(null);
  const [scenarioLoaded, setScenarioLoaded] = useState(false);
  const [demoScenario,   setDemoScenario]   = useState(null);
  const [result, setResult] = useState(null);
  const [heating, setHeating] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultTab, setResultTab] = useState("elec");
  const [elecBill, setElecBill] = useState("");
  const [heatBill, setHeatBill] = useState("");
  const [baseline, setBaseline] = useState(null);
  const [scenLabel, setScenLabel] = useState("");
  const [showScenModal, setShowScenModal] = useState(false);
  const [scenSaved, setScenSaved] = useState(false);

  // User's own buildings (non-mock) from shared context
  const userBuildings = buildings.filter(b => b.source !== "mock");

  // Load scenario from My Space
  useEffect(() => {
    const s = location.state?.scenario;
    if (s?.form) {
      setForm(f => ({ ...f, ...s.form }));
      setScenarioLoaded(true);
      setSelectedId(null);
    }
  }, [location.state]);

  const selectBuilding = (b) => {
    setSelectedId(b.id);
    setScenarioLoaded(false);
    setForm({
      building_name: b.name || "",
      district: b.district || "Сүхбаатар",
      area: b.area,
      building_type: b.type || "apartment",
      year: b.year,
      floors: b.floors,
      rooms: b.rooms || 3,
      window_ratio: b.window_ratio || 25,
      wall_material: b.wall_material || "panel",
      heating_type: b.heating_type || "central",
      insulation_quality: b.insulation_quality || "medium",
      window_type: b.window_type || "double",
    });
    setResult(null);
    setHeating(null);
    setRecs([]);
  };

  const canRun = !!(selectedId || scenarioLoaded || demoScenario);

  const runModel = () => {
    if (!canRun) return;
    setLoading(true);
    setResultTab("elec");
    setTimeout(() => {
      // Auto-derive occupancy/equipment from area + building type (hidden from UI)
      const resPer100 = { apartment: 5, office: 3, school: 4, hospital: 6, commercial: 2, warehouse: 1 };
      const appPer100 = { apartment: 8, office: 5, school: 4, hospital: 10, commercial: 6, warehouse: 3 };
      const enriched = {
        ...form,
        hdd:       currentHdd,
        residents: Math.max(1, Math.round(form.area / 100 * (resPer100[form.building_type] || 4))),
        // Cap at 15 — training data has appliances in [2,15]; out-of-distribution inputs cause XGBoost extrapolation
        appliances: Math.min(15, Math.max(2, Math.round(form.area / 100 * (appPer100[form.building_type] || 6)))),
      };
      const modelR = predict(enriched);
      const h      = predictHeating(enriched);

      // If user entered a monthly electricity bill, blend with model (70% user / 30% model)
      const userMonthly = parseFloat(elecBill);
      let r = modelR;
      if (userMonthly > 0) {
        const ec         = convertElecMoneyToKwh(userMonthly);
        const userAnnual = ec.kwh_annual;

        // Clamp: model must not exceed user * 1.5 (prevents outlier inflation)
        const safeModel = Math.min(modelR.annual, userAnnual * 1.5);

        // Edge-case: if raw model > 2× user the data are too divergent — trust user fully
        const extreme   = modelR.annual > userAnnual * 2;
        const hybrid    = extreme
          ? userAnnual
          : Math.round(0.7 * userAnnual + 0.3 * safeModel);

        const scale    = hybrid / Math.max(1, modelR.annual);
        const newInt   = Math.round(hybrid / form.area);
        const newGrade =
          newInt < 50  ? "A" : newInt < 100 ? "B" :
          newInt < 150 ? "C" : newInt < 200 ? "D" :
          newInt < 250 ? "E" : newInt < 300 ? "F" : "G";
        r = {
          ...modelR,
          annual:      hybrid,
          monthly_avg: Math.round(hybrid / 12),
          daily_avg:   +(hybrid / 365).toFixed(2),
          chart_data:  modelR.chart_data.map(d => ({ ...d, usage: Math.round(d.usage * scale) })),
          intensity:   newInt,
          grade:       newGrade,
          co2:         +((hybrid * 0.88) / 1000).toFixed(1),
          pm25:        Math.round(hybrid * 0.88 * 1.35),
          // expose for comparison + explanation
          userAnnual,
          modelAnnual:  modelR.annual,
          safeModel,
          isHybrid:     true,
          isFallback:   extreme,   // model was clamped to user entirely
        };
      }

      const rec = generateRecommendations(enriched, r, lang);
      setResult(r);
      setHeating(h);
      setRecs(rec);
      setLastPrediction({ form: enriched, result: r, heating: h });
      setLoading(false);
      addPrediction({
        form: { ...enriched, name: form.building_name || `${form.area}м² ${form.building_type}`, grade: r.grade },
        result: r.annual,
        heating: h,
      });
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
          {/* ── Form card ────────────────────────────────────────── */}
          <div className="card predictor-form-card">
            <div className="pred-form-inner">

            {/* ── Left col: Demo + Building picker ── */}
            <div className="pred-form-col">

            {/* ── Demo scenarios ── */}
            <div className="pred-demo-section">
              <div className="pred-demo-label">
                <Brain size={13} style={{ color: "#9b72cf" }} />
                <span>{lang === "mn" ? "Жишээ сценариар туршиж үзэх" : "Try with sample scenarios"}</span>
              </div>
              <div className="pred-demo-btns">
                {DEMO_SCENARIOS.map(s => (
                  <button
                    key={s.id}
                    className={`pred-demo-btn${demoScenario === s.id ? " active" : ""}`}
                    style={{ borderColor: demoScenario === s.id ? s.color : undefined,
                             color:       demoScenario === s.id ? s.color : undefined }}
                    onClick={() => {
                      setForm(f => ({ ...f, ...s.form }));
                      setDemoScenario(s.id);
                      setSelectedId(null);
                      setScenarioLoaded(false);
                      setResult(null); setHeating(null); setRecs([]);
                    }}
                  >
                    <span className="pdb-label">{lang === "mn" ? s.label_mn : s.label_en}</span>
                    <span className="pdb-desc">{lang === "mn" ? s.desc_mn : s.desc_en}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Building selector */}
            <div className="pred-picker-header">
              <Building2 size={17} style={{ color: "var(--primary-light)" }} />
              <span>{lang === "mn" ? "Барилга сонгох" : "Select a building"}</span>
              <button className="btn btn-secondary pred-add-bld-btn" onClick={() => navigate("/data-input")}>
                <Upload size={13} /> {lang === "mn" ? "Нэмэх" : "Add"}
              </button>
            </div>

            {scenarioLoaded && (
              <div className="pred-scen-loaded-banner">
                <Bookmark size={13} style={{ color: "#f4a261" }} />
                <span>{lang === "mn" ? "Сценариас ачааллав" : "Loaded from scenario"}: <strong>{form.building_name || `${form.area}м²`}</strong></span>
              </div>
            )}

            {userBuildings.length === 0 && !scenarioLoaded ? (
              <div className="pred-empty-bld">
                <Building2 size={38} style={{ color: "var(--text3)", marginBottom: "0.6rem" }} />
                <p>{lang === "mn" ? "Одоогоор барилга байхгүй байна." : "No buildings yet."}</p>
                <button className="btn btn-primary" onClick={() => navigate("/data-input")}>
                  <Upload size={14} /> {lang === "mn" ? "Барилга нэмэх" : "Add Building"}
                </button>
              </div>
            ) : (
              <div className="pred-bld-list">
                {userBuildings.map(b => (
                  <button
                    key={b.id}
                    className={`pred-bld-item${selectedId === b.id ? " active" : ""}`}
                    onClick={() => selectBuilding(b)}
                  >
                    <div className="pred-bld-grade" style={{ background: GRADE_COLORS[b.grade] || "#888" }}>{b.grade}</div>
                    <div className="pred-bld-info">
                      <strong>{b.name}</strong>
                      <span>{b.type} · {b.area}м² · {b.year}</span>
                    </div>
                    <ChevronRight size={14} className="pred-bld-arrow" />
                  </button>
                ))}
              </div>
            )}

            </div>{/* /pred-form-col left */}

            {/* ── Right col: Bill calculator + Predict ── */}
            <div className="pred-form-col">

            {/* ── Bill calculator (optional, shown when building selected or scenario loaded) ── */}
            {canRun && (
            <Section icon={DollarSign} title={lang === "mn" ? "Сарын зардалаас тооцоолох" : "Estimate from monthly costs"} defaultOpen={false}>
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
                          {lang === "mn" ? `${ec.effective_rate}₮/кВт·цаг (дундаж тариф)` : `${ec.effective_rate}₮/kWh (avg rate)`}
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

            )}

            {canRun && (
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
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
            )}
            </div>{/* /pred-form-col right */}
            </div>{/* /pred-form-inner */}
          </div>

          {/* ── Results (below form, full-width) ─────────────────── */}
          <div className="predictor-right">

            {result && (
              <div className="result-card card animate-fade" aria-live="polite" aria-atomic="true">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>
                  <Zap size={16} style={{ marginLeft: 8 }} />
                  {t.predictor.result_title}
                </h3>

                {/* Estimate disclaimer */}
                <div className="pred-estimate-badge">
                  <Info size={12} style={{ flexShrink: 0 }} />
                  <span>{lang === "mn" ? "Энэ бол загварын тооцоолол — бодит тооцооны мэдээлэл биш" : "This is a model estimate — not actual billing data"}</span>
                </div>

                {/* Accuracy + Confidence mini cards */}
                <div className="pred-accuracy-row">
                  <div className="pred-acc-card">
                    <div className="pred-acc-val">{Math.round(METRICS.r2 * 100)}%</div>
                    <div className="pred-acc-label">{lang === "mn" ? "Загварын нарийвчлал" : "Model accuracy"} (R²)</div>
                  </div>
                  <div className="pred-acc-card pred-acc-card--green">
                    <div className="pred-acc-val" style={{ color: "#2a9d8f" }}>{METRICS.confidence}%</div>
                    <div className="pred-acc-label">{lang === "mn" ? "Итгэх түвшин" : "Confidence"} (±15%)</div>
                  </div>
                </div>

                {/* Result Tabs */}
                <div className="result-tabs" style={{ display: "flex", gap: "0.3rem", marginBottom: "1.1rem", background: "var(--bg3)", padding: "0.3rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  {[
                    { id: "elec",     icon: Zap,         label: lang === "mn" ? "Цахилгаан" : "Electricity" },
                    { id: "heat",     icon: Flame,       label: lang === "mn" ? "Дулаан" : "Heating" },
                    { id: "forecast", icon: Clock,       label: lang === "mn" ? "Таамаглал" : "Forecast" },
                    { id: "recs",     icon: Lightbulb,   label: lang === "mn" ? "Зөвлөмж" : "Tips" },
                    { id: "cases",    icon: FlaskConical, label: lang === "mn" ? "Жишээ" : "Cases" },
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
                {resultTab === "elec" && (<div className="animate-fade">{(() => {
                  const mKwh = result.monthly_avg;
                  const mCost = mKwh <= 150
                    ? mKwh * 175
                    : mKwh <= 300
                    ? 150 * 175 + (mKwh - 150) * 256
                    : 150 * 175 + 150 * 256 + (mKwh - 300) * 285;
                  const annualElecCost  = Math.round(mCost * 12);
                  const monthlyElecCost = Math.round(mCost);
                  const heatingCost     = heating?.annual_heat_cost || 0;
                  const hotWaterCost    = heating?.hot_water_annual  || 0;
                  const serviceCost     = heating?.service_annual    || 0;
                  const totalAnnualCost = annualElecCost + heatingCost + hotWaterCost + serviceCost;
                  return (<>

                  {/* ── Two main metric blocks ── */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.65rem", marginBottom:"0.65rem" }}>
                    <div style={{ background:"rgba(26,110,181,0.08)", border:"1px solid rgba(58,143,212,0.22)", borderRadius:10, padding:"1rem 1.1rem" }}>
                      <div style={{ fontSize:"1.75rem", fontWeight:900, color:"#f4a261", lineHeight:1.1 }}>
                        {result.annual.toLocaleString()}
                        <span style={{ fontSize:"0.88rem", fontWeight:600, marginLeft:5 }}>кВт·цаг</span>
                      </div>
                      <div style={{ fontSize:"0.7rem", color:"var(--text3)", marginTop:5 }}>
                        {lang==="mn" ? "Жилийн хэрэглээ" : "Annual consumption"}
                      </div>
                    </div>
                    <div style={{ background:"rgba(26,110,181,0.08)", border:"1px solid rgba(58,143,212,0.22)", borderRadius:10, padding:"1rem 1.1rem" }}>
                      <div style={{ fontSize:"1.75rem", fontWeight:900, color:"#f4a261", lineHeight:1.1 }}>
                        {annualElecCost.toLocaleString()}
                        <span style={{ fontSize:"0.88rem", fontWeight:600, marginLeft:5 }}>₮</span>
                      </div>
                      <div style={{ fontSize:"0.7rem", color:"var(--text3)", marginTop:5 }}>
                        {lang==="mn" ? "Жилийн цахилгааны зардал" : "Annual electricity cost"}
                      </div>
                    </div>
                  </div>

                  {/* ── Three smaller stats ── */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0.5rem", marginBottom:"0.65rem" }}>
                    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:9, padding:"0.7rem 0.85rem" }}>
                      <div style={{ fontSize:"1.15rem", fontWeight:800, color:"#3a8fd4", lineHeight:1.1 }}>
                        {result.monthly_avg.toLocaleString()}
                        <span style={{ fontSize:"0.65rem", marginLeft:3 }}>кВт·цаг</span>
                      </div>
                      <div style={{ fontSize:"0.6rem", color:"var(--text3)", marginTop:3 }}>
                        {lang==="mn" ? "Сарын дундаж" : "Monthly avg"}
                      </div>
                      <div style={{ fontSize:"0.6rem", color:"var(--text3)" }}>
                        {monthlyElecCost.toLocaleString()} ₮/сар
                      </div>
                    </div>
                    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:9, padding:"0.7rem 0.85rem" }}>
                      <div style={{ fontSize:"1.15rem", fontWeight:800, color:"#2a9d8f", lineHeight:1.1 }}>
                        {result.co2}
                        <span style={{ fontSize:"0.65rem", marginLeft:3 }}>т</span>
                      </div>
                      <div style={{ fontSize:"0.6rem", color:"var(--text3)", marginTop:3 }}>CO₂ т/жил</div>
                      <div style={{ fontSize:"0.6rem", color:"var(--text3)" }}>= {result.pm25.toLocaleString()} μg PM2.5</div>
                    </div>
                    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:9, padding:"0.7rem 0.85rem" }}>
                      <div style={{ fontSize:"1.15rem", fontWeight:800, color:"#e9c46a", lineHeight:1.1 }}>
                        {result.intensity}
                        <span style={{ fontSize:"0.65rem", marginLeft:3 }}>кВт·цаг/м²</span>
                      </div>
                      <div style={{ fontSize:"0.6rem", color:"var(--text3)", marginTop:3 }}>
                        {lang==="mn" ? "Эрчим хүчний эрчмэлт" : "Energy intensity"}
                      </div>
                    </div>
                  </div>

                  {/* ── Cost breakdown row ── */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden", marginBottom:"0.65rem" }}>
                    {[
                      { icon:"⚡", label: lang==="mn"?"Цахилгаан/жил":"Electricity/yr", val: annualElecCost, monthly: monthlyElecCost, color:"#3a8fd4" },
                      { icon:"🔥", label: lang==="mn"?"Дулаан/жил":"Heating/yr",        val: heatingCost,    monthly: Math.round(heatingCost/12), color:"#f4a261" },
                      { icon:"🔥", label: lang==="mn"?"Нийт зардал/жил":"Total cost/yr", val: totalAnnualCost, monthly: Math.round(totalAnnualCost/12), color:"#2a9d8f" },
                    ].map((item, i) => (
                      <div key={item.label} style={{ padding:"0.8rem 0.85rem", borderLeft: i>0 ? "1px solid var(--border)" : undefined }}>
                        <div style={{ fontSize:"0.62rem", color:"var(--text3)", marginBottom:4 }}>
                          {item.icon} {item.label}
                        </div>
                        <div style={{ fontSize:"1.05rem", fontWeight:800, color:item.color }}>
                          {item.val.toLocaleString()} ₮
                        </div>
                        <div style={{ fontSize:"0.6rem", color:"var(--text3)", marginTop:2 }}>
                          ≈ {item.monthly.toLocaleString()} ₮/сар
                        </div>
                      </div>
                    ))}
                  </div>
                  </>);
                })()}

                {/* ── Grade bar ── */}
                <div className="pred-grade-section">
                  <div className="pred-grade-label">
                    <TrendingUp size={13} />
                    {lang === "mn" ? "УР АШГИЙН ЗЭРЭГЛЭЛ" : "ENERGY GRADE"}
                    <span className="pred-grade-badge" style={{ background: GRADE_COLORS[result.grade] }}>{result.grade}</span>
                  </div>
                  <GradeBar grade={result.grade} />
                  <div className="pred-grade-hint">
                    {t.predictor.intensity_detail.replace("{val}", result.intensity)}
                  </div>
                </div>

                {/* User bill vs Model comparison (shown when elecBill was provided) */}
                {result.isHybrid && (() => {
                  const uKwh = result.userAnnual;
                  const mKwh = result.modelAnnual;
                  const hKwh = result.annual;
                  const diffUvsM = uKwh - mKwh;
                  return (
                    <div style={{ margin: "0.75rem 0", padding: "0.9rem 1rem", background: "rgba(42,157,143,0.07)", border: "1px solid rgba(42,157,143,0.25)", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, fontSize: "0.82rem", color: "#2a9d8f", marginBottom: "0.65rem" }}>
                        <Zap size={13} />
                        {lang === "mn" ? "Нэхэмжлэл vs Загвар харьцуулалт" : "Bill vs Model comparison"}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", textAlign: "center" }}>
                        <div style={{ background: "rgba(26,110,181,0.1)", borderRadius: 8, padding: "0.6rem 0.4rem" }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 3 }}>📄 {lang === "mn" ? "Нэхэмжлэл" : "Bill"}</div>
                          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#3a8fd4" }}>{uKwh.toLocaleString()}</div>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>kWh/жил</div>
                        </div>
                        <div style={{ background: "rgba(155,114,207,0.1)", borderRadius: 8, padding: "0.6rem 0.4rem" }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 3 }}>🤖 {lang === "mn" ? "Загвар" : "Model"}</div>
                          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#9b72cf" }}>{mKwh.toLocaleString()}</div>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>kWh/жил</div>
                        </div>
                        <div style={{ background: "rgba(42,157,143,0.12)", borderRadius: 8, padding: "0.6rem 0.4rem", border: "1px solid rgba(42,157,143,0.3)" }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 3 }}>⚡ {lang === "mn" ? "Эцсийн (70/30)" : "Final (70/30)"}</div>
                          <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#2a9d8f" }}>{hKwh.toLocaleString()}</div>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>kWh/жил</div>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: "0.5rem", textAlign: "center" }}>
                        {lang === "mn"
                          ? `Нэхэмжлэл ${diffUvsM > 0 ? "+" : ""}${diffUvsM.toLocaleString()} kWh загвараас ${diffUvsM > 0 ? "өндөр" : "доогуур"} · эцсийн: 70% нэхэмжлэл + 30% загвар`
                          : `Bill is ${Math.abs(diffUvsM).toLocaleString()} kWh ${diffUvsM > 0 ? "above" : "below"} model · final = 70% bill + 30% model`}
                      </div>
                    </div>
                  );
                })()}

                {/* Scenario comparison */}
                {baseline && (() => {
                  const diff = result.annual - baseline.result.annual;
                  const pct = ((diff / baseline.result.annual) * 100).toFixed(1);
                  const diffColor = diff > 0 ? "#e63946" : diff < 0 ? "#2a9d8f" : "#a8c5e0";
                  const maxVal = Math.max(result.annual, baseline.result.annual);
                  return (
                    <div className="pred-scenario-block">
                      <div className="pred-scenario-header">
                        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <FlaskConical size={13} style={{ color: "#e9c46a" }} />
                          {lang === "mn" ? "Хувилбар харьцуулалт" : "Scenario comparison"}
                        </span>
                        <button onClick={() => setBaseline(null)} className="pred-scenario-close"><X size={13} /></button>
                      </div>
                      <div className="pred-scenario-cols">
                        <div className="pred-scenario-col">
                          <div className="pred-scen-tag">{lang === "mn" ? "Суурь" : "Baseline"}</div>
                          <div className="pred-scen-name">{baseline.label}</div>
                          <div className="pred-scen-val" style={{ color: GRADE_COLORS[baseline.result.grade] }}>
                            {baseline.result.annual.toLocaleString()} kWh
                          </div>
                          <div className="pred-scen-grade">
                            <span style={{ background: GRADE_COLORS[baseline.result.grade], color: "#fff", padding: "1px 7px", borderRadius: 4, fontWeight: 800, fontSize: "0.8rem" }}>{baseline.result.grade}</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>{baseline.result.intensity} kWh/m²</span>
                          </div>
                          <div className="pred-scen-bar-track">
                            <div className="pred-scen-bar-fill" style={{ width: `${(baseline.result.annual / maxVal) * 100}%`, background: GRADE_COLORS[baseline.result.grade] }} />
                          </div>
                        </div>
                        <div className="pred-scenario-diff" style={{ color: diffColor }}>
                          <div style={{ fontSize: "1rem", fontWeight: 800 }}>{diff > 0 ? "+" : ""}{diff.toLocaleString()}</div>
                          <div style={{ fontSize: "0.72rem" }}>kWh</div>
                          <div style={{ fontSize: "0.75rem", marginTop: 2 }}>({diff > 0 ? "+" : ""}{pct}%)</div>
                        </div>
                        <div className="pred-scenario-col">
                          <div className="pred-scen-tag">{lang === "mn" ? "Одоогийн" : "Current"}</div>
                          <div className="pred-scen-name" style={{ color: "var(--primary-light)" }}>
                            {form.building_name || `${form.area}m² ${form.building_type}`}
                          </div>
                          <div className="pred-scen-val" style={{ color: GRADE_COLORS[result.grade] }}>
                            {result.annual.toLocaleString()} kWh
                          </div>
                          <div className="pred-scen-grade">
                            <span style={{ background: GRADE_COLORS[result.grade], color: "#fff", padding: "1px 7px", borderRadius: 4, fontWeight: 800, fontSize: "0.8rem" }}>{result.grade}</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>{result.intensity} kWh/m²</span>
                          </div>
                          <div className="pred-scen-bar-track">
                            <div className="pred-scen-bar-fill" style={{ width: `${(result.annual / maxVal) * 100}%`, background: GRADE_COLORS[result.grade] }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Monthly chart — heating + electric dual panel */}
                <h4 className="chart-sub-title">{t.predictor.monthly_breakdown}</h4>
                {(() => {
                  // Use physics heating model if available, else HDD-based split
                  const totalAnnual = result.annual + (heating?.annual_kwh_equiv || 0);
                  const fallbackSplit = splitMonthlyEnergy(totalAnnual);
                  const dualData = result.chart_data.map((d, i) => {
                    const heatKwh = heating?.monthly_heat_kwh?.[i] ?? fallbackSplit[i].heating;
                    return {
                      month:    d.month,
                      heating:  heatKwh,
                      electric: d.usage,
                      total:    d.usage + heatKwh,
                    };
                  });
                  return (
                    <EnergyDualChart
                      lang={lang}
                      height={210}
                      leftTitle={lang === "mn" ? "Stacked: Дулаалга + Цахилгаан = Нийт" : "Stacked: Heating + Electric = Use"}
                      rightTitle={lang === "mn" ? "Сар бүрийн нийт хэрэглээ (MWh)" : "Monthly total consumption (MWh)"}
                      data={dualData}
                    />
                  );
                })()}

                {/* Top 3 Factors */}
                <h4 className="chart-sub-title" style={{ marginTop: "1.25rem" }}>
                  {lang === "mn" ? "Хамгийн нөлөөлсөн 3 хүчин зүйл" : "Top 3 influencing factors"}
                </h4>
                <div className="pred-top3-grid">
                  {result.features.slice(0, 3).map((f, i) => (
                    <div key={f.key} className="pred-top3-card">
                      <div className="pred-top3-rank" style={{ color: FEAT_COLORS[i] }}>#{i + 1}</div>
                      <div className="pred-top3-name">{FEAT_LABELS[f.key] || f.key}</div>
                      <div className="pred-top3-pct" style={{ color: FEAT_COLORS[i] }}>{f.pct}%</div>
                      <div className="pred-top3-bar-track">
                        <div className="pred-top3-bar-fill" style={{
                          width: `${(f.pct / result.features[0].pct) * 100}%`,
                          background: FEAT_COLORS[i],
                        }} />
                      </div>
                    </div>
                  ))}
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

                {/* Why this result */}
                {(() => {
                  const top = result.features.slice(0, 3);
                  const gradeDesc = {
                    A: lang === "mn" ? "маш үр ашигтай (50 кВт·цаг/м²-аас доош)" : "very efficient (below 50 kWh/m²)",
                    B: lang === "mn" ? "үр ашигтай (50–100 кВт·цаг/м²)" : "efficient (50–100 kWh/m²)",
                    C: lang === "mn" ? "дундаж (100–150 кВт·цаг/м²)" : "average (100–150 kWh/m²)",
                    D: lang === "mn" ? "дунджаас доогуур (150–200 кВт·цаг/м²)" : "below average (150–200 kWh/m²)",
                    E: lang === "mn" ? "үр ашиг муу (200–250 кВт·цаг/м²)" : "poor efficiency (200–250 kWh/m²)",
                    F: lang === "mn" ? "маш үр ашиг муу (250–300 кВт·цаг/м²)" : "very poor efficiency (250–300 kWh/m²)",
                    G: lang === "mn" ? "хэт их хэрэглэгч (300+ кВт·цаг/м²)" : "excessive consumption (300+ kWh/m²)",
                  };
                  const parts = top.map(f => `${FEAT_LABELS[f.key] || f.key} (${f.pct}%)`);
                  const improvable = result.features.filter(f =>
                    ["ins_poor","win_single","mat_wood","age"].includes(f.key)
                  ).slice(0, 1);
                  return (
                    <div style={{ marginTop: "1rem", padding: "0.9rem 1rem", background: "rgba(58,143,212,0.06)", border: "1px solid rgba(58,143,212,0.18)", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, fontSize: "0.82rem", color: "var(--primary-light)", marginBottom: "0.5rem" }}>
                        <Info size={13} />
                        {lang === "mn" ? "Яагаад ийм дүн гарав?" : "Why this result?"}
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.65, margin: 0 }}>
                        {lang === "mn"
                          ? `Хамгийн их нөлөөлсөн хүчин зүйлүүд: ${parts.join(", ")}. Барилгын зэрэглэл ${result.grade} — ${gradeDesc[result.grade] || ""}. Эрчим хүчний эрчмийн утга ${result.intensity} кВт·цаг/м² байна.${improvable.length > 0 ? ` Сайжруулах боломжтой: ${FEAT_LABELS[improvable[0].key] || improvable[0].key}.` : ""}`
                          : `Top drivers: ${parts.join(", ")}. Grade ${result.grade} means ${gradeDesc[result.grade] || ""}. Energy intensity is ${result.intensity} kWh/m².${improvable.length > 0 ? ` Improvement opportunity: ${FEAT_LABELS[improvable[0].key] || improvable[0].key}.` : ""}`}
                      </p>
                      {/* Hybrid derivation explanation */}
                      {result.isHybrid && (
                        <div style={{ marginTop: "0.65rem", paddingTop: "0.6rem", borderTop: "1px solid rgba(58,143,212,0.18)", fontSize: "0.77rem", color: "var(--text2)", lineHeight: 1.7 }}>
                          <strong style={{ color: "#2a9d8f", display: "block", marginBottom: "0.3rem" }}>
                            {lang === "mn" ? "Дүн яаж тооцоологдсон бэ?" : "How was this calculated?"}
                          </strong>
                          {result.isFallback ? (
                            lang === "mn"
                              ? `Загварын таамаглал (${result.modelAnnual.toLocaleString()} kWh) нэхэмжлэлийн утгаас 2 дахин их байсан тул загварыг бүрэн орхиж нэхэмжлэлийн утгыг ашигласан: ${result.userAnnual.toLocaleString()} kWh.`
                              : `Model (${result.modelAnnual.toLocaleString()} kWh) was >2× bill data — fell back to bill only: ${result.userAnnual.toLocaleString()} kWh.`
                          ) : (
                            lang === "mn"
                              ? `Нэхэмжлэл: ${result.userAnnual.toLocaleString()} kWh · Загвар (хязгаарласан): ${result.safeModel.toLocaleString()} kWh → Эцсийн = 0.7 × ${result.userAnnual.toLocaleString()} + 0.3 × ${result.safeModel.toLocaleString()} = ${result.annual.toLocaleString()} kWh`
                              : `Bill: ${result.userAnnual.toLocaleString()} kWh · Model (clamped): ${result.safeModel.toLocaleString()} kWh → Final = 0.7 × ${result.userAnnual.toLocaleString()} + 0.3 × ${result.safeModel.toLocaleString()} = ${result.annual.toLocaleString()} kWh`
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                        {lang === "mn" ? `506₮/м² × 9 сар (Эрчим хүчний зохицуулах хороо — dulaan.mn)` : `506₮/m² × 9 months (Energy Regulatory Commission — dulaan.mn)`}
                      </div>
                    </div>

                    {/* Official dulaan.mn tariff reference */}
                    <div style={{ background: "var(--bg3)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: "0.75rem" }}>
                      <div style={{ background: "#1a3a5c", padding: "0.3rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, color: "#7ec8ff" }}>
                        🔥 {lang === "mn" ? "Дулааны тариф (НӨАТ-гүй) — Эрчим хүчний зохицуулах хороо" : "Heating Tariff (excl. VAT) — Energy Regulatory Commission"}
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.7rem" }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                            <th style={{ padding: "0.2rem 0.6rem", textAlign: "left", color: "var(--text3)", fontWeight: 600 }}>{lang === "mn" ? "Ангилал" : "Category"}</th>
                            <th style={{ padding: "0.2rem 0.5rem", textAlign: "right", color: "var(--text3)", fontWeight: 600 }}>{lang === "mn" ? "Нэгж" : "Unit"}</th>
                            <th style={{ padding: "0.2rem 0.6rem", textAlign: "right", color: "var(--text3)", fontWeight: 600 }}>{lang === "mn" ? "Тариф" : "Tariff"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            [lang === "mn" ? "Орон сууцны халаалт" : "Apartment heating", "Төг/м²/сар", "506"],
                            [lang === "mn" ? "Орон сууцны халаалт" : "Apartment heating", "Төг/ГДж", "3,421"],
                            [lang === "mn" ? "Халуун ус — халаалтын улиралд" : "Hot water — heating season", "Төг/хүн", "1,870"],
                            [lang === "mn" ? "Халуун ус — халаалтын бус улиралд" : "Hot water — off-season", "Төг/хүн", "2,806"],
                            [lang === "mn" ? "Халуун ус — усны зарцуулалтаар" : "Hot water — by volume", "Төг/м³", "1,632"],
                          ].map(([label, unit, price]) => (
                            <tr key={label + unit} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "0.2rem 0.6rem", color: "var(--text2)" }}>{label}</td>
                              <td style={{ padding: "0.2rem 0.5rem", textAlign: "right", color: "var(--text3)", fontSize: "0.65rem" }}>{unit}</td>
                              <td style={{ padding: "0.2rem 0.6rem", textAlign: "right", fontWeight: 700, color: "#f4a261" }}>{price}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ padding: "0.25rem 0.6rem 0.3rem", borderTop: "1px solid var(--border)", background: "rgba(58,143,212,0.04)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.68rem" }}>
                          <tbody>
                            <tr><td style={{ color: "var(--text3)", padding: "0.1rem 0" }}>{lang === "mn" ? "Аж ахуйн нэгж — халаалт" : "Commercial — heating"}</td><td style={{ textAlign: "right", color: "var(--text3)", fontSize: "0.63rem" }}>Төг/м³</td><td style={{ textAlign: "right", fontWeight: 700, color: "#f4a261", paddingLeft: "0.5rem" }}>604</td></tr>
                            <tr><td style={{ color: "var(--text3)", padding: "0.1rem 0" }}>{lang === "mn" ? "Аж ахуйн нэгж — халаалт+халуун ус" : "Commercial — heat+hot water"}</td><td style={{ textAlign: "right", color: "var(--text3)", fontSize: "0.63rem" }}>Төг/ГДж</td><td style={{ textAlign: "right", fontWeight: 700, color: "#f4a261", paddingLeft: "0.5rem" }}>9,314</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "0.85rem", border: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.7 }}>
                      <strong style={{ display: "block", marginBottom: 4 }}>{lang === "mn" ? "Загварын тухай" : "About this model"}</strong>
                      {lang === "mn"
                        ? `БНТУ 23-02-09 стандартын дулааны ачааллын томьёонд үндэслэсэн. Суурь ${heating.gcal_per_m2} Гкал/м²/жил × ${form.area} м² = ${heating.annual_gcal} Гкал. Дулааны алдагдал: хана ${form.wall_material}, дулаалга ${form.insulation_quality}, HDD ${heating.hdd_used}${heating.hdd_is_default ? " (УБ дундаж)" : ""}.`
                        : `Based on БНТУ 23-02-09 thermal load formula. Base ${heating.gcal_per_m2} Gcal/m²/year × ${form.area} m² = ${heating.annual_gcal} Gcal. Heat loss factors: wall ${form.wall_material}, insulation ${form.insulation_quality}, HDD ${heating.hdd_used}${heating.hdd_is_default ? " (UB avg default)" : ""}.`}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.5rem" }}>
                      {lang === "mn"
                        ? <>Эх сурвалж: БНТУ 23-02-09 · <a href="https://www.dulaan.mn/page/tariff" target="_blank" rel="noopener noreferrer" style={{ color: "#3a8fd4" }}>Эрчим хүчний зохицуулах хороо — dulaan.mn</a></>
                        : <>Source: БНТУ 23-02-09 · <a href="https://www.dulaan.mn/page/tariff" target="_blank" rel="noopener noreferrer" style={{ color: "#3a8fd4" }}>Energy Regulatory Commission — dulaan.mn</a></>}
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
                        ? "Загвар нь физик EUI томьёо + XGBoost gradient boosting хосолсон. Бодит өгөгдлийн хязгаарлалтаас болж synthetic dataset ашигласан. Жишилтийн утгуудыг тооцоологдсон болохыг анхаарна уу."
                        : "Model uses physics-informed EUI formula + XGBoost gradient boosting. Synthetic dataset used due to limited public Mongolian building data. Note: actual consumption figures are referenced from published sources."}
                    </div>
                  </div>
                )}

                {/* ── Forecast Tab ── */}
                {resultTab === "forecast" && (() => {
                  const now   = new Date();
                  const hIdx  = now.getHours();
                  const mIdx  = now.getMonth();          // 0-based
                  const thisHourKwh  = +(result.daily_avg * HOUR_W[hIdx] / HOUR_W_SUM * 24).toFixed(2);
                  const thisMonthKwh = result.chart_data[mIdx].usage;
                  const daysInMonth  = new Date(now.getFullYear(), mIdx + 1, 0).getDate();
                  const remainDays   = daysInMonth - now.getDate() + 1;
                  const remainMonth  = Math.round(result.daily_avg * remainDays);

                  // Next 12 months starting from today
                  const totalAnnual12 = result.annual + (heating?.annual_kwh_equiv || 0);
                  const fbSplit12 = splitMonthlyEnergy(totalAnnual12);
                  const next12 = Array.from({ length: 12 }, (_, i) => {
                    const mi      = (mIdx + i) % 12;
                    const d       = new Date(now.getFullYear(), mIdx + i, 1);
                    const lbl     = d.toLocaleDateString(lang === "mn" ? "mn-MN" : "en-US", { month: "short", year: "2-digit" });
                    const elecKwh = result.chart_data[mi].usage;
                    // Physics heating model first; HDD-based fallback if unavailable
                    const heatKwh = heating?.monthly_heat_kwh?.[mi] ?? fbSplit12[mi].heating;
                    return { month: lbl, elec: elecKwh, heat: heatKwh, total: elecKwh + heatKwh, isCurrent: i === 0 };
                  });

                  // 5-year outlook (+2% per year aging factor)
                  const years5 = Array.from({ length: 5 }, (_, i) => ({
                    year: now.getFullYear() + i,
                    kwh:  Math.round(result.annual * Math.pow(1.02, i)),
                  }));
                  const maxKwh5 = years5[years5.length - 1].kwh;

                  return (
                    <div className="animate-fade">
                      <p style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: "1rem", lineHeight: 1.6 }}>
                        {lang === "mn"
                          ? "Барилгын параметр болон сарын хэв маягт тулгуурлан цаг хугацааны хэрэглээг таамаглав."
                          : "Energy use projected across time periods using building parameters and seasonal patterns."}
                      </p>

                      {/* ── Time cards ── */}
                      <div className="ptf-grid">
                        {[
                          {
                            period: lang === "mn" ? "Энэ цаг" : "This hour",
                            val:    thisHourKwh,
                            unit:   "kWh",
                            color:  "#3a8fd4",
                            sub:    `${String(hIdx).padStart(2,"0")}:00 – ${String(hIdx+1).padStart(2,"0")}:00`,
                          },
                          {
                            period: lang === "mn" ? "Өнөөдөр" : "Today",
                            val:    result.daily_avg.toLocaleString(),
                            unit:   "kWh",
                            color:  "#2a9d8f",
                            sub:    now.toLocaleDateString(lang === "mn" ? "mn-MN" : "en-US", { weekday: "short", day: "numeric", month: "short" }),
                          },
                          {
                            period: lang === "mn" ? "Энэ сар" : "This month",
                            val:    thisMonthKwh.toLocaleString(),
                            unit:   "kWh",
                            color:  "#f4a261",
                            sub:    lang === "mn"
                              ? `Үлдсэн ~${remainMonth.toLocaleString()} kWh (${remainDays} өдөр)`
                              : `~${remainMonth.toLocaleString()} kWh left (${remainDays}d)`,
                          },
                          {
                            period: lang === "mn" ? "Жил" : "Year",
                            val:    result.annual.toLocaleString(),
                            unit:   "kWh",
                            color:  "#e9c46a",
                            sub:    `${now.getFullYear()} · ${result.intensity} kWh/m²`,
                          },
                        ].map((c, i) => (
                          <div key={i} className="ptf-card" style={{ borderColor: `${c.color}44` }}>
                            <div className="ptf-period" style={{ color: c.color }}>{c.period}</div>
                            <div className="ptf-val">
                              {c.val} <span className="ptf-unit">{c.unit}</span>
                            </div>
                            <div className="ptf-sub">{c.sub}</div>
                          </div>
                        ))}
                      </div>

                      {/* ── Next 12 months chart ── */}
                      <h4 className="chart-sub-title" style={{ marginTop: "1.25rem" }}>
                        {lang === "mn" ? "Дараагийн 12 сарын таамаглал" : "Next 12-month forecast"}
                      </h4>
                      <EnergyDualChart
                        lang={lang}
                        height={185}
                        leftTitle={lang === "mn" ? "Stacked: Дулаалга + Цахилгаан = Нийт" : "Stacked: Heating + Electric = Use"}
                        rightTitle={lang === "mn" ? "Сар бүрийн нийт хэрэглээ (MWh)" : "Monthly total consumption (MWh)"}
                        data={next12.map(d => ({
                          month:    d.month,
                          heating:  d.heat,
                          electric: d.elec,
                          total:    d.total,
                        }))}
                      />
                      <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: "0.35rem", textAlign: "center" }}>
                        {lang === "mn" ? "Одоогийн сараас эхлэн 12 сар · цахилгаан + дулааны хэрэглээ (kWh эквивалент)" : "12 months from now · electricity + heating consumption (kWh equivalent)"}
                      </div>

                      {/* ── 5-year outlook ── */}
                      <h4 className="chart-sub-title" style={{ marginTop: "1.25rem" }}>
                        {lang === "mn" ? "5 жилийн хэтийн таамаглал" : "5-year outlook"}
                      </h4>
                      <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: "0.7rem" }}>
                        {lang === "mn"
                          ? "+2%/жил өсөлт гэж үзсэн (барилгын нас, тоног төхөөрөмжийн эдэлгээ)"
                          : "+2%/yr growth assumed (building aging, equipment wear)"}
                      </div>
                      <div className="ptf-5yr">
                        {years5.map((y, i) => (
                          <div key={y.year} className="ptf-5yr-row">
                            <div className="ptf-5yr-yr" style={{ color: i === 0 ? "var(--primary-light)" : "var(--text2)" }}>
                              {y.year}{i === 0 ? (lang === "mn" ? " ←одоо" : " ←now") : ""}
                            </div>
                            <div className="ptf-5yr-bar-wrap">
                              <div className="ptf-5yr-bar"
                                style={{ width: `${(y.kwh / maxKwh5) * 100}%`,
                                  background: i === 0 ? "#3a8fd4" : `rgba(58,143,212,${0.38 + i * 0.13})` }} />
                            </div>
                            <div className="ptf-5yr-val">
                              {y.kwh.toLocaleString()} <span style={{ color: "var(--text3)", fontSize: "0.68rem" }}>kWh</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: "0.65rem", lineHeight: 1.5 }}>
                        {lang === "mn"
                          ? "Таамаглал нь барилгын физик параметр + сарын хэрэглээний хэв маягт тулгуурласан. Бодит хэрэглээ цаг уур, хэрэглэгчийн зан байдлаас хамаарч өөрчлөгдөж болно."
                          : "Forecast based on building parameters and seasonal patterns. Actual usage may differ with weather changes and occupant behavior."}
                      </div>
                    </div>
                  );
                })()}

                {/* Model info + save */}
                <div className="model-info-row">
                  <span className="model-badge" title="Physics-informed XGBoost gradient boosting trained on 600 UB buildings">XGBoost + EUI</span>
                  <span className="model-badge" title={`n_train=${METRICS.n_train}, n_test=${METRICS.n_test}`}>
                    R² = {METRICS.r2}
                  </span>
                  <span className="model-badge" title="Mean Absolute Percentage Error on held-out test set">
                    MAPE = {METRICS.mape}%
                  </span>
                  <span className="model-badge" title={`MAE = ${METRICS.mae.toLocaleString()} kWh on test set`}>
                    MAE = {METRICS.mae.toLocaleString()} kWh
                  </span>
                  <span className="model-badge" title={`RMSE = ${METRICS.rmse.toLocaleString()} kWh on test set`}>
                    RMSE = {METRICS.rmse.toLocaleString()} kWh
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
                  addScenario({ label: scenLabel.trim(), form, id: Date.now() });
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
                  addScenario({ label: scenLabel.trim(), form, id: Date.now() });
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
