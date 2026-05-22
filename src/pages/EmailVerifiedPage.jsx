import { Link } from "react-router-dom";
import { CheckCircle, ArrowRight, Home, Zap } from "lucide-react";
import { useLang } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { APP_NAME } from "../config/constants";
import "./AuthPages.css";

export default function EmailVerifiedPage() {
  const { lang } = useLang();
  const mn = lang === "mn";
  const { user } = useAuth();

  usePageTitle(mn ? "И-мэйл баталгаажлаа" : "Email Verified");

  return (
    <div className="auth-bg">
      <div className="auth-grid-bg" />

      <div className="auth-card animate-fade" style={{ textAlign: "center" }}>
        <div className="auth-logo">
          <Zap size={22} />
          <span>{APP_NAME}</span>
        </div>

        {/* Steps: all done */}
        <div className="auth-steps">
          <div className="auth-step-dot done" />
          <div className="auth-step-dot done" />
          <div className="auth-step-dot done" />
        </div>

        <div className="auth-success-ring" style={{ width: 84, height: 84 }}>
          <CheckCircle size={38} style={{ color: "#2a9d8f" }} />
        </div>

        <h1 className="auth-title">
          {mn ? "И-мэйл баталгаажлаа!" : "Email verified!"}
        </h1>

        <p className="auth-subtitle">
          {mn
            ? "Таны и-мэйл хаяг амжилттай баталгаажлаа. Одоо UB Energy системийн бүх боломжийг ашиглах боломжтой болсон."
            : "Your email address has been successfully verified. You now have full access to UB Energy."}
        </p>

        {/* Feature chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", marginBottom: "1.75rem" }}>
          {[
            { label: mn ? "Дашборд" : "Dashboard", color: "#3a8fd4" },
            { label: mn ? "Таамаглагч" : "Predictor", color: "#2a9d8f" },
            { label: mn ? "Зөвлөмж" : "Recommendations", color: "#e9c46a" },
          ].map(({ label, color }) => (
            <span key={label} style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "0.3rem 0.75rem",
              background: `${color}15`,
              border: `1px solid ${color}30`,
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 600,
              color,
            }}>
              ✓ {label}
            </span>
          ))}
        </div>

        {user ? (
          <Link
            to="/dashboard"
            className="btn btn-premium auth-btn-full"
            style={{ textDecoration: "none", marginBottom: "0.75rem" }}
          >
            <ArrowRight size={16} />
            {mn ? "Dashboard руу шилжих" : "Go to Dashboard"}
          </Link>
        ) : (
          <Link
            to="/login"
            className="btn btn-premium auth-btn-full"
            style={{ textDecoration: "none", marginBottom: "0.75rem" }}
          >
            {mn ? "Нэвтрэх" : "Sign in to continue"}
          </Link>
        )}

        <Link to="/" className="auth-back-link">
          <Home size={14} />
          {mn ? "Нүүр хуудас руу буцах" : "Back to home"}
        </Link>
      </div>
    </div>
  );
}
