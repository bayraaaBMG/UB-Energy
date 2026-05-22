import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { KeyRound, Eye, EyeOff, CheckCircle, ArrowLeft, Zap, AlertTriangle } from "lucide-react";
import { useLang } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { APP_NAME } from "../config/constants";
import "./AuthPages.css";

function pwStrength(pw) {
  if (!pw) return { score: 0, pct: 0, label: "", color: "" };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { pct: 15,  label: "Маш сул",    en: "Very weak",   color: "#e63946" },
    { pct: 30,  label: "Сул",        en: "Weak",         color: "#f4a261" },
    { pct: 55,  label: "Дунд",       en: "Fair",         color: "#e9c46a" },
    { pct: 75,  label: "Хүчтэй",    en: "Strong",       color: "#57cc99" },
    { pct: 100, label: "Маш хүчтэй", en: "Very strong",  color: "#2a9d8f" },
  ];
  return { score: s, ...map[Math.min(s, 4)] };
}

export default function ResetPasswordPage() {
  const { lang } = useLang();
  const mn = lang === "mn";
  const { resetPassword } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get("email") || "";

  usePageTitle(mn ? "Нууц үг сэргээх" : "Reset Password");

  const [pw, setPw]           = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [showCf, setShowCf]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  const st = pwStrength(pw);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (pw.length < 8) {
      setError(mn ? "Нууц үг 8+ тэмдэгт байх ёстой" : "Password must be at least 8 characters");
      return;
    }
    if (pw !== confirm) {
      setError(mn ? "Нууц үг таарахгүй байна" : "Passwords do not match");
      return;
    }
    setLoading(true);
    const result = await resetPassword(email, pw);
    setLoading(false);
    if (!result.ok) {
      setError(mn ? "Нууц үг солиход алдаа гарлаа. Дахин оролдоно уу." : "Failed to reset password. Please try again.");
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate("/login"), 2800);
  };

  // Invalid link
  if (!email) {
    return (
      <div className="auth-bg">
        <div className="auth-grid-bg" />
        <div className="auth-card animate-fade" style={{ textAlign: "center" }}>
          <div className="auth-icon-circle" style={{
            background: "rgba(244,162,97,0.1)",
            border: "2px solid rgba(244,162,97,0.25)",
          }}>
            <AlertTriangle size={30} style={{ color: "var(--warning)" }} />
          </div>
          <h1 className="auth-title">{mn ? "Линк хүчингүй" : "Invalid reset link"}</h1>
          <p className="auth-subtitle">
            {mn
              ? "Энэ линк хүчингүй эсвэл хугацаа нь дууссан байна. Дахин сэргээх хүсэлт илгээнэ үү."
              : "This link is invalid or has expired. Please request a new password reset."}
          </p>
          <Link to="/login" className="btn btn-premium auth-btn-full" style={{ textDecoration: "none" }}>
            {mn ? "Нэвтрэх хуудас руу буцах" : "Back to login"}
          </Link>
        </div>
      </div>
    );
  }

  // Success screen
  if (success) {
    return (
      <div className="auth-bg">
        <div className="auth-grid-bg" />
        <div className="auth-card animate-fade" style={{ textAlign: "center" }}>
          <div className="auth-success-ring" style={{ width: 80, height: 80 }}>
            <CheckCircle size={36} style={{ color: "#2a9d8f" }} />
          </div>
          <h1 className="auth-title">
            {mn ? "Нууц үг амжилттай солигдлоо!" : "Password reset!"}
          </h1>
          <p className="auth-subtitle">
            {mn
              ? "Шинэ нууц үгээрээ нэвтэрч болно. Нэвтрэх хуудас руу шилжиж байна..."
              : "You can now sign in with your new password. Redirecting to login..."}
          </p>
          <span className="auth-info-chip">
            <CheckCircle size={13} />
            {mn ? "Хэдхэн хормын дараа..." : "Redirecting shortly..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg">
      <div className="auth-grid-bg" />

      <div className="auth-card animate-fade">
        <div className="auth-logo">
          <Zap size={22} />
          <span>{APP_NAME}</span>
        </div>

        <div className="auth-steps">
          <div className="auth-step-dot done" />
          <div className="auth-step-dot done" />
          <div className="auth-step-dot active" />
        </div>

        <div className="auth-icon-circle" style={{
          background: "rgba(58,143,212,0.1)",
          border: "2px solid rgba(58,143,212,0.22)",
        }}>
          <KeyRound size={28} style={{ color: "#3a8fd4" }} />
        </div>

        <h1 className="auth-title">{mn ? "Шинэ нууц үг тохируулах" : "Set new password"}</h1>
        <p className="auth-subtitle">
          {mn
            ? <><span className="auth-email-highlight">{email}</span> хаягт шинэ нууц үгээ тохируулна уу.</>
            : <>Set a new password for <span className="auth-email-highlight">{email}</span>.</>
          }
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{mn ? "Шинэ нууц үг" : "New password"}</label>
            <div className="pw-row">
              <input
                type={showPw ? "text" : "password"}
                className="form-input"
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoFocus
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pw && (
              <div className="pw-strength" style={{ marginTop: "0.4rem" }}>
                <div className="pws-track">
                  <div className="pws-fill" style={{ width: `${st.pct}%`, background: st.color }} />
                </div>
                <span className="pws-label" style={{ color: st.color }}>
                  {mn ? st.label : st.en}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{mn ? "Нууц үг давтах" : "Confirm password"}</label>
            <div className="pw-row">
              <input
                type={showCf ? "text" : "password"}
                className="form-input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button type="button" className="pw-toggle" onClick={() => setShowCf(!showCf)}>
                {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirm && pw !== confirm && (
              <div style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "0.2rem" }}>
                {mn ? "Нууц үг таарахгүй байна" : "Passwords do not match"}
              </div>
            )}
          </div>

          {error && (
            <div className="login-error" role="alert" style={{ marginBottom: "0.75rem" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-premium auth-btn-full"
            disabled={loading || (confirm.length > 0 && pw !== confirm)}
          >
            {loading
              ? <span className="login-spinner" style={{ borderTopColor: "#fff" }} />
              : <KeyRound size={16} />}
            {mn ? "Нууц үг солих" : "Reset password"}
          </button>
        </form>

        <Link to="/login" className="auth-back-link">
          <ArrowLeft size={14} />
          {mn ? "Нэвтрэх хуудас руу буцах" : "Back to login"}
        </Link>
      </div>
    </div>
  );
}
