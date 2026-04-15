import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import { useAuth } from "../contexts/AuthContext";
import {
  Upload, CheckCircle, MapPin, Building2, FileText, FileSpreadsheet,
  File, Link2, X, CloudUpload, FilePlus, Trash2, Eye, ArrowRight, Info,
  Layers, Wind, Flame, Target, Zap,
} from "lucide-react";
import { ulaanbaatarDistricts } from "../data/mockData";
import "./DataInputPage.css";
import { saveUserBuilding } from "../utils/buildingStorage";
import { convertElecMoneyToKwh, convertHeatBillToEstimates, TARIFF_TIERS, predict } from "../ml/model";

const GRADE_COLORS = { A:"#2a9d8f",B:"#57cc99",C:"#a8c686",D:"#f4a261",E:"#e76f51",F:"#e63946",G:"#9b1d20" };

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
  const [previewFile, setPreviewFile] = useState(null);
  const [elecBill, setElecBill] = useState("");
  const [heatBill, setHeatBill] = useState("");
  const [formErrors, setFormErrors] = useState({});

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
  });

  // Live ML preview — run predict whenever key fields change
  const livePreview = React.useMemo(() => {
    const area = parseFloat(form.area);
    if (!area || area < 10) return null;
    const type = form.building_type || "apartment";
    const resPer100 = { apartment: 5, office: 3, school: 4, hospital: 6, commercial: 2, warehouse: 1 };
    const appPer100 = { apartment: 8, office: 5, school: 4, hospital: 10, commercial: 6, warehouse: 3 };
    const mlInput = {
      building_type: type,
      area,
      year:  Math.max(1940, Math.min(2026, parseInt(form.year) || 1990)),
      floors: Math.max(1, parseInt(form.total_floors) || 3),
      rooms:  parseInt(form.rooms) || Math.max(1, Math.round(area / 50)),
      hdd: 4500,
      window_ratio: 25,
      residents: Math.max(1, Math.round(area / 100 * (resPer100[type] || 4))),
      appliances: Math.min(50, Math.max(2, Math.round(area / 100 * (appPer100[type] || 6)))),
      wall_material: form.wall_material || "panel",
      heating_type: form.heating_type || "central",
      insulation_quality: form.insulation_quality || "medium",
      window_type: form.window_type || "double",
    };
    try { return predict(mlInput); } catch { return null; }
  }, [form.area, form.building_type, form.year, form.total_floors, form.wall_material,
      form.heating_type, form.insulation_quality, form.window_type, form.rooms]);

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
    const record = {
      id:           `user_${Date.now()}`,
      name:         form.building_name || t.dataInput.unnamed_building,
      type:         form.building_type,
      area,
      floors:       parseInt(form.total_floors) || 3,
      year:         parseInt(form.year) || new Date().getFullYear(),
      district:     form.district,
      monthly_usage,
      rooms:        parseInt(form.rooms) || null,
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
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setFiles([]); setLinks([]); }, 4000);
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
            <span>{t.dataInput.success_msg}</span>
            <button
              className="success-db-btn"
              onClick={() => navigate("/database")}
            >
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

              {/* 🏢 Байршил ба бүтэц */}
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
              <FormSection
                icon={Layers}
                title={lang === "mn" ? "Барилгын мэдээлэл" : "Building Details"}
                color="#9b72cf"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="di-building_type">{t.predictor.building_type}</label>
                  <select id="di-building_type" name="building_type" value={form.building_type} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.building_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-area">{t.predictor.area} *</label>
                  <input id="di-area" name="area" type="number" value={form.area} onChange={handleChange}
                    className={`form-input${formErrors.area ? " input-error" : ""}`} placeholder="m²" min={10} required />
                  {formErrors.area && <div className="field-error">{formErrors.area}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-rooms">{t.predictor.rooms}</label>
                  <input id="di-rooms" name="rooms" type="number" value={form.rooms} onChange={handleChange}
                    className="form-input" placeholder="3" min={1} max={20} />
                </div>
              </FormSection>

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

                <div className="form-group">
                  <label className="form-label" htmlFor="di-door_type">{t.dataInput.door_type}</label>
                  <select id="di-door_type" name="door_type" value={form.door_type} onChange={handleChange} className="form-select">
                    <option value="metal">{t.dataInput.door_metal}</option>
                    <option value="wood">{t.dataInput.door_wood}</option>
                    <option value="insulated">{t.dataInput.door_insulated}</option>
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
            <div className="grid grid-2" style={{ gridTemplateColumns: "1fr 320px", alignItems: "start" }}>
              <div className="card">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>
                  <CloudUpload size={16} style={{ marginLeft: 8 }} />
                  {t.dataInput.file_section_title}
                </h3>

                <div
                  className={`drop-zone ${dragOver ? "over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <CloudUpload size={40} opacity={0.5} />
                  <p className="dz-main">
                    {t.dataInput.dz_main} <span className="dz-link">{t.dataInput.dz_click}</span>
                  </p>
                  <p className="dz-sub">{t.dataInput.dz_sub}</p>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept={ACCEPT_STR}
                    className="file-input-hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>

                <div className="format-badges">
                  {["CSV", "Excel", "JSON", "PDF", "Word", "ZIP"].map(f => (
                    <span key={f} className="fmt-badge">{f}</span>
                  ))}
                </div>

                {files.length > 0 && (
                  <div className="file-list mt-2">
                    <div className="fl-header">
                      <span>{files.length} {t.dataInput.files_selected}</span>
                      <button className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }}
                        onClick={() => setFiles([])}>
                        <Trash2 size={13} /> {t.dataInput.clear_all}
                      </button>
                    </div>
                    {files.map(f => (
                      <FileItem key={f.name} file={f} t={t} onRemove={removeFile} onPreview={setPreviewFile} />
                    ))}
                  </div>
                )}

                <button
                  className="btn btn-primary submit-btn mt-2"
                  onClick={handleFileSubmit}
                  disabled={files.length === 0 && links.length === 0}
                >
                  <Upload size={18} />
                  {t.dataInput.upload_btn} ({files.length} {t.dataInput.file_unit})
                </button>
              </div>

              <div className="card">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.dataInput.file_guide_title}</h3>
                <div className="format-guide">
                  <div className="fg-item">
                    <FileSpreadsheet size={18} style={{ color: "#2a9d8f" }} />
                    <div><strong>CSV / Excel</strong><p>{t.dataInput.csv_desc}</p></div>
                  </div>
                  <div className="fg-item">
                    <FileText size={18} style={{ color: "#3a8fd4" }} />
                    <div><strong>JSON</strong><p>{t.dataInput.json_desc}</p></div>
                  </div>
                  <div className="fg-item">
                    <FileText size={18} style={{ color: "#e63946" }} />
                    <div><strong>PDF / Word</strong><p>{t.dataInput.pdf_desc}</p></div>
                  </div>
                  <div className="fg-item">
                    <File size={18} style={{ color: "#f4a261" }} />
                    <div><strong>ZIP</strong><p>{t.dataInput.zip_desc}</p></div>
                  </div>
                </div>
                <div className="guide-note mt-2">
                  <strong>{t.dataInput.template_label}</strong><br />
                  <a href="#" className="text-primary" style={{ fontSize: "0.85rem" }}
                    onClick={(e) => {
                      e.preventDefault();
                      const csv = "building_name,area,year,floors,usage_kwh,district\nЖишээ байр,1200,1995,9,38500,Сүхбаатар\n";
                      const b = new Blob(["\uFEFF" + csv], { type: "text/csv" });
                      const u = URL.createObjectURL(b);
                      const a = document.createElement("a"); a.href = u; a.download = "template.csv"; a.click();
                    }}>
                    template.csv
                  </a>
                </div>
              </div>
            </div>
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
          <div className="preview-overlay" onClick={() => setPreviewFile(null)}>
            <div className="preview-modal card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={previewFile.name}>
              <div className="preview-header">
                <span>{previewFile.name}</span>
                <button className="chatbot-close" onClick={() => setPreviewFile(null)} aria-label={t.common.close}><X size={18} /></button>
              </div>
              <div className="preview-body">
                <p style={{ color: "var(--text3)", fontSize: "0.85rem", textAlign: "center", padding: "2rem" }}>
                  {t.dataInput.preview_note}<br />
                  <strong style={{ color: "var(--primary-light)" }}>{previewFile.name}</strong> ({formatSize(previewFile.size)}) {t.dataInput.preview_ready}.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
