import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Tooltip as LeafletTooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
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
  ThermometerSnowflake, Layers, MapPin, FlaskConical, Info,
} from "lucide-react";
import { monthlyEnergyData, buildingsData, ulaanbaatarDistricts } from "../data/mockData";
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

// PM2.5 heating source multipliers (local coal burning >> central/electric)
const PM25_HEAT_FACTOR = { central: 1.0, local: 2.4, electric: 0.15 };
// Insulation multiplier: worse insulation = more fuel burned = more PM2.5
const PM25_INSUL_FACTOR = { poor: 1.3, medium: 1.0, good: 0.8 };

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

  // Rule-based PM2.5: base from CO₂, then scale by heating source + insulation
  const heatMul  = PM25_HEAT_FACTOR[b.heating_type  || "central"];
  const insulMul = PM25_INSUL_FACTOR[b.insulation_quality || "medium"];
  const pm25     = Math.round(co2 * 1350 * heatMul * insulMul);

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
// Keys: lowercase substrings matched against the building's name tag
const KNOWN_BUILDINGS = {
  // Hotels & resorts
  "shangri-la":           { year: 2015, type: "commercial", floors: 18, insulation_quality: "good",   wall_material: "concrete" },
  "шангри-ла":            { year: 2015, type: "commercial", floors: 18, insulation_quality: "good",   wall_material: "concrete" },
  "shangri":              { year: 2015, type: "commercial", floors: 18, insulation_quality: "good",   wall_material: "concrete" },
  "ulaanbaatar hotel":    { year: 1961, type: "commercial", floors:  8, insulation_quality: "poor",   wall_material: "brick" },
  "улаанбаатар зочид":    { year: 1961, type: "commercial", floors:  8, insulation_quality: "poor",   wall_material: "brick" },
  "ramada":               { year: 2012, type: "commercial", floors: 12, insulation_quality: "good",   wall_material: "concrete" },
  "туушин":               { year: 1979, type: "commercial", floors:  8, insulation_quality: "poor",   wall_material: "panel" },
  "tuushin":              { year: 1979, type: "commercial", floors:  8, insulation_quality: "poor",   wall_material: "panel" },
  "best western":         { year: 2005, type: "commercial", floors:  7, insulation_quality: "medium", wall_material: "concrete" },
  "bayangol":             { year: 1964, type: "commercial", floors:  8, insulation_quality: "poor",   wall_material: "brick" },
  "баянгол":              { year: 1964, type: "commercial", floors:  8, insulation_quality: "poor",   wall_material: "brick" },
  // Office towers
  "blue sky":             { year: 2010, type: "office",     floors: 25, insulation_quality: "good",   wall_material: "concrete" },
  "блу скай":             { year: 2010, type: "office",     floors: 25, insulation_quality: "good",   wall_material: "concrete" },
  "central tower":        { year: 2014, type: "office",     floors: 21, insulation_quality: "good",   wall_material: "concrete" },
  "монгол улс":           { year: 2006, type: "office",     floors: 14, insulation_quality: "medium", wall_material: "concrete" },
  "state department":     { year: 2006, type: "office",     floors: 14, insulation_quality: "medium", wall_material: "concrete" },
  "засгийн газар":        { year: 1951, type: "office",     floors:  4, insulation_quality: "poor",   wall_material: "brick" },
  "government house":     { year: 1951, type: "office",     floors:  4, insulation_quality: "poor",   wall_material: "brick" },
  "parliam":              { year: 1951, type: "office",     floors:  4, insulation_quality: "poor",   wall_material: "brick" },
  "улсын их хурал":       { year: 1951, type: "office",     floors:  4, insulation_quality: "poor",   wall_material: "brick" },
  "монголбанк":           { year: 1996, type: "office",     floors:  9, insulation_quality: "medium", wall_material: "concrete" },
  "mongolbank":           { year: 1996, type: "office",     floors:  9, insulation_quality: "medium", wall_material: "concrete" },
  "mcs":                  { year: 2008, type: "office",     floors: 12, insulation_quality: "good",   wall_material: "concrete" },
  "торгон":               { year: 2003, type: "office",     floors:  9, insulation_quality: "medium", wall_material: "concrete" },
  // Retail / commercial
  "их дэлгүүр":           { year: 1958, type: "commercial", floors:  5, insulation_quality: "poor",   wall_material: "brick" },
  "ikh delguur":          { year: 1958, type: "commercial", floors:  5, insulation_quality: "poor",   wall_material: "brick" },
  "nomin":                { year: 2005, type: "commercial", floors:  6, insulation_quality: "medium", wall_material: "concrete" },
  "номин":                { year: 2005, type: "commercial", floors:  6, insulation_quality: "medium", wall_material: "concrete" },
  "mercury":              { year: 2008, type: "commercial", floors:  8, insulation_quality: "medium", wall_material: "concrete" },
  "меркури":              { year: 2008, type: "commercial", floors:  8, insulation_quality: "medium", wall_material: "concrete" },
  "state department store":{ year: 1958, type: "commercial", floors: 5, insulation_quality: "poor",   wall_material: "brick" },
  "narny":                { year: 2003, type: "commercial", floors:  5, insulation_quality: "medium", wall_material: "concrete" },
  "нарны":                { year: 2003, type: "commercial", floors:  5, insulation_quality: "medium", wall_material: "concrete" },
  "gandan":               { year: 1838, type: "commercial", floors:  2, insulation_quality: "poor",   wall_material: "brick" },
  "гандан":               { year: 1838, type: "commercial", floors:  2, insulation_quality: "poor",   wall_material: "brick" },
  // Universities & schools
  "монгол улсын их сургуул": { year: 1942, type: "school", floors: 5, insulation_quality: "poor",    wall_material: "brick" },
  "муис":                 { year: 1942, type: "school",     floors:  5, insulation_quality: "poor",   wall_material: "brick" },
  "mus":                  { year: 1942, type: "school",     floors:  5, insulation_quality: "poor",   wall_material: "brick" },
  "шутис":                { year: 1969, type: "school",     floors:  6, insulation_quality: "poor",   wall_material: "panel" },
  "мубис":                { year: 1951, type: "school",     floors:  5, insulation_quality: "poor",   wall_material: "brick" },
  "анагаах":              { year: 1961, type: "school",     floors:  5, insulation_quality: "poor",   wall_material: "brick" },
  // Hospitals
  "нэгдсэн эмнэлэг":      { year: 1953, type: "hospital",  floors:  5, insulation_quality: "poor",   wall_material: "brick" },
  "intermed":             { year: 2000, type: "hospital",   floors:  6, insulation_quality: "medium", wall_material: "concrete" },
  "интермед":             { year: 2000, type: "hospital",   floors:  6, insulation_quality: "medium", wall_material: "concrete" },
  "songdo":               { year: 2011, type: "hospital",   floors:  7, insulation_quality: "good",   wall_material: "concrete" },
  "сонгдо":               { year: 2011, type: "hospital",   floors:  7, insulation_quality: "good",   wall_material: "concrete" },
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
  const b   = (tags.building  || "").toLowerCase();
  const am  = (tags.amenity   || "").toLowerCase();
  const sh  = (tags.shop      || "").toLowerCase();
  const lei = (tags.leisure   || "").toLowerCase();
  const tou = (tags.tourism   || "").toLowerCase();
  const man = (tags.man_made  || "").toLowerCase();
  const name = (tags.name     || "").toLowerCase();

  // Amenity / use overrides (more reliable than building=yes)
  if (["school","university","college","kindergarten","library"].includes(am) ||
      ["school","university","college","kindergarten"].includes(b))             return "school";
  if (["hospital","clinic","doctors","pharmacy","dentist"].includes(am) ||
      ["hospital","clinic","healthcare"].includes(b))                           return "hospital";
  if (am === "theatre" || am === "cinema" || lei === "sports_centre")           return "commercial";
  if (sh || am === "supermarket" || am === "marketplace" ||
      ["retail","supermarket","commercial","shop","mall","kiosk",
       "warehouse","industrial"].includes(b))                                   return "commercial";
  if (tags.office || am === "bank" || am === "post_office" ||
      ["office","government","civic","public","administration",
       "parliament","courthouse"].includes(b))                                  return "office";
  if (tou === "hotel" || tou === "hostel" || tou === "apartment" ||
      ["hotel","hostel"].includes(b))                                           return "apartment";
  if (["apartments","residential","house","detached","semidetached_house",
       "terrace","dormitory","bungalow","cabin"].includes(b))                   return "apartment";

  // Name-based hints (Mongolian & English)
  if (/сургууль|дотуур|коллеж|их сургуул/i.test(name))     return "school";
  if (/эмнэлэг|клиник|поликлиник|hospital/i.test(name))    return "hospital";
  if (/дэлгүүр|market|mall|plaza|center|centre|тэнхим/i.test(name)) return "commercial";
  if (/оффис|office|tower|байр|хороо|засаг/i.test(name))   return "office";

  return "apartment"; // UB default — most unmapped buildings are residential
}

