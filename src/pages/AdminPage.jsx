import { useState, useMemo } from "react";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuth } from "../contexts/AuthContext";
import {
  Settings, Users, BarChart2, Database, Shield,
  CheckCircle, TrendingUp, Trash2, Lock, History,
  Search, ChevronDown, AlertTriangle, UserCheck,
  UserX, Building2, Activity, RefreshCw, Download,
} from "lucide-react";
import { storageGetJSON, storageSetJSON } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";
import "./AdminPage.css";

// ── Correct admin email (matches AuthContext) ──────────────────────────────────
const ADMIN_EMAIL = "admin@ubenergy.mn";
const ADMIN_SEED = {
  id: "admin_1", name: "Админ", email: ADMIN_EMAIL,
  type: "official", org: "UBenergy", role: "admin",
  createdAt: new Date("2024-01-01").toISOString(),
  isDemo: true,
};

const GRADE_COLORS = { A:"#2a9d8f", B:"#57cc99", C:"#e9c46a", D:"#f4a261", E:"#e76f51", F:"#e63946", G:"#6d2b2b" };
const TYPE_LABELS  = { apartment:"Орон сууц", office:"Оффис", school:"Сургууль", hospital:"Эмнэлэг", commercial:"Худалдааны", warehouse:"Агуулах" };
const ROLE_LABELS  = { admin:"Админ", manager:"Менежер", user:"Хэрэглэгч" };
const ROLE_COLORS  = { admin:"#e63946", manager:"#f4a261", user:"#2a9d8f" };
const ACTION_LABELS = { add:"Нэмсэн", delete:"Устгасан", import:"Импорт" };

// ── localStorage helpers ───────────────────────────────────────────────────────
function loadUsers() {
  const stored = storageGetJSON(STORAGE_KEYS.users, []);
  return [ADMIN_SEED, ...stored.filter(u => u.email !== ADMIN_EMAIL)];
}

function saveUsers(users) {
  // Never save admin_seed to localStorage
  storageSetJSON(STORAGE_KEYS.users, users.filter(u => u.id !== "admin_1"));
}

function loadBuildings() {
  return storageGetJSON(STORAGE_KEYS.buildings, []);
}

function deleteBuilding(id) {
  storageSetJSON(STORAGE_KEYS.buildings, loadBuildings().filter(b => b.id !== id));
}

function loadAllLogs(users) {
  const all = [];
  users.forEach(u => {
    try {
      const logs = JSON.parse(localStorage.getItem(`ubenergy_log_${u.id}`) || "[]");
      logs.forEach(e => all.push({ ...e, userName: u.name, userId: u.id }));
    } catch {}
  });
  return all.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

function clearAllLogs(users) {
  users.forEach(u => localStorage.removeItem(`ubenergy_log_${u.id}`));
}

const SETTINGS_KEY = "ubenergy_admin_settings";
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); }
  catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

// ── Helpers ────────────────────────────────────────────────────────────────────
function GradePill({ grade }) {
  return (
    <span className="adm-grade-pill" style={{ background: GRADE_COLORS[grade] || "#888" }}>{grade}</span>
  );
}

