import { storageGetJSON, storageSetJSON } from "./storage";
import { STORAGE_KEYS } from "../config/constants";
import { buildingsData } from "../data/mockData";
import { predict } from "../ml/model";

const STORAGE_KEY = STORAGE_KEYS.buildings;

// ─── Canonical building schema ─────────────────────────────────────────────────
// Every building — mock, user-submitted, or OSM-sourced — is normalized here.
// ML prediction runs at normalize time so all consumers get consistent fields.
export function normalizeBuilding(raw) {
  const area   = Math.max(10, parseFloat(raw.area)   || 100);
  const floors = Math.max(1,  parseInt(raw.floors)   || 3);
  const year   = Math.max(1940, Math.min(2026, parseInt(raw.year) || 1990));
  const type   = raw.type || raw.building_type || "apartment";

  // Per-type resident/appliance density (per 100 m²)
  const resPer100 = { apartment: 5, office: 3, school: 4, hospital: 6, commercial: 2, warehouse: 1 };
  const appPer100 = { apartment: 8, office: 5, school: 4, hospital: 10, commercial: 6, warehouse: 3 };

  const mlInput = {
    building_type:      type,
    area, year, floors,
    rooms:              parseInt(raw.rooms) || Math.max(1, Math.round(area / 50)),
    hdd:                4500,
    window_ratio:       raw.window_ratio || 25,
    residents:          Math.max(1, Math.round(area / 100 * (resPer100[type] || 4))),
    appliances:         Math.min(15, Math.max(2, Math.round(area / 100 * (appPer100[type] || 6)))),
    wall_material:      raw.wall_material      || "panel",
    heating_type:       raw.heating_type       || "central",
    insulation_quality: raw.insulation_quality || "medium",
    window_type:        raw.window_type        || "double",
  };

  const ml = predict(mlInput);

  // If user provided actual bill-derived kWh, prefer that for total
  const actualAnnual = raw.monthly_usage ? Math.round(raw.monthly_usage * 12) : null;
  const finalKwh     = actualAnnual ?? ml.annual;
  const finalIntens  = Math.round(finalKwh / area);
  const finalGrade   =
    finalIntens < 50  ? "A" : finalIntens < 100 ? "B" :
    finalIntens < 150 ? "C" : finalIntens < 200 ? "D" :
    finalIntens < 250 ? "E" : finalIntens < 300 ? "F" : "G";

  return {
    id:       raw.id    || `bld_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    name:     raw.name  || "Нэргүй барилга",
    type,
    area,
    floors,
    year,
    district:           raw.district           || "Улаанбаатар",
    wall_material:      mlInput.wall_material,
    heating_type:       mlInput.heating_type,
    insulation_quality: mlInput.insulation_quality,
    window_type:        mlInput.window_type,
    latitude:           parseFloat(raw.latitude  ?? raw.lat)  || 47.9184,
    longitude:          parseFloat(raw.longitude ?? raw.lng)  || 106.9177,
    monthly_elec_cost:  parseFloat(raw.monthly_elec_cost) || null,
    monthly_heat_cost:  parseFloat(raw.monthly_heat_cost) || null,
    source:             raw.source      || "mock",
    userId:             raw.userId      || null,
    submittedAt:        raw.submittedAt || null,
    // ML-computed energy fields
    predicted_kwh:  finalKwh,
    monthly_kwh:    Math.round(finalKwh / 12),
    intensity:      finalIntens,
    grade:          finalGrade,
    co2:            ml.co2,
    pm25:           ml.pm25,
    // Raw ML result kept for panel details
    ml_annual:      ml.annual,
    ml_grade:       ml.grade,
    has_actual_data: !!actualAnnual,
  };
}

// ─── Seed: mock buildings normalized + ML-predicted ───────────────────────────
export const MOCK_BUILDINGS = buildingsData.map(b =>
  normalizeBuilding({ ...b, lat: b.lat, lng: b.lng, source: "mock" })
);

// ─── User buildings (localStorage) ────────────────────────────────────────────
export function getUserBuildings(userId = null) {
  const all = storageGetJSON(STORAGE_KEY, []);
  return userId ? all.filter(b => !b.userId || b.userId === userId) : all;
}

export function saveUserBuilding(record) {
  const normalized = normalizeBuilding({ ...record, source: record.source || "user" });
  const existing   = storageGetJSON(STORAGE_KEY, []);
  storageSetJSON(STORAGE_KEY, [...existing, normalized]);
}

export function updateUserBuilding(id, updates) {
  const all = storageGetJSON(STORAGE_KEY, []);
  storageSetJSON(STORAGE_KEY, all.map(b =>
    b.id === id ? normalizeBuilding({ ...b, ...updates }) : b
  ));
}

export function deleteUserBuilding(id) {
  const all = storageGetJSON(STORAGE_KEY, []);
  storageSetJSON(STORAGE_KEY, all.filter(b => b.id !== id));
}

// ─── Combined dataset: mock + user (user overrides same id) ───────────────────
export function getAllBuildings(userId = null) {
  const userRaw = getUserBuildings(userId);
  const normalized = userRaw.map(b => normalizeBuilding({ ...b, source: b.source || "user" }));
  const userIds = new Set(normalized.map(b => b.id));
  return [...MOCK_BUILDINGS.filter(b => !userIds.has(b.id)), ...normalized];
}

// ─── Aggregate stats ──────────────────────────────────────────────────────────
export function computeStats(buildings) {
  if (!buildings || !buildings.length) return null;

  const totalKwh  = buildings.reduce((s, b) => s + b.predicted_kwh, 0);
  const totalArea = buildings.reduce((s, b) => s + b.area, 0);
  const totalCo2  = buildings.reduce((s, b) => s + b.co2, 0);
  const totalPm25 = buildings.reduce((s, b) => s + b.pm25, 0);

  const gradeCounts = {};
  buildings.forEach(b => { gradeCounts[b.grade] = (gradeCounts[b.grade] || 0) + 1; });

  // District aggregation
  const byDistrict = {};
  buildings.forEach(b => {
    if (!byDistrict[b.district]) byDistrict[b.district] = { count: 0, kwh: 0, area: 0 };
    byDistrict[b.district].count++;
    byDistrict[b.district].kwh  += b.predicted_kwh;
    byDistrict[b.district].area += b.area;
  });
  const districtData = Object.entries(byDistrict)
    .map(([district, d]) => ({
      district,
      count:     d.count,
      kwh:       Math.round(d.kwh),
      intensity: d.area > 0 ? Math.round(d.kwh / d.area) : 0,
    }))
    .sort((a, b) => b.intensity - a.intensity);

  const topHigh = [...buildings]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);

  return {
    count:        buildings.length,
    totalKwh:     Math.round(totalKwh),
    totalMwh:     +(totalKwh / 1000).toFixed(1),
    totalCo2:     +totalCo2.toFixed(1),
    totalPm25:    Math.round(totalPm25),
    totalArea:    Math.round(totalArea),
    avgIntensity: totalArea > 0 ? Math.round(totalKwh / totalArea) : 0,
    avgCo2:       +(totalCo2 / buildings.length).toFixed(1),
    gradeCounts,
    districtData,
    topHigh,
  };
}