// Infer floor count from area when OSM levels tag is missing
function inferFloors(area, tags) {
  const raw = parseInt(tags["building:levels"] || tags["levels"] || "");
  if (!isNaN(raw) && raw >= 1 && raw <= 40) return Math.min(40, raw);

  // UB-specific heuristics: large footprint → likely high-rise
  if (area > 3000) return 16;
  if (area > 1500) return 9;
  if (area > 600)  return 5;
  return 3;
}

// Infer construction year — try multiple OSM date tags
function inferYear(tags) {
  const candidates = [
    tags["start_date"],
    tags["construction_date"],
    tags["year_of_construction"],
    tags["building:year_of_construction"],
  ];
  for (const c of candidates) {
    if (!c) continue;
    const y = parseInt(c.slice(0, 4));
    if (!isNaN(y) && y >= 1920 && y <= 2025) return { year: y, yearKnown: true };
  }
  return { year: 1985, yearKnown: false }; // UB median for unknown buildings
}

function osmToBuilding(el) {
  const tags    = el.tags  || {};
  const geom    = el.geometry || [];
  if (geom.length < 3) return null;

  const area    = Math.round(osmAreaSqm(geom));
  // Skip obviously broken OSM polygons (garages, kiosks, data errors)
  if (area < 12) return null;

  const type    = osmBuildingType(tags);
  const floors  = inferFloors(area, tags);
  const { year, yearKnown } = inferYear(tags);
  const floorsKnown = !isNaN(parseInt(tags["building:levels"] || tags["levels"] || ""));
  const nameTag = tags.name || tags["name:mn"] || tags["name:en"] || "";
  const addrStr = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const name    = nameTag || addrStr || `#${String(el.id).slice(-4)}`;

  const base = {
    id: el.id, name, type,
    area: Math.max(30, area), floors, year,
    yearKnown, floorsKnown,
    district: tags["addr:district"] || tags["addr:suburb"] || tags["addr:city"] || "Улаанбаатар",
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
function BuildingFetcher({ onNewBuildings, setLoading, onFetched }) {
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
            .map(osmToBuilding)
            .filter(Boolean);
          if (els.length > 0) { onNewBuildings(els); onFetched?.(new Date()); break; }
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

  // What-if simulation state
  const [wi, setWi] = useState({
    insulation_quality: building.insulation_quality || "medium",
    window_type:        building.window_type        || "double",
    heating_type:       building.heating_type       || "central",
    wall_material:      building.wall_material      || "panel",
    year:               building.year               || 1990,
  });
  const wiResult = useMemo(() => {
    const resPer100 = { apartment: 5, office: 3, school: 4, hospital: 6, commercial: 2, warehouse: 1 };
    const appPer100 = { apartment: 8, office: 5, school: 4, hospital: 10, commercial: 6, warehouse: 3 };
    const type = building.type || "apartment";
    return predict({
      building_type: type, area: building.area, year: wi.year,
      floors: building.floors, hdd: 4500, window_ratio: 25,
      rooms: building.rooms || Math.max(1, Math.round(building.area / 50)),
      residents: Math.max(1, Math.round(building.area / 100 * (resPer100[type] || 4))),
      appliances: Math.min(50, Math.max(2, Math.round(building.area / 100 * (appPer100[type] || 6)))),
      wall_material:      wi.wall_material,
      heating_type:       wi.heating_type,
      insulation_quality: wi.insulation_quality,
      window_type:        wi.window_type,
    });
  }, [building, wi]);

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
    { id: "whatif", label: mn ? "Симуляц" : "What-if" },
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
          <span className="meta-yr" title={!building.yearKnown && building.source === "osm" ? (mn ? "OSM-д он байхгүй — таамаглал" : "Year not in OSM — estimated") : ""}>
            {building.year}{!building.yearKnown && building.source === "osm" ? "~" : ""}
          </span>
        </div>
        {/* OSM data completeness warning */}
        {building.source === "osm" && (!building.yearKnown || !building.floorsKnown) && (
          <div className="bp-data-warn">
            <span className="bdw-icon">!</span>
            <span>
              {mn
                ? `OSM-д ${!building.yearKnown ? "он" : ""}${!building.yearKnown && !building.floorsKnown ? ", " : ""}${!building.floorsKnown ? "давхрын тоо" : ""} байхгүй — тооцооллыг загвараар нөхсөн`
                : `OSM missing ${[!building.yearKnown && "year", !building.floorsKnown && "floor count"].filter(Boolean).join(" & ")} — estimated by model`}
            </span>
          </div>
        )}
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
              formula={building.floorsKnown === false && building.source === "osm"
                ? (mn ? "OSM-д байхгүй → талбайгаас таамаглал" : "Not in OSM → inferred from area")
                : t.map.formula_osm_levels}
              value={`${building.floors}${building.floorsKnown === false && building.source === "osm" ? "~" : ""}`}
              unit={t.common.floors_unit} />
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

            {/* ── Estimate / Actual source badge ── */}
            <div className="popup-source-badge">
              {calc.hasActualData
                ? <><span className="psb-dot actual" /><span className="psb-text">{mn ? "Бодит нэхэмжлэлийн өгөгдөл" : "Actual bill data"}</span></>
                : <><span className="psb-dot estimate" /><span className="psb-text">{mn ? "ML загварын таамаглал" : "ML model estimate"}</span></>
              }
            </div>

            {/* ── Quick-summary property grid ── */}
            <div className="popup-props-grid">
              <div className="pp-item">
                <span className="pp-key">{mn ? "Баригдсан он" : "Year built"}</span>
                <span className="pp-val">
                  {building.year}
                  {!building.yearKnown && building.source === "osm" && <em className="pp-approx">~</em>}
                </span>
              </div>
              <div className="pp-item">
                <span className="pp-key">{mn ? "Халаалтын төрөл" : "Heating type"}</span>
                <span className="pp-val">
                  {{central: mn?"Дүүргийн":"District", local: mn?"Орон нутаг":"Local", electric: mn?"Цахилгаан":"Electric"}[building.heating_type||"central"] || (building.heating_type || "—")}
                </span>
              </div>
              <div className="pp-item">
                <span className="pp-key">{mn ? "Дулаалга" : "Insulation"}</span>
                <span className="pp-val" style={{ color: {poor:"#e63946",medium:"#f4a261",good:"#2a9d8f"}[building.insulation_quality||"medium"] }}>
                  {{poor:mn?"Муу":"Poor", medium:mn?"Дунд":"Medium", good:mn?"Сайн":"Good"}[building.insulation_quality||"medium"]}
                </span>
              </div>
              <div className="pp-item">
                <span className="pp-key">{mn ? "Жилийн эрчим хүч" : "Annual energy"}</span>
                <span className="pp-val" style={{ color: "#f4a261", fontWeight: 800 }}>
                  {calc.total.toLocaleString()} kWh
                </span>
              </div>
              <div className="pp-item">
                <span className="pp-key">CO₂</span>
                <span className="pp-val" style={{ color: calc.impactColor, fontWeight: 700 }}>
                  {calc.co2} t/жил
                </span>
              </div>
              <div className="pp-item">
                <span className="pp-key">{mn ? "Эрсдлийн түвшин" : "Risk level"}</span>
                <span className="pp-val" style={{ color: calc.impactColor, fontWeight: 700 }}>
                  {{high: mn?"Өндөр":"High", medium: mn?"Дунд":"Medium", low: mn?"Бага":"Low"}[calc.impactLabel]}
                </span>
              </div>
            </div>

            {/* ── Risk explanation ── */}
            <div className="popup-risk-box" style={{ borderColor: `${calc.impactColor}44`, background: `${calc.impactColor}0d` }}>
              <span style={{ color: calc.impactColor, fontWeight: 700, fontSize: "0.72rem" }}>
                {calc.impactLabel === "high"
                  ? (mn ? "Өндөр CO₂ ялгаруулалт — эрчим хүчний аудит зайлшгүй шаардлагатай" : "High CO₂ output — energy audit strongly recommended")
                  : calc.impactLabel === "medium"
                  ? (mn ? "Дунд зэргийн эрсдэл — дулаалга, цонхны шинэчлэл хэрэгтэй" : "Moderate risk — insulation or window upgrades would help")
                  : (mn ? "Бага эрсдэл — барилга харьцангуй үр ашигтай" : "Low risk — building is relatively efficient")}
              </span>
            </div>

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

        {/* What-if simulation */}
        {tab === "whatif" && (() => {
          const baseline = calc.ml.annual;
          const improved = wiResult.annual;
          const diff     = improved - baseline;
          const pct      = baseline > 0 ? ((diff / baseline) * 100).toFixed(1) : 0;
          const diffColor = diff < 0 ? "#2a9d8f" : diff > 0 ? "#e63946" : "#a8c5e0";
          return (
            <div className="tab-section">
              <SectionHeader icon={Zap} color="#9b72cf" title={mn ? "Параметр өөрчлөлтийн симуляц" : "Parameter change simulation"} />
              <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: "0.85rem", lineHeight: 1.6 }}>
                {mn
                  ? "Барилгын параметрийг өөрчилж ML загварын таамаглал хэрхэн өөрчлөгдөхийг харна уу."
                  : "Adjust parameters to see how the ML model's prediction changes in real-time."}
              </div>

              {/* Controls */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginBottom: "1rem" }}>
                {/* Insulation */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: "0.3rem", fontWeight: 600 }}>
                    {mn ? "Дулаалгын чанар" : "Insulation quality"}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {[["poor", mn ? "Муу" : "Poor", "#e63946"], ["medium", mn ? "Дунд" : "Medium", "#f4a261"], ["good", mn ? "Сайн" : "Good", "#2a9d8f"]].map(([v, label, c]) => (
                      <button key={v} onClick={() => setWi(w => ({ ...w, insulation_quality: v }))}
                        style={{ flex: 1, padding: "0.3rem 0.2rem", borderRadius: 6, border: `1px solid ${wi.insulation_quality === v ? c : "var(--border)"}`,
                          background: wi.insulation_quality === v ? `${c}22` : "var(--bg3)", color: wi.insulation_quality === v ? c : "var(--text3)", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Windows */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: "0.3rem", fontWeight: 600 }}>
                    {mn ? "Цонхны төрөл" : "Window type"}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {[["single", mn ? "Нэг давхар" : "Single", "#e63946"], ["double", mn ? "Хос шил" : "Double", "#f4a261"], ["triple", mn ? "Гурван шил" : "Triple", "#2a9d8f"]].map(([v, label, c]) => (
                      <button key={v} onClick={() => setWi(w => ({ ...w, window_type: v }))}
                        style={{ flex: 1, padding: "0.3rem 0.2rem", borderRadius: 6, border: `1px solid ${wi.window_type === v ? c : "var(--border)"}`,
                          background: wi.window_type === v ? `${c}22` : "var(--bg3)", color: wi.window_type === v ? c : "var(--text3)", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Heating */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: "0.3rem", fontWeight: 600 }}>
                    {mn ? "Халаалтын төрөл" : "Heating type"}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {[["central", mn ? "Дүүрэг" : "District", "#2a9d8f"], ["local", mn ? "Орон нутаг" : "Local", "#f4a261"], ["electric", mn ? "Цахилгаан" : "Electric", "#e63946"]].map(([v, label, c]) => (
                      <button key={v} onClick={() => setWi(w => ({ ...w, heating_type: v }))}
                        style={{ flex: 1, padding: "0.3rem 0.2rem", borderRadius: 6, border: `1px solid ${wi.heating_type === v ? c : "var(--border)"}`,
                          background: wi.heating_type === v ? `${c}22` : "var(--bg3)", color: wi.heating_type === v ? c : "var(--text3)", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Wall material */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: "0.3rem", fontWeight: 600 }}>
                    {mn ? "Хананы материал" : "Wall material"}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {[["panel", mn ? "Панел" : "Panel", "#a8c5e0"], ["brick", mn ? "Тоосго" : "Brick", "#f4a261"], ["concrete", mn ? "Бетон" : "Concrete", "#3a8fd4"], ["wood", mn ? "Мод" : "Wood", "#2a9d8f"]].map(([v, label, c]) => (
                      <button key={v} onClick={() => setWi(w => ({ ...w, wall_material: v }))}
                        style={{ flex: "1 0 40%", padding: "0.3rem 0.2rem", borderRadius: 6, border: `1px solid ${wi.wall_material === v ? c : "var(--border)"}`,
                          background: wi.wall_material === v ? `${c}22` : "var(--bg3)", color: wi.wall_material === v ? c : "var(--text3)", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Renovation year slider */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: "0.3rem", fontWeight: 600 }}>
                    {mn ? `Шинэчлэлийн он: ${wi.year}` : `Renovation year: ${wi.year}`}
                  </div>
                  <input type="range" min={1940} max={2026} value={wi.year}
                    onChange={e => setWi(w => ({ ...w, year: parseInt(e.target.value) }))}
                    style={{ width: "100%", accentColor: "#9b72cf" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text3)" }}>
                    <span>1940</span><span>2026</span>
                  </div>
                </div>
              </div>

              {/* Result comparison */}
              <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "0.9rem", border: "1px solid var(--border)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginBottom: 3 }}>{mn ? "Одоогийн" : "Current"}</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: GRADE_COLORS[calc.grade] }}>{baseline.toLocaleString()}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>kWh · {calc.grade}</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "0 0.3rem" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.88rem", color: diffColor }}>
                      {diff > 0 ? "+" : ""}{diff.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: diffColor }}>
                      ({diff > 0 ? "+" : ""}{pct}%)
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginBottom: 3 }}>{mn ? "Симуляц" : "Simulated"}</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: GRADE_COLORS[wiResult.grade] }}>{improved.toLocaleString()}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>kWh · {wiResult.grade}</div>
                  </div>
                </div>
                {diff < 0 && (
                  <div style={{ textAlign: "center", padding: "0.5rem", background: "rgba(42,157,143,0.1)", borderRadius: 7, fontSize: "0.78rem", color: "#2a9d8f", fontWeight: 700 }}>
                    {mn ? `~${Math.abs(diff).toLocaleString()} kWh/жил хэмнэлт боломжтой` : `~${Math.abs(diff).toLocaleString()} kWh/yr savings possible`}
                  </div>
                )}
                {diff >= 0 && diff !== 0 && (
                  <div style={{ textAlign: "center", padding: "0.5rem", background: "rgba(230,57,70,0.08)", borderRadius: 7, fontSize: "0.78rem", color: "#e63946", fontWeight: 700 }}>
                    {mn ? "Хэрэглээ нэмэгдэнэ — илүү үр ашигтай тохиргоо сонгоно уу" : "Usage increases — choose more efficient settings"}
                  </div>
                )}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: "0.5rem" }}>
                {mn ? "Симуляц нь ML OLS загварт суурилсан. Бодит хэмнэлт нэмэлт хэмжилтээс хамаарна." : "Simulation is ML OLS-based. Actual savings depend on real conditions."}
              </div>
            </div>
          );
        })()}
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

// ─── Smog / haze overlay ──────────────────────────────────────────────────────
const SMOG_PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left:   ((i * 41 + 13) % 97),
  size:   90 + (i * 31) % 130,
  dur:    13 + (i * 7)  % 14,
  delay:  -(i * 2.1),
  opBase: 0.07 + (i * 0.018) % 0.13,
}));

