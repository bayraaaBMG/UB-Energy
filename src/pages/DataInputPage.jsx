import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import { useAuth } from "../contexts/AuthContext";
import {
  Upload, CheckCircle, MapPin, Building2, FileText, FileSpreadsheet,
  File, Link2, X, CloudUpload, FilePlus, Trash2, Eye, ArrowRight, Info,
  Layers, Wind, Flame, Target, Zap, AlertTriangle, ChevronDown, ChevronRight,
  CircleCheck, CircleX, Loader2,
} from "lucide-react";
import { ulaanbaatarDistricts } from "../data/mockData";
import "./DataInputPage.css";
import { saveUserBuilding } from "../utils/buildingStorage";
import { convertElecMoneyToKwh, convertHeatBillToEstimates, TARIFF_TIERS, predict } from "../ml/model";

const GRADE_COLORS = { A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20" };

// ─── Building-type dynamic schema ─────────────────────────────────────────────
const TYPE_SCHEMA = {
  apartment: {
    color: "#3a8fd4",
    desc: { mn: "Орон сууцны барилга — айлуудын тоо, өрөөний тоогоор ачааллыг тооцоолно.", en: "Residential — occupancy derived from units, floors, and rooms per unit." },
    fields: [
      { key: "units_per_floor",    label: { mn: "Давхрын айлын тоо", en: "Units per floor" },      type: "number", default: 4,  min: 1,  max: 40,   hint: { mn: "Нэг давхарт байх орон сууцны тоо", en: "Apartments on each floor" } },
      { key: "avg_rooms_per_unit", label: { mn: "Өрөөний тоо",        en: "Rooms per unit" },       type: "number", default: 2,  min: 1,  max: 8 },
      { key: "has_elevator",       label: { mn: "Лифт байгаа",           en: "Has elevator" },         type: "check" },
      { key: "has_basement",       label: { mn: "Подвал/гараж байгаа",   en: "Basement / garage" },   type: "check" },
    ],
    derive: (f) => {
      const units = (f.units_per_floor || 4) * Math.max(1, parseInt(f.total_floors) || 3);
      const elev  = f.has_elevator ? 1.08 : 1;
      const base  = f.has_basement ? 1.05 : 1;
      return {
        rooms:      units * (f.avg_rooms_per_unit || 2),
        residents:  Math.round(units * 2.5),
        appliances: Math.min(50, Math.round(units * 0.85 * elev * base)),
        info_mn:    `Нийт ${units} айл · ${Math.round(units * 2.5)} оршин суугч`,
        info_en:    `${units} total units · ${Math.round(units * 2.5)} residents`,
      };
    },
  },
  office: {
    color: "#2a9d8f",
    desc: { mn: "Оффисын барилга — ажиллагсад, компьютерийн тоогоор цахилгааны ачааллыг тооцоолно.", en: "Office — load estimated from employees and equipment count." },
    fields: [
      { key: "employees",    label: { mn: "Ажиллагсдын тоо",         en: "Employees" },               type: "number", default: 50,  min: 1, max: 5000 },
      { key: "computers",    label: { mn: "Компьютер / ажлын байр",  en: "Computers / workstations" }, type: "number", default: 40,  min: 0, max: 2000 },
      { key: "working_hours",label: { mn: "Өдрийн ажлын цаг",        en: "Working hours / day" },      type: "number", default: 8,   min: 1, max: 24   },
      { key: "has_server",   label: { mn: "Сервер өрөөтэй",          en: "Has server room" },          type: "check" },
    ],
    derive: (f) => {
      const hrFactor = ((f.working_hours || 8) / 8);
      const srv      = f.has_server ? 1.15 : 1;
      const apps     = Math.min(50, Math.max(2, Math.round(((f.computers || 40) / 5) * hrFactor * srv)));
      return {
        rooms:      Math.max(1, Math.ceil((f.employees || 50) / 4)),
        residents:  f.employees || 50,
        appliances: apps,
        info_mn:    `${f.employees || 50} ажиллагсад · ${f.computers || 40} компьютер · ${f.working_hours || 8}ц/өдөр`,
        info_en:    `${f.employees || 50} staff · ${f.computers || 40} computers · ${f.working_hours || 8}h/day`,
      };
    },
  },
  school: {
    color: "#e9c46a",
    desc: { mn: "Сургуулийн барилга — анги танхим, сурагчдын тоогоор тооцоолно.", en: "School — energy load based on classrooms, students, and staff." },
    fields: [
      { key: "classrooms",  label: { mn: "Ангийн тасалгааны тоо",  en: "Classrooms" },    type: "number", default: 20,  min: 1,  max: 200  },
      { key: "students",    label: { mn: "Сурагчдын нийт тоо",      en: "Total students" }, type: "number", default: 600, min: 10, max: 10000 },
      { key: "school_staff",label: { mn: "Багш + ажилтны тоо",      en: "Teachers + staff"},type: "number", default: 50,  min: 1,  max: 500  },
      { key: "has_gym",     label: { mn: "Спортын заалтай",          en: "Has sports hall" },type: "check" },
      { key: "has_cafeteria",label:{ mn: "Гуанзтай",                en: "Has cafeteria" },  type: "check" },
    ],
    derive: (f) => {
      const gym  = f.has_gym      ? 1.12 : 1;
      const cafe = f.has_cafeteria? 1.08 : 1;
      const total = (f.students || 600) + (f.school_staff || 50);
      return {
        rooms:      f.classrooms || 20,
        residents:  total,
        appliances: Math.min(50, Math.max(2, Math.round((f.classrooms || 20) * 2 * gym * cafe))),
        info_mn:    `${f.classrooms || 20} анги · ${total} хүн`,
        info_en:    `${f.classrooms || 20} classrooms · ${total} people`,
      };
    },
  },
  hospital: {
    color: "#e63946",
    desc: { mn: "Эмнэлгийн барилга — ор, тасгийн тоо болон 24/7 ачааллаар тооцоолно.", en: "Hospital — energy load based on beds, departments, and 24/7 operation." },
    fields: [
      { key: "beds",        label: { mn: "Ортны тоо",          en: "Patient beds" },      type: "number", default: 80, min: 1,  max: 5000 },
      { key: "departments", label: { mn: "Тасгийн тоо",         en: "Departments" },       type: "number", default: 8,  min: 1,  max: 100  },
      { key: "has_icu",     label: { mn: "ЭМТ / Intensive care", en: "Has ICU" },          type: "check" },
      { key: "is_24h",      label: { mn: "24/7 ажилладаг",       en: "24/7 operation" },   type: "check" },
    ],
    derive: (f) => {
      const h24  = f.is_24h  ? 1.4 : 1;
      const icu  = f.has_icu ? 1.2 : 1;
      return {
        rooms:      f.departments || 8,
        residents:  Math.round((f.beds || 80) * 1.8),
        appliances: Math.min(50, Math.max(5, Math.round((f.beds || 80) * 0.45 * h24 * icu))),
        info_mn:    `${f.beds || 80} ор · ${f.departments || 8} тасаг${f.is_24h ? " · 24/7" : ""}`,
        info_en:    `${f.beds || 80} beds · ${f.departments || 8} depts${f.is_24h ? " · 24/7" : ""}`,
      };
    },
  },
  commercial: {
    color: "#f4a261",
    desc: { mn: "Арилжааны барилга — дэлгүүрийн тоо, ажлын цагаар цахилгааны ачааллыг тооцоолно.", en: "Commercial — load based on shop units, operating hours, and equipment." },
    fields: [
      { key: "shops",           label: { mn: "Дэлгүүр / нэгжийн тоо",   en: "Shops / units" },          type: "number", default: 15,  min: 1, max: 500 },
      { key: "commercial_hours",label: { mn: "Ажлын цаг (цаг/өдөр)",    en: "Operating hours/day" },    type: "number", default: 12,  min: 1, max: 24  },
      { key: "has_escalator",   label: { mn: "Эскалатор / лифт байгаа",  en: "Escalators / lifts" },    type: "check" },
      { key: "has_cold_storage",label: { mn: "Хөргөгч агуулах байгаа",  en: "Cold storage" },           type: "check" },
    ],
    derive: (f) => {
      const hrs  = ((f.commercial_hours || 12) / 10);
      const esc  = f.has_escalator   ? 1.12 : 1;
      const cold = f.has_cold_storage? 1.18 : 1;
      return {
        rooms:      f.shops || 15,
        residents:  (f.shops || 15) * 3,
        appliances: Math.min(50, Math.max(3, Math.round((f.shops || 15) * 2 * hrs * esc * cold))),
        info_mn:    `${f.shops || 15} дэлгүүр · ${f.commercial_hours || 12}ц/өдөр`,
        info_en:    `${f.shops || 15} shops · ${f.commercial_hours || 12}h/day`,
      };
    },
  },
  warehouse: {
    color: "#6c757d",
    desc: { mn: "Агуулахын барилга — ажлын цаг, хөргөлтийн горимоор тооцоолно.", en: "Warehouse — energy based on ceiling height, operating hours, and cooling." },
    fields: [
      { key: "ceiling_height",  label: { mn: "Таазны өндөр (м)",        en: "Ceiling height (m)" },   type: "number", default: 8,  min: 3, max: 30 },
      { key: "operating_hours", label: { mn: "Ажлын цаг (цаг/өдөр)",   en: "Operating hours/day" }, type: "number", default: 10, min: 1, max: 24 },
      { key: "has_cooling",     label: { mn: "Хөргөлтийн агуулах",      en: "Refrigerated storage" }, type: "check" },
      { key: "has_loading_dock",label: { mn: "Ачаалах тавцантай",       en: "Has loading dock" },     type: "check" },
    ],
    derive: (f) => {
      const area = parseFloat(f.area) || 500;
      const cold = f.has_cooling ? 1.6 : 1;
      const hrs  = ((f.operating_hours || 10) / 8);
      return {
        rooms:      2,
        residents:  Math.max(2, Math.round(area / 200)),
        appliances: Math.min(50, Math.max(2, Math.round(area / 500 * 3 * cold * hrs))),
        info_mn:    `${f.ceiling_height || 8}м өндөр · ${f.operating_hours || 10}ц/өдөр${f.has_cooling ? " · Хөргөлттэй" : ""}`,
        info_en:    `${f.ceiling_height || 8}m ceiling · ${f.operating_hours || 10}h/day${f.has_cooling ? " · Cooled" : ""}`,
      };
    },
  },
};

function computeQualityScore(form, elecBill, heatBill) {
  let score = 0;
  if (form.building_name.trim())                              score += 15;
  if (parseFloat(form.area) >= 10)                           score += 20;
  if (parseInt(form.year) >= 1940 && parseInt(form.year) <= 2026) score += 10;
  if (parseInt(form.total_floors) >= 1)                      score += 10;
  if (form.insulation_quality && form.insulation_quality !== "medium") score += 10;
  else if (form.insulation_quality === "medium")             score += 5;
  if (form.wall_material && form.wall_material !== "panel")  score += 10;
  else if (form.wall_material === "panel")                   score += 5;
  if (form.window_type && form.window_type !== "double")     score += 5;
  else if (form.window_type === "double")                    score += 3;
  if (parseFloat(elecBill) > 0 || parseFloat(heatBill) > 0) score += 15;
  return Math.min(100, score);
}

// ─── CSV / JSON parsers ───────────────────────────────────────────────────────
const CSV_REQUIRED = ["area"];
const NAME_KEYS    = ["building_name", "name", "нэр"];

function detectDelimiter(line) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && counts[ch] !== undefined) counts[ch]++;
  }
  if (counts[";"] > counts[","] && counts[";"] > counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

function parseCSVLine(line, delim = ",") {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delim && !inQ) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

const COL_SPEC = [
  { key: "building_name", req: true,  mn: "Барилгын нэр",                         en: "Building name" },
  { key: "area",          req: true,  mn: "Талбай (м²)",                           en: "Floor area (m²)" },
  { key: "year",          req: false, mn: "Баригдсан он (1940–2026)",               en: "Year built (1940–2026)" },
  { key: "floors",        req: false, mn: "Давхрын тоо",                            en: "Number of floors" },
  { key: "district",      req: false, mn: "Дүүрэг",                                en: "District" },
  { key: "type",          req: false, mn: "Төрөл: apartment / office / school ...", en: "Type: apartment / office / school ..." },
  { key: "usage_kwh",     req: false, mn: "Жилийн хэрэглээ (кВт·цаг)",             en: "Annual usage (kWh)" },
  { key: "insulation_quality", req: false, mn: "Тусгаарлалт: good / medium / poor",en: "Insulation: good / medium / poor" },
  { key: "wall_material", req: false, mn: "Хана: panel / brick / concrete / wood", en: "Wall: panel / brick / concrete / wood" },
  { key: "lat",           req: false, mn: "Өргөрөг (latitude)",                    en: "Latitude" },
  { key: "lng",           req: false, mn: "Уртраг (longitude)",                    en: "Longitude" },
];

function normalizeRow(obj, idx) {
  const area = parseFloat(obj.area);
  const name = NAME_KEYS.map(k => obj[k]).find(Boolean) || `Row ${idx + 2}`;
  const errs = [];
  if (!area || isNaN(area) || area < 1) errs.push("area missing/invalid");
  if (obj.year && (parseInt(obj.year) < 1900 || parseInt(obj.year) > 2030)) errs.push("year out of range");
  if (errs.length) return { valid: false, row: idx + 2, name, msg: errs.join(", ") };
  return {
    valid: true,
    record: {
      id:                 `csv_${Date.now()}_${idx}`,
      name,
      area,
      year:               parseInt(obj.year)  || null,
      floors:             parseInt(obj.floors || obj.total_floors) || null,
      district:           obj.district        || "Сүхбаатар",
      type:               obj.type || obj.building_type || "apartment",
      predicted_kwh:      parseFloat(obj.usage_kwh) || null,
      insulation_quality: obj.insulation_quality || "medium",
      wall_material:      obj.wall_material   || "panel",
      window_type:        obj.window_type     || "double",
      heating_type:       obj.heating_type    || "central",
      latitude:           parseFloat(obj.lat  || obj.latitude)  || 47.9184,
      longitude:          parseFloat(obj.lng  || obj.longitude) || 106.9177,
      source:      "user",
      submittedAt: new Date().toISOString(),
    },
  };
}

function parseCSVText(text) {
  // Strip UTF-8 BOM that Excel adds
  const clean = text.replace(/^﻿/, "");
  const lines = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .split("\n").filter(l => l.trim());
  if (lines.length < 2) return { headers: [], valid: [], errors: [{ row: 1, name: "", msg: "Empty file or no data rows" }], totalRows: 0 };
  const delim   = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delim).map(h => h.replace(/^["']|["']$/g, "").toLowerCase().trim());
  const nameKey = NAME_KEYS.find(k => headers.includes(k));
  const valid = [], errors = [];
  lines.slice(1).forEach((line, idx) => {
    if (!line.trim()) return;
    const vals = parseCSVLine(line, delim).map(v => v.replace(/^["']|["']$/g, ""));
    const obj  = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    if (nameKey) obj.building_name = obj[nameKey];
    const r = normalizeRow(obj, idx);
    r.valid ? valid.push(r.record) : errors.push(r);
  });
  return { headers, valid, errors, totalRows: lines.length - 1 };
}

function parseJSONText(text) {
  try {
    let data = JSON.parse(text);
    if (!Array.isArray(data)) data = data.buildings || data.data || data.records || [];
    if (!Array.isArray(data)) return { headers: [], valid: [], errors: [{ row: 0, name: "", msg: "Expected an array of building objects" }], totalRows: 0 };
    const valid = [], errors = [];
    data.forEach((obj, idx) => {
      const r = normalizeRow(obj, idx);
      r.valid ? valid.push(r.record) : errors.push(r);
    });
    return { headers: Object.keys(data[0] || {}), valid, errors, totalRows: data.length };
  } catch (e) {
    return { headers: [], valid: [], errors: [{ row: 0, name: "", msg: "Invalid JSON — " + e.message }], totalRows: 0 };
  }
}

// ─── Time-series detection & aggregation ─────────────────────────────────────
const TS_DATE_PATTERNS  = /date|time|datetime|timestamp/i;
const TS_POWER_PATTERNS = /use_kw|use_kwh|total_kw|heating_kw|electric_kw|kw$|kwh$|power|watt|load|energy|consumption/i;
const TS_ID_PATTERNS    = /building_id|building_name|meter_id|^id$|^name$/i;
const TS_AREA_PATTERNS  = /area_m2|area$|floor_area|gaz/i;
const TS_TEMP_PATTERNS  = /outdoortemp|outdoor_temp|temp$|temperature/i;
const TS_OCC_PATTERNS   = /occupancy|residents|people/i;

function detectTimeSeries(headers) {
  const hasDate  = headers.some(h => TS_DATE_PATTERNS.test(h));
  const hasPower = headers.some(h => TS_POWER_PATTERNS.test(h));
  return hasDate && hasPower;
}

function pickCol(headers, pattern) {
  return headers.findIndex(h => pattern.test(h));
}

function aggregateTimeSeries(text) {
  const clean = text.replace(/^﻿/, "");
  const lines  = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return null;

  const delim   = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delim).map(h => h.trim().toLowerCase());

  const dateIdx    = pickCol(headers, TS_DATE_PATTERNS);
  const useIdx     = pickCol(headers, /use_kw$/i) >= 0 ? pickCol(headers, /use_kw$/i) : pickCol(headers, TS_POWER_PATTERNS);
  const heatingIdx = pickCol(headers, /heating_kw/i);
  const electricIdx= pickCol(headers, /electric_kw/i);
  const areaIdx    = pickCol(headers, TS_AREA_PATTERNS);
  const floorsIdx  = pickCol(headers, /^floors$|^floor_count$/i);
  const idIdx      = pickCol(headers, TS_ID_PATTERNS);
  const districtIdx= pickCol(headers, /^district$|дүүрэг/i);
  const tempIdx    = pickCol(headers, TS_TEMP_PATTERNS);
  const occupIdx   = pickCol(headers, TS_OCC_PATTERNS);

  if (dateIdx < 0 || useIdx < 0) return null;

  // Parse all rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const v = parseCSVLine(lines[i], delim);
    const useVal = parseFloat(v[useIdx]);
    if (isNaN(useVal)) continue;
    rows.push(v);
  }
  if (rows.length === 0) return null;

  // Building metadata from first row
  const r0       = rows[0];
  const buildingId = idIdx >= 0 ? (r0[idIdx] || "Unknown") : "Unknown";
  const area       = areaIdx >= 0 ? (parseFloat(r0[areaIdx]) || null) : null;
  const floors     = floorsIdx >= 0 ? (parseInt(r0[floorsIdx]) || null) : null;
  const district   = districtIdx >= 0 ? (r0[districtIdx] || null) : null;

  // Unique building IDs
  const buildingIds = idIdx >= 0
    ? [...new Set(rows.map(r => r[idIdx]).filter(Boolean))]
    : [buildingId];

  // Accumulate
  let totalUse = 0, totalHeat = 0, totalElec = 0;
  let peakKw   = 0, tempSum = 0, tempN = 0, occSum = 0, occN = 0;
  const monthly = {}, hourly = Array(24).fill(0), hourlyCnt = Array(24).fill(0);
  const dates   = [];

  rows.forEach(r => {
    const u = parseFloat(r[useIdx]) || 0;
    totalUse += u;
    if (u > peakKw) peakKw = u;
    if (heatingIdx >= 0) totalHeat += parseFloat(r[heatingIdx]) || 0;
    if (electricIdx >= 0) totalElec += parseFloat(r[electricIdx]) || 0;
    if (tempIdx >= 0) { const t = parseFloat(r[tempIdx]); if (!isNaN(t)) { tempSum += t; tempN++; } }
    if (occupIdx >= 0) { const o = parseFloat(r[occupIdx]); if (!isNaN(o)) { occSum += o; occN++; } }
    const d = new Date(r[dateIdx]);
    if (!isNaN(d)) {
      dates.push(d);
      const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      monthly[mk] = (monthly[mk] || 0) + u;
      hourly[d.getHours()] += u;
      hourlyCnt[d.getHours()]++;
    }
  });

  const minDate = dates.length ? new Date(Math.min(...dates)) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates)) : null;
  const periodYears = minDate && maxDate
    ? Math.max(0.01, (maxDate - minDate) / (365.25 * 24 * 3600 * 1000))
    : 1;
  const annualKwh = Math.round(totalUse / periodYears);
  const avgKw     = totalUse / rows.length;
  const loadFactor= peakKw > 0 ? avgKw / peakKw : 0;
  const intensity  = area ? Math.round(annualKwh / area) : null;

  const GRADE_THRESHOLDS = [50,100,150,200,250,350];
  const GRADES = "ABCDEFG";
  const grade = intensity === null ? "—"
    : GRADES[GRADE_THRESHOLDS.findIndex(t => intensity < t) >= 0
        ? GRADE_THRESHOLDS.findIndex(t => intensity < t)
        : 6];

  const sortedMonthly = Object.entries(monthly)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([month, kwh]) => ({ month, kwh: Math.round(kwh) }));

  const hourlyAvg = hourly.map((v, i) => hourlyCnt[i] > 0 ? Math.round(v / hourlyCnt[i] * 10) / 10 : 0);

  return {
    buildingIds, buildingId, area, floors, district,
    totalRows: rows.length,
    periodYears: Math.round(periodYears * 10) / 10,
    dateRange: minDate && maxDate
      ? { from: minDate.toISOString().slice(0,10), to: maxDate.toISOString().slice(0,10) }
      : null,
    totalUseKwh:     Math.round(totalUse),
    annualKwh,
    peakKw:          Math.round(peakKw * 10) / 10,
    avgKw:           Math.round(avgKw   * 10) / 10,
    loadFactor:      Math.round(loadFactor * 100),
    totalHeatingKwh: heatingIdx >= 0 ? Math.round(totalHeat) : null,
    totalElectricKwh:electricIdx >= 0 ? Math.round(totalElec) : null,
    avgTemp:         tempN > 0 ? Math.round(tempSum / tempN * 10) / 10 : null,
    avgOccupancy:    occN  > 0 ? Math.round(occSum  / occN) : null,
    intensity, grade,
    monthly: sortedMonthly,
    hourlyAvg,
    detectedCols: {
      date:     headers[dateIdx],
      use:      headers[useIdx],
      heating:  heatingIdx >= 0  ? headers[heatingIdx]  : null,
      electric: electricIdx >= 0 ? headers[electricIdx] : null,
      temp:     tempIdx >= 0     ? headers[tempIdx]     : null,
    },
  };
}

// ─── Parse result badge ───────────────────────────────────────────────────────
function FileParseResult({ result, lang }) {
  if (!result) return null;
  const [showErrors, setShowErrors] = useState(false);
  if (result.parsing) return (
    <div className="fpr fpr-loading">
      <Loader2 size={13} className="fpr-spin" />
      <span>{lang === "mn" ? "Уншиж байна..." : "Parsing..."}</span>
    </div>
  );
  const { valid, errors, totalRows } = result;
  const tone = errors.length === 0 ? "ok" : valid.length > 0 ? "warn" : "err";
  return (
    <div className={`fpr fpr-${tone}`}>
      <div className="fpr-summary">
        {totalRows > 0 && <span className="fpr-total">{totalRows} {lang === "mn" ? "мөр" : "rows"}</span>}
        {valid.length > 0 && (
          <span className="fpr-valid"><CircleCheck size={12}/> {valid.length} {lang === "mn" ? "хүчинтэй барилга" : "valid buildings"}</span>
        )}
        {errors.length > 0 && (
          <button className="fpr-err-toggle" onClick={() => setShowErrors(s => !s)}>
            <CircleX size={12}/> {errors.length} {lang === "mn" ? "алдаа" : "errors"}
            {showErrors ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
          </button>
        )}
      </div>
      {showErrors && (
        <div className="fpr-errors">
          {errors.slice(0, 8).map((e, i) => (
            <div key={i} className="fpr-err-row">
              <span className="fpr-row-num">{lang === "mn" ? `Мөр ${e.row}` : `Row ${e.row}`}</span>
              {e.name && <span className="fpr-row-name">{e.name}</span>}
              <span className="fpr-row-msg">{e.msg}</span>
            </div>
          ))}
          {errors.length > 8 && <div className="fpr-more">+{errors.length - 8} {lang === "mn" ? "алдаа" : "more"}</div>}
        </div>
      )}
    </div>
  );
}

// ─── CSV table preview ────────────────────────────────────────────────────────
function CSVPreviewTable({ content }) {
  const allLines = content.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .split("\n").filter(l => l.trim());
  if (allLines.length < 2) return <p style={{ color: "var(--text3)", padding: "1rem" }}>Өгөгдөл байхгүй / No data</p>;
  const delim   = detectDelimiter(allLines[0]);
  const headers = parseCSVLine(allLines[0], delim);
  const rows    = allLines.slice(1, 11).map(l => parseCSVLine(l, delim));
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ fontSize: "0.78rem", borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "0.4rem 0.65rem", background: "var(--bg3)", border: "1px solid var(--border)", textAlign: "left", whiteSpace: "nowrap", color: "var(--primary-light)", fontWeight: 700 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "var(--card)" : "var(--bg2)" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "0.35rem 0.65rem", border: "1px solid var(--border)", color: "var(--text2)", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {cell || <span style={{ color: "var(--text3)" }}>—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {allLines.length > 11 && (
        <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.5rem", textAlign: "center" }}>
          Эхний 10 мөр · нийт {allLines.length - 1} мөр
        </div>
      )}
    </div>
  );
}

// ─── "Ямар формат зөв вэ?" accordion ─────────────────────────────────────────
function FormatGuideAccordion({ lang }) {
  const [open, setOpen] = useState(false);
  const CSV_EXAMPLE = `building_name,area,year,floors,district,type,usage_kwh
Сансар 15-р байр,2400,1992,9,Чингэлтэй,apartment,38500
Монгол Цахилгаан ХК,3200,2005,8,Сүхбаатар,office,52000`;
  const JSON_EXAMPLE = `[
  {
    "building_name": "Сансар 15-р байр",
    "area": 2400,
    "year": 1992,
    "district": "Чингэлтэй",
    "type": "apartment"
  }
]`;
  return (
    <div className="fmt-guide-accordion card">
      <button className="fga-toggle" onClick={() => setOpen(o => !o)}>
        <Info size={14} style={{ color: "#3a8fd4" }} />
        <span>{lang === "mn" ? "Ямар формат зөв вэ?" : "What format is accepted?"}</span>
        {open ? <ChevronDown size={15} style={{ marginLeft: "auto" }} /> : <ChevronRight size={15} style={{ marginLeft: "auto" }} />}
      </button>

      {open && (
        <div className="fga-body animate-fade">
          {/* Column spec */}
          <div className="fga-section-label">
            {lang === "mn" ? "CSV / Excel баганы жагсаалт" : "CSV / Excel column list"}
          </div>
          <div className="fga-col-list">
            {COL_SPEC.map(c => (
              <div key={c.key} className="fga-col-row">
                <code className="fga-col-key">{c.key}</code>
                <span className={`fga-req-badge ${c.req ? "req" : "opt"}`}>
                  {c.req ? (lang === "mn" ? "Заавал" : "Required") : (lang === "mn" ? "Сонголт" : "Optional")}
                </span>
                <span className="fga-col-desc">{lang === "mn" ? c.mn : c.en}</span>
              </div>
            ))}
          </div>

          {/* CSV example */}
          <div className="fga-section-label" style={{ marginTop: "1rem" }}>
            {lang === "mn" ? "CSV жишээ" : "CSV example"}
          </div>
          <pre className="fga-code">{CSV_EXAMPLE}</pre>

          {/* JSON example */}
          <div className="fga-section-label">
            {lang === "mn" ? "JSON жишээ" : "JSON example"}
          </div>
          <pre className="fga-code">{JSON_EXAMPLE}</pre>

          {/* Rules */}
          <ul className="fga-rules">
            <li>{lang === "mn" ? "CSV-д эхний мөр нь гарчиг байна (header row)" : "CSV first row must be the header row"}</li>
            <li>{lang === "mn" ? "JSON нь array эсвэл {buildings: [...]} бүтэцтэй байна" : "JSON must be an array or {buildings: [...]} object"}</li>
            <li>{lang === "mn" ? "area заавал байна; байхгүй бол тэр мөр алгасагдана" : "area is required; rows without it are skipped"}</li>
            <li>{lang === "mn" ? "Тэмдэгт кодлол: UTF-8 (BOM байсан ч зөв ажиллана)" : "Encoding: UTF-8 (BOM is handled automatically)"}</li>
          </ul>

          {/* Template download */}
          <button className="fga-dl-btn" onClick={() => {
            const csv = "building_name,area,year,floors,district,type,usage_kwh,insulation_quality,wall_material\nЖишээ байр,1200,1995,9,Сүхбаатар,apartment,38500,medium,panel\n";
            const b = new Blob(["\uFEFF" + csv], { type: "text/csv" });
            const u = URL.createObjectURL(b);
            const a = document.createElement("a"); a.href = u; a.download = "ubenergy_template.csv"; a.click();
          }}>
            <FileSpreadsheet size={14} />
            {lang === "mn" ? "template.csv татах" : "Download template.csv"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Supported file types ─────────────────────────────────────────────────────
const ACCEPTED_TYPES = {
  "text/csv": { label: "CSV", icon: FileSpreadsheet, color: "#2a9d8f" },
  "application/vnd.ms-excel": { label: "Excel", icon: FileSpreadsheet, color: "#2a9d8f" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { label: "Excel", icon: FileSpreadsheet, color: "#2a9d8f" },
  "application/json": { label: "JSON", icon: FileText, color: "#3a8fd4" },
  "application/pdf": { label: "PDF", icon: FileText, color: "#e63946" },
  "application/msword": { label: "Word", icon: FileText, color: "#1a6eb5" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "Word", icon: FileText, color: "#1a6eb5" },
  "application/zip": { label: "ZIP", icon: File, color: "#f4a261" },
  "application/x-zip-compressed": { label: "ZIP", icon: File, color: "#f4a261" },
};

const ACCEPT_STR = ".csv,.xls,.xlsx,.json,.pdf,.doc,.docx,.zip";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileItem({ file, t, onRemove, onPreview }) {
  const info = ACCEPTED_TYPES[file.type] || { label: file.name.split(".").pop().toUpperCase(), icon: File, color: "#a8c5e0" };
  const Icon = info.icon;
  return (
    <div className="file-item">
      <div className="fi-icon" style={{ background: `${info.color}22`, color: info.color }}>
        <Icon size={20} />
      </div>
      <div className="fi-info">
        <span className="fi-name">{file.name}</span>
        <span className="fi-meta">{info.label} · {formatSize(file.size)}</span>
      </div>
      <div className="fi-actions">
        {(file.type === "application/pdf" || file.type === "text/csv" || file.type === "application/json") && (
          <button className="fi-btn" onClick={() => onPreview(file)} title={t.dataInput.preview} aria-label={t.dataInput.preview}>
            <Eye size={14} />
          </button>
        )}
        <button className="fi-btn danger" onClick={() => onRemove(file.name)} title={t.dataInput.delete_file} aria-label={t.dataInput.delete_file}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Section header helper ────────────────────────────────────────────────────
function FormSection({ icon: Icon, title, color, children }) {
  return (
    <div className="form-section">
      <div className="form-section-header" style={{ borderColor: color }}>
        {Icon && <Icon size={15} style={{ color, flexShrink: 0 }} />}
        <span className="form-section-title" style={{ color }}>{title}</span>
      </div>
      <div className="grid grid-2">{children}</div>
    </div>
  );
}

// ─── Type-specific dynamic section ───────────────────────────────────────────
function TypeSpecificSection({ type, form, onChange, lang }) {
  const schema = TYPE_SCHEMA[type];
  if (!schema) return null;
  const derived = schema.derive(form);

  return (
    <div className="type-specific-section animate-fade">
      {/* Type banner */}
      <div className="type-banner" style={{ borderColor: schema.color, background: `${schema.color}0d` }}>
        <div>
          <div className="type-banner-name" style={{ color: schema.color }}>
            {lang === "mn" ? schema.desc.mn : schema.desc.en}
          </div>
          <div className="type-derived-info">
            <span>{lang === "mn" ? "Тооцоологдсон:" : "Derived:"}</span>
            <strong style={{ color: schema.color }}>{lang === "mn" ? derived.info_mn : derived.info_en}</strong>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="type-fields-grid">
        {schema.fields.map(field => (
          field.type === "check" ? (
            <label key={field.key} className="type-check-label">
              <input
                type="checkbox"
                name={field.key}
                checked={!!form[field.key]}
                onChange={onChange}
                className="type-checkbox"
              />
              <span className="type-check-text">{lang === "mn" ? field.label.mn : field.label.en}</span>
            </label>
          ) : (
            <div key={field.key} className="form-group">
              <label className="form-label" htmlFor={`di-${field.key}`}>
                {lang === "mn" ? field.label.mn : field.label.en}
              </label>
              <input
                id={`di-${field.key}`}
                type="number"
                name={field.key}
                value={form[field.key] ?? field.default}
                onChange={onChange}
                className="form-input"
                min={field.min}
                max={field.max}
                placeholder={String(field.default)}
              />
              {field.hint && (
                <div className="type-field-hint">{lang === "mn" ? field.hint.mn : field.hint.en}</div>
              )}
            </div>
          )
        ))}
      </div>

      {/* Derived values chip row */}
      <div className="type-derived-chips">
        <span className="type-chip">
          <span className="type-chip-label">{lang === "mn" ? "Өрөөний тоо" : "Rooms"}</span>
          <strong>{derived.rooms}</strong>
        </span>
        <span className="type-chip">
          <span className="type-chip-label">{lang === "mn" ? "Хүн" : "People"}</span>
          <strong>{derived.residents}</strong>
        </span>
        <span className="type-chip">
          <span className="type-chip-label">{lang === "mn" ? "Техник (ML)" : "Appliances (ML)"}</span>
          <strong>{derived.appliances}</strong>
        </span>
      </div>
    </div>
  );
}

// ─── Bill results display ─────────────────────────────────────────────────────
function BillResults({ elecBill, heatBill, lang }) {
  const ec = parseFloat(elecBill) > 0 ? convertElecMoneyToKwh(parseFloat(elecBill)) : null;
  const hc = parseFloat(heatBill) > 0 ? convertHeatBillToEstimates(parseFloat(heatBill)) : null;
  if (!ec && !hc) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", marginTop: "0.75rem" }}>
      {ec && (<>
        <div style={{ background: "rgba(26,110,181,0.09)", border: "1px solid rgba(26,110,181,0.28)", borderRadius: 10, padding: "0.85rem" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1a6eb5" }}>{ec.kwh_monthly.toLocaleString()} кВт·цаг</div>
          <div style={{ fontSize: "0.71rem", color: "var(--text3)", marginTop: 3 }}>{lang === "mn" ? "Сарын цахилгааны хэрэглээ" : "Monthly electricity use"}</div>
          <div style={{ fontSize: "0.69rem", color: "var(--text3)", marginTop: 4, padding: "0.18rem 0.45rem", background: "rgba(26,110,181,0.12)", borderRadius: 6, display: "inline-block" }}>
            {lang === "mn" ? `${ec.effective_rate}₮/кВт·цаг · шат ${ec.tier}` : `${ec.effective_rate}₮/kWh · tier ${ec.tier}`}
          </div>
        </div>
        <div style={{ background: "rgba(58,143,212,0.09)", border: "1px solid rgba(58,143,212,0.28)", borderRadius: 10, padding: "0.85rem" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#3a8fd4" }}>{ec.kwh_annual.toLocaleString()} кВт·цаг</div>
          <div style={{ fontSize: "0.71rem", color: "var(--text3)", marginTop: 3 }}>{lang === "mn" ? "Жилийн тооцоолол" : "Annual estimate"}</div>
          <div style={{ fontSize: "0.69rem", color: "var(--text3)", marginTop: 4 }}>{lang === "mn" ? "× 12 сар" : "× 12 months"}</div>
        </div>
      </>)}
      {hc && (<>
        <div style={{ background: "rgba(244,162,97,0.09)", border: "1px solid rgba(244,162,97,0.28)", borderRadius: 10, padding: "0.85rem" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f4a261" }}>{hc.heat_gcal_monthly} Гкал</div>
          <div style={{ fontSize: "0.71rem", color: "var(--text3)", marginTop: 3 }}>{lang === "mn" ? "Сарын дулаан" : "Monthly heating"}</div>
          <div style={{ fontSize: "0.69rem", color: "var(--text3)", marginTop: 4 }}>≈ {hc.heat_gcal_annual} Гкал/{lang === "mn" ? "жил" : "yr"}</div>
        </div>
        <div style={{ background: "rgba(42,157,143,0.09)", border: "1px solid rgba(42,157,143,0.28)", borderRadius: 10, padding: "0.85rem" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#2a9d8f" }}>{hc.water_m3_monthly} м³</div>
          <div style={{ fontSize: "0.71rem", color: "var(--text3)", marginTop: 3 }}>{lang === "mn" ? "Сарын ус" : "Monthly water"}</div>
          <div style={{ fontSize: "0.69rem", color: "var(--text3)", marginTop: 4 }}>≈ {hc.water_m3_annual} м³/{lang === "mn" ? "жил" : "yr"}</div>
        </div>
      </>)}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DataInputPage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.dataInput);
  const { user } = useAuth();
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("manual");
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [link, setLink] = useState("");
  const [links, setLinks] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [elecBill, setElecBill] = useState("");
  const [heatBill, setHeatBill] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [parseResults, setParseResults] = useState({}); // keyed by file.name
  const [csvText, setCsvText] = useState("");
  const [pasteResult, setPasteResult] = useState(null);
  const [tsResult, setTsResult] = useState(null);

  const handleCsvInput = (val) => {
    setCsvText(val);
    const trimmed = val.trim();
    if (!trimmed) { setPasteResult(null); setTsResult(null); return; }
    const firstLine = trimmed.split("\n")[0];
    const headers   = parseCSVLine(firstLine, detectDelimiter(firstLine)).map(h => h.trim().toLowerCase());
    if (detectTimeSeries(headers)) {
      setTsResult(aggregateTimeSeries(trimmed));
      setPasteResult(null);
    } else {
      setPasteResult(parseCSVText(trimmed));
      setTsResult(null);
    }
  };

  // form state must be declared BEFORE any hooks that reference it
  const [form, setForm] = useState({
    building_name: "",
    address: "",
    district: "Сүхбаатар",
    year: "",
    total_floors: "",
    building_type: "apartment",
    area: "",
    rooms: "",
    window_type: "double",
    door_type: "metal",
    heating_type: "central",
    insulation_quality: "medium",
    wall_material: "panel",
    latitude: "47.9184",
    longitude: "106.9177",
    // ── Apartment ──
    units_per_floor: 4,
    avg_rooms_per_unit: 2,
    has_elevator: false,
    has_basement: false,
    // ── Office ──
    employees: 50,
    computers: 40,
    working_hours: 8,
    has_server: false,
    // ── School ──
    classrooms: 20,
    students: 600,
    school_staff: 50,
    has_gym: false,
    has_cafeteria: false,
    // ── Hospital ──
    beds: 80,
    departments: 8,
    has_icu: false,
    is_24h: false,
    // ── Commercial ──
    shops: 15,
    commercial_hours: 12,
    has_escalator: false,
    has_cold_storage: false,
    // ── Warehouse ──
    ceiling_height: 8,
    operating_hours: 10,
    has_cooling: false,
    has_loading_dock: false,
  });

  // Live ML preview — uses type-specific derived occupancy when available
  const livePreview = React.useMemo(() => {
    const area = parseFloat(form.area);
    if (!area || area < 10) return null;
    const type = form.building_type || "apartment";
    const schema = TYPE_SCHEMA[type];
    const derived = schema ? schema.derive(form) : null;
    const mlInput = {
      building_type: type,
      area,
      year:   Math.max(1940, Math.min(2026, parseInt(form.year) || 1990)),
      floors: Math.max(1, parseInt(form.total_floors) || 3),
      rooms:  derived?.rooms  ?? (parseInt(form.rooms) || Math.max(1, Math.round(area / 50))),
      hdd:    4500,
      window_ratio: 25,
      residents:  derived?.residents  ?? Math.max(1, Math.round(area / 100 * 4)),
      appliances: derived?.appliances ?? Math.min(50, Math.max(2, Math.round(area / 100 * 6))),
      wall_material:      form.wall_material      || "panel",
      heating_type:       form.heating_type       || "central",
      insulation_quality: form.insulation_quality || "medium",
      window_type:        form.window_type        || "double",
    };
    try { return predict(mlInput); } catch { return null; }
  }, [form]);

  const qualityScore = computeQualityScore(form, elecBill, heatBill);

  // Close file preview on Escape
  useEffect(() => {
    if (!previewFile) return;
    const handler = (e) => { if (e.key === "Escape") setPreviewFile(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [previewFile]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter(f => {
      const ext = f.name.split(".").pop().toLowerCase();
      return ["csv","xls","xlsx","json","pdf","doc","docx","zip"].includes(ext);
    });
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
    // Auto-parse CSV and JSON
    valid.forEach(f => {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!["csv","json"].includes(ext)) return;
      setParseResults(prev => ({ ...prev, [f.name]: { parsing: true } }));
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const result = ext === "csv" ? parseCSVText(text) : parseJSONText(text);
        setParseResults(prev => ({ ...prev, [f.name]: result }));
      };
      reader.onerror = () => {
        setParseResults(prev => ({ ...prev, [f.name]: { valid: [], errors: [{ row: 0, name: "", msg: "Could not read file" }], totalRows: 0 } }));
      };
      reader.readAsText(f, "UTF-8");
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (name) => setFiles(prev => prev.filter(f => f.name !== name));

  const addLink = () => {
    const l = link.trim();
    if (!l || links.includes(l)) return;
    setLinks(prev => [...prev, l]);
    setLink("");
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    // Validate
    const errors = {};
    if (!form.building_name.trim()) errors.building_name = lang === "mn" ? "Нэр оруулна уу" : "Name required";
    const area = parseFloat(form.area);
    if (!area || area < 10) errors.area = lang === "mn" ? "10 м²-аас их байх ёстой" : "Must be at least 10 m²";
    const yr = parseInt(form.year);
    if (form.year && (yr < 1940 || yr > 2026)) errors.year = lang === "mn" ? "1940–2026 байх ёстой" : "Must be 1940–2026";
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});

    // Build record — normalizeBuilding in buildingStorage will run ML
    const elecConverted = parseFloat(elecBill) > 0 ? convertElecMoneyToKwh(parseFloat(elecBill)) : null;
    const monthly_usage = elecConverted ? elecConverted.kwh_monthly : null;
    const schema  = TYPE_SCHEMA[form.building_type];
    const derived = schema ? schema.derive(form) : {};
    const record = {
      id:           `user_${Date.now()}`,
      name:         form.building_name || t.dataInput.unnamed_building,
      type:         form.building_type,
      area,
      floors:       parseInt(form.total_floors) || 3,
      year:         parseInt(form.year) || new Date().getFullYear(),
      district:     form.district,
      monthly_usage,
      rooms:        derived.rooms    ?? parseInt(form.rooms) ?? null,
      residents:    derived.residents ?? null,
      appliances:   derived.appliances ?? null,
      window_type:  form.window_type,
      door_type:    form.door_type,
      heating_type: form.heating_type,
      insulation_quality: form.insulation_quality,
      wall_material: form.wall_material,
      latitude:     parseFloat(form.latitude),
      longitude:    parseFloat(form.longitude),
      source:       "user",
      userId:       user?.id || null,
      submittedAt:  new Date().toISOString(),
      // Type-specific extras
      type_details: Object.fromEntries(
        (schema?.fields || []).map(f => [f.key, form[f.key] ?? f.default])
      ),
    };
    saveUserBuilding(record);
    setSubmitted(true);
    setElecBill(""); setHeatBill("");
    setTimeout(() => setSubmitted(false), 5000);
    setForm(f => ({
      ...f,
      building_name: "", address: "", year: "", total_floors: "", area: "", rooms: "",
    }));
  };

  const handleFileSubmit = () => {
    if (files.length === 0 && links.length === 0) return;
    // Import all valid parsed buildings
    let count = 0;
    Object.values(parseResults).forEach(r => {
      if (!r || r.parsing || !r.valid) return;
      r.valid.forEach(record => {
        saveUserBuilding({ ...record, userId: user?.id || null });
        count++;
      });
    });
    setSubmitCount(count);
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setFiles([]); setLinks([]); setParseResults({}); }, 5000);
  };

  const TABS = [
    { id: "manual", label: t.dataInput.tab_manual, icon: Building2  },
    { id: "file",   label: t.dataInput.tab_file,   icon: CloudUpload },
    { id: "link",   label: t.dataInput.tab_link,   icon: Link2       },
  ];

  return (
    <div className="data-input-page">
      <div className="container">
        <div className="page-header">
          <h1><Upload size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.dataInput.title}</h1>
          <p>{t.dataInput.subtitle}</p>
        </div>

        {/* Тарифын тайлбар */}
        <div className="card tariff-note mb-3" style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start", background: "var(--card)", border: "1px solid var(--border)", borderLeft: "4px solid #3a8fd4", borderRadius: 10, padding: "1rem 1.2rem" }}>
          <Info size={18} style={{ color: "#3a8fd4", flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ display: "block", color: "var(--text)", marginBottom: "0.5rem", fontSize: "0.95rem" }}>
              {t.dataInput.tariff_note_title}
            </strong>
            <p style={{ margin: "0 0 0.55rem", color: "var(--text2)", fontSize: "0.875rem", lineHeight: 1.65 }}>
              {t.dataInput.tariff_note_p1}
            </p>
            <p style={{ margin: 0, color: "var(--text2)", fontSize: "0.875rem", lineHeight: 1.65 }}>
              {t.dataInput.tariff_note_p2}
            </p>
          </div>
        </div>

        {submitted && (
          <div className="success-banner animate-fade" role="status" aria-live="polite">
            <CheckCircle size={20} />
            <span>
              {submitCount > 0
                ? (lang === "mn" ? `${submitCount} барилга амжилттай импортлогдлоо!` : `${submitCount} buildings imported successfully!`)
                : t.dataInput.success_msg}
            </span>
            <button className="success-db-btn" onClick={() => navigate("/database")}>
              {t.dataInput.view_in_database}
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="di-tabs mb-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`di-tab ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        {/* ── Manual tab ── */}
        {activeTab === "manual" && (
          <div className="input-layout animate-fade">
            <form onSubmit={handleManualSubmit} className="card input-form">

              {/* Байршил ба бүтэц */}
              <FormSection
                icon={Building2}
                title={t.dataInput.section_loc_struct}
                color="#3a8fd4"
              >
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" htmlFor="di-building_name">{t.dataInput.building_name} *</label>
                  <input id="di-building_name" name="building_name" value={form.building_name} onChange={handleChange}
                    className={`form-input${formErrors.building_name ? " input-error" : ""}`} required placeholder={t.dataInput.name_placeholder} />
                  {formErrors.building_name && <div className="field-error">{formErrors.building_name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-address">{t.dataInput.address}</label>
                  <input id="di-address" name="address" value={form.address} onChange={handleChange}
                    className="form-input" placeholder={t.dataInput.address_placeholder} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-district">{t.dataInput.district}</label>
                  <select id="di-district" name="district" value={form.district} onChange={handleChange} className="form-select">
                    {ulaanbaatarDistricts.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-year">{lang === "mn" ? "Баригдсан огноо" : "Year Built"}</label>
                  <input id="di-year" name="year" type="number" value={form.year} onChange={handleChange}
                    className={`form-input${formErrors.year ? " input-error" : ""}`} placeholder="1950–2026" min={1950} max={2026} />
                  {formErrors.year && <div className="field-error">{formErrors.year}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-total_floors">{t.dataInput.total_floors}</label>
                  <input id="di-total_floors" name="total_floors" type="number" value={form.total_floors} onChange={handleChange}
                    className="form-input" placeholder="18" min={1} max={60} />
                </div>
              </FormSection>

              {/* 📐 Барилгын мэдээлэл */}
              <div className="form-section">
                <div className="form-section-header" style={{ borderColor: "#9b72cf" }}>
                  <Layers size={15} style={{ color: "#9b72cf", flexShrink: 0 }} />
                  <span className="form-section-title" style={{ color: "#9b72cf" }}>
                    {lang === "mn" ? "Барилгын мэдээлэл" : "Building Details"}
                  </span>
                </div>
                {/* Type selector + area always visible */}
                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="di-building_type">{t.predictor.building_type}</label>
                    <select id="di-building_type" name="building_type" value={form.building_type} onChange={handleChange} className="form-select type-select">
                      {Object.entries(t.predictor.building_types).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="di-area">{t.predictor.area} *</label>
                    <input id="di-area" name="area" type="number" value={form.area} onChange={handleChange}
                      className={`form-input${formErrors.area ? " input-error" : ""}`} placeholder="м²" min={10} required />
                    {formErrors.area && <div className="field-error">{formErrors.area}</div>}
                  </div>
                </div>
                {/* Dynamic type-specific fields */}
                <TypeSpecificSection
                  type={form.building_type}
                  form={form}
                  onChange={handleChange}
                  lang={lang}
                />
              </div>

              {/* 🪟 Дулаан алдагдал */}
              <FormSection
                icon={Wind}
                title={t.dataInput.section_heat_loss}
                color="#e9c46a"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="di-window_type">{t.predictor.window_type}</label>
                  <select id="di-window_type" name="window_type" value={form.window_type} onChange={handleChange} className="form-select">
                    <option value="single">{t.dataInput.glazing_single}</option>
                    <option value="double">{t.dataInput.glazing_double}</option>
                    <option value="triple">{t.dataInput.glazing_triple}</option>
                  </select>
                </div>

              </FormSection>

              {/* 🔥 Халаалт */}
              <FormSection
                icon={Flame}
                title={t.dataInput.section_heating}
                color="#f4a261"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="di-heating_type">{t.predictor.heating_type}</label>
                  <select id="di-heating_type" name="heating_type" value={form.heating_type} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.heating_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-insulation_quality">{t.predictor.insulation_quality}</label>
                  <select id="di-insulation_quality" name="insulation_quality" value={form.insulation_quality} onChange={handleChange} className="form-select">
                    <option value="good">{t.dataInput.insul_good}</option>
                    <option value="medium">{t.dataInput.insul_medium}</option>
                    <option value="poor">{t.dataInput.insul_poor}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-wall_material">{t.predictor.wall_material}</label>
                  <select id="di-wall_material" name="wall_material" value={form.wall_material} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.wall_materials).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </FormSection>

              {/* Сарын төлбөрөөс тооцоолох */}
              <div className="form-section form-section-output">
                <div className="form-section-header" style={{ borderColor: "#2a9d8f" }}>
                  <Target size={15} style={{ color: "#2a9d8f", flexShrink: 0 }} />
                  <span className="form-section-title" style={{ color: "#2a9d8f" }}>
                    {lang === "mn" ? "Сарын төлбөрөөс тооцоолох" : "Estimate from monthly bills"}
                  </span>
                  <CheckCircle size={15} style={{ color: "#2a9d8f", marginLeft: "auto" }} />
                </div>
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

                {/* Live results */}
                {(parseFloat(elecBill) > 0 || parseFloat(heatBill) > 0) && <BillResults elecBill={elecBill} heatBill={heatBill} lang={lang} />}

                {/* Formula explanation */}
                <div style={{ marginTop: "1rem", padding: "0.9rem 1rem", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, fontSize: "0.78rem", lineHeight: 1.8, color: "var(--text2)" }}>
                  <strong style={{ display: "block", marginBottom: "0.4rem", color: "var(--text)" }}>
                    {lang === "mn" ? "Томьёо — хэрхэн тооцоолсон?" : "How are these calculated?"}
                  </strong>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <div>
                      <span style={{ color: "#1a6eb5", fontWeight: 700 }}>{lang === "mn" ? "Цахилгаан (шаталсан тариф):" : "Electricity (tiered tariff):"}</span>
                      <div style={{ fontFamily: "monospace", fontSize: "0.75rem", marginTop: 2, color: "var(--text3)" }}>
                        {lang === "mn"
                          ? "0–150 кВт·цаг → 140₮/кВт·цаг (шат 1)"
                          : "0–150 kWh → 140₮/kWh (tier 1)"}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text3)" }}>
                        {lang === "mn"
                          ? "151–250 кВт·цаг → 180₮/кВт·цаг (шат 2)"
                          : "151–250 kWh → 180₮/kWh (tier 2)"}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text3)" }}>
                        {lang === "mn"
                          ? "251+ кВт·цаг → 280₮/кВт·цаг (шат 3)"
                          : "251+ kWh → 280₮/kWh (tier 3)"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>
                        {lang === "mn"
                          ? "Урвуу тооцоолол: кВт·цаг = Мөнгө ÷ тариф (шаталсан)"
                          : "Inverse calc: kWh = Bill ÷ rate (tiered)"}
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
                      <span style={{ color: "#f4a261", fontWeight: 700 }}>{lang === "mn" ? "Дулаан (УБ ДС ТӨХК):" : "Heating (UB DHN ТӨХК):"}</span>
                      <div style={{ fontFamily: "monospace", fontSize: "0.75rem", marginTop: 2, color: "var(--text3)" }}>
                        {lang === "mn"
                          ? "Дулаан (Гкал) = Мөнгө × 72% ÷ 160,000₮/Гкал"
                          : "Heating (Gcal) = Bill × 72% ÷ 160,000₮/Gcal"}
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
                      <span style={{ color: "#2a9d8f", fontWeight: 700 }}>{lang === "mn" ? "Ус (УСУГ):" : "Water (УСУГ):"}</span>
                      <div style={{ fontFamily: "monospace", fontSize: "0.75rem", marginTop: 2, color: "var(--text3)" }}>
                        {lang === "mn"
                          ? "Ус (м³) = Мөнгө × 28% ÷ 2,100₮/м³"
                          : "Water (m³) = Bill × 28% ÷ 2,100₮/m³"}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: "0.6rem", fontSize: "0.7rem", color: "var(--text3)", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
                    {lang === "mn"
                      ? "Эх сурвалж: УБЦТС ТӨХК тарифын журам 2024 (цахилгаан) · Улаанбаатар Дулааны Сүлжээ ТӨХК 2024 (дулаан) · УСУГ норматив 2024 (ус)"
                      : "Sources: УБЦТС ТӨХК Tariff Schedule 2024 (electricity) · Ulaanbaatar Heating Network ТӨХК 2024 (heating) · УСУГ norm 2024 (water)"}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="form-section">
                <div className="form-section-header" style={{ borderColor: "#3a8fd4" }}>
                  <MapPin size={14} style={{ color: "#3a8fd4" }} />
                  <span className="form-section-title" style={{ color: "#3a8fd4" }}>
                    {t.dataInput.section_location}
                  </span>
                </div>
                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="di-latitude">{t.dataInput.latitude}</label>
                    <input id="di-latitude" name="latitude" value={form.latitude} onChange={handleChange}
                      className="form-input" placeholder="47.9184" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="di-longitude">{t.dataInput.longitude}</label>
                    <input id="di-longitude" name="longitude" value={form.longitude} onChange={handleChange}
                      className="form-input" placeholder="106.9177" />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary submit-btn mt-2">
                <Upload size={18} />
                {t.dataInput.submit_btn}
              </button>
            </form>

            {/* Guide sidebar */}
            <div className="input-guide card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Quality score */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h3 className="section-title" style={{ fontSize: "0.95rem", marginBottom: 0 }}>
                    {lang === "mn" ? "Өгөгдлийн чанар" : "Data Quality"}
                  </h3>
                  <span style={{
                    fontWeight: 800, fontSize: "1.1rem",
                    color: qualityScore >= 70 ? "#2a9d8f" : qualityScore >= 40 ? "#f4a261" : "#e63946",
                  }}>{qualityScore}%</span>
                </div>
                <div style={{ height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: `${qualityScore}%`,
                    background: qualityScore >= 70 ? "#2a9d8f" : qualityScore >= 40 ? "#f4a261" : "#e63946",
                    transition: "width 0.4s ease, background 0.4s ease",
                  }} />
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.4rem" }}>
                  {lang === "mn"
                    ? qualityScore >= 70 ? "Сайн — ML загвар нарийн тооцоолно"
                      : qualityScore >= 40 ? "Дундаж — илүү мэдээлэл нэмнэ үү"
                      : "Хангалтгүй — талбай ба барилгын мэдээлэл шаардлагатай"
                    : qualityScore >= 70 ? "Good — ML model will predict accurately"
                      : qualityScore >= 40 ? "Fair — add more details for better accuracy"
                      : "Low — area and building info required"}
                </div>
              </div>

              {/* Live ML preview */}
              {livePreview ? (
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text2)", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Zap size={13} style={{ color: "#e9c46a" }} />
                    {lang === "mn" ? "Урьдчилсан ML тооцоолол" : "Live ML Preview"}
                  </div>
                  <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "0.85rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                    <div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#3a8fd4" }}>{livePreview.annual.toLocaleString()}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>kWh/{lang === "mn" ? "жил" : "yr"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#9b72cf" }}>{livePreview.monthly_avg.toLocaleString()}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>kWh/{lang === "mn" ? "сар" : "mo"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: GRADE_COLORS[livePreview.grade] }}>{livePreview.grade}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>{lang === "mn" ? "Зэрэглэл" : "Grade"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: GRADE_COLORS[livePreview.grade] }}>{livePreview.intensity}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>kWh/m²</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: "0.4rem" }}>
                    CO₂: {livePreview.co2} t · PM2.5: {livePreview.pm25.toLocaleString()} μg
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--text3)", padding: "0.75rem", background: "var(--bg2)", borderRadius: 8, textAlign: "center" }}>
                  {lang === "mn" ? "Талбай оруулсны дараа ML тооцоолол харагдана" : "Enter area to see live ML prediction"}
                </div>
              )}

              <div>
                <h3 className="section-title" style={{ fontSize: "0.95rem" }}>{t.dataInput.guide_title}</h3>
                <ul className="guide-list">
                  <li>{t.dataInput.guide_1}</li>
                  <li>{t.dataInput.guide_2}</li>
                  <li>{t.dataInput.guide_3}</li>
                  <li>{t.dataInput.guide_4}</li>
                  <li>{t.dataInput.guide_5}</li>
                  <li>{t.dataInput.guide_6}</li>
                </ul>
                <div className="guide-note">
                  <strong>{t.dataInput.guide_note_title}</strong><br />
                  {t.dataInput.guide_note_text}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── File upload tab ── */}
        {activeTab === "file" && (
          <div className="animate-fade">

            {/* Input section: file picker + paste */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                <div>
                  <div className="form-section-header" style={{ borderColor: "#3a8fd4", marginBottom: "0.6rem" }}>
                    <CloudUpload size={14} style={{ color: "#3a8fd4" }} />
                    <span className="form-section-title" style={{ color: "#3a8fd4" }}>
                      {lang === "mn" ? "Файл сонгох" : "Upload file"}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.79rem", color: "var(--text2)", marginBottom: "0.6rem", lineHeight: 1.55 }}>
                    {lang === "mn"
                      ? "CSV файл — нэг барилгын бүртгэл болон цаг цувааны (time-series) дата хоёуланг дэмжинэ."
                      : "CSV file — supports both building registry rows and time-series (hourly/daily) data."}
                  </p>
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    className="csv-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const raw = (ev.target.result || "").replace(/^﻿/, "");
                        handleCsvInput(raw);
                      };
                      reader.onerror = () => setPasteResult({ valid: [], errors: [{ row: 0, name: "", msg: "File could not be read" }], totalRows: 0 });
                      reader.readAsText(file, "UTF-8");
                    }}
                  />
                </div>
                <div>
                  <div className="form-section-header" style={{ borderColor: "#2a9d8f", marginBottom: "0.6rem" }}>
                    <FileSpreadsheet size={14} style={{ color: "#2a9d8f" }} />
                    <span className="form-section-title" style={{ color: "#2a9d8f" }}>
                      {lang === "mn" ? "Эсвэл CSV буулгах" : "Or paste CSV"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                    <span className="fmt-badge">Ctrl+C → Ctrl+V</span>
                    <span className="fmt-badge">time-series ✓</span>
                    <span className="fmt-badge">building list ✓</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: "0.79rem", color: "var(--text2)", lineHeight: 1.55, margin: 0 }}>
                      {lang === "mn"
                        ? "DateTime + Use_kW баганатай бол цаг цуваа гэж автоматаар таньна."
                        : "Auto-detected as time-series when DateTime + power columns are present."}
                    </p>
                    {csvText && (
                      <button className="fi-btn danger" style={{ width: "auto", padding: "0.2rem 0.55rem", flexShrink: 0, marginLeft: "0.5rem" }}
                        onClick={() => { setCsvText(""); setPasteResult(null); setTsResult(null); }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Shared textarea */}
              <textarea
                className="csv-paste-area"
                style={{ marginTop: "1rem" }}
                value={csvText}
                onChange={(e) => handleCsvInput(e.target.value)}
                placeholder={lang === "mn"
                  ? "Файл сонгох эсвэл энд CSV буулгах...\n\nЖишээ (барилгын бүртгэл):\nbuilding_name,area,year,floors,district,type\nСансар 15-р байр,2400,1992,9,Чингэлтэй,apartment\n\nЖишээ (цаг цуваа):\nDateTime,Use_kW,Heating_kW,Electric_kW\n2024-01-01 00:00,179.84,125.89,53.95"
                  : "Upload a file or paste CSV here...\n\nBuilding list example:\nbuilding_name,area,year,floors,district,type\nCenter Tower,3200,2005,8,Sukhbaatar,office\n\nTime-series example:\nDateTime,Use_kW,Heating_kW,Electric_kW\n2024-01-01 00:00,179.84,125.89,53.95"}
                rows={6}
                spellCheck={false}
              />
            </div>

            {/* ── TIME-SERIES ANALYSIS ── */}
            {tsResult && (
              <div className="ts-analysis animate-fade">

                {/* Detection banner */}
                <div className="ts-banner">
                  <Zap size={16} style={{ color: "#e9c46a", flexShrink: 0 }} />
                  <div>
                    <strong>{lang === "mn" ? "Цаг цувааны дата илрүүлсэн" : "Time-series data detected"}</strong>
                    <span className="ts-banner-meta">
                      {tsResult.totalRows.toLocaleString()} {lang === "mn" ? "мөр" : "rows"} ·{" "}
                      {tsResult.buildingIds.join(", ")} ·{" "}
                      {tsResult.dateRange ? `${tsResult.dateRange.from} → ${tsResult.dateRange.to}` : ""}
                    </span>
                  </div>
                  <div className="ts-banner-cols">
                    {Object.entries(tsResult.detectedCols).filter(([,v]) => v).map(([k, v]) => (
                      <code key={k} className="ts-col-chip">{v}</code>
                    ))}
                  </div>
                </div>

                {/* Key metric cards */}
                <div className="ts-metrics">
                  <div className="ts-metric-card">
                    <div className="ts-metric-val" style={{ color: "#3a8fd4" }}>{tsResult.annualKwh.toLocaleString()}</div>
                    <div className="ts-metric-label">kWh/{lang === "mn" ? "жил" : "yr"} (est.)</div>
                    <div className="ts-metric-sub">{lang === "mn" ? `${tsResult.periodYears} жилийн дундаж` : `avg of ${tsResult.periodYears} yrs`}</div>
                  </div>
                  <div className="ts-metric-card">
                    <div className="ts-metric-val" style={{ color: "#e63946" }}>{tsResult.peakKw.toLocaleString()}</div>
                    <div className="ts-metric-label">kW {lang === "mn" ? "оргил ачаалал" : "peak demand"}</div>
                    <div className="ts-metric-sub">{lang === "mn" ? "хамгийн их" : "maximum"}</div>
                  </div>
                  <div className="ts-metric-card">
                    <div className="ts-metric-val" style={{ color: "#9b72cf" }}>{tsResult.avgKw.toLocaleString()}</div>
                    <div className="ts-metric-label">kW {lang === "mn" ? "дундаж" : "average"}</div>
                    <div className="ts-metric-sub">{lang === "mn" ? `ачааллын хүчин зүйл: ${tsResult.loadFactor}%` : `load factor: ${tsResult.loadFactor}%`}</div>
                  </div>
                  {tsResult.intensity && (
                    <div className="ts-metric-card">
                      <div className="ts-metric-val" style={{ color: GRADE_COLORS[tsResult.grade] || "#f4a261" }}>{tsResult.intensity}</div>
                      <div className="ts-metric-label">kWh/m²/{lang === "mn" ? "жил" : "yr"}</div>
                      <div className="ts-metric-sub">
                        {lang === "mn" ? "зэрэглэл" : "grade"}{" "}
                        <strong style={{ color: GRADE_COLORS[tsResult.grade], fontSize: "1rem" }}>{tsResult.grade}</strong>
                        {tsResult.area && <> · {tsResult.area.toLocaleString()} m²</>}
                      </div>
                    </div>
                  )}
                  {tsResult.totalHeatingKwh && (
                    <div className="ts-metric-card">
                      <div className="ts-metric-val" style={{ color: "#f4a261" }}>{Math.round(tsResult.totalHeatingKwh/1000)}k</div>
                      <div className="ts-metric-label">kWh {lang === "mn" ? "халаалт нийт" : "total heating"}</div>
                      <div className="ts-metric-sub">
                        {Math.round(tsResult.totalHeatingKwh / tsResult.totalUseKwh * 100)}% {lang === "mn" ? "нийтийн" : "of total"}
                      </div>
                    </div>
                  )}
                  {tsResult.totalElectricKwh && (
                    <div className="ts-metric-card">
                      <div className="ts-metric-val" style={{ color: "#1a6eb5" }}>{Math.round(tsResult.totalElectricKwh/1000)}k</div>
                      <div className="ts-metric-label">kWh {lang === "mn" ? "цахилгаан нийт" : "total electric"}</div>
                      <div className="ts-metric-sub">
                        {Math.round(tsResult.totalElectricKwh / tsResult.totalUseKwh * 100)}% {lang === "mn" ? "нийтийн" : "of total"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Monthly bar chart */}
                {tsResult.monthly.length > 0 && (
                  <div className="card ts-chart-card">
                    <div className="form-section-header" style={{ borderColor: "#3a8fd4", marginBottom: "0.85rem" }}>
                      <Zap size={14} style={{ color: "#3a8fd4" }} />
                      <span className="form-section-title" style={{ color: "#3a8fd4" }}>
                        {lang === "mn" ? "Сарын хэрэглээ (kWh)" : "Monthly consumption (kWh)"}
                      </span>
                    </div>
                    {(() => {
                      // Group by year, show up to last 24 months
                      const shown = tsResult.monthly.slice(-24);
                      const maxVal = Math.max(...shown.map(m => m.kwh));
                      return (
                        <div style={{ overflowX: "auto" }}>
                          <div className="ts-bar-chart">
                            {shown.map((m, i) => {
                              const pct = maxVal > 0 ? (m.kwh / maxVal * 100) : 0;
                              const [yr, mo] = m.month.split("-");
                              const isWinter = [12,1,2,3].includes(parseInt(mo));
                              return (
                                <div key={i} className="ts-bar-col" title={`${m.month}: ${m.kwh.toLocaleString()} kWh`}>
                                  <div className="ts-bar-wrap">
                                    <div className="ts-bar" style={{ height: `${pct}%`, background: isWinter ? "#3a8fd4" : "#2a9d8f" }} />
                                  </div>
                                  <div className="ts-bar-label">{parseInt(mo)}р</div>
                                  {parseInt(mo) === 1 && <div className="ts-bar-year">{yr}</div>}
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--text3)" }}>
                            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#3a8fd4", borderRadius: 2, marginRight: 4 }} />{lang === "mn" ? "өвөл" : "winter"}</span>
                            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2a9d8f", borderRadius: 2, marginRight: 4 }} />{lang === "mn" ? "зун" : "summer"}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Hourly profile */}
                {tsResult.hourlyAvg.some(v => v > 0) && (
                  <div className="card ts-chart-card">
                    <div className="form-section-header" style={{ borderColor: "#9b72cf", marginBottom: "0.85rem" }}>
                      <Zap size={14} style={{ color: "#9b72cf" }} />
                      <span className="form-section-title" style={{ color: "#9b72cf" }}>
                        {lang === "mn" ? "Өдрийн дундаж профайл (kW)" : "Average daily profile (kW)"}
                      </span>
                    </div>
                    {(() => {
                      const maxH = Math.max(...tsResult.hourlyAvg);
                      return (
                        <div className="ts-bar-chart ts-hourly-chart">
                          {tsResult.hourlyAvg.map((v, h) => (
                            <div key={h} className="ts-bar-col" title={`${h}:00 — ${v} kW`}>
                              <div className="ts-bar-wrap">
                                <div className="ts-bar" style={{ height: `${maxH > 0 ? v/maxH*100 : 0}%`, background: h >= 8 && h <= 22 ? "#9b72cf" : "#4a3a6a" }} />
                              </div>
                              <div className="ts-bar-label">{h % 6 === 0 ? `${h}h` : ""}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Save to database button */}
                <button
                  className="btn btn-primary submit-btn"
                  style={{ width: "100%", marginTop: "0.5rem" }}
                  onClick={() => {
                    const rec = {
                      id:           `ts_${Date.now()}`,
                      name:         tsResult.buildingId,
                      type:         "apartment",
                      area:         tsResult.area,
                      floors:       tsResult.floors,
                      year:         tsResult.dateRange ? parseInt(tsResult.dateRange.from.slice(0,4)) : new Date().getFullYear(),
                      district:     tsResult.district || "Сүхбаатар",
                      predicted_kwh: tsResult.annualKwh,
                      peak_kw:      tsResult.peakKw,
                      load_factor:  tsResult.loadFactor / 100,
                      heating_kwh:  tsResult.totalHeatingKwh,
                      electric_kwh: tsResult.totalElectricKwh,
                      intensity:    tsResult.intensity,
                      grade:        tsResult.grade,
                      data_source:  "timeseries",
                      period_years: tsResult.periodYears,
                      monthly_profile: tsResult.monthly,
                      source:       "user",
                      userId:       user?.id || null,
                      submittedAt:  new Date().toISOString(),
                    };
                    saveUserBuilding(rec);
                    setSubmitCount(1);
                    setSubmitted(true);
                    setCsvText(""); setTsResult(null);
                    setTimeout(() => setSubmitted(false), 5000);
                  }}
                >
                  <Upload size={18} />
                  {lang === "mn"
                    ? `"${tsResult.buildingId}" барилгыг хадгалах`
                    : `Save "${tsResult.buildingId}" to database`}
                </button>
              </div>
            )}

            {/* ── BUILDING LIST (regular CSV) ── */}
            {pasteResult && (
              <div className="animate-fade">
                <div className="card" style={{ marginBottom: "1rem" }}>
                  <FileParseResult result={pasteResult} lang={lang} />
                  {pasteResult.valid.length > 0 && (
                    <div style={{ marginTop: "0.75rem", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                        <thead>
                          <tr>{["name","area","year","floors","district","type"].map(h => (
                            <th key={h} style={{ padding: "0.35rem 0.65rem", background: "var(--bg3)", border: "1px solid var(--border)", textAlign: "left", color: "var(--primary-light)" }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {pasteResult.valid.slice(0,8).map((r, i) => (
                            <tr key={i} style={{ background: i%2===0?"var(--card)":"var(--bg2)" }}>
                              {[r.name, r.area, r.year||"—", r.floors||"—", r.district, r.type].map((v,j) => (
                                <td key={j} style={{ padding:"0.3rem 0.65rem", border:"1px solid var(--border)", color:"var(--text2)" }}>{v}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {pasteResult.valid.length > 8 && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.4rem", textAlign: "center" }}>
                          + {pasteResult.valid.length - 8} {lang === "mn" ? "барилга" : "more"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-primary submit-btn"
                  style={{ width: "100%" }}
                  onClick={() => {
                    const all = pasteResult.valid || [];
                    if (!all.length) return;
                    all.forEach(r => saveUserBuilding({ ...r, userId: user?.id || null }));
                    setSubmitCount(all.length);
                    setSubmitted(true);
                    setCsvText(""); setPasteResult(null);
                    setTimeout(() => setSubmitted(false), 5000);
                  }}
                  disabled={!pasteResult.valid.length}
                >
                  <Upload size={18} />
                  {pasteResult.valid.length > 0
                    ? (lang === "mn" ? `${pasteResult.valid.length} барилга импортлох` : `Import ${pasteResult.valid.length} buildings`)
                    : (lang === "mn" ? "Хүчинтэй мөр байхгүй" : "No valid rows")}
                </button>
              </div>
            )}

          </div>
        )}

        {/* ── Link tab ── */}
        {activeTab === "link" && (
          <div className="animate-fade">
            <div className="card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>
                <Link2 size={16} style={{ marginLeft: 8 }} />
                {t.dataInput.link_title}
              </h3>
              <p style={{ color: "var(--text2)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                {t.dataInput.link_desc}
              </p>

              <div className="link-input-row">
                <input
                  className="form-input"
                  placeholder={t.dataInput.link_placeholder}
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addLink()}
                />
                <button className="btn btn-primary" onClick={addLink} style={{ flexShrink: 0 }}>
                  <FilePlus size={16} /> {t.dataInput.link_add}
                </button>
              </div>

              {links.length > 0 && (
                <div className="links-list mt-2">
                  {links.map(l => (
                    <div key={l} className="link-item">
                      <Link2 size={14} style={{ color: "var(--primary-light)", flexShrink: 0 }} />
                      <span className="link-url">{l}</span>
                      <button className="fi-btn danger" onClick={() => setLinks(prev => prev.filter(x => x !== l))}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-primary submit-btn mt-2" onClick={handleFileSubmit}>
                    <Upload size={18} />
                    {t.dataInput.link_upload_btn} ({links.length} {t.dataInput.link_unit})
                  </button>
                </div>
              )}

              <div className="link-examples mt-3">
                <h4 style={{ color: "var(--text2)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{t.dataInput.link_examples_title}</h4>
                {[
                  "https://raw.githubusercontent.com/user/repo/main/buildings.csv",
                  "https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv",
                  "https://api.example.mn/buildings?format=json",
                ].map(ex => (
                  <button key={ex} className="link-example" onClick={() => setLink(ex)}>
                    <Link2 size={12} />
                    <code style={{ fontSize: "0.75rem" }}>{ex}</code>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* File preview modal */}
        {previewFile && (
          <div className="preview-overlay" onClick={() => { setPreviewFile(null); setPreviewContent(null); }}>
            <div className="preview-modal card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={previewFile.name}>
              <div className="preview-header">
                <span>{previewFile.name} <span style={{ fontWeight: 400, color: "var(--text3)", fontSize: "0.82rem" }}>({formatSize(previewFile.size)})</span></span>
                <button className="chatbot-close" onClick={() => { setPreviewFile(null); setPreviewContent(null); }} aria-label={t.common.close}><X size={18} /></button>
              </div>
              <div className="preview-body" style={{ padding: "1rem" }}>
                {previewContent === null ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "2rem", color: "var(--text3)", fontSize: "0.85rem" }}>
                    <Loader2 size={16} className="fpr-spin" />
                    {lang === "mn" ? "Уншиж байна..." : "Loading..."}
                  </div>
                ) : previewContent.type === "csv" ? (
                  <CSVPreviewTable content={previewContent.content} />
                ) : previewContent.type === "json" ? (
                  <pre style={{ fontSize: "0.76rem", color: "var(--text2)", overflow: "auto", maxHeight: "55vh", margin: 0, lineHeight: 1.6, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem" }}>
                    {previewContent.content.slice(0, 4000)}{previewContent.content.length > 4000 ? "\n\n... (truncated)" : ""}
                  </pre>
                ) : (
                  <p style={{ color: "var(--text3)", fontSize: "0.85rem", textAlign: "center", padding: "2rem" }}>
                    {t.dataInput.preview_note}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
