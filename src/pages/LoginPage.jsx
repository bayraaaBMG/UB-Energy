import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuth } from "../contexts/AuthContext";
import {
  LogIn, UserPlus, Building2, User, Eye, EyeOff, Zap,
  KeyRound, ArrowLeft, CheckCircle, Shield, AlertTriangle,
  Lock, ChevronDown, ChevronRight,
} from "lucide-react";
import { APP_NAME } from "../config/constants";
import "./LoginPage.css";

// ─── Password strength ────────────────────────────────────────────────────────
function pwStrength(pw) {
  if (!pw) return { score: 0, pct: 0, label: "", color: "" };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { pct: 15,  label: "Маш сул",  en: "Very weak",  color: "#e63946" },
    { pct: 30,  label: "Сул",       en: "Weak",        color: "#f4a261" },
    { pct: 55,  label: "Дунд",      en: "Fair",        color: "#e9c46a" },
    { pct: 75,  label: "Хүчтэй",   en: "Strong",      color: "#57cc99" },
    { pct: 100, label: "Маш хүчтэй",en:"Very strong", color: "#2a9d8f" },
  ];
  return { score: s, ...map[Math.min(s, 4)] };
}

function StrengthMeter({ pw, lang }) {
  const st = pwStrength(pw);
  if (!pw) return null;
  return (
    <div className="pw-strength">
      <div className="pws-track">
        <div className="pws-fill" style={{ width: `${st.pct}%`, background: st.color }} />
      </div>
      <span className="pws-label" style={{ color: st.color }}>
        {lang === "mn" ? st.label : st.en}
      </span>
    </div>
  );
}

// ─── Rate limiting constants ──────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECS = 30;

