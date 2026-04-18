import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuth } from "../contexts/AuthContext";
import { getUserBuildings, computeStats } from "../utils/buildingStorage";
import {
  User, Building2, Mail, Shield, Calendar, LogOut,
  Edit2, Lock, CheckCircle, AlertCircle, BarChart2, Camera,
  Download, FileText, Zap, Globe, ChevronDown,
  History, Clock, Settings, Leaf, Wind, TrendingUp, Languages,
} from "lucide-react";
import "./ProfilePage.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  apartment:  "Орон сууц",
  office:     "Оффис",
  school:     "Сургууль",
  hospital:   "Эмнэлэг",
  commercial: "Худалдааны",
  warehouse:  "Агуулах",
};

const GRADE_COLORS = {
  A: "#2a9d8f", B: "#57cc99", C: "#8ecae6",
  D: "#f4a261", E: "#e76f51", F: "#e63946", G: "#9b2226",
};

const ACTION_LABELS = {
  add:    "Барилга нэмсэн",
  delete: "Барилга устгасан",
  import: "Файлаас оруулсан",
};

// ── Activity log helpers (mirrors DatabasePage) ───────────────────────────────
const LOG_KEY  = (uid) => `ubenergy_log_${uid}`;
const MAX_LOG  = 50;

function readLog(uid) {
  try { return JSON.parse(localStorage.getItem(LOG_KEY(uid)) || "[]"); }
  catch { return []; }
}

