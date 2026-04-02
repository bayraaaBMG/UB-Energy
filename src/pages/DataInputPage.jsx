import { useState, useRef } from "react";
import { useLang } from "../contexts/LanguageContext";
import {
  Upload, CheckCircle, MapPin, Building2, FileText, FileSpreadsheet,
  File, Link2, X, CloudUpload, FilePlus, Trash2, Eye
} from "lucide-react";
import { ulaanbaatarDistricts } from "../data/mockData";
import "./DataInputPage.css";

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
          <button className="fi-btn" onClick={() => onPreview(file)} title={t.dataInput.preview}>
            <Eye size={14} />
          </button>
        )}
        <button className="fi-btn danger" onClick={() => onRemove(file.name)} title={t.dataInput.delete_file}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function DataInputPage() {
  const { t } = useLang();
  const fileRef = useRef(null);

  const [activeTab, setActiveTab] = useState("manual");
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [link, setLink] = useState("");
  const [links, setLinks] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const [form, setForm] = useState({
    building_name: "", address: "", district: "Сүхбаатар",
    building_type: "apartment", area: "", year: "",
    floors: "", wall_material: "panel", heating_type: "central",
    occupancy: "", latitude: "47.9184", longitude: "106.9177",
    annual_usage: "",
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setForm({ building_name: "", address: "", district: "Сүхбаатар", building_type: "apartment", area: "", year: "", floors: "", wall_material: "panel", heating_type: "central", occupancy: "", latitude: "47.9184", longitude: "106.9177", annual_usage: "" });
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
          <div className="success-banner animate-fade">
            <CheckCircle size={20} />
            {t.dataInput.success_msg}
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
              <h2 className="section-title">
                <Building2 size={16} style={{ marginLeft: 8 }} />
                {t.dataInput.section_general}
              </h2>

              <div className="grid grid-2">
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">{t.dataInput.building_name} *</label>
                  <input name="building_name" value={form.building_name} onChange={handleChange}
                    className="form-input" required placeholder={t.dataInput.name_placeholder} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.dataInput.address}</label>
                  <input name="address" value={form.address} onChange={handleChange}
                    className="form-input" placeholder={t.dataInput.address_placeholder} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.dataInput.district}</label>
                  <select name="district" value={form.district} onChange={handleChange} className="form-select">
                    {ulaanbaatarDistricts.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t.predictor.building_type}</label>
                  <select name="building_type" value={form.building_type} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.building_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t.predictor.area}</label>
                  <input name="area" type="number" value={form.area} onChange={handleChange}
                    className="form-input" placeholder={t.common.units_sqm} min={10} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.predictor.year}</label>
                  <input name="year" type="number" value={form.year} onChange={handleChange}
                    className="form-input" placeholder="1950–2026" min={1950} max={2026} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.predictor.floors}</label>
                  <input name="floors" type="number" value={form.floors} onChange={handleChange}
                    className="form-input" min={1} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.predictor.wall_material}</label>
                  <select name="wall_material" value={form.wall_material} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.wall_materials).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t.predictor.heating_type}</label>
                  <select name="heating_type" value={form.heating_type} onChange={handleChange} className="form-select">
                    {Object.entries(t.predictor.heating_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t.predictor.occupancy}</label>
                  <input name="occupancy" type="number" value={form.occupancy} onChange={handleChange}
                    className="form-input" min={1} />
                </div>

                <div className="form-group">
                  <label className="form-label">{t.dataInput.annual_usage}</label>
                  <input name="annual_usage" type="number" value={form.annual_usage} onChange={handleChange}
                    className="form-input" placeholder={t.dataInput.annual_usage_placeholder} />
                </div>
              </div>

              <h2 className="section-title mt-3" style={{ fontSize: "1rem" }}>
                <MapPin size={14} style={{ marginLeft: 8 }} />
                {t.dataInput.section_location}
              </h2>

              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">{t.dataInput.latitude}</label>
                  <input name="latitude" value={form.latitude} onChange={handleChange}
                    className="form-input" placeholder="47.9184" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.dataInput.longitude}</label>
                  <input name="longitude" value={form.longitude} onChange={handleChange}
                    className="form-input" placeholder="106.9177" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary submit-btn mt-2">
                <Upload size={18} />
                {t.dataInput.submit_btn}
              </button>
            </form>

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
                  {t.dataInput.upload_btn} ({files.length} {t.dataInput.tab_file.toLowerCase()})
                </button>
              </div>

              {/* Guide */}
              <div className="card">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.dataInput.file_guide_title}</h3>

                <div className="format-guide">
                  <div className="fg-item">
                    <FileSpreadsheet size={18} style={{ color: "#2a9d8f" }} />
                    <div>
                      <strong>CSV / Excel</strong>
                      <p>{t.dataInput.csv_desc}</p>
                    </div>
                  </div>
                  <div className="fg-item">
                    <FileText size={18} style={{ color: "#3a8fd4" }} />
                    <div>
                      <strong>JSON</strong>
                      <p>{t.dataInput.json_desc}</p>
                    </div>
                  </div>
                  <div className="fg-item">
                    <FileText size={18} style={{ color: "#e63946" }} />
                    <div>
                      <strong>PDF / Word</strong>
                      <p>{t.dataInput.pdf_desc}</p>
                    </div>
                  </div>
                  <div className="fg-item">
                    <File size={18} style={{ color: "#f4a261" }} />
                    <div>
                      <strong>ZIP</strong>
                      <p>{t.dataInput.zip_desc}</p>
                    </div>
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
                    {t.dataInput.link_upload_btn} ({links.length})
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
                  <div key={ex} className="link-example" onClick={() => setLink(ex)}>
                    <Link2 size={12} />
                    <code style={{ fontSize: "0.75rem" }}>{ex}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* File preview modal */}
        {previewFile && (
          <div className="preview-overlay" onClick={() => setPreviewFile(null)}>
            <div className="preview-modal card" onClick={e => e.stopPropagation()}>
              <div className="preview-header">
                <span>{previewFile.name}</span>
                <button className="chatbot-close" onClick={() => setPreviewFile(null)}><X size={18} /></button>
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
