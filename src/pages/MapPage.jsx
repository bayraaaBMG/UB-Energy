import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Polygon, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { storageGetJSON } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";
import { useAuth } from "../contexts/AuthContext";
import {
  Building2, Zap, Wind, Ruler, Filter, TrendingUp,
  Database, Calculator, Leaf, BarChart2, Award, Lightbulb,
  ThermometerSnowflake, Layers,
} from "lucide-react";
import { monthlyEnergyData, buildingsData } from "../data/mockData";
import { predict } from "../ml/model";
import "leaflet/dist/leaflet.css";
import "./MapPage.css";

// ─── Tile providers ────────────────────────────────────────────────────────────
const TILES = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://openstreetmap.org/">OpenStreetMap</a>',
  },
};

const UB_CENTER = [47.9184, 106.9177];

// Multiple Overpass mirrors — tried in order until one works
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Grid step for viewport dedup (degrees) — ~2 km cells
const FETCH_STEP = 0.02;

// ─── Building type colors ──────────────────────────────────────────────────────
const TYPE_COLOR = {
  apartment:  "#3a8fd4",
  office:     "#9b72cf",
  school:     "#2a9d8f",
  hospital:   "#e63946",
  commercial: "#f4a261",
};

// ─── Calculation Engine ────────────────────────────────────────────────────────
const FLOOR_HEIGHT = 3.0;

const TYPE_EUI = {
  apartment:  { heating: 120, electric: 35 },
  office:     { heating:  90, electric: 60 },
  school:     { heating: 100, electric: 40 },
  hospital:   { heating: 130, electric: 80 },
  commercial: { heating:  80, electric: 90 },
};

// Emission factors (kg CO₂ per kWh)
const EF_HEAT = 0.28;   // district heating (coal boilers)
const EF_ELEC = 0.73;   // Mongolia electricity grid

function calcBuilding(b) {
  const eui    = TYPE_EUI[b.type] || TYPE_EUI.apartment;
  const height = b.floors * FLOOR_HEIGHT;
  const volume = b.area * height;

  // EUI split (heating vs electric share)
  const heating  = Math.round(b.area * eui.heating);
  const electric = Math.round(b.area * eui.electric);

  // ML prediction — uses building properties if available, else defaults
  const mlForm = {
    building_type:      b.type || "apartment",
    area:               b.area,
    year:               b.year || 1990,
    floors:             b.floors,
    rooms:              b.rooms || Math.max(1, Math.round(b.area / 50)),
    hdd:                4500,
    window_ratio:       25,
    residents:          Math.max(1, Math.round(b.area / 30)),
    appliances:         5,
    wall_material:      b.wall_material      || "panel",
    heating_type:       b.heating_type       || "central",
    insulation_quality: b.insulation_quality || "medium",
    window_type:        b.window_type        || "double",
  };
  const ml = predict(mlForm);

  // For user buildings with actual bill data, use that as primary
  const hasActualData  = (b.source === "user") && b.monthly_usage > 0;
  const actualAnnual   = hasActualData ? Math.round(b.monthly_usage * 12) : null;
  const total          = actualAnnual ?? ml.annual;
  const intensity      = Math.round(total / b.area);
  const co2            = +((heating * EF_HEAT + electric * EF_ELEC) / 1000).toFixed(1);
  const pm25           = Math.round(co2 * 1350);

  const grade =
    intensity < 50  ? "A" : intensity < 100 ? "B" :
    intensity < 150 ? "C" : intensity < 200 ? "D" :
    intensity < 250 ? "E" : intensity < 300 ? "F" : "G";

  const impactLabel = co2 > 60 ? "high" : co2 > 30 ? "medium" : "low";
  const impactColor = { high: "#e63946", medium: "#f4a261", low: "#2a9d8f" }[impactLabel];

  return {
    height, volume, heating, electric, total, co2, pm25, intensity,
    grade, impactLabel, impactColor,
    euiHeating: eui.heating, euiElectric: eui.electric,
    ml, hasActualData, actualAnnual,
  };
}

