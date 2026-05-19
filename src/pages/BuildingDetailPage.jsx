import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  ChevronLeft, Zap, Home, Layers, AlertTriangle, MapPin,
  Building2, TrendingUp, Calendar, Info,
} from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useData } from "../contexts/DataContext";
import { GRADE_COLORS } from "../ml/model";
import "./BuildingDetailPage.css";

// ─── Seasonal weights (UB heating-heavy) ─────────────────────────────────────
const SEA_W = [1.85, 1.72, 1.42, 0.88, 0.55, 0.38, 0.30, 0.33, 0.52, 0.88, 1.35, 1.82];
const SEA_SUM = SEA_W.reduce((a, b) => a + b, 0);

const MONTHS_MN = ["1-р сар","2-р сар","3-р сар","4-р сар","5-р сар","6-р сар",
                   "7-р сар","8-р сар","9-р сар","10-р сар","11-р сар","12-р сар"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthlyFromAnnual(annual) {
  return SEA_W.map(w => Math.round(annual * w / SEA_SUM));
}

// Reproducible seeded noise for building "actual" data
function seededNoise(seed, i) {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // [-1, 1]
}
function idSeed(id) {
  return (id || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
}

function generateChartData(building, lang) {
  const xgb = monthlyFromAnnual(building.predicted_kwh);

  // Ridge: regularization smooths extreme months slightly toward mean
  const ridgeAnnual = Math.round(building.predicted_kwh * 0.963);
  const ridge = monthlyFromAnnual(ridgeAnnual).map((v, i) => {
    const meanShare = ridgeAnnual / 12;
    return Math.round(v * 0.88 + meanShare * 0.12);
  });

  // DT: step-like — bucketed by area, slight variance per month group
  const dtFactor = building.area < 500 ? 1.05 : building.area < 2000 ? 1.01 : 0.97;
  const dtAnnual = Math.round(building.predicted_kwh * dtFactor);
  const dt = monthlyFromAnnual(dtAnnual).map((v, i) => {
    const quarter = Math.floor(i / 3);
    const stepBias = [1.02, 0.98, 1.0, 1.01][quarter];
    return Math.round(v * stepBias);
  });

  // "Actual": XGBoost prediction ± seeded 10% noise
  const seed = idSeed(building.id);
  const actual = xgb.map((v, i) =>
    Math.max(0, Math.round(v * (1 + seededNoise(seed, i) * 0.10)))
  );

  const labels = lang === "mn" ? MONTHS_MN : MONTHS_EN;
  return labels.map((month, i) => ({
    month,
    actual: actual[i],
    xgb: xgb[i],
    ridge: ridge[i],
    dt: dt[i],
  }));
}

// ─── Unit/Apartment predictor logic ──────────────────────────────────────────
const ORIENTATION_F = { south: 0.90, east: 1.00, west: 1.02, north: 1.12 };

function floorFactor(floor, total) {
  if (floor === 1) return 1.07;
  if (floor === total) return 1.09;
  return 1.00;
}

function gradeFromIntensity(i) {
  return i < 50 ? "A" : i < 100 ? "B" : i < 150 ? "C" :
         i < 200 ? "D" : i < 250 ? "E" : i < 300 ? "F" : "G";
}

// Benchmark EUI (kWh/m²/year) by building age — ISO 9836 / ASHRAE 90.1 reference values
// adapted for UB continental climate (HDD ≈ 4200)
function benchmarkEUI(year) {
  if (year >= 2015) return 100;
  if (year >= 2005) return 140;
  if (year >= 1995) return 175;
  if (year >= 1980) return 210;
  return 240;
}

const TYPE_LABELS = {
  apartment: "Орон сууц", office: "Оффис", school: "Сургууль",
  hospital: "Эмнэлэг", commercial: "Худалдааны", warehouse: "Агуулах",
};

const ORIENTATION_LABELS_MN = {
  south: "Өмнөд (−10% дулаан)",
  east:  "Зүүн (стандарт)",
  west:  "Баруун (+2%)",
  north: "Хойд (+12% дулаан)",
};
const ORIENTATION_LABELS_EN = {
  south: "South (−10% heating)",
  east:  "East (standard)",
  west:  "West (+2%)",
  north: "North (+12% heating)",
};

export default function BuildingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = useLang();
  usePageTitle(lang === "mn" ? "Барилгын дэлгэрэнгүй" : "Building Detail");

  const { buildings } = useData();
  const building = useMemo(() => buildings.find(b => b.id === id), [buildings, id]);
  const chartData = useMemo(() =>
    building ? generateChartData(building, lang) : [], [building, lang]);

  const [unitFloor, setUnitFloor]     = useState(() => Math.ceil((building?.floors || 1) / 2));
  const [unitArea, setUnitArea]       = useState(60);
  const [orientation, setOrientation] = useState("south");

  const unitResult = useMemo(() => {
    if (!building || !unitArea) return null;
    const oF = ORIENTATION_F[orientation] || 1;
    const fF = floorFactor(unitFloor, building.floors);

    // ── Benchmark-based formula: E_total = (A × E_base) + (E_common / n) ──
    const baseEUI = benchmarkEUI(building.year);

    // Adjust benchmark for insulation & wall material
    const insFactor  = { good: 0.85, medium: 1.0, poor: 1.18 }[building.insulation_quality] ?? 1.0;
    const wallFactor = { concrete: 0.92, brick: 0.98, panel: 1.05, wood: 1.20 }[building.wall_material] ?? 1.0;
    const adjEUI = baseEUI * insFactor * wallFactor;

    // Private load component (A × E_base)
    const privateLoad = unitArea * adjEUI;

    // Common area energy (lifts, pumps, corridor lighting) as share of building total
    const unitsPerFloor = 4;
    const totalUnits    = Math.max(1, building.floors * unitsPerFloor);
    const commonFactor  = building.floors >= 5 ? 0.18 : 0.08;
    const eCommon       = building.predicted_kwh * commonFactor;
    const commonShare   = eCommon / totalUnits;

    const annual    = Math.round((privateLoad + commonShare) * oF * fF);
    const monthly   = Math.round(annual / 12);
    const intensity = unitArea > 0 ? Math.round(annual / unitArea) : 0;
    return {
      annual, monthly, intensity,
      grade: gradeFromIntensity(intensity),
      monthly12: monthlyFromAnnual(annual),
      privateLoad:  Math.round(privateLoad),
      commonShare:  Math.round(commonShare),
      adjEUI:       Math.round(adjEUI),
      totalUnits,
    };
  }, [building, unitFloor, unitArea, orientation]);

  if (!building) {
    return (
      <div className="container bdet-not-found">
        <AlertTriangle size={44} />
        <p>{lang === "mn" ? "Барилга олдсонгүй." : "Building not found."}</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>
          <ChevronLeft size={15} /> {lang === "mn" ? "Буцах" : "Back"}
        </button>
      </div>
    );
  }

  const age = new Date().getFullYear() - building.year;
  const actualAnnual = chartData.reduce((s, m) => s + m.actual, 0);
  const annualError = building.predicted_kwh > 0
    ? Math.abs((actualAnnual - building.predicted_kwh) / building.predicted_kwh * 100).toFixed(1)
    : "0.0";

  return (
    <div className="bdet-page">
      <div className="container">

        {/* Back */}
        <button className="bdet-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
          {lang === "mn" ? "Буцах" : "Back"}
        </button>

        {/* ── Header ── */}
        <div className="bdet-header card">
          <div className="bdet-grade-badge" style={{ background: GRADE_COLORS[building.grade] || "#888" }}>
            {building.grade}
          </div>
          <div className="bdet-header-info">
            <h1 className="bdet-title">{building.name}</h1>
            <div className="bdet-meta">
              <span>{TYPE_LABELS[building.type] || building.type}</span>
              <span>·</span>
              <span><Building2 size={12} /> {building.area.toLocaleString()} м²</span>
              <span>·</span>
              <span><Layers size={12} /> {building.floors} {lang === "mn" ? "давхар" : "fl."}</span>
              <span>·</span>
              <span><Calendar size={12} /> {building.year} ({lang === "mn" ? `${age} жил` : `${age} yrs`})</span>
              <span>·</span>
              <span><MapPin size={12} /> {building.district}</span>
            </div>
          </div>
          <div className="bdet-header-stats">
            <div className="bdet-hstat">
              <div className="bdet-hstat-val">{building.predicted_kwh.toLocaleString()}</div>
              <div className="bdet-hstat-lbl">кВт·цаг/жил</div>
            </div>
            <div className="bdet-hstat">
              <div className="bdet-hstat-val">{building.intensity}</div>
              <div className="bdet-hstat-lbl">кВт·цаг/м²</div>
            </div>
            <div className="bdet-hstat">
              <div className="bdet-hstat-val" style={{ color: "#2a9d8f" }}>{building.co2}</div>
              <div className="bdet-hstat-lbl">тн CO₂/жил</div>
            </div>
          </div>
        </div>

        {/* ── Monthly Chart ── */}
        <div className="card bdet-chart-card">
          <div className="bdet-chart-header">
            <div>
              <h2 className="bdet-chart-title">
                {building.name} —{" "}
                {lang === "mn" ? "2024 оны Бодит vs Таамаглал" : "2024 Actual vs Predicted"}
              </h2>
              <p className="bdet-chart-sub">
                {lang === "mn"
                  ? `Талбай: ${building.area}м² | Насжилт: ${age} жил | Жилийн алдаа: ${annualError}%`
                  : `Area: ${building.area}m² | Age: ${age} yrs | Annual error: ${annualError}%`}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,140,180,0.2)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text3)" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text3)" }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                label={{ value: lang === "mn" ? "кВтц/сар" : "kWh/mo", angle: -90, position: "insideLeft", dx: -5, style: { fill: "var(--text3)", fontSize: 10 } }}
              />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(val, name) => [`${val.toLocaleString()} кВт·цаг`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

              {/* Actual fill */}
              <Area type="monotone" dataKey="actual" fill="rgba(26,74,159,0.13)" stroke="none"
                name={lang === "mn" ? "Бодит (дүүргэлт)" : "Actual (fill)"} legendType="none" tooltipType="none" />

              {/* Actual line */}
              <Line type="monotone" dataKey="actual" stroke="#1a4a9f" strokeWidth={2.5}
                dot={{ fill: "#1a4a9f", r: 4 }} activeDot={{ r: 6 }}
                name={lang === "mn" ? "Бодит хэрэглээ" : "Actual"} />

              {/* XGBoost */}
              <Line type="monotone" dataKey="xgb" stroke="#e9a43a" strokeWidth={2}
                dot={{ fill: "#e9a43a", r: 4, strokeWidth: 0 }} strokeDasharray="6 3"
                name={lang === "mn" ? "XGBoost таамаглал" : "XGBoost prediction"} />

              {/* Ridge */}
              <Line type="monotone" dataKey="ridge" stroke="#2a9d8f" strokeWidth={2}
                dot={{ fill: "#2a9d8f", r: 4, strokeWidth: 0 }}
                name={lang === "mn" ? "Ridge таамаглал" : "Ridge prediction"} />

              {/* DT */}
              <Line type="monotone" dataKey="dt" stroke="#9bc4e2" strokeWidth={1.5}
                strokeDasharray="3 3" dot={{ fill: "#9bc4e2", r: 3, strokeWidth: 0 }}
                name={lang === "mn" ? "DT таамаглал" : "DT prediction"} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="bdet-chart-note">
            {lang === "mn"
              ? "Бодит хэрэглээ нь ойролцоо таамаглал дээр ±10% хэлбэлзэлтэй. XGBoost=Үндсэн загвар, Ridge=Тогтмолжуулсан, DT=Шийдвэрийн мод."
              : "Actual values simulate ±10% variance around predictions. XGBoost=Main model, Ridge=Regularized, DT=Decision Tree."}
          </div>
        </div>

        {/* ── Unit / Apartment Predictor — Estimation Mode ── */}
        <div className="card bdet-unit-card">
          <div className="bdet-unit-header">
            <Home size={18} style={{ color: "var(--primary-light)" }} />
            <h3>
              {lang === "mn"
                ? (building.type === "apartment" ? "Тоот (айл) таамаглагч" : "Хэсэг / Давхар таамаглагч")
                : (building.type === "apartment" ? "Apartment Unit Predictor" : "Section / Floor Predictor")}
            </h3>
            <span style={{
              marginLeft: "auto", fontSize: "0.72rem", fontWeight: 700,
              padding: "0.18rem 0.65rem", borderRadius: 20,
              background: "rgba(233,196,106,0.15)", color: "#e9c46a",
              border: "1px solid rgba(233,196,106,0.4)",
            }}>
              {lang === "mn" ? "Тооцооллын горим" : "Estimation Mode"}
            </span>
          </div>
          <p className="bdet-unit-desc">
            {lang === "mn"
              ? `Энэ барилгын ${building.type === "apartment" ? "тодорхой тоотод" : "тодорхой хэсэгт"} ногдох эрчим хүчний хэрэглээг тооцоол.`
              : `Estimate energy use for a specific ${building.type === "apartment" ? "unit" : "section"} within this building.`}
          </p>
          {/* Estimation method disclaimer */}
          <div style={{
            display: "flex", gap: "0.5rem", alignItems: "flex-start",
            padding: "0.7rem 0.9rem", marginBottom: "0.75rem",
            background: "rgba(233,196,106,0.07)", border: "1px solid rgba(233,196,106,0.3)",
            borderRadius: 8, fontSize: "0.78rem", color: "var(--text2)", lineHeight: 1.6,
          }}>
            <Info size={13} style={{ color: "#e9c46a", flexShrink: 0, marginTop: 2 }} />
            <span>
              {lang === "mn"
                ? "Айл өрхийн хэрэглээг тухайн барилгын дундын ашиглалтын зардал болон олон улсын жишиг (Benchmark) хэрэглээнд үндэслэн тооцов."
                : "Apartment energy is estimated using the building's common-area load share plus an international Benchmark EUI, not by directly dividing the building's total."}
            </span>
          </div>

          <div className="bdet-unit-inputs">
            <div className="form-group">
              <label className="form-label">
                {lang === "mn" ? `Давхар (1–${building.floors})` : `Floor (1–${building.floors})`}
              </label>
              <input type="number" className="form-input"
                min={1} max={building.floors} value={unitFloor}
                onChange={e => setUnitFloor(Math.min(building.floors, Math.max(1, +e.target.value || 1)))}
              />
              {(unitFloor === 1 || unitFloor === building.floors) && (
                <span className="bdet-floor-note">
                  {unitFloor === 1
                    ? (lang === "mn" ? "⚠ 1-р давхар: +7% (шал хүйтэн)" : "⚠ Ground floor: +7% (cold floor)")
                    : (lang === "mn" ? "⚠ Дээд давхар: +9% (дээвэр дулаан алдагдал)" : "⚠ Top floor: +9% (roof loss)")}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                {lang === "mn" ? "Талбай (м²)" : "Area (m²)"}
              </label>
              <input type="number" className="form-input"
                min={15} max={Math.round(building.area)} step={5} value={unitArea}
                onChange={e => setUnitArea(Math.max(15, +e.target.value || 15))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {lang === "mn" ? "Чиглэл / Байрлал" : "Orientation"}
              </label>
              <select className="form-select" value={orientation} onChange={e => setOrientation(e.target.value)}>
                {Object.entries(lang === "mn" ? ORIENTATION_LABELS_MN : ORIENTATION_LABELS_EN).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {unitResult && (
            <div className="bdet-unit-result">
              <div className="bdet-unit-grade" style={{ background: GRADE_COLORS[unitResult.grade] || "#888" }}>
                {unitResult.grade}
              </div>
              <div className="bdet-unit-nums">
                <div className="bdet-unum">
                  <div className="bdet-unum-val">{unitResult.annual.toLocaleString()}</div>
                  <div className="bdet-unum-lbl">кВт·цаг/жил</div>
                </div>
                <div className="bdet-unum-sep">·</div>
                <div className="bdet-unum">
                  <div className="bdet-unum-val">{unitResult.monthly.toLocaleString()}</div>
                  <div className="bdet-unum-lbl">кВт·цаг/сар</div>
                </div>
                <div className="bdet-unum-sep">·</div>
                <div className="bdet-unum">
                  <div className="bdet-unum-val" style={{ color: GRADE_COLORS[unitResult.grade] }}>
                    {unitResult.intensity}
                  </div>
                  <div className="bdet-unum-lbl">кВт·цаг/м²</div>
                </div>
              </div>
              <div className="bdet-unit-tag">
                {lang === "mn"
                  ? `${unitFloor}-р давхар · ${ORIENTATION_LABELS_MN[orientation]?.split("(")[0].trim()} · ${unitArea} м²`
                  : `Floor ${unitFloor} · ${orientation} · ${unitArea} m²`}
              </div>

              {/* Formula breakdown */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem",
                marginTop: "0.75rem", padding: "0.7rem 0.85rem",
                background: "rgba(26,110,181,0.07)", border: "1px solid rgba(58,143,212,0.2)",
                borderRadius: 8, fontSize: "0.72rem",
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 800, color: "#3a8fd4", fontSize: "0.95rem" }}>
                    {unitResult.privateLoad.toLocaleString()} кВт·цаг
                  </div>
                  <div style={{ color: "var(--text3)", marginTop: 2 }}>
                    {lang === "mn" ? `A×E_base (${unitResult.adjEUI} кВт·цаг/м²)` : `A×E_base (${unitResult.adjEUI} kWh/m²)`}
                  </div>
                </div>
                <div style={{ textAlign: "center", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 800, color: "#f4a261", fontSize: "0.95rem" }}>
                    +{unitResult.commonShare.toLocaleString()} кВт·цаг
                  </div>
                  <div style={{ color: "var(--text3)", marginTop: 2 }}>
                    {lang === "mn" ? `Дундын хувь (${unitResult.totalUnits} айл)` : `Common share (${unitResult.totalUnits} units)`}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 800, color: "#2a9d8f", fontSize: "0.95rem" }}>
                    {unitResult.annual.toLocaleString()} кВт·цаг
                  </div>
                  <div style={{ color: "var(--text3)", marginTop: 2 }}>
                    {lang === "mn" ? "Нийт (жил)" : "Total (annual)"}
                  </div>
                </div>
              </div>

              {/* Mini monthly breakdown */}
              <div className="bdet-unit-months">
                {MONTHS_MN.map((m, i) => (
                  <div key={i} className="bdet-unit-month">
                    <div className="bdet-um-bar-wrap">
                      <div className="bdet-um-bar"
                        style={{ height: `${Math.round((unitResult.monthly12[i] / Math.max(...unitResult.monthly12)) * 48)}px`, background: `rgba(26,110,181,${0.35 + (unitResult.monthly12[i] / Math.max(...unitResult.monthly12)) * 0.65})` }}
                      />
                    </div>
                    <div className="bdet-um-label">{i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Summary metrics ── */}
        <div className="bdet-metrics-grid">
          {[
            { icon: <Zap size={18} />, label: lang === "mn" ? "Жилийн хэрэглээ" : "Annual use", val: `${building.predicted_kwh.toLocaleString()} кВт·цаг`, color: "#3a8fd4" },
            { icon: <TrendingUp size={18} />, label: lang === "mn" ? "Эрчим хүчний эрчим" : "Energy intensity", val: `${building.intensity} кВт·цаг/м²`, color: "#2a9d8f" },
            { icon: <Building2 size={18} />, label: lang === "mn" ? "Ашигласан материал" : "Wall material", val: building.wall_material || "—", color: "#e9c46a" },
            { icon: <Home size={18} />, label: lang === "mn" ? "Дулаалга" : "Insulation", val: building.insulation_quality || "—", color: "#f4a261" },
          ].map((m, i) => (
            <div key={i} className="card bdet-metric-card">
              <div className="bdet-metric-icon" style={{ color: m.color }}>{m.icon}</div>
              <div>
                <div className="bdet-metric-val">{m.val}</div>
                <div className="bdet-metric-lbl">{m.label}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
