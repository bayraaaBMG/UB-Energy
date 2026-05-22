import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, RefreshCw, ExternalLink, Zap, CheckCircle } from "lucide-react";
import { useLang } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { APP_NAME } from "../config/constants";
import "./AuthPages.css";

export default function VerifyEmailPage() {
  const { lang } = useLang();
  const mn = lang === "mn";
  const { user } = useAuth();
  usePageTitle(mn ? "И-мэйл баталгаажуулалт" : "Verify Email");

  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  const email = user?.email || "";

  const handleResend = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setResent(true);
    setLoading(false);
  };

  return (
    <div className="auth-bg">
      <div className="auth-grid-bg" />

      <div className="auth-card animate-fade">
        <div className="auth-logo">
          <Zap size={22} />
          <span>{APP_NAME}</span>
        </div>

        {/* Steps */}
        <div className="auth-steps">
          <div className="auth-step-dot done" />
          <div className="auth-step-dot active" />
          <div className="auth-step-dot" />
        </div>

        <div className="auth-icon-circle" style={{
          background: "rgba(26,110,181,0.12)",
          border: "2px solid rgba(58,143,212,0.25)",
        }}>
          <Mail size={30} style={{ color: "#3a8fd4" }} />
        </div>

        <h1 className="auth-title">
          {mn ? "И-мэйлээ баталгаажуулна уу" : "Verify your email"}
        </h1>

        <p className="auth-subtitle">
          {mn ? "Та дараах хаяг руу баталгаажуулах и-мэйл илгээгдлээ:" : "We sent a verification email to:"}
          <br /><br />
          {email && <span className="auth-email-highlight">{email}</span>}
        </p>

        <p style={{ textAlign: "center", fontSize: "0.83rem", color: "var(--text3)", marginBottom: "1.5rem", lineHeight: 1.65 }}>
          {mn
            ? "И-мэйл дэх линк дээр дарж бүртгэлээ баталгаажуулна уу. Хэрэв харагдахгүй бол spam хавтасаа шалгана уу."
            : "Click the link in that email to verify your account. If you don't see it, check your spam folder."}
        </p>

        {resent ? (
          <div className="auth-resent-banner">
            <CheckCircle size={15} />
            {mn ? "Дахин илгээлээ! И-мэйлээ шалгана уу." : "Email resent! Check your inbox."}
          </div>
        ) : (
          <button
            className="btn btn-premium auth-btn-full"
            onClick={handleResend}
            disabled={loading}
            style={{ marginBottom: "0.75rem" }}
          >
            {loading
              ? <span className="login-spinner" style={{ borderTopColor: "#fff" }} />
              : <RefreshCw size={16} />}
            {mn ? "Дахин илгээх" : "Resend verification email"}
          </button>
        )}

        <a
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost auth-btn-full"
        >
          <ExternalLink size={16} />
          {mn ? "Gmail нээх" : "Open Gmail"}
        </a>

        <div className="auth-divider" />

        <Link to="/login" className="auth-back-link">
          <ArrowLeft size={14} />
          {mn ? "Нэвтрэх хуудас руу буцах" : "Back to login"}
        </Link>
      </div>
    </div>
  );
}