// ─── Recommendations engine ───────────────────────────────────────────────────
function getRecommendations(b, calc, lang) {
  const mn = lang === "mn";
  const recs = [];
  const insul = b.insulation_quality || "medium";
  const win   = b.window_type || "double";
  const year  = b.year || 1990;
  const heat  = b.heating_type || "central";

  if (insul === "poor") {
    const saving = Math.round(calc.ml.annual * 0.22);
    recs.push({
      Icon: ThermometerSnowflake, color: "#3a8fd4",
      title: mn ? "Дулаалга сайжруулах" : "Improve insulation",
      desc:  mn ? "Хананы дулаалгыг сайжруулснаар дулааны алдагдлыг мэдэгдэхүйц бууруулна." : "Upgrading wall insulation significantly cuts heat loss.",
      saving,
    });
  } else if (insul === "medium") {
    const saving = Math.round(calc.ml.annual * 0.10);
    recs.push({
      Icon: ThermometerSnowflake, color: "#3a8fd4",
      title: mn ? "Нэмэлт дулаалга" : "Add extra insulation",
      desc:  mn ? "Дунд зэргийн дулаалгыг сайн болговол ~10% хэрэглээ буурна." : "Upgrading from medium to good insulation saves ~10%.",
      saving,
    });
  }
  if (win === "single") {
    const saving = Math.round(calc.ml.annual * 0.12);
    recs.push({
      Icon: Layers, color: "#9b72cf",
      title: mn ? "Хос шилтэй цонх суурилуулах" : "Install double-pane windows",
      desc:  mn ? "Нэг давхар шилийг хос шилээр солих нь дулааны алдагдлыг 35-45% бууруулна." : "Replacing single-pane with double-pane windows reduces heat loss by 35–45%.",
      saving,
    });
  }
  if (year < 1985) {
    const saving = Math.round(calc.ml.annual * 0.28);
    recs.push({
      Icon: Building2, color: "#e63946",
      title: mn ? "Иж бүрэн шинэчлэл" : "Major energy retrofit",
      desc:  mn ? "1985 оноос өмнө баригдсан барилга нь орчин үеийн стандартаас доогуур байдаг. Цогц шинэчлэл хийвэл ~28% хэрэглээ буурна." : "Pre-1985 buildings are well below modern standards. A full retrofit can save ~28%.",
      saving,
    });
  } else if (year < 2000) {
    const saving = Math.round(calc.ml.annual * 0.12);
    recs.push({
      Icon: Building2, color: "#f4a261",
      title: mn ? "Дулааны горим оновчлол" : "Thermal system optimization",
      desc:  mn ? "1985–2000 онд баригдсан барилгын тоног төхөөрөмжийг шинэчлэх нь ~12% хэрэглээ бууруулна." : "Retrofitting systems in buildings from 1985–2000 can cut usage by ~12%.",
      saving,
    });
  }
  if (heat === "local") {
    const saving = Math.round(calc.ml.annual * 0.18);
    recs.push({
      Icon: Zap, color: "#f4a261",
      title: mn ? "Дүүргийн дулаан руу шилжих" : "Connect to district heating",
      desc:  mn ? "Орон нутгийн халаалтаас дүүргийн дулааны сүлжээнд холбогдох нь ~18% хэрэглээ бууруулна." : "Switching from local to district heating can reduce consumption by ~18%.",
      saving,
    });
  }
  if (recs.length === 0) {
    recs.push({
      Icon: Lightbulb, color: "#2a9d8f",
      title: mn ? "Ухаалаг тоолуур суурилуулах" : "Install smart metering",
      desc:  mn ? "Бодит цагийн хэрэглээний мэдээлэл нь ~8–12% хэрэглээ бууруулахад тусалдаг." : "Real-time consumption feedback helps reduce usage by ~8–12%.",
      saving: Math.round(calc.ml.annual * 0.10),
    });
  }
  return recs;
}

const CITY_ANNUAL  = monthlyEnergyData.reduce((s, m) => s + m.usage, 0);
const MONTH_FRACS  = monthlyEnergyData.map(m => m.usage / CITY_ANNUAL);

// ─── Known building corrections (OSM often missing start_date / wrong type) ───
// Keys: lowercase substrings of the building's name tag
const KNOWN_BUILDINGS = {
  "shangri-la":        { year: 2015, type: "commercial", floors: 18, insulation_quality: "good", wall_material: "concrete" },
  "шангри-ла":         { year: 2015, type: "commercial", floors: 18, insulation_quality: "good", wall_material: "concrete" },
  "shangri":           { year: 2015, type: "commercial", floors: 18, insulation_quality: "good", wall_material: "concrete" },
  "blue sky":          { year: 2010, type: "office",     floors: 25, insulation_quality: "good", wall_material: "concrete" },
  "блу скай":          { year: 2010, type: "office",     floors: 25, insulation_quality: "good", wall_material: "concrete" },
  "central tower":     { year: 2014, type: "office",     floors: 21, insulation_quality: "good", wall_material: "concrete" },
  "монгол улс":        { year: 2006, type: "office",     floors: 14 },
  "state department":  { year: 2006, type: "office",     floors: 14 },
  "их дэлгүүр":        { year: 1958, type: "commercial", floors: 5,  insulation_quality: "poor", wall_material: "brick" },
  "ikh delguur":       { year: 1958, type: "commercial", floors: 5,  insulation_quality: "poor", wall_material: "brick" },
  "ulaanbaatar hotel": { year: 1961, type: "commercial", floors: 8,  insulation_quality: "poor", wall_material: "brick" },
  "улаанбаатар зочид": { year: 1961, type: "commercial", floors: 8,  insulation_quality: "poor", wall_material: "brick" },
  "nomin":             { year: 2005, type: "commercial", floors: 6,  insulation_quality: "medium", wall_material: "concrete" },
  "номин":             { year: 2005, type: "commercial", floors: 6,  insulation_quality: "medium", wall_material: "concrete" },
  "mercury":           { year: 2008, type: "commercial", floors: 8,  insulation_quality: "medium", wall_material: "concrete" },
  "меркури":           { year: 2008, type: "commercial", floors: 8,  insulation_quality: "medium", wall_material: "concrete" },
};

