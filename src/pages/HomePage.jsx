import { Link } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import {
  Brain, BarChart2, CloudRain, Lightbulb, ArrowRight,
  Building2, Zap, Users, Target
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { monthlyEnergyData } from "../data/mockData";
import { APP_NAME } from "../config/constants";
import "./HomePage.css";

const stats = (t) => [
  { icon: Building2, value: "1,247", label: t.home.stat1_label, color: "#3a8fd4" },
  { icon: Zap, value: "28,400", label: t.home.stat2_label, color: "#e9c46a" },
  { icon: Target, value: "92.4%", label: t.home.stat3_label, color: "#2a9d8f" },
  { icon: Users, value: "389", label: t.home.stat4_label, color: "#f4a261" },
];

const features = (t) => [
  { icon: Brain, title: t.home.feature1_title, text: t.home.feature1_text, color: "#3a8fd4" },
  { icon: CloudRain, title: t.home.feature2_title, text: t.home.feature2_text, color: "#2a9d8f" },
  { icon: BarChart2, title: t.home.feature3_title, text: t.home.feature3_text, color: "#e9c46a" },
  { icon: Lightbulb, title: t.home.feature4_title, text: t.home.feature4_text, color: "#f4a261" },
];

export default function HomePage() {
  const { t, lang } = useLang();
  const monthlyData = monthlyEnergyData.map(d => ({ ...d, month: lang === "mn" ? d.month : d.month_en }));

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg-grid" />
        <div className="container hero-content animate-fade">
          <div className="hero-badge">
            <Zap size={14} />
            <span>Machine Learning · Energy Prediction</span>
          </div>
          <h1 className="hero-title">{t.home.hero_title}</h1>
          <p className="hero-subtitle">{t.home.hero_subtitle}</p>
          <div className="hero-actions">
            <Link to="/predictor" className="btn btn-accent">
              <Brain size={18} />
              {t.home.hero_btn}
            </Link>
            <Link to="/dashboard" className="btn btn-secondary">
              <BarChart2 size={18} />
              {t.home.hero_btn2}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="container">
          <div className="grid grid-4">
            {stats(t).map(({ icon: Icon, value, label, color }) => (
              <div className="stat-card card animate-fade" key={label}>
                <div className="stat-icon" style={{ background: `${color}22`, color }}>
                  <Icon size={24} />
                </div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chart Preview */}
      <section className="chart-preview">
        <div className="container">
          <div className="grid grid-2 gap-3" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
            <div className="card intro-card">
              <h2 className="section-title">{t.home.intro_title}</h2>
              <p style={{ color: "var(--text2)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                {t.home.intro_text}
              </p>
              <div className="tech-tags">
                {["Random Forest", "Gradient Boosting", "XGBoost", "SHAP", "Python", "React"].map(tag => (
                  <span key={tag} className="tech-tag">{tag}</span>
                ))}
              </div>
              <Link to="/predictor" className="btn btn-primary mt-3">
                <ArrowRight size={16} />
                {t.home.hero_btn}
              </Link>
            </div>

            <div className="card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>
                {t.dashboard.monthly} ({t.common.units_mwh})
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a6eb5" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#1a6eb5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.4)" />
                  <XAxis dataKey="month" tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: "#6a9bbf", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }}
                    labelStyle={{ color: "var(--accent)" }}
                  />
                  <Area type="monotone" dataKey="usage" stroke="#1a6eb5" fill="url(#colorUsage)" strokeWidth={2} name={t.common.usage} />
                  <Area type="monotone" dataKey="predicted" stroke="#2a9d8f" fill="none" strokeWidth={2} strokeDasharray="4 4" name={t.common.predicted} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="container">
          <div className="grid grid-4">
            {features(t).map(({ icon: Icon, title, text, color }) => (
              <div className="feature-card card animate-fade" key={title}>
                <div className="feature-icon" style={{ background: `${color}22`, color }}>
                  <Icon size={28} />
                </div>
                <h3 className="feature-title">{title}</h3>
                <p className="feature-text">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
