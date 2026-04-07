import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuth } from "../contexts/AuthContext";
import { getUserBuildings } from "../utils/buildingStorage";
import {
  User, Building2, Mail, Shield, Calendar, LogOut,
  Edit2, Lock, CheckCircle, AlertCircle, BarChart2,
} from "lucide-react";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { t } = useLang();
  usePageTitle(t.nav.profile);
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  // ── name edit ──
  const [nameVal, setNameVal] = useState(user?.name || "");
  const [nameSaved, setNameSaved] = useState(false);
  const [nameErr, setNameErr] = useState("");

  // ── password change ──
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaved, setPwSaved] = useState(false);
  const [pwErr, setPwErr] = useState("");

  if (!user) { navigate("/login"); return null; }

  const buildings = getUserBuildings(user.id);
  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const typeLabel = user.type === "official" ? t.profile.type_official : t.profile.type_personal;
  const roleLabel = user.role === "admin" ? t.profile.role_admin : t.profile.role_user;

  const handleSaveName = (e) => {
    e.preventDefault();
    setNameErr("");
    const res = updateUser({ name: nameVal.trim() });
    if (res.ok) { setNameSaved(true); setTimeout(() => setNameSaved(false), 3000); }
    else setNameErr("error");
  };

  const handleSavePw = (e) => {
    e.preventDefault();
    setPwErr("");
    if (pw.next !== pw.confirm) { setPwErr(t.profile.error_mismatch); return; }
    if (pw.next.length < 6) { setPwErr(t.profile.error_too_short); return; }
    const res = updateUser({ currentPassword: pw.current, newPassword: pw.next });
    if (res.ok) {
      setPwSaved(true);
      setPw({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwSaved(false), 3000);
    } else {
      setPwErr(res.error === "wrong_password" ? t.profile.error_wrong_pw : t.profile.error_too_short);
    }
  };

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="profile-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="card profile-header animate-fade">
          <div className="ph-avatar">{user.name.charAt(0).toUpperCase()}</div>
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
          <button className="btn btn-secondary ph-logout" onClick={handleLogout}>
            <LogOut size={15} /> {t.profile.logout_btn}
          </button>
        </div>

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

          {/* ── Stats ── */}
          <div className="card profile-stats-card">
            <h3 className="section-title">{t.profile.stats_title}</h3>
            <div className="stat-big">
              <BarChart2 size={32} style={{ color: "#3a8fd4" }} />
              <div>
                <div className="stat-big-num">{buildings.length}</div>
                <div className="stat-big-lbl">{t.profile.buildings_saved}</div>
              </div>
            </div>
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
              {nameErr && <p className="profile-error"><AlertCircle size={14} /> {nameErr}</p>}
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
                <input
                  type="password"
                  className="form-input"
                  value={pw.current}
                  onChange={e => setPw({ ...pw, current: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.profile.new_pw}</label>
                <input
                  type="password"
                  className="form-input"
                  value={pw.next}
                  onChange={e => setPw({ ...pw, next: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.profile.confirm_pw}</label>
                <input
                  type="password"
                  className="form-input"
                  value={pw.confirm}
                  onChange={e => setPw({ ...pw, confirm: e.target.value })}
                  required
                />
              </div>
              {pwErr && <p className="profile-error"><AlertCircle size={14} /> {pwErr}</p>}
              {pwSaved && <p className="profile-success"><CheckCircle size={14} /> {t.profile.pw_saved_msg}</p>}
              <button type="submit" className="btn btn-primary">{t.profile.pw_save_btn}</button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