function applyKnownCorrections(name, override) {
  const lc = (name || "").toLowerCase();
  for (const [key, vals] of Object.entries(KNOWN_BUILDINGS)) {
    if (lc.includes(key)) return { ...override, ...vals };
  }
  return override;
}

// ─── OSM / Overpass helpers ────────────────────────────────────────────────────
function osmAreaSqm(geom) {
  const pts = geom.map(n => ({
    x: n.lon * 111000 * Math.cos(n.lat * Math.PI / 180),
    y: n.lat * 111000,
  }));
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  }
  return Math.max(20, Math.abs(a / 2));
}

function osmBuildingType(tags = {}) {
  const b = (tags.building || "").toLowerCase();
  if (["apartments","residential","house","detached","semidetached_house",
       "terrace","dormitory","hotel","hostel","bungalow"].includes(b)) return "apartment";
  if (["office","government","civic","public"].includes(b) || tags.office) return "office";
  if (["school","university","college","kindergarten"].includes(b))        return "school";
  if (["hospital","clinic","healthcare"].includes(b))                      return "hospital";
  if (["retail","supermarket","commercial","shop","mall","warehouse",
       "industrial","kiosk"].includes(b))                                  return "commercial";
  return "apartment";
}

function osmToBuilding(el) {
  const tags    = el.tags  || {};
  const geom    = el.geometry || [];
  const area    = Math.round(osmAreaSqm(geom));
  const type    = osmBuildingType(tags);
  const floors  = Math.max(1, Math.min(30,
    parseInt(tags["building:levels"] || tags["levels"] || "3")));
  const rawYear = parseInt(tags["start_date"] || tags["construction_date"] || "1990");
  const year    = isNaN(rawYear) ? 1990 : Math.max(1940, Math.min(2024, rawYear));
  const nameTag = tags.name || "";
  const addrStr = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const name    = nameTag || addrStr || `#${String(el.id).slice(-4)}`;

  const base = {
    id: el.id, name, type,
    area: Math.max(30, area), floors, year,
    district: tags["addr:district"] || tags["addr:suburb"] || "Улаанбаатар",
    osmGeom: geom, tags,
    source: "osm",
  };
  return applyKnownCorrections(name, base);
}

function mockGeom(lat, lng, areaSqm) {
  const s = Math.sqrt(areaSqm);
  const dLat = (s / 111000) * 0.5;
  const dLng = (s / (111000 * Math.cos((lat * Math.PI) / 180))) * 0.5;
  return [
    { lat: lat - dLat, lon: lng - dLng },
    { lat: lat - dLat, lon: lng + dLng },
    { lat: lat + dLat, lon: lng + dLng },
    { lat: lat + dLat, lon: lng - dLng },
  ];
}

const MOCK_FALLBACK = buildingsData.map(b => ({
  id:       b.id,
  name:     b.name,
  type:     b.type,
  area:     b.area,
  floors:   b.floors,
  year:     b.year,
  district: b.district,
  osmGeom:  mockGeom(b.lat, b.lng, b.area),
  tags:     {},
  source:   "mock",
}));

function loadUserMapBuildings(userId = null) {
  try {
    const all = storageGetJSON(STORAGE_KEYS.buildings, []);
    const stored = userId ? all.filter(b => !b.userId || b.userId === userId) : all;
    return stored.map(b => ({
      id:       b.id,
      name:     b.name,
      type:     b.type || "apartment",
      area:     b.area || 100,
      floors:   b.floors || 1,
      year:     b.year || 2000,
      district: b.district || "Улаанбаатар",
      osmGeom:  mockGeom(b.latitude || 47.9184, b.longitude || 106.9177, b.area || 100),
      tags:     {},
      source:   b.source || "user",
      insulation_quality: b.insulation_quality,
      window_type:        b.window_type,
      monthly_usage:      b.monthly_usage,
    }));
  } catch { return []; }
}

