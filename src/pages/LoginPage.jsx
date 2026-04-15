import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import { useAuth } from "../contexts/AuthContext";
import { LogIn, UserPlus, Building2, User, Eye, EyeOff, Zap, KeyRound, ArrowLeft, CheckCircle } from "lucide-react";
import { APP_NAME } from "../config/constants";
import "./LoginPage.css";

export default function LoginPage() {
  const { t } = useLang();
  usePageTitle(t.nav.login);
  const { login, register, checkEmailForReset, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("login"); // login | register | forgot | reset
  const [userType, setUserType] = useState("personal");
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", org: "" });
  const [error, setError] = useState("");
  const [resetEmail, setResetEmail] = useState(""); // email confirmed in forgot step
  const [resetSuccess, setResetSuccess] = useState(false);

  // Already logged in — send them where they came from or dashboard
  if (user) {
    return <Navigate to={location.state?.from || "/dashboard"} replace />;
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setResetSuccess(false);
    setShowPw(false);
    setShowNewPw(false);
    setForm({ name: "", email: "", password: "", confirm: "", org: "" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (mode === "login") {
      const ok = login(form.email, form.password);
      if (ok) navigate(location.state?.from || "/dashboard", { replace: true });
      else setError(t.login.error_invalid);

    } else if (mode === "register") {
      if (form.password !== form.confirm) { setError(t.login.error_password_mismatch); return; }
      const result = register({ name: form.name, email: form.email, password: form.password, type: userType, org: form.org });
      if (!result.ok) {
        setError(result.error === "email_taken" ? t.login.error_email_taken : t.login.error_invalid);
        return;
      }
      navigate(location.state?.from || "/dashboard", { replace: true });

    } else if (mode === "forgot") {
      const check = checkEmailForReset(form.email);
      if (check.error === "email_not_found") { setError(t.login.error_email_not_found); return; }
      if (check.error === "admin_reset")     { setError(t.login.error_admin_reset);     return; }
      setResetEmail(form.email.trim().toLowerCase());
      setForm(f => ({ ...f, password: "", confirm: "" }));
      setMode("reset");

    } else if (mode === "reset") {
      if (form.password !== form.confirm) { setError(t.login.error_password_mismatch); return; }
      const result = resetPassword(resetEmail, form.password);
      if (!result.ok) {
        setError(result.error === "too_short" ? t.login.error_password_mismatch : t.login.error_invalid);
        return;
      }
      setResetSuccess(true);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card animate-fade">
        <div className="login-logo">
          <Zap size={28} />
          <span>{APP_NAME}</span>
        </div>

        {/* ── Forgot / Reset modes ── */}
        {(mode === "forgot" || mode === "reset") && (
          <>
            <div className="forgot-icon">
              <KeyRound size={24} style={{ color: "#3a8fd4" }} />
            </div>
            <h1 className="login-title">
              {mode === "forgot" ? t.login.forgot_title : t.login.reset_title}
            </h1>
            {mode === "forgot" && (
              <p className="forgot-subtitle">{t.login.forgot_subtitle}</p>
            )}
            {mode === "reset" && (
              <p className="forgot-subtitle" style={{ color: "#2a9d8f" }}>
                {resetEmail}
              </p>
            )}

            {resetSuccess ? (
              <div className="reset-success">
                <CheckCircle size={20} style={{ color: "#2a9d8f" }} />
                <span>{t.login.reset_success}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                {mode === "forgot" && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="forgot-email">{t.login.email}</label>
                    <input id="forgot-email" name="email" type="email" value={form.email}
                      onChange={handleChange} className="form-input" required
                      placeholder="example@email.com" autoFocus />
                  </div>
                )}

                {mode === "reset" && (
                  <>
                    <div className="form-group">
                      <label className="form-label" htmlFor="reset-pw">{t.login.reset_new}</label>
                      <div className="pw-row">
                        <input id="reset-pw" name="password" type={showNewPw ? "text" : "password"}
                          value={form.password} onChange={handleChange}
                          className="form-input" required minLength={6} placeholder="••••••••" autoFocus />
                        <button type="button" className="pw-toggle" onClick={() => setShowNewPw(!showNewPw)}
                          aria-label={showNewPw ? t.login.hide_password : t.login.show_password}>
                          {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="reset-confirm">{t.login.reset_confirm}</label>
                      <input id="reset-confirm" name="confirm" type="password" value={form.confirm}
                        onChange={handleChange} className="form-input" required placeholder="••••••••" />
                    </div>
                  </>
                )}

                {error && <div className="login-error" role="alert">{error}</div>}

                <button type="submit" className="btn btn-primary login-btn">
                  <KeyRound size={17} />
                  {mode === "forgot" ? t.login.forgot_btn : t.login.reset_btn}
                </button>
              </form>
            )}

            <button className="forgot-back-btn" onClick={() => switchMode("login")}>
              <ArrowLeft size={14} />
              {t.login.forgot_back}
            </button>
          </>
        )}

        {/* ── Login / Register modes ── */}
        {(mode === "login" || mode === "register") && (
          <>
            <h1 className="login-title">
              {mode === "login" ? t.login.title : t.login.register_title}
            </h1>

            {/* User type tabs — only during registration */}
            {mode === "register" && (
              <div className="type-tabs">
                <button className={`type-tab ${userType === "personal" ? "active" : ""}`}
                  onClick={() => setUserType("personal")}>
                  <User size={16} />{t.login.personal}
                </button>
                <button className={`type-tab ${userType === "official" ? "active" : ""}`}
                  onClick={() => setUserType("official")}>
                  <Building2 size={16} />{t.login.official}
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              {mode === "register" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="login-name">{t.login.name}</label>
                  <input id="login-name" name="name" value={form.name} onChange={handleChange}
                    className="form-input" required placeholder={t.login.name} />
                </div>
              )}

              {mode === "register" && userType === "official" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="login-org">{t.login.org}</label>
                  <input id="login-org" name="org" value={form.org} onChange={handleChange}
                    className="form-input" placeholder={t.login.org} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="login-email">{t.login.email}</label>
                <input id="login-email" name="email" type="email" value={form.email} onChange={handleChange}
                  className="form-input" required placeholder="example@email.com" />
              </div>

              <div className="form-group">
                <div className="pw-label-row">
                  <label className="form-label" htmlFor="login-password">{t.login.password}</label>
                  {mode === "login" && (
                    <button type="button" className="forgot-inline-btn"
                      onClick={() => switchMode("forgot")}>
                      {t.login.forgot_link}
                    </button>
                  )}
                </div>
                <div className="pw-row">
                  <input id="login-password" name="password" type={showPw ? "text" : "password"}
                    value={form.password} onChange={handleChange}
                    className="form-input" required placeholder="••••••••" />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? t.login.hide_password : t.login.show_password}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="login-confirm">{t.login.confirm_password}</label>
                  <input id="login-confirm" name="confirm" type="password" value={form.confirm}
                    onChange={handleChange} className="form-input" required placeholder="••••••••" />
                </div>
              )}

              {error && <div className="login-error" role="alert">{error}</div>}

              <button type="submit" className="btn btn-primary login-btn">
                {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
                {mode === "login" ? t.login.login_btn : t.login.register_btn}
              </button>
            </form>

            <div className="login-switch">
              {mode === "login" ? (
                <>
                  <span>{t.login.no_account}</span>
                  <button className="switch-btn" onClick={() => switchMode("register")}>
                    {t.login.register_btn}
                  </button>
                </>
              ) : (
                <>
                  <span>{t.login.has_account}</span>
                  <button className="switch-btn" onClick={() => switchMode("login")}>
                    {t.login.login_btn}
                  </button>
                </>
              )}
            </div>

            <div className="demo-hint">
              <span>{t.login.demo_hint}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
