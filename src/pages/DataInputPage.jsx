import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import {
  Upload, CheckCircle, MapPin, Building2, FileText, FileSpreadsheet,
  File, Link2, X, CloudUpload, FilePlus, Trash2, Eye, ArrowRight,
} from "lucide-react";
import { ulaanbaatarDistricts } from "../data/mockData";
import "./DataInputPage.css";

// ─── localStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = "ub_buildings_user";

export function getUserBuildings(userId = null) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!userId) return all;
    return all.filter(b => !b.userId || b.userId === userId);
  }
  catch { return []; }
}

function saveUserBuilding(record) {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, record]));
}

export function deleteUserBuilding(id) {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(b => b.id !== id)));
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
function FormSection({ emoji, title, color, children }) {
  return (
    <div className="form-section">
      <div className="form-section-header" style={{ borderColor: color }}>
        <span className="form-section-emoji">{emoji}</span>
        <span className="form-section-title" style={{ color }}>{title}</span>
      </div>
      <div className="grid grid-2">{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DataInputPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const mn = lang === "mn";
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("manual");
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [link, setLink] = useState("");
  const [links, setLinks] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Close file preview on Escape
  useEffect(() => {
    if (!previewFile) return;
    const handler = (e) => { if (e.key === "Escape") setPreviewFile(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [previewFile]);

  const [form, setForm] = useState({
    // 🏢 Location & structure
    building_name: "",
    address: "",
    district: "Сүхбаатар",
    year: "",
    total_floors: "",
    floor_number: "",
    units_per_floor: "",
    // 📐 Apartment
    building_type: "apartment",
    area: "",
    rooms: "",
    balcony: false,
    // 🪟 Heat loss
    window_count: "",
    window_direction: "south",
    window_type: "double",
    door_type: "metal",
    // 🔥 Heating
    heating_type: "central",
    insulation_quality: "medium",
    wall_material: "panel",
    // 👨‍👩‍👧‍👦 Occupancy
    occupancy: "",
    // 🌡️ Environment
    outdoor_temp: "",
    season: "winter",
    // 🎯 Output (target)
    monthly_usage: "",
    // Location coords
    latitude: "47.9184",
    longitude: "106.9177",
  });

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
    // Build a record and persist to localStorage
    const monthly = parseFloat(form.monthly_usage) || 0;
    const record = {
      id: `user_${Date.now()}`,
      name:     form.building_name || (mn ? "Нэргүй барилга" : "Unnamed Building"),
      type:     form.building_type,
      area:     parseFloat(form.area) || 0,
      floors:   parseInt(form.total_floors) || parseInt(form.floor_number) || 1,
      year:     parseInt(form.year) || new Date().getFullYear(),
      district: form.district,
      usage:    Math.round(monthly * 12),   // estimated annual kWh
      monthly_usage: monthly,
      floor_number:    parseInt(form.floor_number) || null,
      units_per_floor: parseInt(form.units_per_floor) || null,
      rooms:           parseInt(form.rooms) || null,
      balcony:         form.balcony,
      window_count:    parseInt(form.window_count) || null,
      window_direction: form.window_direction,
      window_type:     form.window_type,
      door_type:       form.door_type,
      heating_type:    form.heating_type,
      insulation_quality: form.insulation_quality,
      wall_material:   form.wall_material,
      occupancy:       parseInt(form.occupancy) || null,
      outdoor_temp:    parseFloat(form.outdoor_temp) || null,
      season:          form.season,
      latitude:        parseFloat(form.latitude),
      longitude:       parseFloat(form.longitude),
      source: "user",
      userId: user?.id || null,
      submittedAt: new Date().toISOString(),
    };
    saveUserBuilding(record);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
    setForm(f => ({
      ...f,
      building_name: "", address: "", year: "", total_floors: "",
      floor_number: "", units_per_floor: "", area: "", rooms: "",
      balcony: false, window_count: "", outdoor_temp: "", monthly_usage: "",
      occupancy: "",
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

        {submitted && (
          <div className="success-banner animate-fade" role="status" aria-live="polite">
            <CheckCircle size={20} />
            <span>{t.dataInput.success_msg}</span>
            <button
              className="success-db-btn"
              onClick={() => navigate("/database")}
            >
              {mn ? "Мэдээлэл харах" : "View in Database"}
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
                emoji="🏢"
                title={mn ? "Байршил ба бүтэц" : "Location & Structure"}
                color="#3a8fd4"
              >
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" htmlFor="di-building_name">{t.dataInput.building_name} *</label>
                  <input id="di-building_name" name="building_name" value={form.building_name} onChange={handleChange}
                    className="form-input" required placeholder={t.dataInput.name_placeholder} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-address">{t.dataInput.address}</label>
                  <input id="di-address" name="address" value={form.address} onChange={handleChange}
                    className="form-input" placeholder={t.dataInput.address_placeholder} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-district">{mn ? "Байршил (дүүрэг)" : "District"}</label>
                  <select id="di-district" name="district" value={form.district} onChange={handleChange} className="form-select">
                    {ulaanbaatarDistricts.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-year">{mn ? "Барилгын ашиглалтанд орсон он" : "Year Built"}</label>
                  <input id="di-year" name="year" type="number" value={form.year} onChange={handleChange}
                    className="form-input" placeholder="1950–2026" min={1950} max={2026} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-total_floors">{mn ? "Нийт давхар (ж: 18)" : "Total Floors (e.g. 18)"}</label>
                  <input id="di-total_floors" name="total_floors" type="number" value={form.total_floors} onChange={handleChange}
                    className="form-input" placeholder="18" min={1} max={60} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-floor_number">{mn ? "Хэдэн давхарт (ж: 10)" : "Your Floor (e.g. 10)"}</label>
                  <input id="di-floor_number" name="floor_number" type="number" value={form.floor_number} onChange={handleChange}
                    className="form-input" placeholder="10" min={1} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-units_per_floor">{mn ? "Давхартаа хэдэн айлтай" : "Units per Floor"}</label>
                  <input id="di-units_per_floor" name="units_per_floor" type="number" value={form.units_per_floor} onChange={handleChange}
                    className="form-input" placeholder="4" min={1} />
                </div>
              </FormSection>

              {/* 📐 Айлын мэдээлэл */}
              <FormSection
                emoji="📐"
                title={mn ? "Айлын мэдээлэл" : "Apartment Info"}
                color="#9b72cf"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="di-building_type">{mn ? "Барилгын төрөл" : "Building Type"}</label>
                  <select id="di-building_type" name="building_type" value={form.building_type} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.building_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-area">{mn ? "Талбай (м²)" : "Area (m²)"} *</label>
                  <input id="di-area" name="area" type="number" value={form.area} onChange={handleChange}
                    className="form-input" placeholder="m²" min={10} required />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-rooms">{mn ? "Өрөөний тоо" : "Number of Rooms"}</label>
                  <input id="di-rooms" name="rooms" type="number" value={form.rooms} onChange={handleChange}
                    className="form-input" placeholder="3" min={1} max={20} />
                </div>

                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingTop: "1.6rem" }}>
                  <input
                    type="checkbox" name="balcony" id="balcony"
                    checked={form.balcony} onChange={handleChange}
                    style={{ width: 18, height: 18, accentColor: "#9b72cf", cursor: "pointer" }}
                  />
                  <label htmlFor="balcony" className="form-label" style={{ margin: 0, cursor: "pointer" }}>
                    {mn ? "Тагт байгаа" : "Has Balcony"}
                  </label>
                </div>
              </FormSection>

              {/* 🪟 Дулаан алдагдал */}
              <FormSection
                emoji="🪟"
                title={mn ? "Дулаан алдагдал" : "Heat Loss Factors"}
                color="#e9c46a"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="di-window_count">{mn ? "Цонхны тоо" : "Number of Windows"}</label>
                  <input id="di-window_count" name="window_count" type="number" value={form.window_count} onChange={handleChange}
                    className="form-input" placeholder="6" min={0} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-window_direction">{mn ? "Цонхны чиглэл" : "Window Orientation"}</label>
                  <select id="di-window_direction" name="window_direction" value={form.window_direction} onChange={handleChange} className="form-select">
                    <option value="south">{mn ? "Урд" : "South"}</option>
                    <option value="north">{mn ? "Хойд" : "North"}</option>
                    <option value="east">{mn ? "Зүүн" : "East"}</option>
                    <option value="west">{mn ? "Баруун" : "West"}</option>
                    <option value="mixed">{mn ? "Холимог" : "Mixed"}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-window_type">{mn ? "Цонхны төрөл" : "Window Type"}</label>
                  <select id="di-window_type" name="window_type" value={form.window_type} onChange={handleChange} className="form-select">
                    <option value="single">{mn ? "1 давхар шил" : "Single glazed"}</option>
                    <option value="double">{mn ? "2 давхар шил" : "Double glazed"}</option>
                    <option value="triple">{mn ? "3 давхар шил" : "Triple glazed"}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-door_type">{mn ? "Хаалганы төрөл" : "Door Type"}</label>
                  <select id="di-door_type" name="door_type" value={form.door_type} onChange={handleChange} className="form-select">
                    <option value="metal">{mn ? "Металл хаалга" : "Metal door"}</option>
                    <option value="wood">{mn ? "Мод хаалга" : "Wooden door"}</option>
                    <option value="insulated">{mn ? "Дулаалгатай хаалга" : "Insulated door"}</option>
                  </select>
                </div>
              </FormSection>

              {/* 🔥 Халаалт */}
              <FormSection
                emoji="🔥"
                title={mn ? "Халаалт" : "Heating"}
                color="#f4a261"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="di-heating_type">{mn ? "Халаалтын төрөл" : "Heating Type"}</label>
                  <select id="di-heating_type" name="heating_type" value={form.heating_type} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.heating_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-insulation_quality">{mn ? "Дулаалгын түвшин" : "Insulation Quality"}</label>
                  <select id="di-insulation_quality" name="insulation_quality" value={form.insulation_quality} onChange={handleChange} className="form-select">
                    <option value="good">{mn ? "Сайн" : "Good"}</option>
                    <option value="medium">{mn ? "Дунд" : "Medium"}</option>
                    <option value="poor">{mn ? "Муу" : "Poor"}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-wall_material">{t.predictor.wall_material}</label>
                  <select id="di-wall_material" name="wall_material" value={form.wall_material} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.wall_materials).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </FormSection>

              {/* 👨‍👩‍👧‍👦 Хэрэглээ */}
              <FormSection
                emoji="👨‍👩‍👧‍👦"
                title={mn ? "Хэрэглээ" : "Occupancy"}
                color="#2a9d8f"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="di-occupancy">{mn ? "Амьдарч буй хүний тоо" : "Number of Residents"}</label>
                  <input id="di-occupancy" name="occupancy" type="number" value={form.occupancy} onChange={handleChange}
                    className="form-input" placeholder="4" min={1} />
                </div>
              </FormSection>

              {/* 🌡️ Орчны өгөгдөл */}
              <FormSection
                emoji="🌡️"
                title={mn ? "Орчны өгөгдөл" : "Environmental Data"}
                color="#6a9bbf"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="di-outdoor_temp">{mn ? "Гадаад температур (°C, сарын дундаж)" : "Outdoor Temp (°C, monthly avg)"}</label>
                  <input id="di-outdoor_temp" name="outdoor_temp" type="number" value={form.outdoor_temp} onChange={handleChange}
                    className="form-input" placeholder="-15" min={-50} max={40} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="di-season">{mn ? "Улирал" : "Season"}</label>
                  <select id="di-season" name="season" value={form.season} onChange={handleChange} className="form-select">
                    <option value="winter">{mn ? "Өвөл" : "Winter"}</option>
                    <option value="spring">{mn ? "Хавар" : "Spring"}</option>
                    <option value="summer">{mn ? "Зун" : "Summer"}</option>
                    <option value="autumn">{mn ? "Намар" : "Autumn"}</option>
                  </select>
                </div>
              </FormSection>

              {/* 🎯 Гаралт */}
              <div className="form-section form-section-output">
                <div className="form-section-header" style={{ borderColor: "#2a9d8f" }}>
                  <span className="form-section-emoji">🎯</span>
                  <span className="form-section-title" style={{ color: "#2a9d8f" }}>
                    {mn ? "Гаралт — хамгийн чухал" : "Output — Target Variable"}
                  </span>
                  <span className="form-section-badge">✅</span>
                </div>
                <div className="output-field-wrap">
                  <label className="form-label output-label" htmlFor="di-monthly_usage">
                    {mn ? "Сарын цахилгаан хэрэглээ (kWh)" : "Monthly Electricity Consumption (kWh)"}
                  </label>
                  <div className="output-input-row">
                    <input
                      id="di-monthly_usage" name="monthly_usage" type="number" value={form.monthly_usage} onChange={handleChange}
                      className="form-input output-input"
                      placeholder={mn ? "ж: 320" : "e.g. 320"} min={0}
                    />
                    <span className="output-unit">kWh / {mn ? "сар" : "month"}</span>
                  </div>
                  <p className="output-hint">
                    {mn
                      ? "Цахилгааны тооцооны дэвтэр эсвэл нийлүүлэгчийн мэдээллээс авна уу."
                      : "Take this from your electricity bill or supplier data."}
                  </p>
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
            <div className="input-guide card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.dataInput.guide_title}</h3>
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
                  {t.dataInput.upload_btn} ({files.length} {mn ? "файл" : "file"})
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
                    📥 template.csv
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
                    {t.dataInput.link_upload_btn} ({links.length} {mn ? "холбоос" : "link"})
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