// Fetch with 14-second abort timeout
async function tryOverpass(endpoint, query) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 14000);
  try {
    const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── BuildingFetcher — lives inside MapContainer ───────────────────────────────
// Fetches OSM buildings for the current viewport on mount and after pan/zoom.
// Uses a grid-cell cache to avoid re-fetching the same area.
function BuildingFetcher({ onNewBuildings, setLoading }) {
  const map = useMap();
  const fetchedCells = useRef(new Set());
  const inFlight = useRef(false);

  const fetchViewport = useCallback(async () => {
    if (inFlight.current) return;
    const bounds = map.getBounds();
    const s = bounds.getSouth(), w = bounds.getWest();
    const n = bounds.getNorth(), e = bounds.getEast();

    // Grid-cell dedup: floor coords to FETCH_STEP grid
    const ck = `${Math.floor(s / FETCH_STEP)},${Math.floor(w / FETCH_STEP)}`;
    if (fetchedCells.current.has(ck)) return;
    fetchedCells.current.add(ck);

    inFlight.current = true;
    setLoading(true);

    const query =
      `[out:json][timeout:12][maxsize:3000000];` +
      `way["building"](${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)});out geom;`;

    try {
      for (const mirror of OVERPASS_MIRRORS) {
        try {
          const json = await tryOverpass(mirror, query);
          const els = (json.elements || [])
            .filter(el => el.geometry?.length > 2)
            .slice(0, 1000)
            .map(osmToBuilding);
          if (els.length > 0) { onNewBuildings(els); break; }
        } catch (err) {
          console.warn(`Overpass mirror (${mirror}):`, err.message);
        }
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [map, onNewBuildings, setLoading]);

  // Fetch on first render
  useEffect(() => { fetchViewport(); }, [fetchViewport]);

  // Re-fetch after pan / zoom
  useMapEvents({ moveend: fetchViewport, zoomend: fetchViewport });

  return null;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color }) {
  return (
    <div className="sec-header" style={{ borderColor: color }}>
      <Icon size={14} style={{ color }} />
      <span style={{ color }}>{title}</span>
    </div>
  );
}

function CalcRow({ label, formula, value, unit, highlight }) {
  return (
    <div className={`calc-row${highlight ? " calc-hi" : ""}`}>
      <div className="cr-left">
        <span className="cr-label">{label}</span>
        {formula && <span className="cr-formula">{formula}</span>}
      </div>
      <div className="cr-right">
        <span className="cr-val">{value}</span>
        {unit && <span className="cr-unit"> {unit}</span>}
      </div>
    </div>
  );
}

function NoteBox({ children }) {
  return <div className="note-box">{children}</div>;
}

const GRADE_COLORS = {
  A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20",
};
const GRADES = ["A","B","C","D","E","F","G"];

function GradeRow({ grade }) {
  return (
    <div className="grade-row">
      {GRADES.map(g => (
        <div key={g} className={`grade-cell${g === grade ? " grade-active" : ""}`}
          style={{ background: g === grade ? GRADE_COLORS[g] : `${GRADE_COLORS[g]}25`,
                   color:      g === grade ? "#fff" : GRADE_COLORS[g] }}>
          {g}
        </div>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ct">
      <div className="ct-m">{label}</div>
      <div className="ct-v">{payload[0].value.toLocaleString()} kWh</div>
    </div>
  );
}

// ─── Building side panel ───────────────────────────────────────────────────────
function BuildingPanel({ building, lang, t }) {
  const [tab, setTab] = useState("energy");
  const calc   = useMemo(() => calcBuilding(building), [building]);
  const recs   = useMemo(() => getRecommendations(building, calc, lang), [building, calc, lang]);
  const types  = t.predictor.building_types;
  const typeLbl = types[building.type] || building.type;
  const mn = lang === "mn";

  const monthly = MONTH_FRACS.map((frac, i) => ({
    m:   mn ? monthlyEnergyData[i].month.split("-")[0] : monthlyEnergyData[i].month_en,
    kwh: Math.round(calc.total * frac),
  }));

  const TABS = [
    { id: "energy", label: t.map.sec_energy },
    { id: "geom",   label: t.map.sec_geom },
    { id: "em",     label: t.map.sec_em },
    { id: "chart",  label: t.map.sec_chart },
    { id: "reco",   label: mn ? "Зөвлөмж" : "Tips" },
  ];

  return (
    <div className="bp">
      {/* Header */}
      <div className="bp-head">
        <div className="bp-name">
          <Building2 size={14} style={{ color: TYPE_COLOR[building.type], flexShrink: 0, marginTop: 2 }} />
          <span>{building.name}</span>
        </div>
        <div className="bp-meta">
          <span className="meta-type" style={{ background: `${TYPE_COLOR[building.type]}22`, color: TYPE_COLOR[building.type] }}>
            {typeLbl}
          </span>
          <span className="meta-grade" style={{ background: GRADE_COLORS[calc.grade] }}>
            {calc.grade}
          </span>
          <span className="meta-yr">{building.year}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bp-tabs">
        {TABS.map(tb => (
          <button key={tb.id} className={`bp-tab${tab === tb.id ? " active" : ""}`}
            onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
      </div>

      <div className="bp-body">

        {/* Geometry */}
        {tab === "geom" && (
          <div className="tab-section">
            <SectionHeader icon={Ruler} color="#3a8fd4" title={t.map.sec_geom} />
            <CalcRow label={t.map.row_area}
              formula={t.map.formula_poly}
              value={building.area.toLocaleString()} unit="m²" />
            <CalcRow label={t.map.row_floors}
              formula={t.map.formula_osm_levels}
              value={building.floors} unit={t.common.floors_unit} />
            <CalcRow label={t.map.row_floorh}
              formula={t.map.formula_standard}
              value={FLOOR_HEIGHT.toFixed(1)} unit="m" />
            <CalcRow label={t.map.row_height}
              formula={t.map.formula_height}
              value={`${building.floors} × ${FLOOR_HEIGHT} = ${calc.height}`}
              unit="m" highlight />
            <CalcRow label={t.map.row_volume}
              formula={t.map.formula_volume}
              value={`${building.area.toLocaleString()} × ${calc.height} = ${calc.volume.toLocaleString()}`}
              unit="m³" highlight />
            <CalcRow label={t.map.detail_district} value={building.district} />
          </div>
        )}

        {/* Energy */}
        {tab === "energy" && (
          <div className="tab-section">
            <SectionHeader icon={Zap} color="#f4a261" title={t.map.sec_energy} />

            {/* ML prediction hero */}
            <div className="ml-hero">
              <div className="ml-hero-badge">ML</div>
              <div className="ml-hero-body">
                <div className="ml-hero-val">{calc.ml.annual.toLocaleString()} <span className="ml-hero-unit">kWh/жил</span></div>
                <div className="ml-hero-sub">{mn ? "Машин сургалтын таамаглал (OLS · R² ≥ 0.87)" : "ML prediction (OLS · R² ≥ 0.87)"}</div>
              </div>
            </div>

            {/* Actual bill data badge for user buildings */}
            {calc.hasActualData && (
              <div className="actual-data-row">
                <Zap size={12} style={{ color: "#2a9d8f" }} />
                <span style={{ color: "#2a9d8f", fontWeight: 700, fontSize: "0.82rem" }}>
                  {mn ? "Бодит хэрэглээ (нэхэмжлэлээс):" : "Actual (from bill):"}
                </span>
                <span style={{ fontWeight: 800, color: "var(--text)", fontSize: "0.88rem" }}>
                  {calc.actualAnnual.toLocaleString()} kWh/жил
                </span>
              </div>
            )}

            {/* EUI breakdown */}
            <CalcRow label={t.map.row_heating}
              formula={`EUI = ${calc.euiHeating} kWh/m²`}
              value={calc.heating.toLocaleString()} unit="kWh" />
            <CalcRow label={t.map.row_electric}
              formula={`EUI = ${calc.euiElectric} kWh/m²`}
              value={calc.electric.toLocaleString()} unit="kWh" />
            <CalcRow label={t.map.row_total}
              value={calc.total.toLocaleString()} unit="kWh/жил" highlight />
            <CalcRow label={t.map.row_intens}
              value={calc.intensity} unit="kWh/m²" />

            <div style={{ marginTop: "0.75rem" }}>
              <div className="cr-label" style={{ marginBottom: "0.4rem" }}>{t.map.energy_grade}</div>
              <GradeRow grade={calc.grade} />
            </div>
          </div>
        )}

        {/* Emissions */}
        {tab === "em" && (
          <div className="tab-section">
            <SectionHeader icon={Wind} color="#e76f51" title={t.map.sec_em} />
            <CalcRow label={t.map.row_co2}
              formula={t.map.formula_co2}
              value={`(${calc.heating.toLocaleString()}×0.28 + ${calc.electric.toLocaleString()}×0.73) / 1000`}
              unit="" />
            <CalcRow label="" value={calc.co2} unit={t.map.unit_t_co2} highlight />
            <CalcRow label={t.map.row_pm25}
              formula={t.map.formula_pm25}
              value={`${calc.co2} × 1350 = ${calc.pm25.toLocaleString()}`}
              unit="kg/yr" />
            <CalcRow label={t.map.row_winter}
              formula={t.map.formula_oct_mar}
              value="62" unit="%" />
            <CalcRow label={t.map.row_impact}
              value={
                <span style={{ color: calc.impactColor, fontWeight: 700 }}>
                  {{ high: t.map.em_high, medium: t.map.em_medium, low: t.map.em_low }[calc.impactLabel]}
                </span>
              } />
            <div className="em-bar-wrap">
              <div className="em-bar-track">
                <div className="em-seg" style={{ width: "62%", background: "#3a8fd4" }} />
                <div className="em-seg" style={{ width: "38%", background: "#f4a261" }} />
              </div>
              <div className="em-bar-lbls">
                <span><i className="em-dot" style={{ background: "#3a8fd4" }} />
                  {t.map.winter} 62%</span>
                <span><i className="em-dot" style={{ background: "#f4a261" }} />
                  {t.map.summer} 38%</span>
              </div>
            </div>
            <NoteBox>{t.map.note_em}</NoteBox>
          </div>
        )}

        {/* Chart */}
        {tab === "chart" && (
          <div className="tab-section">
            <SectionHeader icon={TrendingUp} color="#9b72cf" title={t.map.sec_chart} />
            <div className="chart-hero">
              <Zap size={16} style={{ color: "#f4a261" }} />
              <span className="ch-total">{calc.total.toLocaleString()}</span>
              <span className="ch-unit">kWh/yr</span>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthly} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="m" tick={{ fill: "#667788", fontSize: 9 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#667788", fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(58,143,212,0.07)" }} />
                  <Bar dataKey="kwh" fill="#3a8fd4" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-note">{t.map.chart_note_climate}</div>
          </div>
        )}

        {/* Recommendations */}
        {tab === "reco" && (
          <div className="tab-section">
            <SectionHeader icon={Lightbulb} color="#2a9d8f" title={mn ? "Эрчим хүч хэмнэх зөвлөмж" : "Energy-saving tips"} />
            <div className="reco-baseline">
              <span style={{ color: "var(--text3)", fontSize: "0.78rem" }}>
                {mn ? "Одоогийн таамаглал:" : "Current estimate:"}
              </span>
              <strong style={{ color: "#f4a261" }}>{calc.ml.annual.toLocaleString()} kWh/жил</strong>
            </div>
            {recs.map((r, i) => (
              <div key={i} className="reco-item">
                <div className="reco-icon" style={{ background: `${r.color}18`, borderColor: `${r.color}33` }}>
                  <r.Icon size={14} style={{ color: r.color }} />
                </div>
                <div className="reco-body">
                  <div className="reco-title">{r.title}</div>
                  <div className="reco-desc">{r.desc}</div>
                  <div className="reco-saving">
                    <Leaf size={11} style={{ color: "#2a9d8f" }} />
                    {mn ? `~${r.saving.toLocaleString()} kWh/жил хэмнэлт` : `~${r.saving.toLocaleString()} kWh/yr savings`}
                    <span style={{ color: "var(--text3)", marginLeft: 4 }}>
                      (~{Math.round(r.saving / calc.ml.annual * 100)}%)
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="reco-note">
              {mn
                ? "Тооцоолол нь барилгын параметрт тулгуурласан таамаглал бөгөөд бодит хэмнэлт нэмэлт хэмжилтээс хамаарна."
                : "Estimates are based on building parameters. Actual savings depend on real conditions and measurements."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty panel ───────────────────────────────────────────────────────────────
function NoSelection({ t }) {
  return (
    <div className="no-sel">
      <div className="no-sel-icon">
        <Building2 size={40} opacity={0.18} />
      </div>
      <p className="no-sel-hint">{t.map.select_hint}</p>
      <p className="no-sel-sub">{t.map.select_sub}</p>
      <div className="no-sel-steps">
        {[
          t.map.geom_hint,
          "ML OLS → kWh таамаглал",
          "CO₂ · зэрэглэл A–G · зөвлөмж",
        ].map((s, i) => <div key={i} className="nss">{s}</div>)}
      </div>
    </div>
  );
}

// ─── How it works section ──────────────────────────────────────────────────────
function HowItWorks({ t, lang }) {
  const mn = lang === "mn";
  const steps = [
    {
      Icon: Database,
      color: "#3a8fd4",
      title: t.map.how_step1_title,
      desc: mn
        ? "OpenStreetMap-ийн Overpass API ашиглан таны харж буй газрын зургийн хэсгийн бүх барилгын полигоны татаж авна. Хэрэглэгч газрын зургийг хөдөлгөх бүрт шинэ хэсгийн барилгуудыг автоматаар нэмнэ. Нийтдээ 1000 барилга хүртэл нэг хүсэлтэд багтана."
        : "Overpass API fetches all building polygons from OpenStreetMap for the visible viewport. Every time you pan the map, buildings for the new area are automatically loaded. Up to 1,000 buildings are fetched per request.",
      formula: 'GET /api/interpreter?data=way["building"](bbox);out geom;',
    },
    {
      Icon: Calculator,
      color: "#9b72cf",
      title: t.map.how_step2_title,
      desc: mn
        ? "OSM-ийн полигонын оройн цэгүүдийг (lat, lon) метрийн координатад хөрвүүлж, Shoelace (Gauss) томьёогоор талбайг тооцдог. Энэ нь дурын олон өнцөгтийн талбайг нарийвчлалтай тооцоолдог стандарт геометрийн арга."
        : "The polygon vertices (lat, lon) are projected to metric coordinates, then the Shoelace (Gauss) formula computes the exact area of any irregular polygon — no bounding-box approximation needed.",
      formula: "A = ½ |Σ (xⱼ + xᵢ)(yⱼ − yᵢ)|   where x = lon × 111000 × cos(lat)",
    },
    {
      Icon: Zap,
      color: "#f4a261",
      title: mn ? "3. ML OLS загвар — эрчим хүчний таамаглал" : "3. ML OLS model — energy prediction",
      desc: mn
        ? "600 Монгол барилгын синтетик өгөгдөл дээр сургасан OLS (дэс хамгийн бага квадратын) шугаман регрессийн загвар ашиглана. Загвар нь 30+ feature (талбай, нас, дулаалга, халаалт, материал г.м.) хүлээн авч жилийн kWh таамагладаг. Туршилтын R² ≥ 0.87."
        : "An OLS (Ordinary Least Squares) linear regression trained on 600 synthetic Mongolian buildings. It takes 30+ features (area, age, insulation, heating type, wall material, etc.) and predicts annual kWh. Test R² ≥ 0.87. EUI is shown as a secondary breakdown.",
      formula: "ML: annual_kWh = Xβ   where X = [area, age, floors, insulation, heating, material, ...]",
    },
    {
      Icon: Leaf,
      color: "#2a9d8f",
      title: t.map.how_step4_title,
      desc: mn
        ? "Монголын эрчим хүчний сүлжээний нүүрсний хүнд байдлыг харгалзан цахилгаанд 0.73 kg CO₂/kWh, дүүргийн халаалтанд 0.28 kg CO₂/kWh коэффициентийг хэрэглэнэ. PM2.5 тоосонцрын тооцоо CO₂ × 1350 байна."
        : "Mongolia's coal-heavy grid uses 0.73 kg CO₂/kWh for electricity and 0.28 kg CO₂/kWh for district heating. PM2.5 particulate estimate is derived as CO₂ × 1350 based on Ulaanbaatar combustion data.",
      formula: "CO₂ = (E_h × 0.28 + E_e × 0.73) / 1000   [t CO₂/yr]",
    },
    {
      Icon: Award,
      color: "#57cc99",
      title: t.map.how_step5_title,
      desc: mn
        ? "Нийт эрчим хүчний хэрэглээг талбайд хуваан эрчим хүчний эрч (intensity, kWh/m²/жил) гаргаж, абсолют утгаар A–G зэрэглэлд хуваарилна. A зэрэглэл нь 50 kWh/m² дор, G зэрэглэл нь 300 kWh/m²-ээс дээш гэсэн утгатай."
        : "Total energy divided by area gives energy intensity (kWh/m²/yr). This maps to an A–G label: A < 50, B < 100, C < 150, D < 200, E < 250, F < 300, G ≥ 300 kWh/m²/yr — allowing direct comparison between any two buildings.",
      formula: "intensity = E_total / area   →   grade: A(<50) B(<100) C(<150) D(<200) E(<250) F(<300) G",
    },
    {
      Icon: BarChart2,
      color: "#e76f51",
      title: t.map.how_step6_title,
      desc: mn
        ? "Улаанбаатарын бодит сарын хэрэглэний хэв маягт тулгуурлан жилийн нийт хэрэглээг 12 сард хуваарилна. Хамгийн хүйтэн сарууд (1, 2, 12-р сар) нийт хэрэглээний 30%+ эзэлдэг."
        : "Annual total is distributed across 12 months using Ulaanbaatar's real consumption pattern (fractions from our monthly dataset). Winter months (Dec–Feb) account for 30%+ of annual consumption alone.",
      formula: "E_month = E_total × frac[month]   where frac = monthly_usage / annual_total",
    },
  ];

  return (
    <section className="how-section">
      <div className="how-inner">
        <h2 className="how-title">{t.map.how_title}</h2>
        <p className="how-subtitle">{t.map.how_subtitle}</p>
        <div className="how-steps">
          {steps.map((step, i) => (
            <div key={i} className="how-step">
              <div className="how-step-icon" style={{ background: `${step.color}18`, borderColor: `${step.color}33` }}>
                <step.Icon size={20} style={{ color: step.color }} />
              </div>
              <div className="how-step-body">
                <h3 className="how-step-title" style={{ color: step.color }}>{step.title}</h3>
                <p className="how-step-desc">{step.desc}</p>
                {step.formula && (
                  <code className="how-formula">{step.formula}</code>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Data sources */}
        <div className="how-sources">
          <span className="how-src-label">{t.map.how_src_label}</span>
          {[
            { name: "OpenStreetMap", desc: t.map.how_src_osm },
            { name: "Overpass API",  desc: t.map.how_src_overpass },
            { name: "IEA / НҮЭХ",   desc: t.map.how_src_iea },
            { name: "НАМЕМ",         desc: t.map.how_src_namem },
          ].map(s => (
            <span key={s.name} className="how-src-chip">
              <strong>{s.name}</strong> — {s.desc}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MapPage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.map);
  const { user } = useAuth();

  // Building cache: Map<id, building> — pre-seeded with mock + user buildings
  const buildingCache = useRef(new Map([
    ...MOCK_FALLBACK.map(b => [b.id, b]),
    ...loadUserMapBuildings(user?.id).map(b => [b.id, b]),
  ]));
  const [buildings,   setBuildings]  = useState([...buildingCache.current.values()]);
  const [loading,     setLoading]    = useState(true);
  const [selected,    setSelected]   = useState(null);
  const [typeFilter,  setTypeFilter] = useState("all");
  const [layer,       setLayer]      = useState("dark");
  const [colorMode,   setColorMode]  = useState("type"); // "type" | "grade"

  // Called by BuildingFetcher with each batch of OSM buildings
  const addBuildings = useCallback((newBs) => {
    let added = 0;
    newBs.forEach(b => {
      if (!buildingCache.current.has(b.id)) {
        buildingCache.current.set(b.id, b);
        added++;
      }
    });
    if (added > 0) {
      setBuildings([...buildingCache.current.values()]);
    }
  }, []);

  const typeLabels = t.predictor.building_types;
  const filtered   = useMemo(
    () => typeFilter === "all" ? buildings : buildings.filter(b => b.type === typeFilter),
    [buildings, typeFilter]
  );

  const tile = TILES[layer];

  // Count of OSM vs mock vs user buildings for the badge
  const osmCount  = buildings.filter(b => b.source === "osm").length;
  const mockCount = buildings.filter(b => b.source === "mock").length;
  const userCount = buildings.filter(b => b.source === "user" || b.source === "predictor").length;

  return (
    <div className="map-outer">
      {/* ── Full-screen map + panel row ── */}
      <div className="map-page">
        {/* Map canvas */}
        <div className="map-canvas">
          <MapContainer
            center={UB_CENTER}
            zoom={15}
            style={{ position: "absolute", inset: 0 }}
            zoomControl={false}
          >
            <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={19} />

            {/* Viewport-based building loader */}
            <BuildingFetcher onNewBuildings={addBuildings} setLoading={setLoading} />

            {filtered.map(b => {
              const active   = selected?.id === b.id;
              const isMine   = b.source === "user" || b.source === "predictor";
              const typeColor = TYPE_COLOR[b.type] || "#3a8fd4";
              // Grade-based color when in "grade" mode
              const gradeColor = (() => {
                if (colorMode !== "grade") return typeColor;
                const calc = calcBuilding(b);
                return GRADE_COLORS[calc.grade] || typeColor;
              })();
              const color  = gradeColor;
              const coords = b.osmGeom.map(n => [n.lat, n.lon]);
              return (
                <Polygon
                  key={b.id}
                  positions={coords}
                  pathOptions={{
                    color:       active ? "#ffffff" : isMine ? "#f4c842" : color,
                    weight:      active ? 3 : isMine ? 2 : 1,
                    fillColor:   color,
                    fillOpacity: active ? 0.88 : 0.55,
                    dashArray:   isMine && !active ? "5 3" : undefined,
                  }}
                  eventHandlers={{ click: () => setSelected(b) }}
                />
              );
            })}

            <ZoomControl position="bottomright" />
          </MapContainer>

          {/* Loading overlay */}
          {loading && (
            <div className="map-overlay-state">
              <div className="map-spinner" />
              <span>{t.map.loading_buildings}</span>
            </div>
          )}

          {/* Building count badge */}
          {buildings.length > 0 && (
            <div className="bldg-count">
              {filtered.length} / {buildings.length} {t.map.buildings_unit}
              {mockCount > 0 && osmCount === 0 && (
                <span className="bldg-mock-note"> · demo</span>
              )}
              {userCount > 0 && (
                <span className="bldg-mock-note" style={{ color: "#f4c842" }}>
                  {" "}· {userCount} {lang === "mn" ? "өөрийн барилга" : "my buildings"}
                </span>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="map-controls">
            <div className="ctrl-pill">
              <Filter size={12} style={{ color: "#8899aa" }} />
              <select className="ctrl-sel" value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setSelected(null); }}>
                <option value="all">{t.map.all_types}</option>
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="layer-group">
              <button className={`layer-btn${colorMode === "type" ? " active" : ""}`}
                onClick={() => setColorMode("type")} title={lang === "mn" ? "Төрлөөр өнгө" : "Color by type"}>
                {lang === "mn" ? "Төрөл" : "Type"}
              </button>
              <button className={`layer-btn${colorMode === "grade" ? " active" : ""}`}
                onClick={() => setColorMode("grade")} title={lang === "mn" ? "Зэрэглэлээр өнгө (A–G)" : "Color by grade (A–G)"}>
                {lang === "mn" ? "Зэрэглэл" : "Grade"}
              </button>
            </div>
            <div className="layer-group">
              {["dark", "satellite", "street"].map(l => (
                <button key={l} className={`layer-btn${layer === l ? " active" : ""}`}
                  onClick={() => setLayer(l)}>
                  {t.map[`layer_${l}`]}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="map-legend">
            {colorMode === "type"
              ? Object.entries(TYPE_COLOR).map(([type, color]) => (
                  <div key={type} className="lgd-row">
                    <span className="lgd-dot" style={{ background: color }} />
                    <span>{typeLabels[type] || type}</span>
                  </div>
                ))
              : ["A","B","C","D","E","F","G"].map(g => (
                  <div key={g} className="lgd-row">
                    <span className="lgd-dot" style={{ background: GRADE_COLORS[g] }} />
                    <span>{g}</span>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Side panel */}
        <div className="map-panel">
          {selected
            ? <BuildingPanel building={selected} lang={lang} t={t} />
            : <NoSelection t={t} />
          }
        </div>
      </div>

      {/* ── How it works section ── */}
      <HowItWorks t={t} lang={lang} />
    </div>
  );
}