// ─── Security notice (collapsible) ───────────────────────────────────────────
function SecurityNotice({ lang }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sec-notice">
      <button className="sec-notice-toggle" onClick={() => setOpen(o => !o)}>
        <Shield size={13} />
        <span>{lang === "mn" ? "Аюулгүй байдлын мэдэгдэл" : "Security notice"}</span>
        {open ? <ChevronDown size={12} style={{ marginLeft: "auto" }} /> : <ChevronRight size={12} style={{ marginLeft: "auto" }} />}
      </button>
      {open && (
        <div className="sec-notice-body">
          <div className="sec-row ok">
            <CheckCircle size={12} />
            {lang === "mn"
              ? "Нууц үг PBKDF2-SHA256 (150,000 давталт) аргаар localStorage-д хадгалагддаг."
              : "Passwords are hashed with PBKDF2-SHA256 (150,000 iterations) before storage."}
          </div>
          <div className="sec-row ok">
            <CheckCircle size={12} />
            {lang === "mn"
              ? "Session 7 хоногийн дараа автоматаар дуусна."
              : "Sessions expire automatically after 7 days."}
          </div>
          <div className="sec-row warn">
            <AlertTriangle size={12} />
            {lang === "mn"
              ? "Өгөгдөл зөвхөн таны хөтөчид хадгалагдана — backend сервер байхгүй."
              : "Data is stored in your browser only — no backend server exists."}
          </div>
          <div className="sec-row warn">
            <AlertTriangle size={12} />
            {lang === "mn"
              ? "Энэ бол demo систем. Бодит мэдээлэл оруулахгүй байхыг зөвлөж байна."
              : "This is a demo system. We recommend not entering real personal data."}
          </div>
          <div className="sec-row warn">
            <AlertTriangle size={12} />
            {lang === "mn"
              ? "Admin бүртгэл нь demo зориулалттай бөгөөд production түвшинд backend auth шаардагдана."
              : "Admin account is demo-only. Production use requires backend authentication."}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.login);
  const { login, register, checkEmailForReset, resetPassword, user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [mode, setMode]           = useState("login");
  const [userType, setUserType]   = useState("personal");
  const [showPw, setShowPw]       = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [form, setForm]           = useState({ name: "", email: "", password: "", confirm: "", org: "" });
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [resetEmail, setResetEmail]   = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // Rate limiting
  const [attempts, setAttempts]   = useState(0);
  const [lockout, setLockout]     = useState(0); // seconds remaining
  const lockoutRef = useRef(null);

  useEffect(() => {
    if (lockout <= 0) return;
    lockoutRef.current = setInterval(() => {
      setLockout(s => {
        if (s <= 1) { clearInterval(lockoutRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(lockoutRef.current);
  }, [lockout > 0]);

  if (user) return <Navigate to={location.state?.from || "/dashboard"} replace />;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const switchMode = (next) => {
    setMode(next); setError(""); setResetSuccess(false);
    setShowPw(false); setShowNewPw(false);
    setForm({ name: "", email: "", password: "", confirm: "", org: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (lockout > 0) return;

    setLoading(true);
    try {
      if (mode === "login") {
        const ok = await login(form.email, form.password);
        if (ok) {
          setAttempts(0);
          navigate(location.state?.from || "/dashboard", { replace: true });
        } else {
          const next = attempts + 1;
          setAttempts(next);
          if (next >= MAX_ATTEMPTS) {
            setAttempts(0);
            setLockout(LOCKOUT_SECS);
            setError(lang === "mn"
              ? `${MAX_ATTEMPTS} удаа буруу оруулсан. ${LOCKOUT_SECS}с хүлээнэ үү.`
              : `${MAX_ATTEMPTS} failed attempts. Wait ${LOCKOUT_SECS}s.`);
          } else {
            setError(`${t.login.error_invalid} (${next}/${MAX_ATTEMPTS})`);
          }
        }

      } else if (mode === "register") {
        if (form.password.length < 8) {
          setError(lang === "mn" ? "Нууц үг 8+ тэмдэгт байх ёстой" : "Password must be at least 8 characters");
          return;
        }
        if (form.password !== form.confirm) { setError(t.login.error_password_mismatch); return; }
        const result = await register({ name: form.name, email: form.email, password: form.password, type: userType, org: form.org });
        if (!result.ok) {
          setError(result.error === "email_taken" ? t.login.error_email_taken
                 : result.error === "too_short"   ? (lang === "mn" ? "Нууц үг 8+ тэмдэгт байх ёстой" : "Password must be at least 8 characters")
                 : t.login.error_invalid);
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
        if (form.password.length < 8) {
          setError(lang === "mn" ? "Нууц үг 8+ тэмдэгт байх ёстой" : "Password must be at least 8 characters");
          return;
        }
        if (form.password !== form.confirm) { setError(t.login.error_password_mismatch); return; }
        const result = await resetPassword(resetEmail, form.password);
        if (!result.ok) {
          setError(result.error === "too_short"
            ? (lang === "mn" ? "Нууц үг 8+ тэмдэгт байх ёстой" : "Password must be at least 8 characters")
            : t.login.error_invalid);
          return;
        }
        setResetSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockout > 0;

  return (
    <div className="login-page">
      <div className="login-card card animate-fade">
        <div className="login-logo">
          <Zap size={28} />
          <span>{APP_NAME}</span>
        </div>

        {/* ── Forgot / Reset ── */}
        {(mode === "forgot" || mode === "reset") && (
          <>
            <div className="forgot-icon">
              <KeyRound size={24} style={{ color: "#3a8fd4" }} />
            </div>
            <h1 className="login-title">
              {mode === "forgot" ? t.login.forgot_title : t.login.reset_title}
            </h1>
            {mode === "forgot" && <p className="forgot-subtitle">{t.login.forgot_subtitle}</p>}
            {mode === "reset" && <p className="forgot-subtitle" style={{ color: "#2a9d8f" }}>{resetEmail}</p>}

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
                          className="form-input" required minLength={8} placeholder="••••••••" autoFocus />
                        <button type="button" className="pw-toggle" onClick={() => setShowNewPw(!showNewPw)}>
                          {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <StrengthMeter pw={form.password} lang={lang} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="reset-confirm">{t.login.reset_confirm}</label>
                      <input id="reset-confirm" name="confirm" type="password" value={form.confirm}
                        onChange={handleChange} className="form-input" required placeholder="••••••••" />
                    </div>
                  </>
                )}
                {error && <div className="login-error" role="alert">{error}</div>}
                <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                  {loading ? <span className="login-spinner" /> : <KeyRound size={17} />}
                  {mode === "forgot" ? t.login.forgot_btn : t.login.reset_btn}
                </button>
              </form>
            )}
            <button className="forgot-back-btn" onClick={() => switchMode("login")}>
              <ArrowLeft size={14} />{t.login.forgot_back}
            </button>
          </>
        )}

        {/* ── Login / Register ── */}
        {(mode === "login" || mode === "register") && (
          <>
            <h1 className="login-title">
              {mode === "login" ? t.login.title : t.login.register_title}
            </h1>

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
                <input id="login-email" name="email" type="email" value={form.email}
                  onChange={handleChange} className="form-input" required
                  placeholder="example@email.com" disabled={isLocked} />
              </div>

              <div className="form-group">
                <div className="pw-label-row">
                  <label className="form-label" htmlFor="login-password">{t.login.password}</label>
                  {mode === "login" && (
                    <button type="button" className="forgot-inline-btn" onClick={() => switchMode("forgot")}>
                      {t.login.forgot_link}
                    </button>
                  )}
                </div>
                <div className="pw-row">
                  <input id="login-password" name="password" type={showPw ? "text" : "password"}
                    value={form.password} onChange={handleChange}
                    className="form-input" required placeholder="••••••••" disabled={isLocked}
                    minLength={mode === "register" ? 8 : undefined} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === "register" && <StrengthMeter pw={form.password} lang={lang} />}
              </div>

              {mode === "register" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="login-confirm">{t.login.confirm_password}</label>
                  <input id="login-confirm" name="confirm" type="password" value={form.confirm}
                    onChange={handleChange} className="form-input" required placeholder="••••••••" />
                  {form.confirm && form.password !== form.confirm && (
                    <div className="pw-mismatch">
                      {lang === "mn" ? "Нууц үг таарахгүй байна" : "Passwords do not match"}
                    </div>
                  )}
                </div>
              )}

              {error && <div className="login-error" role="alert">{error}</div>}

              {isLocked && (
                <div className="lockout-banner">
                  <Lock size={14} />
                  {lang === "mn"
                    ? `Нэвтрэх хаагдсан — ${lockout}с хүлээнэ үү`
                    : `Account temporarily locked — ${lockout}s remaining`}
                </div>
              )}

              <button type="submit" className="btn btn-primary login-btn"
                disabled={loading || isLocked}>
                {loading
                  ? <span className="login-spinner" />
                  : mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
                {mode === "login" ? t.login.login_btn : t.login.register_btn}
              </button>
            </form>

            <div className="login-switch">
              {mode === "login" ? (
                <><span>{t.login.no_account}</span>
                  <button className="switch-btn" onClick={() => switchMode("register")}>{t.login.register_btn}</button></>
              ) : (
                <><span>{t.login.has_account}</span>
                  <button className="switch-btn" onClick={() => switchMode("login")}>{t.login.login_btn}</button></>
              )}
            </div>

            {/* Demo hint — no real credentials shown */}
            <div className="demo-hint">
              <span>
                {lang === "mn"
                  ? "Demo: шинэ бүртгэл үүсгэх эсвэл admin@ubenergy.mn-ээр нэвтэрнэ үү."
                  : "Demo: create a new account or sign in with admin@ubenergy.mn."}
              </span>
            </div>

            {/* Security notice accordion */}
            <SecurityNotice lang={lang} />
          </>
        )}
      </div>
    </div>
  );
}
