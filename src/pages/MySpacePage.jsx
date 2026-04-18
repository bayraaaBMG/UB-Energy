import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  Package, Building2, Database, History, Bookmark, Star,
  FileText, BarChart2, Trash2, Download, Upload, Shield,
  Award, User, Tag, ChevronRight, AlertCircle, AlertTriangle,
  Zap, MapPin, ChevronDown, ChevronUp, Search, ArrowUpDown,
} from "lucide-react";
import {
  getPredictions, clearPredictions, deletePrediction,
  getScenarios, deleteScenario,
  getFavorites, removeFavorite,
} from "../utils/userDataStorage";
import {
  getUserBuildings, deleteUserBuilding, updateUserBuilding,
} from "../utils/buildingStorage";
import "./MySpacePage.css";

const GRADE_COLORS = { A: "#2a9d8f", B: "#57cc99", C: "#e9c46a", D: "#f4a261", E: "#e76f51", F: "#e63946", G: "#6d2b2b" };

const TYPE_LABELS = {
  apartment: "Орон сууц", office: "Оффис", school: "Сургууль",
  hospital: "Эмнэлэг", commercial: "Худалдааны", warehouse: "Агуулах",
};

function getGreeting(lang) {
  const h = new Date().getHours();
  if (lang === "mn") {
    if (h < 12) return "Өглөөний мэнд";
    if (h < 17) return "Өдрийн мэнд";
    return "Оройн мэнд";
  }
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function GradePill({ grade }) {
  return (
    <span className="ms-grade-pill" style={{ background: GRADE_COLORS[grade] || "#888" }}>
      {grade}
    </span>
  );
}

function EmptyState({ icon: Icon, text, action }) {
  return (
    <div className="ms-empty">
      <Icon size={36} />
      <p>{text}</p>
      {action}
    </div>
  );
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab({ t, user, buildings, predictions, scenarios, favorites, onTabChange }) {
  const navigate = useNavigate();
  const { lang } = useLang();

  const totalKwh = buildings.reduce((s, b) => s + (b.predicted_kwh || 0), 0);
  const avgKwh   = buildings.length ? Math.round(totalKwh / buildings.length) : 0;

  const qualityScore = useMemo(() => {
    if (!buildings.length) return 0;
    const scored = buildings.map(b => {
      let score = 0;
      if (b.name && b.name !== "Нэргүй барилга") score += 20;
      if (b.area > 0) score += 20;
      if (b.year > 1940) score += 20;
      if (b.district && b.district !== "Улаанбаатар") score += 20;
      if (b.wall_material) score += 20;
      return score;
    });
    return Math.round(scored.reduce((s, v) => s + v, 0) / buildings.length);
  }, [buildings]);

  const lastActivity = useMemo(() => {
    const dates = [
      ...buildings.map(b => b.submittedAt),
      ...predictions.map(p => p.savedAt),
      ...scenarios.map(s => s.savedAt),
    ].filter(Boolean).sort().reverse();
    return dates[0] ? new Date(dates[0]).toLocaleDateString("mn-MN") : "—";
  }, [buildings, predictions, scenarios]);

  const typeDist = useMemo(() => {
    const counts = {};
    buildings.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [buildings]);

  const highRiskBuildings = useMemo(
    () => buildings.filter(b => ["E","F","G"].includes(b.grade)).sort((a,b) => b.intensity - a.intensity).slice(0,5),
    [buildings]
  );

  const recentActivity = useMemo(() => {
    return [
      ...buildings.map(b => ({ date: b.submittedAt, label: b.name, type: "building", grade: b.grade })),
      ...predictions.map(p => ({ date: p.savedAt, label: p.form?.name || "Таамаглал", type: "prediction" })),
      ...scenarios.map(s => ({ date: s.savedAt, label: s.label || s.name, type: "scenario" })),
    ]
      .filter(i => i.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }, [buildings, predictions, scenarios]);

  const topStats = [
    { label: t.myspace.stat_buildings,   value: buildings.length,   icon: <Building2 size={20} />, color: "#1a6eb5", onClick: () => onTabChange("buildings") },
    { label: t.myspace.stat_predictions, value: predictions.length, icon: <History size={20} />,   color: "#2a9d8f", onClick: () => onTabChange("history") },
    { label: t.myspace.stat_scenarios,   value: scenarios.length,   icon: <Bookmark size={20} />,  color: "#f4a261", onClick: () => onTabChange("scenarios") },
    { label: t.myspace.stat_favorites,   value: favorites.length,   icon: <Star size={20} />,      color: "#e9c46a", onClick: () => onTabChange("favorites") },
  ];

  const extraStats = [
    { label: t.myspace.stat_avg_usage,    value: `${avgKwh.toLocaleString()} кВт·цаг`,           icon: <Zap size={16} />,      color: "#6c3ec5" },
    { label: t.myspace.stat_data_quality, value: `${qualityScore}%`,                              icon: <Database size={16} />, color: "#2a9d8f" },
    { label: t.myspace.stat_total_usage,  value: `${Math.round(totalKwh / 1000).toLocaleString()} МВт·цаг`, icon: <BarChart2 size={16} />, color: "#e63946" },
    { label: t.myspace.stat_last_activity,value: lastActivity,                                    icon: <History size={16} />,  color: "#6c757d" },
  ];

  const quickActions = [
    { label: lang === "mn" ? "Барилга нэмэх"   : "Add Building",    icon: <Upload size={20} />,   color: "#1a6eb5", bg: "#1a6eb51a", action: () => navigate("/data-input") },
    { label: lang === "mn" ? "Таамаглал хийх"  : "Run Prediction",  icon: <Zap size={20} />,      color: "#2a9d8f", bg: "#2a9d8f1a", action: () => navigate("/predictor") },
    { label: lang === "mn" ? "Газрын зураг"    : "Map View",        icon: <MapPin size={20} />,   color: "#f4a261", bg: "#f4a2611a", action: () => navigate("/map") },
    { label: lang === "mn" ? "Тайлан татах"    : "Download Report", icon: <FileText size={20} />, color: "#6c3ec5", bg: "#6c3ec51a", action: () => onTabChange("reports") },
  ];

  return (
    <div className="ms-summary">

      {/* ── Greeting banner ── */}
      <div className="card ms-greeting-banner">
        <div className="ms-greeting-left">
          <div className="ms-greeting-text">
            {getGreeting(lang)}, <strong>{user.name}</strong>
          </div>
          <div className="ms-greeting-date">
            {new Date().toLocaleDateString(lang === "mn" ? "mn-MN" : "en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </div>
        </div>
        <div className="ms-greeting-chips">
          <span className="ms-greeting-chip">{buildings.length} {lang === "mn" ? "барилга" : "buildings"}</span>
          <span className="ms-greeting-chip">{predictions.length} {lang === "mn" ? "таамаглал" : "predictions"}</span>
          {highRiskBuildings.length > 0 && (
            <span className="ms-greeting-chip warn">
              <AlertTriangle size={11} /> {highRiskBuildings.length} {lang === "mn" ? "анхааруулга" : "alerts"}
            </span>
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="ms-quick-actions">
        {quickActions.map(qa => (
          <button key={qa.label} className="ms-qa-card card" onClick={qa.action}>
            <div className="ms-qa-icon" style={{ background: qa.bg, color: qa.color }}>{qa.icon}</div>
            <div className="ms-qa-label">{qa.label}</div>
          </button>
        ))}
      </div>

      {/* ── Top 4 stats (clickable) ── */}
      <div className="ms-stat-grid">
        {topStats.map(s => (
          <button key={s.label} className="ms-stat-card card ms-stat-clickable" onClick={s.onClick}>
            <span className="ms-stat-icon" style={{ background: `${s.color}1a`, color: s.color }}>{s.icon}</span>
            <div>
              <div className="ms-stat-value">{s.value}</div>
              <div className="ms-stat-label">{s.label}</div>
            </div>
            <ChevronRight size={14} className="ms-stat-arrow" />
          </button>
        ))}
      </div>

      {/* ── Secondary stats ── */}
      <div className="ms-extra-stats">
        {extraStats.map(s => (
          <div key={s.label} className="ms-extra-stat">
            <span className="ms-extra-icon" style={{ color: s.color }}>{s.icon}</span>
            <div>
              <div className="ms-extra-val">{s.value}</div>
              <div className="ms-extra-lbl">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── High-risk alert ── */}
      {highRiskBuildings.length > 0 && (
        <div className="card ms-alert-card">
          <div className="ms-alert-header">
            <AlertTriangle size={15} />
            <span>{lang === "mn" ? "Өндөр эрчим хүч хэрэглэлттэй барилгууд" : "High energy consumption buildings"}</span>
            <span className="ms-alert-count">{highRiskBuildings.length}</span>
          </div>
          <div className="ms-alert-list">
            {highRiskBuildings.map(b => (
              <div key={b.id} className="ms-alert-row">
                <GradePill grade={b.grade} />
                <span className="ms-alert-name">{b.name}</span>
                <span className="ms-alert-val">{b.intensity} кВт·цаг/м²</span>
                <span className="ms-alert-dist">{b.district || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom row: type dist + activity ── */}
      <div className="ms-summary-row">
        {typeDist.length > 0 && (
          <div className="card ms-type-dist">
            <h4>{t.myspace.type_dist_title}</h4>
            {typeDist.map(([type, count]) => (
              <div key={type} className="ms-type-row">
                <span className="ms-type-label">{TYPE_LABELS[type] || type}</span>
                <div className="ms-type-bar-wrap">
                  <div className="ms-type-bar" style={{ width: `${Math.round((count / buildings.length) * 100)}%` }} />
                </div>
                <span className="ms-type-count">{count}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card ms-activity-feed">
          <h4>{t.myspace.recent_activity}</h4>
          {recentActivity.length === 0 ? (
            <p className="ms-empty-small">{t.myspace.no_activity}</p>
          ) : (
            <ul className="ms-activity-list">
              {recentActivity.map((item, i) => (
                <li key={i} className="ms-activity-item">
                  <span className={`ms-activity-dot ms-dot-${item.type}`} />
                  <span className="ms-activity-name">{item.label}</span>
                  {item.grade && <GradePill grade={item.grade} />}
                  <span className="ms-activity-date">{new Date(item.date).toLocaleDateString("mn-MN")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Buildings Tab ─────────────────────────────────────────────────────────────
function BuildingsTab({ t, user, buildings, onRefresh }) {
  const navigate  = useNavigate();
  const [orgTags, setOrgTags]   = useState({});
  const [savedTags, setSavedTags] = useState({});
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState("date");
  const [sortAsc, setSortAsc]   = useState(false);

  const isOfficialOrAdmin = user?.type === "official" || user?.role === "admin" || user?.role === "manager";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? buildings.filter(b =>
          (b.name || "").toLowerCase().includes(q) ||
          (b.district || "").toLowerCase().includes(q) ||
          (TYPE_LABELS[b.type] || b.type || "").toLowerCase().includes(q)
        )
      : [...buildings];

    list.sort((a, b) => {
      let av, bv;
      if (sortKey === "name")      { av = a.name || ""; bv = b.name || ""; return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av); }
      if (sortKey === "grade")     { const g = "ABCDEFG"; av = g.indexOf(a.grade); bv = g.indexOf(b.grade); }
      else if (sortKey === "area") { av = a.area || 0;  bv = b.area || 0; }
      else if (sortKey === "kwh")  { av = a.predicted_kwh || 0; bv = b.predicted_kwh || 0; }
      else /* date */              { av = a.submittedAt ? new Date(a.submittedAt) : 0; bv = b.submittedAt ? new Date(b.submittedAt) : 0; }
      return sortAsc ? av - bv : bv - av;
    });
    return list;
  }, [buildings, search, sortKey, sortAsc]);

  const handleDelete = (id) => {
    if (!window.confirm(t.myspace.delete_confirm)) return;
    deleteUserBuilding(id);
    onRefresh();
  };

  const handleSaveTag = (building) => {
    const tag = orgTags[building.id] ?? building.org_tag ?? "";
    updateUserBuilding(building.id, { org_tag: tag });
    setSavedTags(prev => ({ ...prev, [building.id]: true }));
    setTimeout(() => setSavedTags(prev => ({ ...prev, [building.id]: false })), 2000);
    onRefresh();
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (buildings.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        text={t.myspace.building_list_empty}
        action={
          <button className="btn btn-primary" onClick={() => navigate("/data-input")}>
            <Upload size={15} /> {t.myspace.go_data_input}
          </button>
        }
      />
    );
  }

  return (
    <div>
      {/* Search + Sort toolbar */}
      <div className="ms-bld-toolbar">
        <div className="ms-bld-search-wrap">
          <Search size={14} className="ms-bld-search-icon" />
          <input
            className="ms-bld-search"
            placeholder="Хайх… (нэр, дүүрэг, төрөл)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="ms-bld-search-clear" onClick={() => setSearch("")}>×</button>}
        </div>
        <div className="ms-sort-btns">
          {[
            { key: "date",  label: "Огноо" },
            { key: "grade", label: "Зэрэглэл" },
            { key: "area",  label: "Талбай" },
            { key: "kwh",   label: "кВт·цаг" },
          ].map(s => (
            <button
              key={s.key}
              className={`ms-sort-btn${sortKey === s.key ? " active" : ""}`}
              onClick={() => toggleSort(s.key)}
            >
              {s.label}
              {sortKey === s.key
                ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                : <ArrowUpDown size={11} />
              }
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="ms-empty" style={{ paddingTop: "2rem" }}>
          <Search size={28} /><p>Хайлтын үр дүн олдсонгүй</p>
        </div>
      ) : (
        <>
          <div className="ms-bld-count">{filtered.length} / {buildings.length} барилга</div>
          <div className="ms-buildings-list">
            {filtered.map(b => (
              <div key={b.id} className="ms-building-card card">
                <div className="ms-building-main">
                  <div className="ms-bld-grade-bar" style={{ background: GRADE_COLORS[b.grade] || "#888" }} />
                  <div className="ms-building-info">
                    <div className="ms-building-name">
                      <Building2 size={16} />
                      <strong>{b.name}</strong>
                      <GradePill grade={b.grade} />
                    </div>
                    <div className="ms-building-meta">
                      <span>{TYPE_LABELS[b.type] || b.type}</span>
                      <span>·</span>
                      <span>{b.area} м²</span>
                      <span>·</span>
                      <span>{b.year}</span>
                      <span>·</span>
                      <span>{b.district}</span>
                      {b.submittedAt && (
                        <><span>·</span><span>{new Date(b.submittedAt).toLocaleDateString("mn-MN")}</span></>
                      )}
                    </div>
                    <div className="ms-building-energy">
                      <Zap size={12} />
                      <span>{(b.predicted_kwh || 0).toLocaleString()} кВт·цаг/жил</span>
                      <span>·</span>
                      <span>{b.intensity || 0} кВт·цаг/м²</span>
                    </div>
                  </div>
                  <button
                    className="ms-icon-btn ms-danger"
                    onClick={() => handleDelete(b.id)}
                    title={t.myspace.delete_building}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {isOfficialOrAdmin && (
                  <div className="ms-org-tag-row">
                    <Tag size={13} />
                    <input
                      className="ms-org-tag-input"
                      placeholder={t.myspace.org_tag_placeholder}
                      value={orgTags[b.id] ?? b.org_tag ?? ""}
                      onChange={e => setOrgTags(prev => ({ ...prev, [b.id]: e.target.value }))}
                    />
                    <button className="btn btn-secondary ms-tag-btn" onClick={() => handleSaveTag(b)}>
                      {savedTags[b.id] ? t.myspace.org_tag_saved : t.myspace.org_tag_save}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Dataset Tab ───────────────────────────────────────────────────────────────
function DatasetTab({ t, buildings }) {
  const qualityScore = useMemo(() => {
    if (!buildings.length) return 0;
    const scored = buildings.map(b => {
      let score = 0;
      if (b.name && b.name !== "Нэргүй барилга") score += 20;
      if (b.area > 0) score += 20;
      if (b.year > 1940) score += 20;
      if (b.district && b.district !== "Улаанбаатар") score += 20;
      if (b.wall_material) score += 20;
      return score;
    });
    return Math.round(scored.reduce((s, v) => s + v, 0) / buildings.length);
  }, [buildings]);

  const downloadCSV = () => {
    const BOM = "\uFEFF";
    const cols = ["id", "name", "type", "area", "floors", "year", "district", "grade", "predicted_kwh", "intensity", "co2", "submittedAt"];
    const rows = buildings.map(b => cols.map(c => JSON.stringify(b[c] ?? "")).join(","));
    const csv = BOM + [cols.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "my_buildings.csv";
    a.click();
  };

  const downloadJSON = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(buildings, null, 2)], { type: "application/json" }));
    a.download = "my_buildings.json";
    a.click();
  };

  if (buildings.length === 0) return <EmptyState icon={Database} text={t.myspace.dataset_empty} />;

  return (
    <div>
      <div className="ms-dataset-header">
        <div className="ms-quality-score">
          <span>{t.myspace.quality_score}:</span>
          <span className="ms-quality-value" style={{ color: qualityScore >= 80 ? "#2a9d8f" : qualityScore >= 50 ? "#e9c46a" : "#e63946" }}>
            {qualityScore}%
          </span>
          <div className="ms-quality-bar-wrap">
            <div className="ms-quality-bar" style={{ width: `${qualityScore}%`, background: qualityScore >= 80 ? "#2a9d8f" : qualityScore >= 50 ? "#e9c46a" : "#e63946" }} />
          </div>
        </div>
        <div className="ms-dataset-btns">
          <button className="btn btn-secondary" onClick={downloadCSV}><Download size={14} /> {t.myspace.download_csv}</button>
          <button className="btn btn-secondary" onClick={downloadJSON}><Download size={14} /> {t.myspace.download_json}</button>
        </div>
      </div>

      <div className="ms-table-scroll">
        <table className="ms-table">
          <thead>
            <tr>
              <th>{t.myspace.history_building}</th>
              <th>Төрөл</th><th>Талбай</th><th>Он</th>
              <th>Дүүрэг</th><th>Зэрэглэл</th><th>кВт·цаг/жил</th><th>кВт·цаг/м²</th>
            </tr>
          </thead>
          <tbody>
            {buildings.map(b => (
              <tr key={b.id}>
                <td><strong>{b.name}</strong></td>
                <td>{TYPE_LABELS[b.type] || b.type}</td>
                <td>{b.area} м²</td>
                <td>{b.year}</td>
                <td>{b.district}</td>
                <td><GradePill grade={b.grade} /></td>
                <td>{(b.predicted_kwh || 0).toLocaleString()}</td>
                <td>{b.intensity || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Prediction History Tab ────────────────────────────────────────────────────
function HistoryTab({ t, user, predictions, onRefresh }) {
  const navigate = useNavigate();

  const handleClear = () => {
    if (!window.confirm("Бүх таамаглалын түүхийг устгах уу?")) return;
    clearPredictions(user.id);
    onRefresh();
  };

  const handleDelete = (id) => {
    deletePrediction(user.id, id);
    onRefresh();
  };

  if (predictions.length === 0) {
    return (
      <EmptyState
        icon={History}
        text={t.myspace.history_empty}
        action={
          <button className="btn btn-primary" onClick={() => navigate("/predictor")}>
            <Zap size={15} /> Таамаглал хийх
          </button>
        }
      />
    );
  }

  const latest = predictions[0];

  return (
    <div>
      {/* Latest prediction featured card */}
      <div className="card ms-latest-pred">
        <div className="ms-latest-label">Сүүлийн таамаглал</div>
        <div className="ms-latest-main">
          <div className="ms-latest-info">
            <div className="ms-latest-name">
              <History size={16} style={{ color: "#2a9d8f" }} />
              <strong>{latest.form?.name || "Барилга"}</strong>
              {latest.form?.grade && <GradePill grade={latest.form.grade} />}
            </div>
            <div className="ms-latest-meta">
              {latest.form?.type && <span>{TYPE_LABELS[latest.form.type] || latest.form.type}</span>}
              {latest.form?.area && <><span>·</span><span>{latest.form.area} м²</span></>}
              {latest.form?.year && <><span>·</span><span>{latest.form.year}</span></>}
            </div>
          </div>
          <div className="ms-latest-kwh">
            <div className="ms-latest-kwh-val">{latest.result ? Math.round(latest.result).toLocaleString() : "—"}</div>
            <div className="ms-latest-kwh-lbl">кВт·цаг/жил</div>
          </div>
        </div>
        <div className="ms-latest-footer">
          <span>{new Date(latest.savedAt).toLocaleString("mn-MN")}</span>
          <button className="btn btn-primary" style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }} onClick={() => navigate("/predictor")}>
            <ChevronRight size={13} /> Шинэ таамаглал
          </button>
        </div>
      </div>

      <div className="ms-list-header">
        <span>{predictions.length} таамаглал</span>
        <button className="btn btn-secondary ms-danger-btn" onClick={handleClear}>
          <Trash2 size={14} /> {t.myspace.history_clear}
        </button>
      </div>

      <div className="ms-cards-list">
        {predictions.map(p => (
          <div key={p.id} className="ms-pred-card card">
            <div className="ms-pred-main">
              <div>
                <div className="ms-pred-name">
                  <History size={14} />
                  <strong>{p.form?.name || "Барилга"}</strong>
                  {p.form?.grade && <GradePill grade={p.form.grade} />}
                </div>
                <div className="ms-pred-meta">
                  {p.form?.type && <span>{TYPE_LABELS[p.form.type] || p.form.type}</span>}
                  {p.form?.area && <><span>·</span><span>{p.form.area} м²</span></>}
                  {p.form?.year && <><span>·</span><span>{p.form.year}</span></>}
                </div>
                {p.result && (
                  <div className="ms-pred-result">
                    <Zap size={12} />
                    <span>{Math.round(p.result).toLocaleString()} кВт·цаг/жил</span>
                  </div>
                )}
              </div>
              <div className="ms-pred-right">
                <span className="ms-pred-date">{new Date(p.savedAt).toLocaleDateString("mn-MN")}</span>
                <button className="ms-icon-btn ms-danger" onClick={() => handleDelete(p.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scenarios Tab ─────────────────────────────────────────────────────────────
function ScenariosTab({ t, user, scenarios, onRefresh }) {
  const navigate = useNavigate();

  const handleLoad   = (s) => navigate("/predictor", { state: { scenario: s } });
  const handleDelete = (id) => { deleteScenario(user.id, id); onRefresh(); };

  if (scenarios.length === 0) return <EmptyState icon={Bookmark} text={t.myspace.scenario_empty} />;

  return (
    <div className="ms-cards-list">
      {scenarios.map(s => (
        <div key={s.id} className="ms-scenario-card card">
          <div className="ms-scenario-main">
            <div>
              <div className="ms-scenario-name"><Bookmark size={14} /><strong>{s.label || s.name || "Сценари"}</strong></div>
              {s.form && (
                <div className="ms-scenario-meta">
                  {s.form.type && <span>{TYPE_LABELS[s.form.type] || s.form.type}</span>}
                  {s.form.area && <><span>·</span><span>{s.form.area} м²</span></>}
                  {s.form.year && <><span>·</span><span>{s.form.year}</span></>}
                </div>
              )}
              <div className="ms-scenario-date">{new Date(s.savedAt || s.updatedAt).toLocaleDateString("mn-MN")}</div>
            </div>
            <div className="ms-scenario-actions">
              <button className="btn btn-primary ms-load-btn" onClick={() => handleLoad(s)}>
                <ChevronRight size={14} /> {t.myspace.load_scenario}
              </button>
              <button className="ms-icon-btn ms-danger" onClick={() => handleDelete(s.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Favorites Tab ─────────────────────────────────────────────────────────────
function FavoritesTab({ t, user, favorites, onRefresh }) {
  const handleRemove = (id) => { removeFavorite(user.id, id); onRefresh(); };

  if (favorites.length === 0) return <EmptyState icon={Star} text={t.myspace.favorites_empty} />;

  return (
    <div className="ms-buildings-list">
      {favorites.map(b => (
        <div key={b.id} className="ms-building-card card">
          <div className="ms-building-main">
            <div className="ms-building-info">
              <div className="ms-building-name">
                <Star size={15} style={{ color: "#f4a261", fill: "#f4a261" }} />
                <strong>{b.name}</strong>
                <GradePill grade={b.grade} />
              </div>
              <div className="ms-building-meta">
                <span>{TYPE_LABELS[b.type] || b.type}</span>
                <span>·</span><span>{b.area} м²</span>
                <span>·</span><span>{b.year}</span>
                <span>·</span><span>{b.district}</span>
              </div>
              {b.favoritedAt && (
                <div className="ms-building-energy" style={{ color: "var(--text3)" }}>
                  <Star size={12} />
                  <span>Нэмсэн: {new Date(b.favoritedAt).toLocaleDateString("mn-MN")}</span>
                </div>
              )}
            </div>
            <button className="ms-icon-btn ms-danger" onClick={() => handleRemove(b.id)} title={t.myspace.remove_favorite}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab({ t, user, buildings, predictions, scenarios }) {
  const [period, setPeriod] = useState("all");

  const filterByPeriod = (items, dateKey) => {
    if (period === "all") return items;
    const now    = new Date();
    const cutoff = period === "year"
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    return items.filter(i => i[dateKey] && new Date(i[dateKey]) >= cutoff);
  };

  const filteredBuildings   = filterByPeriod(buildings,   "submittedAt");
  const filteredPredictions = filterByPeriod(predictions, "savedAt");
  const filteredScenarios   = filterByPeriod(scenarios,   "savedAt");

  const generateHTMLReport = () => {
    const totalKwh = filteredBuildings.reduce((s, b) => s + (b.predicted_kwh || 0), 0);
    const periodStr = period === "all" ? "Бүх цаг" : period === "year" ? "Энэ жил" : "Энэ сар";
    const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="UTF-8"><title>UB Energy — Тайлан</title>
<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;color:#1a1a2e}h1{color:#1a6eb5}h2{color:#2a4a7f;border-bottom:2px solid #eee;padding-bottom:.3rem}table{width:100%;border-collapse:collapse;font-size:.9rem;margin-bottom:1.5rem}th{background:#1a6eb5;color:white;padding:8px 12px;text-align:left}td{padding:7px 12px;border-bottom:1px solid #eee}tr:hover td{background:#f7f9fc}.stat{display:inline-block;margin-right:2rem}.stat-value{font-size:1.4rem;font-weight:700;color:#1a6eb5}.footer{margin-top:2rem;font-size:.8rem;color:#888}</style></head><body>
<h1>UB Energy — Хувийн тайлан</h1>
<p>Хэрэглэгч: <strong>${user?.name || "—"}</strong> &nbsp;|&nbsp; Огноо: ${new Date().toLocaleDateString("mn-MN")} &nbsp;|&nbsp; Хугацаа: ${periodStr}</p>
<h2>Хураангуй</h2>
<div><div class="stat"><div class="stat-value">${filteredBuildings.length}</div><div>Барилга</div></div><div class="stat"><div class="stat-value">${filteredPredictions.length}</div><div>Таамаглал</div></div><div class="stat"><div class="stat-value">${Math.round(totalKwh / 1000)} МВт·цаг</div><div>Нийт хэрэглээ</div></div></div>
<h2>Барилгууд</h2>
<table><thead><tr><th>Нэр</th><th>Төрөл</th><th>Талбай</th><th>Он</th><th>Зэрэглэл</th><th>кВт·цаг/жил</th></tr></thead>
<tbody>${filteredBuildings.map(b => `<tr><td>${b.name}</td><td>${TYPE_LABELS[b.type]||b.type}</td><td>${b.area} м²</td><td>${b.year}</td><td>${b.grade}</td><td>${(b.predicted_kwh||0).toLocaleString()}</td></tr>`).join("")}</tbody></table>
<div class="footer">UB Energy · ubenergy.vercel.app · ${new Date().getFullYear()}</div></body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `ub_energy_report_${new Date().toISOString().slice(0,10)}.html`;
    a.click();
  };

  const generateCSV = () => {
    const BOM = "\uFEFF";
    const cols = ["id","name","type","area","floors","year","district","grade","predicted_kwh","intensity","co2","submittedAt"];
    const rows = filteredBuildings.map(b => cols.map(c => JSON.stringify(b[c] ?? "")).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([BOM + [cols.join(","),...rows].join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `ub_energy_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const generateJSON = () => {
    const data = { user: user?.name, generatedAt: new Date().toISOString(), period, buildings: filteredBuildings, predictions: filteredPredictions, scenarios: filteredScenarios };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `ub_energy_report_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const roleInfo = user?.role === "admin"
    ? { icon: <Shield size={18} />, label: t.myspace.role_admin,   desc: t.myspace.role_admin_desc,   color: "#e63946" }
    : user?.role === "manager"
    ? { icon: <Award size={18} />,  label: t.myspace.role_manager, desc: t.myspace.role_manager_desc, color: "#f4a261" }
    : { icon: <User size={18} />,   label: t.myspace.role_user,    desc: t.myspace.role_user_desc,    color: "#1a6eb5" };

  return (
    <div>
      <div className="card ms-report-card">
        <h4>{t.myspace.reports_title}</h4>
        <div className="ms-period-row">
          <span>{t.myspace.report_period}:</span>
          {["all","year","month"].map(p => (
            <button key={p} className={`ms-period-btn${period === p ? " active" : ""}`} onClick={() => setPeriod(p)}>
              {t.myspace[`report_${p}`]}
            </button>
          ))}
        </div>
        <div className="ms-report-stats">
          <span>{filteredBuildings.length} барилга</span>
          <span>·</span>
          <span>{filteredPredictions.length} таамаглал</span>
          <span>·</span>
          <span>{filteredScenarios.length} сценари</span>
        </div>
        <div className="ms-report-btns">
          <button className="btn btn-primary" onClick={generateHTMLReport}><FileText size={15} /> {t.myspace.download_html}</button>
          <button className="btn btn-secondary" onClick={generateCSV}><Download size={15} /> {t.myspace.download_report_csv}</button>
          <button className="btn btn-secondary" onClick={generateJSON}><Download size={15} /> {t.myspace.download_report_json}</button>
        </div>
      </div>

      <div className="card ms-role-info-card mt-3">
        <div className="ms-role-badge" style={{ background: `${roleInfo.color}1a`, color: roleInfo.color }}>
          {roleInfo.icon}<span>{roleInfo.label}</span>
        </div>
        <p className="ms-role-desc">{roleInfo.desc}</p>
        {user?.email && (
          <div className="ms-role-meta"><User size={13} /> <span>{user.email}</span></div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MySpacePage() {
  const { t } = useLang();
  const { user } = useAuth();
  usePageTitle(t.nav.mySpace);

  const [activeTab, setActiveTab] = useState("summary");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buildings   = useMemo(() => getUserBuildings(user?.id).filter(b => b.source !== "mock"), [tick, user?.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const predictions = useMemo(() => getPredictions(user?.id),  [tick, user?.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scenarios   = useMemo(() => getScenarios(user?.id),    [tick, user?.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const favorites   = useMemo(() => getFavorites(user?.id),    [tick, user?.id]);

  const TAB_CONFIG = [
    { id: "summary",   icon: <BarChart2 size={15} />, label: t.myspace.tab_summary },
    { id: "buildings", icon: <Building2 size={15} />, label: t.myspace.tab_buildings,  badge: buildings.length },
    { id: "dataset",   icon: <Database size={15} />,  label: t.myspace.tab_dataset },
    { id: "history",   icon: <History size={15} />,   label: t.myspace.tab_history,    badge: predictions.length },
    { id: "scenarios", icon: <Bookmark size={15} />,  label: t.myspace.tab_scenarios,  badge: scenarios.length },
    { id: "favorites", icon: <Star size={15} />,      label: t.myspace.tab_favorites,  badge: favorites.length },
    { id: "reports",   icon: <FileText size={15} />,  label: t.myspace.tab_reports },
  ];

  if (!user) {
    return (
      <div className="container ms-page">
        <div className="ms-no-user card">
          <AlertCircle size={40} />
          <p>Нэвтрэх шаардлагатай</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-page">
      <div className="container">
        <div className="ms-header card">
          <div className="ms-header-avatar">
            {user.avatar
              ? <img src={user.avatar} alt={user.name} />
              : <span>{user.name?.charAt(0)?.toUpperCase()}</span>
            }
          </div>
          <div className="ms-header-info">
            <h1><Package size={22} />{t.myspace.title}</h1>
            <p>{t.myspace.subtitle}</p>
            <div className="ms-header-user">
              <span className="ms-header-name">{user.name}</span>
              {user.role === "admin" && (
                <span className="ms-role-chip ms-chip-admin"><Shield size={11} /> {t.myspace.role_admin}</span>
              )}
              {user.role === "manager" && (
                <span className="ms-role-chip ms-chip-manager"><Award size={11} /> {t.myspace.role_manager}</span>
              )}
            </div>
          </div>
        </div>

        <div className="ms-tabs">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.id}
              className={`ms-tab-btn${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span className="ms-tab-label">{tab.label}</span>
              {tab.badge > 0 && <span className="ms-tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </div>

        <div className="ms-tab-content">
          {activeTab === "summary" && (
            <SummaryTab
              t={t} user={user}
              buildings={buildings} predictions={predictions}
              scenarios={scenarios} favorites={favorites}
              onTabChange={setActiveTab}
            />
          )}
          {activeTab === "buildings"  && <BuildingsTab t={t} user={user} buildings={buildings} onRefresh={refresh} />}
          {activeTab === "dataset"    && <DatasetTab t={t} buildings={buildings} />}
          {activeTab === "history"    && <HistoryTab t={t} user={user} predictions={predictions} onRefresh={refresh} />}
          {activeTab === "scenarios"  && <ScenariosTab t={t} user={user} scenarios={scenarios} onRefresh={refresh} />}
          {activeTab === "favorites"  && <FavoritesTab t={t} user={user} favorites={favorites} onRefresh={refresh} />}
          {activeTab === "reports"    && <ReportsTab t={t} user={user} buildings={buildings} predictions={predictions} scenarios={scenarios} favorites={favorites} />}
        </div>
      </div>
    </div>
  );
}
