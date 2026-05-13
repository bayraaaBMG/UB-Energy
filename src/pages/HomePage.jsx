import React from "react";
import { Link } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  Brain, BarChart2, CloudRain, Lightbulb, ArrowRight,
  Building2, Zap, Database, Target, Info, LogIn, FlaskConical, CheckCircle, Map,
  ShieldAlert, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { monthlyEnergyData } from "../data/mockData";
import { METRICS } from "../ml/model";
import { computeStats } from "../utils/buildingStorage";
import { useData } from "../contexts/DataContext";
import "./HomePage.css";

const FEATURES = (t) => [
  { icon: Brain,     title: t.home.feature1_title, text: t.home.feature1_text, color: "#3a8fd4", path: "/predictor" },
  { icon: CloudRain, title: t.home.feature2_title, text: t.home.feature2_text, color: "#2a9d8f", path: "/weather"   },
  { icon: BarChart2, title: t.home.feature3_title, text: t.home.feature3_text, color: "#e9c46a", path: "/dashboard" },
  { icon: Lightbulb, title: t.home.feature4_title, text: t.home.feature4_text, color: "#f4a261", path: "/recommendations" },
];

export default function HomePage() {
  const { t, lang, user } = useApp();
  const mn = lang === "mn";
  usePageTitle(t.nav.home);
  const monthlyData = monthlyEnergyData.map(d => ({
    ...d,
    month: lang === "mn" ? d.month : d.month_en,
  }));

  const { buildings: allBuildings } = useData();
  const stats = React.useMemo(() => computeStats(allBuildings), [allBuildings]);

  const DEMO_BADGE = { mn: "Синтетик өгөгдөл", en: "Synthetic data", icon: FlaskConical, color: "#f4a261" };
  const REAL_BADGE = { mn: "Бодит үзүүлэлт", en: "Real metric", icon: CheckCircle,  color: "#2a9d8f" };
  const SYNT_BADGE = { mn: "Синтетик датасет", en: "Synthetic dataset", icon: FlaskConical, color: "#6c757d" };

  const STATS = [
    {
      icon: Building2,
      value: stats ? `${stats.count.toLocaleString()} ${t.home.stat1_unit}` : `— ${t.home.stat1_unit}`,
      label: t.home.stat1_label,
      color: "#3a8fd4", src: t.home.stat1_src, badge: DEMO_BADGE,
    },
    {
      icon: Zap,
      value: stats ? `${stats.totalMwh >= 1000 ? (stats.totalMwh / 1000).toFixed(1) + " GWh" : stats.totalMwh + " MWh"}` : "— MWh",
      label: t.home.stat2_label,
      color: "#e9c46a", src: t.home.stat2_src, badge: DEMO_BADGE,
    },
    {
      icon: Target,
      value: `${(METRICS.r2 * 100).toFixed(1)}%`,
      label: t.home.stat3_label,
      color: "#2a9d8f", src: t.home.stat3_src, badge: REAL_BADGE,
    },
    {
      icon: Database,
      value: `${METRICS.n_total} ${t.home.stat4_unit}`,
      label: t.home.stat4_label,
      color: "#f4a261", src: t.home.stat4_src, badge: SYNT_BADGE,
    },
  ];

  return (
    <div className="home-page">

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg-grid" />
        <div className="container hero-content animate-fade">
          <div className="hero-badge">
            <Zap size={14} />
            <span>OLS Regression · EUI Model · Open-Meteo · {mn ? "Монголын нөхцөлд" : "Mongolia-adapted"}</span>
          </div>
          {user && (
            <div className="hero-welcome">
              <div className="hw-avatar">{user.name.charAt(0)}</div>
              <span>{t.home.welcome.replace("{name}", user.name)}</span>
            </div>
          )}
          <h1 className="hero-title">{t.home.hero_title}</h1>
          <p className="hero-sentence">{t.home.hero_sentence}</p>
          <p className="hero-subtitle">{t.home.hero_subtitle}</p>
          <div className="hero-actions">
            <Link to="/predictor" className="btn btn-accent">
              <Brain size={18} />
              {t.home.hero_btn}
            </Link>
            <Link to="/map" className="btn btn-secondary">
              <Map size={18} />
              {t.home.hero_btn2}
            </Link>
            <Link to="/dashboard" className="btn btn-secondary">
              <BarChart2 size={18} />
              {t.home.hero_btn3}
            </Link>
          </div>
          {!user && (
            <p className="hero-login-hint">
              <LogIn size={13} />
              {t.home.login_hint}
              {" "}<Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
                {t.home.login_link}
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats-section">
        <div className="container">
          <div className="grid grid-4">
            {STATS.map(({ icon: Icon, value, label, color, badge }) => {
              const BadgeIcon = badge.icon;
              return (
                <div className="stat-card card animate-fade" key={label}>
                  <div className="stat-icon" style={{ background: `${color}22`, color }}>
                    <Icon size={24} />
                  </div>
                  <div className="stat-value">{value}</div>
                  <div className="stat-label">{label}</div>
                  <span className="stat-data-badge" style={{ color: badge.color, borderColor: `${badge.color}44`, background: `${badge.color}10` }}>
                    <BadgeIcon size={10} />
                    {lang === "mn" ? badge.mn : badge.en}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stats source table */}
          <div className="stats-source-box">
            <div className="ssb-head">
              <Info size={14} />
              {t.home.stats_source_title}
            </div>
            <div className="ssb-rows">
              {STATS.map(({ icon: Icon, value, label, color, src }) => (
                <div className="ssb-row" key={label}>
                  <span className="ssb-val" style={{ color }}>
                    <Icon size={12} /> {value}
                  </span>
                  <span className="ssb-label">{label}</span>
                  <span className="ssb-src">{src}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Disclaimer / Data source ── */}
      <section className="disclaimer-section">
        <div className="container">
          <div className="disclaimer-block">
            <div className="disclaimer-left">
              <ShieldAlert size={16} className="disclaimer-icon" aria-hidden="true" />
              <strong>{t.home.disclaimer_title}</strong>
            </div>
            <p className="disclaimer-text">{t.home.disclaimer_text}</p>
            <p className="disclaimer-sources">{t.home.disclaimer_sources}</p>
            <p className="disclaimer-updated">
              <Clock size={11} aria-hidden="true" />
              {t.home.last_updated}: <time dateTime="2026-04-18">2026-04-18</time>
            </p>
          </div>
        </div>
      </section>

      {/* ── Chart + Intro ── */}
      <section className="chart-preview">
        <div className="container">
          <div className="grid chart-preview-grid gap-3">

            <div className="card intro-card">
              <h2 className="section-title">{t.home.intro_title}</h2>
              <p style={{ color: "var(--text2)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                {t.home.intro_text}
              </p>
              <div className="tech-tags">
                {["OLS Regression", "EUI Formula", "Ridge Regression", "Open-Meteo API", "БНТУ норм", "Shoelace Area"].map(tag => (
                  <span key={tag} className="tech-tag">{tag}</span>
                ))}
              </div>
              <Link to="/predictor" className="btn btn-primary mt-3">
                <ArrowRight size={16} />
                {t.home.hero_btn}
              </Link>
            </div>

            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <h3 className="section-title" style={{ fontSize: "1rem", margin: 0 }}>
                  {t.home.chart_title}
                </h3>
                <span className="stat-data-badge" style={{ color: "#f4a261", borderColor: "rgba(244,162,97,0.4)", background: "rgba(244,162,97,0.1)" }}>
                  <FlaskConical size={10} />
                  {lang === "mn" ? "Синтетик өгөгдөл" : "Synthetic data"}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
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
                    formatter={(v, name) => [
                      `${v.toLocaleString()} kWh`,
                      name === "usage"
                        ? t.home.chart_src_usage
                        : t.home.chart_src_pred,
                    ]}
                  />
                  <Area type="monotone" dataKey="usage"     stroke="#1a6eb5" fill="url(#colorUsage)" strokeWidth={2} name="usage" />
                  <Area type="monotone" dataKey="predicted" stroke="#2a9d8f" fill="none" strokeWidth={2} strokeDasharray="4 4" name="predicted" />
                </AreaChart>
              </ResponsiveContainer>

              {/* Chart source explanation */}
              <div className="chart-source-box">
                <div className="csb-head">
                  <Info size={13} />
                  {t.home.chart_src_title}
                </div>
                <div className="csb-items">
                  <div className="csb-item">
                    <span className="csb-swatch" style={{ background: "#1a6eb5" }} />
                    <div>
                      <strong>{t.home.chart_src_usage}</strong>
                      <span>{t.home.chart_src_usage_desc}</span>
                    </div>
                  </div>
                  <div className="csb-item">
                    <span className="csb-swatch dashed" style={{ borderColor: "#2a9d8f" }} />
                    <div>
                      <strong>{t.home.chart_src_pred}</strong>
                      <span>{t.home.chart_src_pred_desc}</span>
                    </div>
                  </div>
                </div>
                <div className="csb-note">{t.home.chart_src_note}</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── ML Credibility section ── */}
      <section className="ml-cred-section">
        <div className="container">
          <div className="ml-cred-header">
            <h2 className="section-title">{mn ? "Машин сургалтын загварын тухай" : "About the ML model"}</h2>
            <p className="ml-cred-sub">
              {mn
                ? "Энэ систем үнэхээр машин сургалтын аргыг ашиглаж байна уу? — Тийм. Доор тайлбарласан."
                : "Does this system actually use machine learning? — Yes. Details below."}
            </p>
          </div>
          <div className="ml-cred-grid">
            {[
              {
                label: mn ? "Ашигласан арга" : "Method used",
                value: "OLS Linear Regression",
                sub:   mn ? "(Ordinary Least Squares — Ridge λ=0.01)" : "(Ordinary Least Squares — Ridge λ=0.01)",
                color: "#3a8fd4",
              },
              {
                label: mn ? "Сургалтын өгөгдөл" : "Training data",
                value: "600",
                sub:   mn ? "синтетик Монгол барилга (EUI физик томьёо + ±12% дуу чимээ)" : "synthetic Mongolian buildings (physics EUI + ±12% noise)",
                color: "#2a9d8f",
              },
              {
                label: mn ? "Нарийвчлал (R²)" : "Accuracy (R²)",
                value: `${(METRICS.r2 * 100).toFixed(1)}%`,
                sub:   mn ? `MAE = ${METRICS.mae.toLocaleString()} kWh · MAPE = ${METRICS.mape}%` : `MAE = ${METRICS.mae.toLocaleString()} kWh · MAPE = ${METRICS.mape}%`,
                color: "#9b72cf",
              },
              {
                label: mn ? "Оролтын хувьсагч" : "Input features",
                value: "30+",
                sub:   mn ? "талбай, нас, давхар, дулаалга, цонх, халаалт, материал, HDD..." : "area, age, floors, insulation, window, heating, material, HDD...",
                color: "#e9c46a",
              },
              {
                label: mn ? "Монголын нөхцөл" : "Mongolia-specific",
                value: "УБ HDD",
                sub:   mn ? "~4,500 HDD/жил · Панель барилга · Нүүрсний хүчин зүйл 0.73 kg CO₂/kWh" : "~4,500 HDD/yr · Panel buildings · Coal factor 0.73 kg CO₂/kWh",
                color: "#e76f51",
              },
              {
                label: mn ? "Тайлбарлах боломж" : "Explainability",
                value: mn ? "Бүрэн" : "Full",
                sub:   mn ? "β-коэффициент бүр параметрийн нөлөөг харуулна · SHAP-lite дашбордод байна" : "Each β shows parameter impact · SHAP-lite available in dashboard",
                color: "#57cc99",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="ml-cred-card card">
                <div className="mlc-label">{label}</div>
                <div className="mlc-value" style={{ color }}>{value}</div>
                <div className="mlc-sub">{sub}</div>
              </div>
            ))}
          </div>
          <div className="ml-cred-flow">
            {[
              { step: mn ? "Оролт" : "Input",      desc: mn ? "Барилгын параметр" : "Building parameters" },
              { step: "OLS Model",                  desc: mn ? "β·x тооцоолол" : "β·x computation" },
              { step: mn ? "Таамаглал" : "Output",  desc: mn ? "kWh, зэрэглэл, CO₂" : "kWh, grade, CO₂" },
              { step: mn ? "Зөвлөмж" : "Actions",  desc: mn ? "Хэмнэлтийн санал" : "Savings recommendations" },
            ].map(({ step, desc }, i, arr) => (
              <span key={step} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="mlc-flow-node">
                  <span className="mlc-flow-step">{step}</span>
                  <span className="mlc-flow-desc">{desc}</span>
                </span>
                {i < arr.length - 1 && <span className="mlc-flow-arr">→</span>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section">
        <div className="container">
          <div className="grid grid-4">
            {FEATURES(t).map(({ icon: Icon, title, text, color, path }) => (
              <Link to={path} className="feature-card card animate-fade" key={title}>
                <div className="feature-icon" style={{ background: `${color}22`, color }}>
                  <Icon size={28} />
                </div>
                <h3 className="feature-title">{title}</h3>
                <p className="feature-text">{text}</p>
                <span className="feature-arrow" style={{ color }}>
                  <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
