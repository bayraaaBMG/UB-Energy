import { Link, useLocation } from "react-router-dom";
import { CheckCircle, ArrowLeft, Mail, ExternalLink, Zap } from "lucide-react";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { APP_NAME } from "../config/constants";
import "./AuthPages.css";

export default function ForgotSuccessPage() {
  const { lang } = useLang();
  const mn = lang === "mn";
  const location = useLocation();
  const email = location.state?.email || "";

  usePageTitle(mn ? "И-мэйл илгээгдлээ" : "Email Sent");

  return (
    <div className="auth-bg">
      <div className="auth-grid-bg" />

      <div className="auth-card animate-fade" style={{ textAlign: "center" }}>
        <div className="auth-logo">
          <Zap size={22} />
          <span>{APP_NAME}</span>
        </div>

        <div className="auth-success-ring">
          <CheckCircle size={34} style={{ color: "#2a9d8f" }} />
        </div>

        <h1 className="auth-title">
          {mn ? "И-мэйл илгээгдлээ!" : "Check your email"}
        </h1>

        <p className="auth-subtitle">
          {mn
            ? "Нууц үг сэргээх заавар дараах хаяг руу илгээгдлээ:"
            : "Password reset instructions have been sent to:"}
          <br /><br />
          {email
            ? <span className="auth-email-highlight">{email}</span>
            : <span style={{ color: "var(--text3)", fontSize: "0.85rem" }}>
                {mn ? "таны и-мэйл хаяг" : "your email address"}
              </span>
          }
        </p>

        <p style={{ fontSize: "0.82rem", color: "var(--text3)", marginBottom: "1.75rem", lineHeight: 1.65 }}>
          {mn
            ? "И-мэйл дэх линк дээр дарж шинэ нууц үг тохируулна уу. Линк 1 цагийн дотор хүчинтэй байна."
            : "Click the link in that email to set a new password. The link expires in 1 hour."}
        </p>

        <a
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-premium auth-btn-full"
          style={{ textDecoration: "none", marginBottom: "0.75rem" }}
        >
          <ExternalLink size={16} />
          {mn ? "Gmail нээх" : "Open Gmail"}
        </a>

        <Link
          to="/login"
          className="btn btn-ghost auth-btn-full"
          style={{ textDecoration: "none" }}
        >
          <ArrowLeft size={16} />
          {mn ? "Нэвтрэх хуудас руу буцах" : "Back to login"}
        </Link>

        <p style={{ marginTop: "1.25rem", fontSize: "0.8rem", color: "var(--text3)" }}>
          {mn ? "И-мэйл ирсэнгүй үү?" : "Didn't receive the email?"}{" "}
          <Link to="/login" style={{ color: "var(--primary-light)", fontWeight: 600 }}>
            {mn ? "Дахин оролдох" : "Try again"}
          </Link>
        </p>
      </div>
    </div>
  );
}
