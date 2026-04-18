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

// ─── CSS 3D Building ──────────────────────────────────────────────────────────
function Building3D({ floors, area, buildingType }) {
  const color = BUILDING_COLORS[buildingType] || "#3a8fd4";
  const W = 130, D = 70;
  const H = Math.min(Math.max(Math.round(floors * 16), 70), 210);
  const nFloors = Math.min(floors, 10);
  const floorH = H / nFloors;
  const winCols = Math.min(4, Math.max(2, Math.floor(W / 35)));
  const winW = (W - (winCols + 1) * 8) / winCols;
  const winH = Math.max(7, floorH * 0.42);

  return (
    <div className="b3d-scene">
      <div className="b3d-box" style={{ width: W, height: H }}>
        {/* Front face */}
        <div style={{
          position: "absolute", top: 0, left: 0, width: W, height: H,
          background: `linear-gradient(175deg, ${color}cc 0%, ${color} 100%)`,
          overflow: "hidden", borderRadius: "3px 3px 0 0",
        }}>
          {nFloors > 1 && Array.from({ length: nFloors - 1 }, (_, i) => (
            <div key={i} style={{
              position: "absolute", left: 0, right: 0,
              top: `${((i + 1) / nFloors) * 100}%`,
              height: 1, background: "rgba(255,255,255,0.2)",
            }} />
          ))}
          {Array.from({ length: nFloors }, (_, row) =>
            Array.from({ length: winCols }, (_, col) => (
              <div key={`${row}-${col}`} style={{
                position: "absolute",
                width: winW, height: winH,
                left: 8 + col * (winW + 8),
                top: row * floorH + (floorH - winH) * 0.28,
                background: "rgba(200,235,255,0.5)",
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 2,
              }} />
            ))
          )}
          <div style={{
            position: "absolute", bottom: 0, left: "50%",
            transform: "translateX(-50%)",
            width: 18, height: Math.max(22, floorH * 0.65),
            background: "rgba(0,0,0,0.28)", borderRadius: "3px 3px 0 0",
          }} />
          <div style={{
            position: "absolute", bottom: 5, right: 7,
            fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.65)",
          }}>{Math.round(area)}m²</div>
        </div>

        {/* Right side face */}
        <div style={{
          position: "absolute", top: 0, left: W,
          width: D, height: H,
          background: "rgba(0,0,0,0.3)",
          transformOrigin: "left center",
          transform: "rotateY(-90deg)",
          overflow: "hidden",
        }}>
          {Array.from({ length: nFloors }, (_, row) => (
            <div key={row} style={{
              position: "absolute",
              width: D * 0.35, height: winH,
              left: D * 0.15,
              top: row * floorH + (floorH - winH) * 0.28,
              background: "rgba(200,235,255,0.2)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 2,
            }} />
          ))}
        </div>

        {/* Roof face */}
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: W, height: D,
          background: "rgba(255,255,255,0.18)",
          transformOrigin: "top center",
          transform: "rotateX(-90deg)",
        }}>
          <div style={{
            position: "absolute", top: "25%", left: "15%",
            width: "22%", height: "45%",
            background: "rgba(255,255,255,0.15)",
            borderRadius: 3, border: "1px solid rgba(255,255,255,0.2)",
          }} />
          <div style={{
            position: "absolute", top: "20%", right: "18%",
            width: "18%", height: "50%",
            background: "rgba(255,255,255,0.1)",
            borderRadius: 2, border: "1px solid rgba(255,255,255,0.12)",
          }} />
        </div>
      </div>
    </div>
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
  const [errors, setErrors] = useState({});

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
    if (errors[e.target.name]) setErrors(prev => { const n = { ...prev }; delete n[e.target.name]; return n; });
  };

  const validate = () => {
    const e = {};
    if (!form.area || form.area < 50) e.area = lang === "mn" ? "Талбай 50м²-аас их байх ёстой" : "Area must be at least 50m²";
    else if (form.area > 50000) e.area = lang === "mn" ? "Талбай 50,000м²-аас хэтрэхгүй" : "Area must be under 50,000m²";
    if (!form.year || form.year < 1940) e.year = lang === "mn" ? "Барилгын жил 1940-өөс их байх ёстой" : "Year must be after 1940";
    else if (form.year > 2026) e.year = lang === "mn" ? "Барилгын жил 2026-аас хэтрэхгүй" : "Year must not exceed 2026";
    if (!form.floors || form.floors < 1) e.floors = lang === "mn" ? "Давхрын тоо 1-ээс их байх ёстой" : "At least 1 floor required";
    else if (form.floors > 50) e.floors = lang === "mn" ? "Давхрын тоо 50-аас хэтрэхгүй" : "Floors must not exceed 50";
    if (!form.rooms || form.rooms < 1) e.rooms = lang === "mn" ? "Өрөөний тоо 1-ээс их байх ёстой" : "At least 1 room required";
    return e;
  };

  const fillExample = () => {
    setForm(prev => ({
      ...prev,
      building_name: lang === "mn" ? "Жишиг орон сууц" : "Example Apartment",
      district: "Сүхбаатар",
      area: 1200,
      building_type: "apartment",
      year: 1985,
      floors: 9,
      rooms: 3,
      window_ratio: 30,
      wall_material: "panel",
      heating_type: "central",
      insulation_quality: "medium",
      window_type: "double",
    }));
    setErrors({});
  };

  const runModel = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
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
                    className={`form-input${errors.area ? " input-error" : ""}`} min={50} max={50000} step={10} />
                  {errors.area && <span className="field-error">{errors.area}</span>}
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
                    className={`form-input${errors.year ? " input-error" : ""}`} min={1940} max={2026} />
                  {errors.year && <span className="field-error">{errors.year}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-floors">{t.predictor.floors}</label>
                  <input id="pred-floors" type="number" name="floors" value={form.floors} onChange={handleChange}
                    className={`form-input${errors.floors ? " input-error" : ""}`} min={1} max={50} />
                  {errors.floors && <span className="field-error">{errors.floors}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pred-rooms">{t.predictor.rooms}</label>
                  <input id="pred-rooms" type="number" name="rooms" value={form.rooms} onChange={handleChange}
                    className={`form-input${errors.rooms ? " input-error" : ""}`} min={1} max={20} />
                  {errors.rooms && <span className="field-error">{errors.rooms}</span>}
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

            {Object.keys(errors).length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.9rem", background: "rgba(230,57,70,0.08)", border: "1px solid rgba(230,57,70,0.3)", borderRadius: 8, marginBottom: "0.5rem", fontSize: "0.82rem", color: "#e63946" }}>
                <AlertTriangle size={14} />
                {lang === "mn" ? "Оруулсан утгуудыг шалгана уу" : "Please fix the errors above before predicting"}
              </div>
            )}
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
              <button
                className="btn btn-secondary"
                onClick={fillExample}
                title={lang === "mn" ? "Жишиг барилгын мэдээллээр дүүргэх" : "Fill with a sample building to try the predictor"}
                style={{ flexShrink: 0 }}
              >
                <Lightbulb size={14} />
                {lang === "mn" ? "Жишээ" : "Example"}
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
                <Building3D
                  floors={form.floors}
                  area={form.area}
                  buildingType={form.building_type}
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