function SmogOverlay({ pm25 }) {
  const intensity = Math.min(1, Math.max(0, (pm25 - 15) / 235));
  const baseOpacity = 0.55 + intensity * 0.45;

  return (
    <div className="smog-overlay" style={{ opacity: baseOpacity }}>
      <div className="smog-base" />
      <div className="smog-vignette" />
      {SMOG_PARTICLES.map(p => (
        <div key={p.id} className="smog-particle" style={{
          left:   `${p.left}%`,
          width:  p.size,
          height: p.size,
          animationDuration:  `${p.dur}s`,
          animationDelay:     `${p.delay}s`,
          '--op': p.opBase + intensity * 0.1,
        }} />
      ))}
    </div>
  );
}

// ─── Weather widget ────────────────────────────────────────────────────────────
function WeatherWidget({ lang, pm25, showSmog, onToggleSmog }) {
  const mn = lang === "mn";
  const pm25Color =
    pm25 > 150 ? "#9b1d20" :
    pm25 > 55  ? "#e63946" :
    pm25 > 35  ? "#f4a261" : "#2a9d8f";
  const pm25Label =
    pm25 > 150 ? (mn ? "Маш аюултай" : "Hazardous") :
    pm25 > 55  ? (mn ? "Аюултай" : "Unhealthy") :
    pm25 > 35  ? (mn ? "Дунд" : "Moderate") :
                 (mn ? "Цэвэр" : "Clean");

  return (
    <div className="weather-widget">
      <div className="ww-top">
        <span className="ww-city">{mn ? "Улаанбаатар" : "Ulaanbaatar"}</span>
        <span className="ww-temp">−4°C</span>
      </div>
      <div className="ww-row">
        <Wind size={11} style={{ color: "#8899aa" }} />
        <span>12 km/h</span>
      </div>
      <div className="ww-pm">
        <span className="ww-pm-label">PM2.5</span>
        <span className="ww-pm-val" style={{ color: pm25Color }}>{pm25} μg/m³</span>
        <span className="ww-pm-badge" style={{ background: `${pm25Color}22`, color: pm25Color, borderColor: `${pm25Color}55` }}>
          {pm25Label}
        </span>
      </div>
      {/* Smog toggle */}
      <button className={`ww-smog-btn${showSmog ? " active" : ""}`} onClick={onToggleSmog}>
        <span className="ww-smog-dot" />
        {showSmog ? (mn ? "Утаа харагдаж байна" : "Smog ON") : (mn ? "Утаа нуусан" : "Smog OFF")}
      </button>
      <div className="ww-note">{mn ? "Жишиг · бодит биш" : "Demo · not real-time"}</div>
    </div>
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
  const [buildings,    setBuildings]   = useState([...buildingCache.current.values()]);
  const [loading,      setLoading]     = useState(true);
  const [lastFetched,  setLastFetched] = useState(null);
  const [selected,     setSelected]   = useState(null);
  const [typeFilter,     setTypeFilter]     = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [layer,          setLayer]          = useState("dark");
  const [colorMode,      setColorMode]      = useState("type"); // "type" | "energy" | "grade" | "pm25"
  const [showSmog,       setShowSmog]       = useState(true);
  const DEMO_PM25 = 89;

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
  const filtered   = useMemo(() => {
    let bs = buildings;
    if (typeFilter !== "all")     bs = bs.filter(b => b.type === typeFilter);
    if (districtFilter !== "all") bs = bs.filter(b => (b.district || "").includes(districtFilter));
    return bs;
  }, [buildings, typeFilter, districtFilter]);

  // Districts present in loaded buildings (deduplicated)
  const availableDistricts = useMemo(() => {
    const seen = new Set();
    buildings.forEach(b => {
      const d = b.district || "";
      ulaanbaatarDistricts.forEach(ud => { if (d.includes(ud)) seen.add(ud); });
    });
    return [...seen].sort();
  }, [buildings]);

  const tile = TILES[layer];

  // Count of OSM vs mock vs user buildings for the badge
  const osmCount  = buildings.filter(b => b.source === "osm").length;
  const mockCount = buildings.filter(b => b.source === "mock").length;
  const userCount = buildings.filter(b => b.source === "user" || b.source === "predictor").length;

  // District comparison stats
  const districtStats = useMemo(() => {
    const groups = {};
    buildings.forEach(b => {
      let d = "Бусад";
      ulaanbaatarDistricts.forEach(ud => { if ((b.district || "").includes(ud)) d = ud; });
      if (!groups[d]) groups[d] = [];
      groups[d].push(b);
    });
    return Object.entries(groups)
      .map(([district, bs]) => {
        const calcs = bs.map(b => calcBuilding(b));
        const avgIntens = Math.round(calcs.reduce((s, c) => s + c.intensity, 0) / calcs.length);
        const counts = {};
        calcs.forEach(c => { counts[c.grade] = (counts[c.grade] || 0) + 1; });
        const topGrade = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "C";
        return { district, count: bs.length, avgIntens, topGrade };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [buildings]);

  // Stats for analysis strip — computed from all loaded buildings
  const analysisStats = useMemo(() => {
    if (buildings.length === 0) return null;
    const calcs = buildings.map(b => ({ b, c: calcBuilding(b) }));
    const totalKwh  = calcs.reduce((s, { c }) => s + c.total, 0);
    const totalCo2  = calcs.reduce((s, { c }) => s + c.co2, 0);
    const avgIntens = Math.round(calcs.reduce((s, { c }) => s + c.intensity, 0) / calcs.length);
    // Grade distribution
    const gradeCounts = {};
    calcs.forEach(({ c }) => { gradeCounts[c.grade] = (gradeCounts[c.grade] || 0) + 1; });
    // Top 3 high-intensity buildings
    const topHigh = [...calcs]
      .sort((a, b) => b.c.intensity - a.c.intensity)
      .slice(0, 3)
      .map(({ b, c }) => ({ name: b.name, intensity: c.intensity, grade: c.grade, type: b.type }));
    return { totalKwh, totalCo2: +totalCo2.toFixed(0), avgIntens, gradeCounts, topHigh, count: calcs.length };
  }, [buildings]);

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
            <BuildingFetcher onNewBuildings={addBuildings} setLoading={setLoading} onFetched={setLastFetched} />

            {filtered.map(b => {
              const active   = selected?.id === b.id;
              const isMine   = b.source === "user" || b.source === "predictor";
              const typeColor = TYPE_COLOR[b.type] || "#3a8fd4";
              // Color by mode
              const polyColor = (() => {
                if (colorMode === "grade") {
                  const calc = calcBuilding(b);
                  return GRADE_COLORS[calc.grade] || typeColor;
                }
                if (colorMode === "energy") {
                  const calc = calcBuilding(b);
                  // continuous gradient green→yellow→red based on kWh/m² (0–300)
                  const t = Math.min(1, calc.intensity / 300);
                  if (t < 0.5) {
                    const tt = t * 2;
                    const r = Math.round(42  + (244 - 42)  * tt);
                    const g = Math.round(157 + (162 - 157) * tt);
                    const bv= Math.round(143 + (97  - 143) * tt);
                    return `rgb(${r},${g},${bv})`;
                  } else {
                    const tt = (t - 0.5) * 2;
                    const r = Math.round(244 + (230 - 244) * tt);
                    const g = Math.round(162 + (57  - 162) * tt);
                    const bv= Math.round(97  + (70  - 97)  * tt);
                    return `rgb(${r},${g},${bv})`;
                  }
                }
                if (colorMode === "pm25") {
                  const calc = calcBuilding(b);
                  // PM2.5 per m² → normalize 0-1 on 0–2000 kg/yr/m² scale
                  const perM2 = calc.pm25 / Math.max(1, b.area);
                  const t = Math.min(1, perM2 / 2);
                  // green (#2a9d8f) → yellow (#f4a261) → red (#e63946)
                  if (t < 0.5) {
                    const tt = t * 2;
                    const r = Math.round(42 + (244 - 42) * tt);
                    const g = Math.round(157 + (162 - 157) * tt);
                    const bv = Math.round(143 + (97 - 143) * tt);
                    return `rgb(${r},${g},${bv})`;
                  } else {
                    const tt = (t - 0.5) * 2;
                    const r = Math.round(244 + (230 - 244) * tt);
                    const g = Math.round(162 + (57 - 162) * tt);
                    const bv = Math.round(97 + (70 - 97) * tt);
                    return `rgb(${r},${g},${bv})`;
                  }
                }
                return typeColor;
              })();
              const color  = polyColor;
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
                >
                  <LeafletTooltip sticky direction="top" offset={[0, -4]}>
                    {(() => {
                      const c = calcBuilding(b);
                      return (
                        <div style={{ fontSize: 12, lineHeight: 1.55, minWidth: 140 }}>
                          <strong style={{ display: "block", marginBottom: 2 }}>{b.name}</strong>
                          <span style={{ color: TYPE_COLOR[b.type] || "#888" }}>
                            {b.type}{b.year ? ` · ${b.year}${!b.yearKnown && b.source === "osm" ? "~" : ""}` : ""}
                          </span>
                          <br />
                          {b.area.toLocaleString()} m² · {b.floors} {lang === "mn" ? "давхар" : "fl"}
                          <br />
                          <span style={{ color: "#f4a261", fontWeight: 700 }}>{c.total.toLocaleString()} kWh/жил</span>
                          {" · "}
                          <span style={{ color: GRADE_COLORS[c.grade], fontWeight: 700 }}>{c.grade}</span>
                          <br />
                          <span style={{ color: "#aaa", fontSize: 11 }}>
                            CO₂ {c.co2} t · {c.hasActualData ? (lang === "mn" ? "Бодит" : "Actual") : (lang === "mn" ? "ML таамаглал" : "ML est.")}
                          </span>
                        </div>
                      );
                    })()}
                  </LeafletTooltip>
                </Polygon>
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

          {/* Building count + last updated badge */}
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
              {lastFetched && (
                <span className="bldg-mock-note" style={{ color: "#6a9bbf", marginLeft: 6 }}>
                  · {lang === "mn" ? "Шинэчлэгдсэн" : "Updated"}{" "}
                  {lastFetched.toLocaleTimeString(lang === "mn" ? "mn-MN" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                  {" (OSM)"}
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
            {availableDistricts.length > 0 && (
              <div className="ctrl-pill">
                <MapPin size={12} style={{ color: "#8899aa" }} />
                <select className="ctrl-sel" value={districtFilter}
                  onChange={e => { setDistrictFilter(e.target.value); setSelected(null); }}>
                  <option value="all">{lang === "mn" ? "Бүх дүүрэг" : "All districts"}</option>
                  {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            {/* Primary layer toggle: Energy / Grade */}
            <div className="layer-group">
              <button className={`layer-btn${colorMode === "energy" ? " active" : ""}`}
                onClick={() => setColorMode("energy")}
                title={lang === "mn" ? "kWh/m² эрчим хүч (ногоон→улаан)" : "Energy kWh/m² (green→red)"}>
                {lang === "mn" ? "Энерги" : "Energy"}
              </button>
              <button className={`layer-btn${colorMode === "grade" ? " active" : ""}`}
                onClick={() => setColorMode("grade")}
                title={lang === "mn" ? "A–G зэрэглэлээр өнгө" : "Color by A–G grade"}>
                {lang === "mn" ? "Зэрэглэл" : "Grade"}
              </button>
            </div>
            {/* Secondary: Type / PM2.5 / base map */}
            <div className="layer-group">
              <button className={`layer-btn${colorMode === "type" ? " active" : ""}`}
                onClick={() => setColorMode("type")} title={lang === "mn" ? "Төрлөөр өнгө" : "Color by type"}>
                {lang === "mn" ? "Төрөл" : "Type"}
              </button>
              <button className={`layer-btn${colorMode === "pm25" ? " active" : ""}`}
                onClick={() => setColorMode("pm25")} title={lang === "mn" ? "PM2.5 бохирдол" : "PM2.5 pollution"}>
                PM2.5
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
              : colorMode === "grade"
              ? (<>
                  {[
                    ["A","<50 kWh/m²"],["B","50–100"],["C","100–150"],
                    ["D","150–200"],["E","200–250"],["F","250–300"],["G","≥300"],
                  ].map(([g, range]) => (
                    <div key={g} className="lgd-row">
                      <span className="lgd-dot" style={{ background: GRADE_COLORS[g] }} />
                      <span>{g}</span>
                      <span className="lgd-range">{range}</span>
                    </div>
                  ))}
                  <div className="lgd-unit-note">{lang === "mn" ? "kWh/м²/жил" : "kWh/m²/yr"}</div>
                </>)
              : colorMode === "energy"
              ? (<>
                  <div className="lgd-pm25">
                    <div className="lgd-pm25-bar" />
                    <div className="lgd-pm25-lbls">
                      <span style={{ color: "#2a9d8f" }}>0</span>
                      <span style={{ color: "#e63946" }}>300+</span>
                    </div>
                    <div style={{ fontSize: "0.64rem", color: "var(--text3)", marginTop: 3 }}>kWh/m²/yr</div>
                  </div>
                  <div className="lgd-unit-note">{lang === "mn" ? "Бага → Өндөр эрчим" : "Low → High energy"}</div>
                </>)
              : (
                <div className="lgd-pm25">
                  <div className="lgd-pm25-bar" />
                  <div className="lgd-pm25-lbls">
                    <span style={{ color: "#2a9d8f" }}>{lang === "mn" ? "Бага" : "Low"}</span>
                    <span style={{ color: "#e63946" }}>{lang === "mn" ? "Өндөр" : "High"}</span>
                  </div>
                  <div style={{ fontSize: "0.64rem", color: "var(--text3)", marginTop: 3 }}>PM2.5</div>
                </div>
              )
            }
            {/* Data source clarity */}
            <div className="lgd-src-note">
              <div className="lgd-src-row">
                <span className="lgd-src-dot" style={{ background: "#3a8fd4" }} />
                <span>{lang === "mn" ? "ML таамаглал" : "ML estimate"}</span>
              </div>
              <div className="lgd-src-row">
                <span className="lgd-src-dot lgd-src-dashed" style={{ borderColor: "#f4c842" }} />
                <span>{lang === "mn" ? "Бодит нэхэмжлэл" : "Actual bill"}</span>
              </div>
              <div className="lgd-src-row">
                <span className="lgd-src-dot" style={{ background: "#667788" }} />
                <span>Demo</span>
              </div>
            </div>
          </div>

          {/* Smog overlay */}
          {showSmog && <SmogOverlay pm25={DEMO_PM25} />}

          {/* Weather widget */}
          <WeatherWidget
            lang={lang}
            pm25={DEMO_PM25}
            showSmog={showSmog}
            onToggleSmog={() => setShowSmog(s => !s)}
          />
        </div>

        {/* Side panel */}
        <div className="map-panel">
          {selected
            ? <BuildingPanel building={selected} lang={lang} t={t} />
            : <NoSelection t={t} />
          }
        </div>
      </div>

      {/* ── Analysis strip ── */}
      {analysisStats && (
        <section className="analysis-strip">
          <div className="analysis-inner">
            <div className="analysis-title">
              <BarChart2 size={16} style={{ color: "#3a8fd4" }} />
              {lang === "mn"
                ? `Ачаалсан ${analysisStats.count} барилгын дүн шинжилгээ`
                : `Analysis of ${analysisStats.count} loaded buildings`}
              <span className="analysis-est-badge">
                <FlaskConical size={11} />
                {lang === "mn" ? "ML таамаглал · бодит өгөгдөл биш" : "ML estimates · not measured data"}
              </span>
            </div>
            <div className="analysis-cards">
              {/* Total energy */}
              <div className="an-card">
                <div className="an-icon" style={{ background: "rgba(244,162,97,0.12)" }}>
                  <Zap size={16} style={{ color: "#f4a261" }} />
                </div>
                <div>
                  <div className="an-val">{(analysisStats.totalKwh / 1e6).toFixed(1)} <span className="an-unit">МВт·цаг/жил</span></div>
                  <div className="an-lbl">{lang === "mn" ? "Нийт таамагласан хэрэглээ" : "Total estimated consumption"}</div>
                </div>
              </div>
              {/* Total CO₂ */}
              <div className="an-card">
                <div className="an-icon" style={{ background: "rgba(230,111,81,0.12)" }}>
                  <Wind size={16} style={{ color: "#e76f51" }} />
                </div>
                <div>
                  <div className="an-val">{(analysisStats.totalCo2 / 1000).toFixed(1)} <span className="an-unit">кт CO₂/жил</span></div>
                  <div className="an-lbl">{lang === "mn" ? "Нийт нүүрхүчлийн хий" : "Total CO₂ emissions"}</div>
                </div>
              </div>
              {/* Avg intensity */}
              <div className="an-card">
                <div className="an-icon" style={{ background: "rgba(155,114,207,0.12)" }}>
                  <TrendingUp size={16} style={{ color: "#9b72cf" }} />
                </div>
                <div>
                  <div className="an-val">{analysisStats.avgIntens} <span className="an-unit">kWh/m²</span></div>
                  <div className="an-lbl">{lang === "mn" ? "Дундаж эрчим хүчний эрч" : "Average energy intensity"}</div>
                </div>
              </div>
              {/* Grade distribution */}
              <div className="an-card an-card-wide">
                <div className="an-icon" style={{ background: "rgba(42,157,143,0.12)" }}>
                  <Award size={16} style={{ color: "#2a9d8f" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="an-lbl" style={{ marginBottom: "0.45rem" }}>
                    {lang === "mn" ? "Зэрэглэлийн тархалт A–G" : "Grade distribution A–G"}
                  </div>
                  <div className="grade-dist-bar">
                    {["A","B","C","D","E","F","G"].map(g => {
                      const cnt  = analysisStats.gradeCounts[g] || 0;
                      const pct  = Math.round(cnt / analysisStats.count * 100);
                      if (pct === 0) return null;
                      return (
                        <div key={g} className="gdb-seg"
                          style={{ width: `${pct}%`, background: GRADE_COLORS[g] }}
                          title={`${g}: ${cnt} (${pct}%)`}>
                          {pct > 7 ? g : ""}
                        </div>
                      );
                    })}
                  </div>
                  <div className="grade-dist-lbls">
                    {["A","B","C","D","E","F","G"].map(g => {
                      const cnt = analysisStats.gradeCounts[g] || 0;
                      if (!cnt) return null;
                      return (
                        <span key={g} style={{ color: GRADE_COLORS[g], fontSize: "0.68rem" }}>
                          {g} {cnt}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Top high-intensity buildings */}
            {analysisStats.topHigh.length > 0 && (
              <div className="an-top">
                <div className="an-top-title">
                  <TrendingUp size={13} style={{ color: "#e63946" }} />
                  {lang === "mn" ? "Өндөр хэрэглээтэй барилгууд" : "Highest intensity buildings"}
                </div>
                {analysisStats.topHigh.map((b, i) => (
                  <div key={i} className="an-top-row">
                    <span className="an-top-rank">#{i + 1}</span>
                    <span className="an-top-name">{b.name}</span>
                    <span className="an-top-grade" style={{ background: GRADE_COLORS[b.grade] }}>{b.grade}</span>
                    <span className="an-top-val">{b.intensity.toLocaleString()} kWh/m²</span>
                  </div>
                ))}
              </div>
            )}

            {/* District comparison */}
            {districtStats.length > 1 && (
              <div className="district-comparison">
                <div className="dc-title">
                  <MapPin size={13} style={{ color: "#9b72cf" }} />
                  {lang === "mn" ? "Дүүргийн харьцуулалт (ML таамаглал)" : "District comparison (ML estimates)"}
                  <span className="dc-est-badge">
                    <FlaskConical size={10} />
                    {lang === "mn" ? "Таамаглал" : "Estimated"}
                  </span>
                </div>
                <div className="dc-table-wrap">
                  <table className="dc-table">
                    <thead>
                      <tr>
                        <th>{lang === "mn" ? "Дүүрэг" : "District"}</th>
                        <th>{lang === "mn" ? "Барилга" : "Buildings"}</th>
                        <th>{lang === "mn" ? "Дунд эрч" : "Avg intensity"}</th>
                        <th>{lang === "mn" ? "Зэрэглэл" : "Top grade"}</th>
                        <th>{lang === "mn" ? "Харьцуулалт" : "vs avg"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const overallAvg = Math.round(districtStats.reduce((s, d) => s + d.avgIntens, 0) / districtStats.length);
                        return districtStats.map(d => {
                          const diff = d.avgIntens - overallAvg;
                          const diffColor = diff > 15 ? "#e63946" : diff < -15 ? "#2a9d8f" : "var(--text3)";
                          const barPct = Math.min(100, (d.avgIntens / 350) * 100);
                          return (
                            <tr key={d.district}
                              className={districtFilter === d.district ? "dc-row-active" : ""}
                              onClick={() => setDistrictFilter(districtFilter === d.district ? "all" : d.district)}
                              style={{ cursor: "pointer" }}>
                              <td className="dc-district">{d.district}</td>
                              <td className="dc-count">{d.count}</td>
                              <td className="dc-intens">
                                <div className="dc-bar-wrap">
                                  <div className="dc-bar" style={{ width: `${barPct}%`, background: GRADE_COLORS[d.topGrade] }} />
                                </div>
                                <span>{d.avgIntens}</span>
                              </td>
                              <td>
                                <span className="dc-grade" style={{ background: GRADE_COLORS[d.topGrade] }}>{d.topGrade}</span>
                              </td>
                              <td style={{ color: diffColor, fontWeight: 700, fontSize: "0.74rem" }}>
                                {diff > 0 ? `+${diff}` : diff}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
                <div className="dc-note">
                  <Info size={11} />
                  {lang === "mn"
                    ? "Дүүрэг дэх барилгуудын OSM тэгийн дагуу бүлэглэсэн. Дүүрэг дарахад шүүнэ. ML таамаглал — бодит хэмжилт биш."
                    : "Grouped by OSM address district tags. Click row to filter. ML estimates only — not actual measurements."}
                </div>
              </div>
            )}

            {/* Overpass API limit note */}
            <div className="an-api-note">
              <Database size={12} style={{ color: "#667788", flexShrink: 0 }} />
              <span>
                {lang === "mn"
                  ? "Overpass API нэг хүсэлтэд 1,000 барилга, 3 MB, 12 секундийн хязгаартай. Тулам хэлбэрийн кэш ашиглан давхар татахаас сэргийлнэ. Газрын зургийг хөдөлгөхөд шинэ хэсгийн барилгуудыг автоматаар нэмнэ."
                  : "Overpass API limits: 1,000 buildings per request, 3 MB max response, 12 s timeout. Grid-cell caching prevents duplicate fetches. Panning the map auto-loads new areas."}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works section ── */}
      <HowItWorks t={t} lang={lang} />
    </div>
  );
}
