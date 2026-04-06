import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { LogIn, UserPlus, Building2, User, Eye, EyeOff, Zap } from "lucide-react";
import { APP_NAME } from "../config/constants";
import "./LoginPage.css";

export default function LoginPage() {
  const { t } = useLang();
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("login"); // login | register
  const [userType, setUserType] = useState("personal");
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", org: "" });
  const [error, setError] = useState("");

  // Already logged in — send them where they came from or dashboard
  if (user) {
    return <Navigate to={location.state?.from || "/dashboard"} replace />;
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (mode === "login") {
      const ok = login(form.email, form.password);
      if (ok) navigate(location.state?.from || "/dashboard", { replace: true });
      else setError(t.login.error_invalid);
    } else {
      if (form.password !== form.confirm) {
        setError(t.login.error_password_mismatch); return;
      }
      const result = register({ name: form.name, email: form.email, password: form.password, type: userType, org: form.org });
      if (!result.ok) {
        setError(result.error === "email_taken" ? t.login.error_email_taken : t.login.error_invalid);
        return;
      }
      navigate(location.state?.from || "/dashboard", { replace: true });
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card animate-fade">
        <div className="login-logo">
          <Zap size={28} />
          <span>{APP_NAME}</span>
        </div>

        <h1 className="login-title">
          {mode === "login" ? t.login.title : t.login.register_title}
        </h1>

        {/* User type tabs — only during registration */}
        {mode === "register" && (
          <div className="type-tabs">
            <button
              className={`type-tab ${userType === "personal" ? "active" : ""}`}
              onClick={() => setUserType("personal")}
            >
              <User size={16} />
              {t.login.personal}
            </button>
            <button
              className={`type-tab ${userType === "official" ? "active" : ""}`}
              onClick={() => setUserType("official")}
            >
              <Building2 size={16} />
              {t.login.official}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">{t.login.name}</label>
              <input name="name" value={form.name} onChange={handleChange}
                className="form-input" required placeholder={t.login.name} />
            </div>
          )}

          {mode === "register" && userType === "official" && (
            <div className="form-group">
              <label className="form-label">{t.login.org}</label>
              <input name="org" value={form.org} onChange={handleChange}
                className="form-input" placeholder={t.login.org} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t.login.email}</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="form-input" required placeholder="example@email.com" />
          </div>

          <div className="form-group">
            <label className="form-label">{t.login.password}</label>
            <div className="pw-row">
              <input name="password" type={showPw ? "text" : "password"}
                value={form.password} onChange={handleChange}
                className="form-input" required placeholder="••••••••" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">{t.login.confirm_password}</label>
              <input name="confirm" type="password" value={form.confirm} onChange={handleChange}
                className="form-input" required placeholder="••••••••" />
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn">
            {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {mode === "login" ? t.login.login_btn : t.login.register_btn}
          </button>
        </form>

        <div className="login-switch">
          {mode === "login" ? (
            <>
              <span>{t.login.no_account}</span>
              <button className="switch-btn" onClick={() => { setMode("register"); setError(""); setForm({ name:"", email:"", password:"", confirm:"", org:"" }); }}>
                {t.login.register_btn}
              </button>
            </>
          ) : (
            <>
              <span>{t.login.has_account}</span>
              <button className="switch-btn" onClick={() => { setMode("login"); setError(""); setForm({ name:"", email:"", password:"", confirm:"", org:"" }); }}>
                {t.login.login_btn}
              </button>
            </>
          )}
        </div>

        <div className="demo-hint">
          <span>{t.login.demo_hint}</span>
        </div>
      </div>
    </div>
  );
}