function RoleBadge({ role }) {
  return (
    <span className="adm-role-badge" style={{ background: `${ROLE_COLORS[role] || "#888"}22`, color: ROLE_COLORS[role] || "#888" }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ users, buildings, logs }) {
  const gradeCounts = useMemo(() => {
    const c = {};
    buildings.forEach(b => { c[b.grade] = (c[b.grade] || 0) + 1; });
    return c;
  }, [buildings]);

  const typeCounts = useMemo(() => {
    const c = {};
    buildings.forEach(b => { c[b.type] = (c[b.type] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [buildings]);

  const totalKwh = buildings.reduce((s, b) => s + (b.predicted_kwh || 0), 0);

  const topStats = [
    { label: "Нийт хэрэглэгч",   value: users.length,       icon: <Users size={20} />,     color: "#3a8fd4" },
    { label: "Нийт барилга",      value: buildings.length,   icon: <Building2 size={20} />, color: "#2a9d8f" },
    { label: "Нийт МВт·цаг/жил", value: `${Math.round(totalKwh/1000).toLocaleString()} МВт`, icon: <TrendingUp size={20} />, color: "#f4a261" },
    { label: "Нийт үйлдэл",      value: logs.length,        icon: <Activity size={20} />,  color: "#6c3ec5" },
  ];

  return (
    <div>
      <div className="adm-demo-note" style={{ background: "rgba(244,162,97,0.1)", border: "1px solid rgba(244,162,97,0.35)", borderRadius: 8, padding: "0.55rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#f4a261", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <AlertTriangle size={14} />
        <span><strong>Demo статистик</strong> — Хэрэглэгч, таамаглалын тоо нь бодит backend байхгүй тул localStorage-д суурилсан жишиг утга болно.</span>
      </div>
      <div className="adm-stat-grid mb-3">
        {topStats.map(s => (
          <div key={s.label} className="card adm-stat-card">
            <div className="adm-stat-icon" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
            <div className="adm-stat-val">{s.value}</div>
            <div className="adm-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="adm-overview-grid">
        {/* Grade distribution */}
        <div className="card">
          <h3 className="section-title" style={{ fontSize: "0.95rem" }}>Барилгын зэрэглэлийн тархалт</h3>
          {buildings.length === 0 ? (
            <p className="adm-empty-msg">Барилгын мэдээлэл байхгүй</p>
          ) : (
            <div className="adm-grade-bars">
              {["A","B","C","D","E","F","G"].map(g => {
                const count = gradeCounts[g] || 0;
                const pct = buildings.length ? Math.round(count / buildings.length * 100) : 0;
                return count > 0 ? (
                  <div key={g} className="adm-grade-row">
                    <span className="adm-grade-lbl" style={{ color: GRADE_COLORS[g] }}>{g}</span>
                    <div className="adm-bar-track">
                      <div className="adm-bar-fill" style={{ width: `${pct}%`, background: GRADE_COLORS[g] }} />
                    </div>
                    <span className="adm-bar-count">{count} <span className="adm-bar-pct">({pct}%)</span></span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Type breakdown */}
        <div className="card">
          <h3 className="section-title" style={{ fontSize: "0.95rem" }}>Барилгын төрлийн тархалт</h3>
          {typeCounts.length === 0 ? (
            <p className="adm-empty-msg">Мэдээлэл байхгүй</p>
          ) : (
            <div className="adm-grade-bars">
              {typeCounts.map(([type, count]) => {
                const pct = buildings.length ? Math.round(count / buildings.length * 100) : 0;
                return (
                  <div key={type} className="adm-grade-row">
                    <span className="adm-type-lbl">{TYPE_LABELS[type] || type}</span>
                    <div className="adm-bar-track">
                      <div className="adm-bar-fill" style={{ width: `${pct}%`, background: "#3a8fd4" }} />
                    </div>
                    <span className="adm-bar-count">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent logs */}
        <div className="card adm-recent-logs">
          <h3 className="section-title" style={{ fontSize: "0.95rem" }}>Сүүлийн үйл ажиллагаа</h3>
          {logs.length === 0 ? (
            <p className="adm-empty-msg">Бүртгэл байхгүй</p>
          ) : (
            <div className="adm-log-list">
              {logs.slice(0, 8).map((e, i) => (
                <div key={i} className={`adm-log-row adm-act-${e.action || "add"}`}>
                  <span className={`adm-log-dot adm-dot-${e.action || "add"}`} />
                  <span className="adm-log-user">{e.userName}</span>
                  <span className="adm-log-action">{ACTION_LABELS[e.action] || e.action}</span>
                  <span className="adm-log-name">{e.name || "—"}</span>
                  <span className="adm-log-time">{e.at ? new Date(e.at).toLocaleString("mn-MN") : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User breakdown */}
        <div className="card">
          <h3 className="section-title" style={{ fontSize: "0.95rem" }}>Хэрэглэгчийн эрхийн тархалт</h3>
          <div className="adm-grade-bars">
            {Object.entries(
              users.reduce((acc, u) => { acc[u.role || "user"] = (acc[u.role || "user"] || 0) + 1; return acc; }, {})
            ).map(([role, count]) => (
              <div key={role} className="adm-grade-row">
                <span className="adm-type-lbl">{ROLE_LABELS[role] || role}</span>
                <div className="adm-bar-track">
                  <div className="adm-bar-fill" style={{ width: `${Math.round(count / users.length * 100)}%`, background: ROLE_COLORS[role] || "#888" }} />
                </div>
                <span className="adm-bar-count">{count}</span>
              </div>
            ))}
          </div>
          <div className="adm-overview-counts mt-2">
            {[
              { label: "Нийт хэрэглэгч",      val: users.length },
              { label: "Түдгэлзүүлсэн",        val: users.filter(u => u.suspended).length },
              { label: "Байгуулгын эрхтэй",    val: users.filter(u => u.type === "official").length },
            ].map(({ label, val }) => (
              <div key={label} className="adm-overview-count">
                <div className="adm-ovc-num">{val}</div>
                <div className="adm-ovc-lbl">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ users, buildings, onRefresh }) {
  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [confirmId,  setConfirmId]  = useState(null);
  const [confirmAct, setConfirmAct] = useState(null); // "delete" | "suspend"

  const userBldCount = useMemo(() => {
    const counts = {};
    buildings.forEach(b => {
      if (b.userId) counts[b.userId] = (counts[b.userId] || 0) + 1;
    });
    return counts;
  }, [buildings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== "all" && (u.role || "user") !== roleFilter) return false;
      if (typeFilter !== "all" && u.type !== typeFilter) return false;
      if (q && !(u.name || "").toLowerCase().includes(q) && !(u.email || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, search, roleFilter, typeFilter]);

  const handleRoleChange = (userId, newRole) => {
    const stored = storageGetJSON(STORAGE_KEYS.users, []);
    storageSetJSON(STORAGE_KEYS.users, stored.map(u => u.id === userId ? { ...u, role: newRole } : u));
    onRefresh();
  };

  const handleSuspend = (userId) => {
    const stored = storageGetJSON(STORAGE_KEYS.users, []);
    storageSetJSON(STORAGE_KEYS.users, stored.map(u => u.id === userId ? { ...u, suspended: !u.suspended } : u));
    onRefresh();
    setConfirmId(null);
  };

  const handleDelete = (userId) => {
    const stored = storageGetJSON(STORAGE_KEYS.users, []);
    storageSetJSON(STORAGE_KEYS.users, stored.filter(u => u.id !== userId));
    onRefresh();
    setConfirmId(null);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="adm-toolbar mb-2">
        <div className="adm-search-wrap">
          <Search size={14} className="adm-search-icon" />
          <input
            className="adm-search"
            placeholder="Нэр, имэйлээр хайх…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="adm-search-clear" onClick={() => setSearch("")}>×</button>}
        </div>
        <select className="adm-filter-sel" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">Бүх эрх</option>
          <option value="admin">Админ</option>
          <option value="manager">Менежер</option>
          <option value="user">Хэрэглэгч</option>
        </select>
        <select className="adm-filter-sel" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Бүх төрөл</option>
          <option value="official">Байгуулга</option>
          <option value="personal">Хувь хүн</option>
        </select>
        <span className="adm-result-count">{filtered.length} / {users.length}</span>
      </div>

      <div className="card adm-table-card">
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Нэр</th>
                <th>Имэйл</th>
                <th>Төрөл</th>
                <th>Байгуулга</th>
                <th>Эрх</th>
                <th>Барилга</th>
                <th>Бүртгэлтэй</th>
                <th>Төлөв</th>
                <th>Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} className={u.suspended ? "adm-row-suspended" : ""}>
                  <td className="adm-td-muted">{i + 1}</td>
                  <td>
                    <div className="adm-user-cell">
                      <div className="adm-user-avatar" style={{ background: u.role === "admin" ? "#e636461a" : "#1a6eb51a", color: u.role === "admin" ? "#e63946" : "#1a6eb5" }}>
                        {(u.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="adm-user-name">{u.name}</span>
                    </div>
                  </td>
                  <td className="adm-td-muted">{u.email}</td>
                  <td>
                    <span className={`adm-type-badge ${u.type === "official" ? "official" : "personal"}`}>
                      {u.type === "official" ? "Байгуулга" : "Хувь хүн"}
                    </span>
                  </td>
                  <td className="adm-td-muted">{u.org || "—"}</td>
                  <td>
                    {u.id === "admin_1" ? (
                      <RoleBadge role="admin" />
                    ) : (
                      <select
                        className="adm-role-sel"
                        value={u.role || "user"}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        style={{ color: ROLE_COLORS[u.role || "user"] }}
                      >
                        <option value="user">Хэрэглэгч</option>
                        <option value="manager">Менежер</option>
                        <option value="admin">Админ</option>
                      </select>
                    )}
                  </td>
                  <td className="adm-td-center">{userBldCount[u.id] || 0}</td>
                  <td className="adm-td-muted">{u.createdAt ? u.createdAt.slice(0,10) : "—"}</td>
                  <td>
                    {u.suspended
                      ? <span className="adm-status-badge suspended">Түдгэлзсэн</span>
                      : <span className="adm-status-badge active">Идэвхтэй</span>
                    }
                  </td>
                  <td>
                    {u.id !== "admin_1" && (
                      confirmId === u.id ? (
                        <div className="adm-confirm-row">
                          <span className="adm-confirm-label">{confirmAct === "delete" ? "Устгах уу?" : "Түдгэлзүүлэх үү?"}</span>
                          <button className="adm-act-btn danger" onClick={() => confirmAct === "delete" ? handleDelete(u.id) : handleSuspend(u.id)}>Тийм</button>
                          <button className="adm-act-btn" onClick={() => setConfirmId(null)}>Үгүй</button>
                        </div>
                      ) : (
                        <div className="adm-actions-row">
                          <button
                            className={`adm-act-btn${u.suspended ? " success" : " warn"}`}
                            onClick={() => { setConfirmId(u.id); setConfirmAct("suspend"); }}
                            title={u.suspended ? "Идэвхжүүлэх" : "Түдгэлзүүлэх"}
                          >
                            {u.suspended ? <UserCheck size={13} /> : <UserX size={13} />}
                          </button>
                          <button
                            className="adm-act-btn danger"
                            onClick={() => { setConfirmId(u.id); setConfirmAct("delete"); }}
                            title="Устгах"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Data / Buildings Moderation Tab ────────────────────────────────────────────
function DataTab({ buildings, users, onRefresh }) {
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [gradeFilter,setGradeFilter]= useState("all");
  const [confirmId,  setConfirmId]  = useState(null);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => { m[u.id] = u.name; });
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return buildings.filter(b => {
      if (typeFilter  !== "all" && b.type  !== typeFilter)  return false;
      if (gradeFilter !== "all" && b.grade !== gradeFilter) return false;
      if (q && !(b.name || "").toLowerCase().includes(q) && !(b.district || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [buildings, search, typeFilter, gradeFilter]);

  const handleDelete = (id) => {
    deleteBuilding(id);
    onRefresh();
    setConfirmId(null);
  };

  const exportCSV = () => {
    const BOM  = "\uFEFF";
    const cols = ["id","name","type","area","floors","year","district","grade","predicted_kwh","intensity","userId","submittedAt"];
    const rows = filtered.map(b => cols.map(c => JSON.stringify(b[c] ?? "")).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([BOM + [cols.join(","),...rows].join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `admin_buildings_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="adm-toolbar mb-2">
        <div className="adm-search-wrap">
          <Search size={14} className="adm-search-icon" />
          <input
            className="adm-search"
            placeholder="Нэр, дүүрэгээр хайх…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="adm-search-clear" onClick={() => setSearch("")}>×</button>}
        </div>
        <select className="adm-filter-sel" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Бүх төрөл</option>
          {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="adm-filter-sel" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
          <option value="all">Бүх зэрэглэл</option>
          {["A","B","C","D","E","F","G"].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button className="btn btn-secondary" style={{ fontSize:"0.8rem", padding:"0.35rem 0.75rem" }} onClick={exportCSV}>
          <Download size={13} /> CSV
        </button>
        <span className="adm-result-count">{filtered.length} / {buildings.length} барилга</span>
      </div>

      <div className="card adm-table-card">
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th><th>Нэр</th><th>Төрөл</th><th>Талбай</th>
                <th>Зэрэглэл</th><th>кВт·цаг/жил</th><th>Дүүрэг</th>
                <th>Хэрэглэгч</th><th>Оруулсан</th><th>Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="adm-empty-row">Олдсонгүй</td></tr>
              ) : filtered.map((b, i) => (
                <tr key={b.id}>
                  <td className="adm-td-muted">{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td className="adm-td-muted">{TYPE_LABELS[b.type] || b.type}</td>
                  <td className="adm-td-muted">{b.area} м²</td>
                  <td><GradePill grade={b.grade} /></td>
                  <td className="adm-td-muted">{(b.predicted_kwh||0).toLocaleString()}</td>
                  <td className="adm-td-muted">{b.district || "—"}</td>
                  <td className="adm-td-muted">{userMap[b.userId] || "—"}</td>
                  <td className="adm-td-muted">{b.submittedAt ? b.submittedAt.slice(0,10) : "—"}</td>
                  <td>
                    {confirmId === b.id ? (
                      <div className="adm-confirm-row">
                        <button className="adm-act-btn danger" onClick={() => handleDelete(b.id)}>Тийм</button>
                        <button className="adm-act-btn" onClick={() => setConfirmId(null)}>Үгүй</button>
                      </div>
                    ) : (
                      <button className="adm-act-btn danger" onClick={() => setConfirmId(b.id)} title="Устгах">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Logs Tab ──────────────────────────────────────────────────────────────────
function LogsTab({ logs, users, onClear }) {
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter,   setUserFilter]   = useState("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    return logs.filter(e => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (userFilter   !== "all" && e.userId !== userFilter)  return false;
      return true;
    });
  }, [logs, actionFilter, userFilter]);

  return (
    <div>
      <div className="adm-toolbar mb-2">
        <select className="adm-filter-sel" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="all">Бүх үйлдэл</option>
          <option value="add">Нэмсэн</option>
          <option value="delete">Устгасан</option>
          <option value="import">Импорт</option>
        </select>
        <select className="adm-filter-sel" value={userFilter} onChange={e => setUserFilter(e.target.value)}>
          <option value="all">Бүх хэрэглэгч</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <span className="adm-result-count">{filtered.length} бүртгэл</span>
        <div style={{ marginLeft: "auto" }}>
          {confirmClear ? (
            <div className="adm-confirm-row">
              <span className="adm-confirm-label">Бүх бүртгэл устгах уу?</span>
              <button className="adm-act-btn danger" onClick={() => { onClear(); setConfirmClear(false); }}>Тийм</button>
              <button className="adm-act-btn" onClick={() => setConfirmClear(false)}>Үгүй</button>
            </div>
          ) : (
            <button className="btn btn-secondary" style={{ fontSize:"0.8rem", padding:"0.35rem 0.75rem", color:"var(--danger)" }} onClick={() => setConfirmClear(true)}>
              <Trash2 size={13} /> Бүгдийг арилгах
            </button>
          )}
        </div>
      </div>

      <div className="card adm-table-card">
        {filtered.length === 0 ? (
          <div className="adm-empty-msg" style={{ padding:"2rem", textAlign:"center" }}>
            <History size={32} style={{ opacity:0.3 }} /><p>Бүртгэл байхгүй байна</p>
          </div>
        ) : (
          <div className="adm-log-timeline">
            {filtered.map((e, i) => (
              <div key={i} className="adm-timeline-row">
                <div className="adm-timeline-left">
                  <span className={`adm-tl-dot adm-dot-${e.action || "add"}`} />
                  <div className="adm-tl-line" />
                </div>
                <div className="adm-timeline-content">
                  <div className="adm-tl-header">
                    <span className="adm-tl-user">{e.userName || "—"}</span>
                    <span className={`adm-tl-action adm-act-lbl-${e.action || "add"}`}>
                      {ACTION_LABELS[e.action] || e.action || "Үйлдэл"}
                    </span>
                    <span className="adm-tl-name">{e.name || "—"}</span>
                    <span className="adm-tl-time">{e.at ? new Date(e.at).toLocaleString("mn-MN") : "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  const [settings, setSettings] = useState(() => ({
    apiUrl:      "https://api.energymn.mn/v2",
    mlVersion:   "v2.3.1",
    backupFreq:  "24",
    apiLimit:    "100",
    demoMode:    true,
    showAdminEmail: false,
    ...loadSettings(),
  }));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const rows = [
    { key: "apiUrl",     label: "API хаяг",              type: "text",     desc: "Гадаад API-ийн үндсэн URL" },
    { key: "mlVersion",  label: "ML загварын хувилбар",   type: "text",     desc: "Одоогийн ML загварын дугаар" },
    { key: "backupFreq", label: "Нөөцлөлтийн давтамж (цаг)", type: "number", desc: "Автомат нөөцлөлт хичнээн цаг тутам хийх" },
    { key: "apiLimit",   label: "API хүсэлтийн хязгаар", type: "number",   desc: "Нэг минутад хэдэн хүсэлт хүлээн авах" },
  ];

  const toggles = [
    { key: "demoMode",      label: "Demo горим",           desc: "Идэвхтэй үед жишиг өгөгдөл ашиглана" },
    { key: "showAdminEmail",label: "Админ имэйл харуулах", desc: "Login хуудсанд demo hint харуулах" },
  ];

  return (
    <div className="adm-settings-wrap">
      <div className="card adm-settings-card">
        <h3 className="section-title" style={{ fontSize:"0.95rem", marginBottom:"1.25rem" }}>Системийн тохиргоо</h3>

        {rows.map(({ key, label, type, desc }) => (
          <div key={key} className="adm-setting-row">
            <div className="adm-setting-info">
              <div className="adm-setting-label">{label}</div>
              <div className="adm-setting-desc">{desc}</div>
            </div>
            <input
              className="form-input adm-setting-input"
              type={type}
              value={settings[key] || ""}
              onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
            />
          </div>
        ))}

        <div className="adm-settings-divider" />

        {toggles.map(({ key, label, desc }) => (
          <div key={key} className="adm-setting-row">
            <div className="adm-setting-info">
              <div className="adm-setting-label">{label}</div>
              <div className="adm-setting-desc">{desc}</div>
            </div>
            <label className="adm-toggle">
              <input
                type="checkbox"
                checked={!!settings[key]}
                onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))}
              />
              <span className="adm-toggle-track" />
            </label>
          </div>
        ))}

        <div className="adm-settings-footer">
          {saved && <span className="adm-saved-msg"><CheckCircle size={14} /> Хадгалагдлаа</span>}
          <button className="btn btn-primary" onClick={handleSave}>Хадгалах</button>
        </div>
      </div>

      {/* System info */}
      <div className="card">
        <h3 className="section-title" style={{ fontSize:"0.95rem", marginBottom:"1rem" }}>Системийн мэдээлэл</h3>
        <div className="adm-sysinfo-list">
          {[
            ["Системийн горим",    "Demo / Client-side"],
            ["Хадгалах систем",    "localStorage"],
            ["Нууц үгийн хамгаалалт", "PBKDF2-SHA256 (150k iter)"],
            ["Session хугацаа",   "7 хоног"],
            ["Frontend framework", "React 18 + Vite"],
            ["Build",              "Vercel Edge CDN"],
          ].map(([lbl, val]) => (
            <div key={lbl} className="adm-sysinfo-row">
              <span className="adm-sysinfo-lbl">{lbl}</span>
              <span className="adm-sysinfo-val">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { t } = useLang();
  usePageTitle(t.nav.admin);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const users     = useMemo(() => loadUsers(),     [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buildings = useMemo(() => loadBuildings(), [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logs      = useMemo(() => loadAllLogs(users), [tick, users]);

  if (!user || user.role !== "admin") {
    return (
      <div className="admin-restricted container">
        <div className="card restricted-card">
          <Lock size={48} opacity={0.4} />
          <h2>{t.admin.restricted_title}</h2>
          <p>{t.admin.restricted_msg}</p>
          <p className="text-muted" style={{ fontSize:"0.85rem" }}>
            {t.admin.restricted_detail?.replace("{email}", user?.email || "—")}
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview",  label: "Тойм",          icon: BarChart2 },
    { id: "users",     label: "Хэрэглэгчид",   icon: Users     },
    { id: "data",      label: "Барилгууд",      icon: Database  },
    { id: "logs",      label: "Бүртгэл",        icon: History   },
    { id: "settings",  label: "Тохиргоо",       icon: Settings  },
  ];

  return (
    <div className="admin-page">
      <div className="container">
        <div className="page-header flex-between mb-3">
          <div>
            <h1 style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <Shield size={26} /> {t.admin.title}
            </h1>
            <p style={{ color:"var(--text3)", marginTop:"0.25rem" }}>{t.admin.subtitle}</p>
          </div>
          <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
            <button className="btn btn-secondary" style={{ fontSize:"0.8rem" }} onClick={refresh}>
              <RefreshCw size={13} /> Шинэчлэх
            </button>
            <span className="adm-admin-badge">
              <Shield size={12} /> Admin
            </span>
          </div>
        </div>

        <div className="admin-tabs mb-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`admin-tab${activeTab === id ? " active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} /> {label}
              {id === "users" && users.filter(u => u.suspended).length > 0 && (
                <span className="adm-tab-alert">{users.filter(u => u.suspended).length}</span>
              )}
              {id === "logs" && logs.length > 0 && (
                <span className="adm-tab-count">{logs.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="animate-fade">
          {activeTab === "overview" && <OverviewTab users={users} buildings={buildings} logs={logs} />}
          {activeTab === "users"    && <UsersTab users={users} buildings={buildings} onRefresh={refresh} />}
          {activeTab === "data"     && <DataTab buildings={buildings} users={users} onRefresh={refresh} />}
          {activeTab === "logs"     && <LogsTab logs={logs} users={users} onClear={() => { clearAllLogs(users); refresh(); }} />}
          {activeTab === "settings" && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}