// ── Preferences (language, export format) ────────────────────────────────────
const PREF_KEY = "ubenergy_prefs";
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); }
  catch { return {}; }
}
function savePrefs(p) { localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { t, lang, toggleLang } = useLang();
  usePageTitle(t.nav.profile);
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  // ── name edit ──
  const [nameVal,   setNameVal]   = useState(user?.name || "");
  const [nameSaved, setNameSaved] = useState(false);
  const [nameErr,   setNameErr]   = useState("");

  // ── avatar upload ──
  const avatarInputRef    = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // ── report period ──
  const [reportOpen, setReportOpen] = useState(false);
  const [period,     setPeriod]     = useState("month");
  const today      = new Date().toISOString().slice(0, 10);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo,   setCustomTo]   = useState(today);

  // ── password change ──
  const [pw,      setPw]      = useState({ current: "", next: "", confirm: "" });
  const [pwSaved, setPwSaved] = useState(false);
  const [pwErr,   setPwErr]   = useState("");

  // ── new: activity log / settings ──
  const [activityLog,  setActivityLog]  = useState([]);
  const [showHistory,  setShowHistory]  = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs,        setPrefs]        = useState(loadPrefs);

  useEffect(() => {
    if (user) setActivityLog(readLog(user.id));
  }, [user]);

  const updatePref = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    savePrefs(next);
  };

  if (!user) { navigate("/login"); return null; }

  const buildings = getUserBuildings(user.id);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const stats = useMemo(() => computeStats(buildings), [buildings]);

  const typeBreakdown = useMemo(() => {
    const counts = {};
    buildings.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1; });
    return Object.entries(counts)
      .map(([type, count]) => ({ type, count, label: TYPE_LABELS[type] || type }))
      .sort((a, b) => b.count - a.count);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  }, [buildings]);

  // ── filter buildings by period (for report) ──
  const filteredBuildings = useMemo(() => {
    const now = new Date();
    return buildings.filter(b => {
      if (!b.submittedAt) return period === "year";
      const d = new Date(b.submittedAt);
      if (period === "day")    return d.toDateString() === now.toDateString();
      if (period === "month")  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === "year")   return d.getFullYear() === now.getFullYear();
      if (period === "custom") {
        const from = new Date(customFrom); from.setHours(0,0,0,0);
        const to   = new Date(customTo);   to.setHours(23,59,59,999);
        return d >= from && d <= to;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  }, [buildings, period, customFrom, customTo]);

  const periodLabel = {
    day:    "Өнөөдөр",
    month:  new Date().toLocaleDateString("mn-MN", { year: "numeric", month: "long" }),
    year:   `${new Date().getFullYear()} он`,
    custom: `${customFrom} — ${customTo}`,
  }[period];

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const typeLabel = user.type === "official" ? t.profile.type_official : t.profile.type_personal;
  const roleLabel = user.role === "admin"    ? t.profile.role_admin    : t.profile.role_user;

  // ── handlers ──
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Зургийн хэмжээ 2MB-аас бага байна уу."); return; }
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => { updateUser({ avatar: ev.target.result }); setAvatarUploading(false); };
    reader.readAsDataURL(file);
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameErr("");
    const res = await updateUser({ name: nameVal.trim() });
    if (res?.ok) { setNameSaved(true); setTimeout(() => setNameSaved(false), 3000); }
    else setNameErr(t.profile.saved_msg || "error");
  };

  const handleSavePw = async (e) => {
    e.preventDefault();
    setPwErr("");
    if (pw.next !== pw.confirm) { setPwErr(t.profile.error_mismatch); return; }
    if (pw.next.length < 8)    { setPwErr(t.profile.error_too_short); return; }
    const res = await updateUser({ currentPassword: pw.current, newPassword: pw.next });
    if (res?.ok) {
      setPwSaved(true);
      setPw({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwSaved(false), 3000);
    } else {
      setPwErr(res?.error === "wrong_password" ? t.profile.error_wrong_pw : t.profile.error_too_short);
    }
  };

  const handleLogout = () => { logout(); navigate("/"); };

  // ── PDF report generator ──
  const generateReport = (bList = filteredBuildings) => {
    const now     = new Date();
    const dateStr = now.toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" });
    const totalKwh   = bList.reduce((s, b) => s + (b.usage || b.predicted_kwh || 0), 0);
    const avgMonthly = bList.length > 0
      ? Math.round(bList.reduce((s, b) => s + (b.monthly_usage || b.monthly_kwh || 0), 0) / bList.length)
      : 0;
    const typeStr = user.type === "official" ? "Байгуулга" : "Хувь хүн";

    const html = `<!DOCTYPE html>
<html lang="mn"><head><meta charset="UTF-8">
<title>UB Energy — Тайлан — ${user.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:13px;color:#1a2a3a;padding:36px 40px;line-height:1.6}
h1{font-size:22px;color:#1a6eb5;margin-bottom:2px}
.sub{color:#6a9bbf;font-size:12px;margin-bottom:24px}
.section{margin-bottom:24px}
.section-title{font-size:13px;font-weight:700;color:#1a6eb5;border-bottom:2px solid #d0e4f4;padding-bottom:5px;margin-bottom:12px;letter-spacing:.3px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 32px}
.info-row{display:flex;gap:8px;padding:4px 0}
.lbl{color:#6a9bbf;min-width:110px;font-size:12px}
.val{font-weight:600}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.stat-box{border:1.5px solid #d0e4f4;border-radius:8px;padding:14px;text-align:center}
.stat-num{font-size:24px;font-weight:700;color:#1a6eb5}
.stat-lbl{font-size:11px;color:#6a9bbf;margin-top:3px}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#e8f0f8;color:#1a6eb5}
.badge.off{background:#e8f8f4;color:#2a9d8f}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#1a6eb5;color:#fff;padding:8px 10px;text-align:left;font-weight:600}
td{padding:7px 10px;border-bottom:1px solid #e8f0f8}
tr:nth-child(even) td{background:#f5f9fd}
.footer{margin-top:36px;padding-top:12px;border-top:1px solid #d0e4f4;color:#6a9bbf;font-size:11px;display:flex;justify-content:space-between}
.print-btn{padding:8px 18px;background:#1a6eb5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:20px}
@media print{.print-btn{display:none}body{padding:16px}}
</style></head><body>
<button class="print-btn" onclick="window.print()">Хэвлэх / PDF болгох</button>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
  <div>
    <h1>UB Energy — Барилгын эрчим хүчний тайлан</h1>
    <div class="sub">Гаргасан огноо: ${dateStr} &nbsp;·&nbsp; Хугацаа: ${periodLabel}</div>
  </div>
</div>
<div class="section">
  <div class="section-title">Хэрэглэгчийн мэдээлэл</div>
  <div class="info-grid">
    <div class="info-row"><span class="lbl">Нэр:</span><span class="val">${user.name}</span></div>
    <div class="info-row"><span class="lbl">И-мэйл:</span><span class="val">${user.email}</span></div>
    <div class="info-row"><span class="lbl">Төрөл:</span><span class="badge ${user.type === "official" ? "off" : ""}">${typeStr}</span></div>
    ${user.org ? `<div class="info-row"><span class="lbl">Байгуулга:</span><span class="val">${user.org}</span></div>` : ""}
    <div class="info-row"><span class="lbl">Бүртгэгдсэн:</span><span class="val">${joinedDate}</span></div>
    <div class="info-row"><span class="lbl">Эрх:</span><span class="val">${user.role === "admin" ? "Админ" : "Хэрэглэгч"}</span></div>
  </div>
</div>
<div class="section">
  <div class="section-title">Нийт үзүүлэлт</div>
  <div class="stats">
    <div class="stat-box"><div class="stat-num">${bList.length}</div><div class="stat-lbl">Барилга (${periodLabel})</div></div>
    <div class="stat-box"><div class="stat-num">${totalKwh.toLocaleString()}</div><div class="stat-lbl">Нийт кВт·цаг/жил</div></div>
    <div class="stat-box"><div class="stat-num">${avgMonthly.toLocaleString()}</div><div class="stat-lbl">Дундаж сарын кВт·цаг</div></div>
  </div>
</div>
${bList.length > 0 ? `
<div class="section">
  <div class="section-title">Барилгын дэлгэрэнгүй жагсаалт (${periodLabel})</div>
  <table>
    <thead><tr><th>#</th><th>Нэр</th><th>Төрөл</th><th>Талбай м²</th><th>Давхар</th><th>Он</th><th>Дүүрэг</th><th>кВт·цаг/жил</th><th>кВт·цаг/сар</th><th>Зэрэглэл</th></tr></thead>
    <tbody>
      ${bList.map((b, i) => `<tr>
        <td>${i + 1}</td><td>${b.name || "—"}</td><td>${TYPE_LABELS[b.type] || b.type || "—"}</td>
        <td>${b.area || "—"}</td><td>${b.floors || "—"}</td><td>${b.year || "—"}</td>
        <td>${b.district || "—"}</td>
        <td>${(b.predicted_kwh || 0).toLocaleString()}</td>
        <td>${(b.monthly_kwh || 0).toLocaleString()}</td>
        <td>${b.grade || "—"}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>` : `<p style="color:#6a9bbf;padding:16px 0">Барилгын мэдээлэл байхгүй байна.</p>`}
<div class="footer">
  <span>UB Energy · ubenergy.vercel.app</span>
  <span>Тайлан гаргасан: ${dateStr}</span>
</div>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Popup blocked. Please allow popups for this site."); return; }
    win.document.write(html);
    win.document.close();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="profile-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="card profile-header animate-fade">
          <div
            className={`ph-avatar ph-avatar-clickable${avatarUploading ? " uploading" : ""}`}
            onClick={() => avatarInputRef.current?.click()}
            title="Зураг солих"
          >
            {user.avatar
              ? <img src={user.avatar} alt={user.name} className="ph-avatar-img" />
              : user.name.charAt(0).toUpperCase()
            }
            <div className="ph-avatar-overlay"><Camera size={18} /></div>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />

          <div className="ph-info">
            <h1 className="ph-name">{user.name}</h1>
            <p className="ph-email"><Mail size={14} /> {user.email}</p>
            <div className="ph-badges">
              <span className={`ph-badge ${user.type === "official" ? "official" : "personal"}`}>
                {user.type === "official" ? <Building2 size={13} /> : <User size={13} />}
                {typeLabel}
              </span>
              {user.role === "admin" && (
                <span className="ph-badge admin"><Shield size={13} /> {roleLabel}</span>
              )}
            </div>
            <p className="ph-joined"><Calendar size={13} /> {t.profile.member_since}: {joinedDate}</p>
          </div>

          <div className="ph-actions">
            <button className="btn btn-primary" onClick={() => setReportOpen(o => !o)} style={{ fontSize: "0.83rem" }}>
              <Download size={14} /> {t.profile.report_btn || "Тайлан татах"}
            </button>
            <button className="btn btn-secondary ph-logout" onClick={handleLogout}>
              <LogOut size={15} /> {t.profile.logout_btn}
            </button>
          </div>
        </div>

        {/* ── Org banner ── */}
        {user.type === "official" && (
          <div className="card org-banner animate-fade">
            <div className="org-banner-icon"><Globe size={28} /></div>
            <div className="org-banner-info">
              <div className="org-banner-label">{t.profile.org_banner_label || "Байгуулгын бүртгэл"}</div>
              <div className="org-banner-name">{user.org || user.name}</div>
              <div className="org-banner-sub">
                {t.profile.org_banner_sub || "Та байгуулгын эрхээр нэвтэрсэн байна. Бүх барилгын мэдээлэл, тайлан, статистикийг байгуулгын нэрийн өмнөөс удирдах боломжтой."}
              </div>
            </div>
            <div className="org-banner-stats">
              <div className="org-stat">
                <div className="org-stat-num">{buildings.length}</div>
                <div className="org-stat-lbl">{t.profile.buildings_saved || "Барилга"}</div>
              </div>
              <div className="org-stat">
                <div className="org-stat-num">{buildings.reduce((s, b) => s + (b.predicted_kwh || 0), 0).toLocaleString()}</div>
                <div className="org-stat-lbl">кВт·цаг/жил</div>
              </div>
            </div>
          </div>
        )}

        <div className="profile-grid">

          {/* ── Account info ── */}
          <div className="card profile-info-card">
            <h3 className="section-title">{t.profile.account_info}</h3>
            <div className="info-rows">
              <div className="info-row">
                <span className="info-label"><User size={14} /> {t.profile.name_label}</span>
                <span className="info-val">{user.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><Mail size={14} /> {t.profile.email_label}</span>
                <span className="info-val">{user.email}</span>
              </div>
              <div className="info-row">
                <span className="info-label"><Shield size={14} /> {t.profile.type_label}</span>
                <span className="info-val">{typeLabel}</span>
              </div>
              {user.org && (
                <div className="info-row">
                  <span className="info-label"><Building2 size={14} /> {t.profile.org_label}</span>
                  <span className="info-val">{user.org}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label"><Shield size={14} /> {t.profile.role_label}</span>
                <span className="info-val">{roleLabel}</span>
              </div>
            </div>
          </div>

          {/* ── Stats + Report ── */}
          <div className="card profile-stats-card">
            <h3 className="section-title">{t.profile.stats_title}</h3>
            <div className="stat-big">
              <BarChart2 size={28} style={{ color: "#3a8fd4" }} />
              <div>
                <div className="stat-big-num">{buildings.length}</div>
                <div className="stat-big-lbl">{t.profile.buildings_saved}</div>
              </div>
            </div>
            {buildings.length > 0 && (
              <div className="stat-rows">
                <div className="stat-row">
                  <span className="stat-row-lbl"><Zap size={13} /> {t.profile.stat_total_kwh || "Нийт кВт·цаг/жил"}</span>
                  <span className="stat-row-val">{buildings.reduce((s, b) => s + (b.predicted_kwh || 0), 0).toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-lbl"><FileText size={13} /> {t.profile.stat_avg_monthly || "Дундаж сарын"}</span>
                  <span className="stat-row-val">
                    {buildings.length > 0
                      ? Math.round(buildings.reduce((s, b) => s + (b.monthly_kwh || 0), 0) / buildings.length).toLocaleString()
                      : 0} кВт·цаг
                  </span>
                </div>
                {stats && (
                  <div className="stat-row">
                    <span className="stat-row-lbl"><TrendingUp size={13} /> {t.profile.stat_avg_intensity || "Дундаж эрчимжилт"}</span>
                    <span className="stat-row-val">{stats.avgIntensity} кВт·цаг/м²</span>
                  </div>
                )}
              </div>
            )}

            {/* Report period picker */}
            <div className="report-picker">
              <button className="report-picker-toggle" onClick={() => setReportOpen(o => !o)}>
                <Download size={14} />
                <span>{t.profile.report_btn || "Тайлан татах"}</span>
                <ChevronDown size={14} style={{ marginLeft: "auto", transform: reportOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
              </button>
              {reportOpen && (
                <div className="report-picker-body animate-fade">
                  <div className="period-tabs">
                    {[{ id: "day", label: "Өдөр" }, { id: "month", label: "Сар" }, { id: "year", label: "Жил" }, { id: "custom", label: "Тодорхой" }].map(p => (
                      <button key={p.id} className={`period-tab${period === p.id ? " active" : ""}`} onClick={() => setPeriod(p.id)}>{p.label}</button>
                    ))}
                  </div>
                  {period === "custom" && (
                    <div className="custom-range">
                      <div className="form-group">
                        <label className="form-label">Эхлэх огноо</label>
                        <input type="date" className="form-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} max={customTo} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Дуусах огноо</label>
                        <input type="date" className="form-input" value={customTo} onChange={e => setCustomTo(e.target.value)} min={customFrom} max={today} />
                      </div>
                    </div>
                  )}
                  <div className="report-preview">
                    <Calendar size={13} />
                    <span>{periodLabel} — <strong>{filteredBuildings.length}</strong> барилга</span>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%", fontSize: "0.83rem" }}
                    onClick={() => { generateReport(filteredBuildings); setReportOpen(false); }}
                    disabled={filteredBuildings.length === 0}
                  >
                    <Download size={14} /> PDF тайлан гаргах
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── User Insights (full width) ── */}
          {buildings.length > 0 && stats && (
            <div className="card profile-insights animate-fade">
              <h3 className="section-title">
                <TrendingUp size={16} style={{ marginRight: 6 }} />
                {t.profile.insights_title || "Хэрэглэгчийн дэлгэрэнгүй үзүүлэлт"}
              </h3>
              <div className="insights-grid">

                {/* Grade distribution */}
                <div className="insight-block">
                  <div className="insight-block-title">{t.profile.grade_dist || "Үр ашгийн зэрэглэл"}</div>
                  <div className="grade-dist">
                    {["A","B","C","D","E","F","G"].map(g => {
                      const count = stats.gradeCounts[g] || 0;
                      if (!count) return null;
                      const pct = Math.round(count / stats.count * 100);
                      return (
                        <div key={g} className="grade-bar-row">
                          <span className="grade-lbl" style={{ color: GRADE_COLORS[g] }}>{g}</span>
                          <div className="grade-bar-track">
                            <div className="grade-bar-fill" style={{ width: `${pct}%`, background: GRADE_COLORS[g] }} />
                          </div>
                          <span className="grade-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Building type breakdown */}
                <div className="insight-block">
                  <div className="insight-block-title">{t.profile.type_breakdown || "Барилгын төрөл"}</div>
                  <div className="type-breakdown">
                    {typeBreakdown.map(({ type, count, label }) => (
                      <div key={type} className="grade-bar-row">
                        <span className="type-lbl">{label}</span>
                        <div className="grade-bar-track">
                          <div className="grade-bar-fill" style={{ width: `${Math.round(count / buildings.length * 100)}%`, background: "#3a8fd4" }} />
                        </div>
                        <span className="grade-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Environmental impact */}
                <div className="insight-block">
                  <div className="insight-block-title">{t.profile.env_impact || "Байгаль орчинд нөлөөлөх байдал"}</div>
                  <div className="env-stats">
                    <div className="env-stat">
                      <Leaf size={22} color="#2a9d8f" />
                      <div>
                        <div className="env-stat-num">{stats.totalCo2.toLocaleString()}</div>
                        <div className="env-stat-lbl">тн CO₂/жил</div>
                      </div>
                    </div>
                    <div className="env-stat">
                      <Wind size={22} color="#f4a261" />
                      <div>
                        <div className="env-stat-num">{stats.totalPm25.toLocaleString()}</div>
                        <div className="env-stat-lbl">кг PM₂.₅/жил</div>
                      </div>
                    </div>
                    <div className="env-stat">
                      <Zap size={22} color="#3a8fd4" />
                      <div>
                        <div className="env-stat-num">{stats.avgIntensity}</div>
                        <div className="env-stat-lbl">кВт·цаг/м² дундаж</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top energy consumers */}
                {stats.topHigh.length > 0 && (
                  <div className="insight-block">
                    <div className="insight-block-title">{t.profile.top_consumers || "Хамгийн их эрчим хүч хэрэглэгч"}</div>
                    <div className="top-list">
                      {stats.topHigh.slice(0, 3).map((b, i) => (
                        <div key={b.id} className="top-row">
                          <span className="top-rank">#{i + 1}</span>
                          <span className="top-name">{b.name}</span>
                          <span className="top-grade" style={{ color: GRADE_COLORS[b.grade] }}>{b.grade}</span>
                          <span className="top-kwh">{b.intensity} кВт·цаг/м²</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── Activity History (full width, collapsible) ── */}
          <div className="card prof-collapsible">
            <button className="prof-toggle-btn" onClick={() => setShowHistory(o => !o)}>
              <History size={15} />
              <span>{t.profile.history_title || "Үйл ажиллагааны түүх"}</span>
              {activityLog.length > 0 && <span className="prof-toggle-count">{activityLog.length}</span>}
              <ChevronDown size={14} style={{ marginLeft: "auto", transform: showHistory ? "rotate(180deg)" : "none", transition: "0.2s" }} />
            </button>
            {showHistory && (
              <div className="prof-panel-body animate-fade">
                {activityLog.length === 0 ? (
                  <div className="prof-empty"><Clock size={13} /> {t.profile.history_empty || "Бүртгэл байхгүй байна"}</div>
                ) : (
                  <div className="prof-log-list">
                    {[...activityLog].reverse().map((entry, i) => (
                      <div key={i} className={`prof-log-row act-${entry.action || "add"}`}>
                        <span className={`prof-log-dot act-${entry.action || "add"}`} />
                        <span className="prof-log-action">{ACTION_LABELS[entry.action] || entry.action || "Үйлдэл"}</span>
                        <span className="prof-log-name">{entry.name || "—"}</span>
                        <span className="prof-log-time">
                          <Clock size={11} />
                          {entry.at ? new Date(entry.at).toLocaleString("mn-MN") : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Edit name ── */}
          <div className="card">
            <h3 className="section-title"><Edit2 size={16} style={{ marginRight: 6 }} />{t.profile.edit_name_title}</h3>
            <form onSubmit={handleSaveName} className="profile-form">
              <div className="form-group">
                <label className="form-label">{t.profile.name_label}</label>
                <input
                  className="form-input"
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  placeholder={t.profile.name_placeholder}
                  required
                />
              </div>
              {nameErr  && <p className="profile-error"><AlertCircle size={14} /> {nameErr}</p>}
              {nameSaved && <p className="profile-success"><CheckCircle size={14} /> {t.profile.saved_msg}</p>}
              <button type="submit" className="btn btn-primary">{t.profile.save_btn}</button>
            </form>
          </div>

          {/* ── Change password ── */}
          <div className="card">
            <h3 className="section-title"><Lock size={16} style={{ marginRight: 6 }} />{t.profile.change_pw_title}</h3>
            <form onSubmit={handleSavePw} className="profile-form">
              <div className="form-group">
                <label className="form-label">{t.profile.current_pw}</label>
                <input type="password" className="form-input" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t.profile.new_pw}</label>
                <input type="password" className="form-input" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t.profile.confirm_pw}</label>
                <input type="password" className="form-input" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} required />
              </div>
              {pwErr  && <p className="profile-error"><AlertCircle size={14} /> {pwErr}</p>}
              {pwSaved && <p className="profile-success"><CheckCircle size={14} /> {t.profile.pw_saved_msg}</p>}
              <button type="submit" className="btn btn-primary">{t.profile.pw_save_btn}</button>
            </form>
          </div>

          {/* ── Settings (full width, collapsible) ── */}
          <div className="card prof-collapsible">
            <button className="prof-toggle-btn" onClick={() => setShowSettings(o => !o)}>
              <Settings size={15} />
              <span>{t.profile.settings_title || "Тохиргоо"}</span>
              <ChevronDown size={14} style={{ marginLeft: "auto", transform: showSettings ? "rotate(180deg)" : "none", transition: "0.2s" }} />
            </button>
            {showSettings && (
              <div className="prof-panel-body animate-fade">

                {/* Language */}
                <div className="settings-row">
                  <div className="settings-row-info">
                    <Languages size={15} />
                    <div>
                      <div className="settings-row-label">{t.profile.settings_lang || "Хэл / Language"}</div>
                      <div className="settings-row-sub">{t.profile.settings_lang_sub || "Системийн харуулах хэлийг сонгоно уу"}</div>
                    </div>
                  </div>
                  <div className="settings-toggle-group">
                    <button className={`settings-opt-btn${lang === "mn" ? " active" : ""}`} onClick={() => lang !== "mn" && toggleLang()}>МН</button>
                    <button className={`settings-opt-btn${lang === "en" ? " active" : ""}`} onClick={() => lang !== "en" && toggleLang()}>EN</button>
                  </div>
                </div>

                {/* Export format */}
                <div className="settings-row">
                  <div className="settings-row-info">
                    <Download size={15} />
                    <div>
                      <div className="settings-row-label">{t.profile.settings_export || "Экспортын формат"}</div>
                      <div className="settings-row-sub">{t.profile.settings_export_sub || "Тайлан болон өгөгдөл татахад ашиглах формат"}</div>
                    </div>
                  </div>
                  <div className="settings-toggle-group">
                    <button className={`settings-opt-btn${(prefs.exportFmt || "csv") === "csv" ? " active" : ""}`} onClick={() => updatePref("exportFmt", "csv")}>CSV</button>
                    <button className={`settings-opt-btn${prefs.exportFmt === "json" ? " active" : ""}`} onClick={() => updatePref("exportFmt", "json")}>JSON</button>
                  </div>
                </div>

                {/* Show prediction details */}
                <div className="settings-row">
                  <div className="settings-row-info">
                    <BarChart2 size={15} />
                    <div>
                      <div className="settings-row-label">{t.profile.settings_details || "Дэлгэрэнгүй таамаглал"}</div>
                      <div className="settings-row-sub">{t.profile.settings_details_sub || "Таамаглалын дэлгэрэнгүй утгыг харуулах"}</div>
                    </div>
                  </div>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={prefs.showDetails !== false}
                      onChange={e => updatePref("showDetails", e.target.checked)}
                    />
                    <span className="settings-switch-track" />
                  </label>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
