import { useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import {
  Globe, ExternalLink, RefreshCw, Info, ChevronDown, ChevronUp,
  Zap, User, Plug, Building2, Cloud, Leaf, Sun, TrendingUp, Thermometer, BarChart2,
  Brain, ArrowRight, Database, FlaskConical, CheckCircle,
} from "lucide-react";
import "./OWIDPage.css";

const CHARTS = [
  {
    id: "primary_energy",
    section: "energy_mix",
    title_mn: "Анхдагч эрчим хүчний хэрэглээ — эх сурвалжаар",
    title_en: "Primary Energy Consumption by Source",
    desc_mn: "Монгол Улсын жилийн анхдагч эрчим хүчний хэрэглээг эх сурвалжаар нь (нүүрс, газрийн тос, хий, сэргэн засагдах эрчим хүч) харуулна.",
    desc_en: "Mongolia's annual primary energy consumption broken down by source — coal, oil, gas, and renewables.",
    url: "https://ourworldindata.org/grapher/primary-energy-consumption-by-source?tab=chart&country=MNG",
    Icon: Zap, color: "#1a6eb5",
  },
  {
    id: "energy_per_capita",
    section: "energy_mix",
    title_mn: "Нэг хүнд ногдох эрчим хүч",
    title_en: "Energy Consumption per Capita",
    desc_mn: "Монгол Улсын нэг хүнд ногдох жилийн анхдагч эрчим хүчний хэрэглээ (кВт·цаг/хүн).",
    desc_en: "Mongolia's annual primary energy consumption per person (kWh/person).",
    url: "https://ourworldindata.org/grapher/per-capita-energy-use?tab=chart&country=MNG",
    Icon: User, color: "#2a9d8f",
  },
  {
    id: "electricity_mix",
    section: "electricity",
    title_mn: "Цахилгааны хольц",
    title_en: "Electricity Mix",
    desc_mn: "Монгол Улсын цахилгаан эрчим хүчний үйлдвэрлэлийн эх сурвалжийн хуваарилалт — нүүрс, нарны, салхины болон бусад.",
    desc_en: "Mongolia's electricity production breakdown by source — coal, solar, wind, and others.",
    url: "https://ourworldindata.org/grapher/electricity-mix?tab=chart&country=MNG",
    Icon: Plug, color: "#e9c46a",
  },
  {
    id: "elec_production",
    section: "electricity",
    title_mn: "Цахилгаан үйлдвэрлэл",
    title_en: "Electricity Production",
    desc_mn: "Монгол Улсын нийт цахилгаан эрчим хүчний үйлдвэрлэл — өсөлтийн хандлага.",
    desc_en: "Mongolia's total electricity generation — growth trend over time.",
    url: "https://ourworldindata.org/grapher/electricity-prod-source-stacked?tab=chart&country=MNG",
    Icon: Building2, color: "#f4a261",
  },
  {
    id: "co2_total",
    section: "co2",
    title_mn: "Нийт CO₂ ялгаруулалт",
    title_en: "Annual CO₂ Emissions",
    desc_mn: "Монгол Улсаас жил бүр ялгарах нийт нүүрсхүчлийн хийн хэмжээ (шаталтын эх сурвалжаас).",
    desc_en: "Mongolia's total annual CO₂ emissions from combustion sources.",
    url: "https://ourworldindata.org/grapher/annual-co2-emissions-per-country?tab=chart&country=MNG",
    Icon: Cloud, color: "#e63946",
  },
  {
    id: "co2_per_capita",
    section: "co2",
    title_mn: "Нэг хүнд ногдох CO₂",
    title_en: "CO₂ Emissions per Capita",
    desc_mn: "Монгол Улсын нэг хүнд ногдох CO₂ ялгаруулалт — дэлхийн дундажтай харьцуулан.",
    desc_en: "Mongolia's per capita CO₂ emissions compared to the global average.",
    url: "https://ourworldindata.org/grapher/co-emissions-per-capita?tab=chart&country=MNG",
    Icon: Globe, color: "#a8c5e0",
  },
  {
    id: "renewable",
    section: "renewable",
    title_mn: "Сэргэн засагдах эрчим хүчний хувь",
    title_en: "Share of Renewable Energy",
    desc_mn: "Монгол Улсын нийт цахилгааны дотор сэргэн засагдах (нарны, салхины, усан) эрчим хүчний эзлэх хувь.",
    desc_en: "Share of solar, wind, and hydro in Mongolia's total electricity generation.",
    url: "https://ourworldindata.org/grapher/renewable-share-energy?tab=chart&country=MNG",
    Icon: Leaf, color: "#2a9d8f",
  },
  {
    id: "solar_capacity",
    section: "renewable",
    title_mn: "Нарны эрчим хүчний хүчин чадал",
    title_en: "Solar Power Capacity",
    desc_mn: "Монгол Улсын суурилуулсан нарны хавтангийн нийт хүчин чадал (мегаватт).",
    desc_en: "Mongolia's total installed solar panel capacity in megawatts.",
    url: "https://ourworldindata.org/grapher/installed-solar-pv-capacity?tab=chart&country=MNG",
    Icon: Sun, color: "#e9c46a",
  },
];

function ChartFrame({ chart, expanded, onToggle, lang, t }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const title = lang === "mn" ? chart.title_mn : chart.title_en;
  const desc  = lang === "mn" ? chart.desc_mn  : chart.desc_en;
  const subtitle = lang === "mn" ? chart.title_en : chart.title_mn;
  const ChartIcon = chart.Icon;

  return (
    <div className={`owid-chart-card card ${expanded ? "expanded" : ""}`}>
      <button
        className="owid-chart-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="owid-chart-left">
          <span className="owid-chart-icon" style={{ background: `${chart.color}22`, color: chart.color }}>
            {ChartIcon && <ChartIcon size={18} />}
          </span>
          <div>
            <h3 className="owid-chart-title">{title}</h3>
            <p className="owid-chart-sub">{subtitle}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="owid-ext-badge">
            <Globe size={10} /> Our World in Data
          </span>
          <span className="owid-expand-btn" aria-hidden="true">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>
      </button>

      <p className="owid-chart-desc">{desc}</p>

      {expanded && (
        <div className="owid-frame-wrap animate-fade">
          {!loaded && !error && (
            <div className="owid-loading">
              <RefreshCw size={22} className="spin" />
              <span>{t.owid.loading}</span>
            </div>
          )}
          {error && (
            <div className="owid-error" role="alert">
              <Info size={20} />
              <div>
                <p>{t.owid.load_error}</p>
                <a href={chart.url} target="_blank" rel="noopener noreferrer" className="owid-ext-link">
                  <ExternalLink size={14} /> {t.owid.view_direct}
                </a>
              </div>
            </div>
          )}
          <iframe
            src={chart.url}
            title={title}
            className={`owid-iframe ${loaded ? "visible" : ""}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
            allow="fullscreen"
            style={{ display: error ? "none" : "block" }}
          />
          <div className="owid-frame-footer">
            <span className="owid-source">{t.owid.source} <strong>Our World in Data</strong> — ourworldindata.org</span>
            <a href={chart.url} target="_blank" rel="noopener noreferrer" className="owid-ext-link">
              <ExternalLink size={13} /> {t.owid.fullscreen}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OWIDPage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.owid);
  const [activeSection, setActiveSection] = useState("all");
  const [expandedId, setExpandedId] = useState("primary_energy");

  const SECTIONS = [
    { id: "all",         label: t.owid.section_all,       Icon: Globe },
    { id: "energy_mix",  label: t.owid.section_energy,    Icon: Zap },
    { id: "electricity", label: t.owid.section_elec,      Icon: Plug },
    { id: "co2",         label: t.owid.section_co2,       Icon: Cloud },
    { id: "renewable",   label: t.owid.section_renewable, Icon: Leaf },
  ];

  const KEY_FACTS = [
    { Icon: Zap,         label: t.owid.fact_total_label,  value: "~8 GWh/yr",      note: "IEA 2022" },
    { Icon: Building2,   label: t.owid.fact_source_label, value: t.owid.fact_source_val, note: t.owid.fact_source_note },
    { Icon: Cloud,       label: t.owid.fact_co2_label,   value: "~7.5 t/yr",      note: t.owid.fact_co2_note },
    { Icon: Sun,         label: t.owid.fact_solar_label,  value: t.owid.fact_solar_val, note: t.owid.fact_solar_note },
    { Icon: TrendingUp,  label: t.owid.fact_growth_label, value: "+3.8%/yr",       note: "2010–2022" },
    { Icon: Thermometer, label: t.owid.fact_hdd_label,   value: "4,500+ HDD",     note: t.owid.fact_hdd_note },
  ];

  const visible = activeSection === "all" ? CHARTS : CHARTS.filter(c => c.section === activeSection);
  const toggle = (id) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="owid-page">
      <div className="container">
        <div className="owid-header page-header">
          <div className="owid-header-left">
            <h1>
              <Globe size={28} style={{ marginRight: 8, verticalAlign: "middle", color: "#3a8fd4" }} />
              {t.owid.title}
            </h1>
            <p>{t.owid.subtitle}</p>
          </div>
          <div className="owid-header-badge">
            <img src="https://ourworldindata.org/favicon.ico" alt="OWID" width={20} height={20}
              onError={e => { e.target.style.display = "none"; }} />
            <span>Our World in Data</span>
          </div>
        </div>

        {/* ── Data provenance banner ── */}
        <div className="owid-provenance-banner card mb-3">
          <div className="owid-prov-col owid-prov-ext">
            <div className="owid-prov-head">
              <Globe size={15} style={{ color: "#3a8fd4" }} />
              <span>{lang === "mn" ? "Гаднын эх сурвалж (энэ хуудас)" : "External sources (this page)"}</span>
            </div>
            <div className="owid-prov-body">
              <p>
                {lang === "mn"
                  ? "Доорх бүх графикууд нь Our World in Data болон Монголын dulaan.mn, tog.mn зэрэг гаднын эх сурвалжаас авсан. UBenergy нь эдгээр өгөгдлийг өөрийн серверт хадгалдаггүй — шууд iframe-ээр харуулдаг."
                  : "All charts below are from Our World in Data and Mongolian sources (dulaan.mn, tog.mn). UBenergy does not store this data — it is displayed via embedded iframes from the original sources."}
              </p>
              <div className="owid-prov-src-chips">
                <span className="owid-prov-chip"><Globe size={11} /> Our World in Data</span>
                <span className="owid-prov-chip"><Thermometer size={11} /> dulaan.mn</span>
                <span className="owid-prov-chip"><Zap size={11} /> tog.mn</span>
                <span className="owid-prov-chip"><Database size={11} /> IEA 2022</span>
              </div>
            </div>
          </div>
          <div className="owid-prov-divider" />
          <div className="owid-prov-col owid-prov-own">
            <div className="owid-prov-head">
              <Brain size={15} style={{ color: "#9b72cf" }} />
              <span>{lang === "mn" ? "UBenergy өөрийн тооцоолол" : "UBenergy's own calculations"}</span>
            </div>
            <div className="owid-prov-body">
              <p>
                {lang === "mn"
                  ? "Predictor болон Dashboard хэсгүүд нь энд харуулж буй дэлхийн хандлагыг лавлагаа болгон ашиглан Монголын барилгын эрчим хүчний хэрэглээг ML загвараар тооцдог."
                  : "The Predictor and Dashboard use the global benchmarks shown here as reference points, then run ML models to estimate energy consumption for specific Mongolian buildings."}
              </p>
              <div className="owid-prov-links">
                <Link to="/predictor" className="owid-prov-link">
                  <Brain size={12} /> {lang === "mn" ? "Predictor" : "Predictor"} <ArrowRight size={11} />
                </Link>
                <Link to="/dashboard" className="owid-prov-link">
                  <BarChart2 size={12} /> {lang === "mn" ? "Dashboard" : "Dashboard"} <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="owid-sections mb-3">
          {SECTIONS.map(s => {
            const SIcon = s.Icon;
            return (
              <button key={s.id} className={`owid-sec-btn ${activeSection === s.id ? "active" : ""}`}
                onClick={() => setActiveSection(s.id)}>
                {SIcon && <SIcon size={14} />}
                {s.label}
                <span className="sec-count">
                  {s.id === "all" ? CHARTS.length : CHARTS.filter(c => c.section === s.id).length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="owid-charts-list">
          {visible.map(chart => (
            <ChartFrame
              key={chart.id}
              chart={chart}
              expanded={expandedId === chart.id}
              onToggle={() => toggle(chart.id)}
              lang={lang}
              t={t}
            />
          ))}
        </div>

        {/* ── Bridge: OWID global → UBenergy local ── */}
        <div className="owid-bridge-section mt-3">
          <div className="owid-bridge-header">
            <CheckCircle size={18} style={{ color: "#2a9d8f" }} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              {lang === "mn"
                ? "Дэлхийн статистик → UBenergy-д хэрхэн ашигласан бэ?"
                : "How does this global data connect to UBenergy?"}
            </h3>
          </div>
          <div className="owid-bridge-grid">
            {[
              {
                owid_fact: lang === "mn" ? "Монголын цахилгааны 95%+ нүүрснээс" : "Mongolia: 95%+ coal electricity",
                owid_src:  "Our World in Data · IEA",
                arrow_label: lang === "mn" ? "Энэхүү утгад үндэслэн Predictor:" : "Predictor uses this as:",
                our_use:   lang === "mn" ? "Цахилгааны ялгарлын коэффициент 0.73 kg CO₂/kWh ашигладаг" : "Emission factor 0.73 kg CO₂/kWh for electricity grid",
                color: "#e63946",
                icon: Cloud,
                link: "/predictor",
                link_label: lang === "mn" ? "CO₂ тооцоол" : "Calculate CO₂",
              },
              {
                owid_fact: lang === "mn" ? "Хуучин барилга: 280–350 kWh/м²/жил" : "Soviet buildings: 280–350 kWh/m²/yr",
                owid_src:  "dulaan.mn · tog.mn",
                arrow_label: lang === "mn" ? "Predictor үүнийг лавлагаа болгон:" : "Predictor benchmarks against this:",
                our_use:   lang === "mn" ? "Зэрэглэлийн систем A–G нь 50 kWh/m² алхмаар тооцдог (G ≥ 300)" : "Grade A–G system steps at 50 kWh/m² (G ≥ 300)",
                color: "#3a8fd4",
                icon: Building2,
                link: "/predictor",
                link_label: lang === "mn" ? "Барилга тооцоол" : "Try predictor",
              },
              {
                owid_fact: lang === "mn" ? "Монгол: нэг хүнд 7.5 t CO₂/жил" : "Mongolia: 7.5 t CO₂/person/yr",
                owid_src:  "Our World in Data",
                arrow_label: lang === "mn" ? "Dashboard харьцуулалт:" : "Dashboard comparison:",
                our_use:   lang === "mn" ? "Барилгын нийт CO₂-ийг хотын дундажтай харьцуулж харуулдаг" : "Building CO₂ is shown alongside city & national average",
                color: "#f4a261",
                icon: BarChart2,
                link: "/dashboard",
                link_label: lang === "mn" ? "Dashboard харах" : "See Dashboard",
              },
              {
                owid_fact: lang === "mn" ? "УБ: 4,500+ HDD/жил (цаг уурын ачаалал)" : "UB: 4,500+ HDD/yr (climate load)",
                owid_src:  "Open-Meteo · БНТУ 23-02-09",
                arrow_label: lang === "mn" ? "ML загварт оролт болгон:" : "ML model input:",
                our_use:   lang === "mn" ? "Predictor нь HDD-ийг автоматаар оруулж дулааны хэрэглээг тооцдог" : "Predictor auto-inputs HDD to estimate heating demand",
                color: "#2a9d8f",
                icon: Thermometer,
                link: "/weather",
                link_label: lang === "mn" ? "Цаг агаар харах" : "See Weather",
              },
            ].map((b, i) => {
              const BIcon = b.icon;
              return (
                <div key={i} className="owid-bridge-card card">
                  <div className="obc-owid-row">
                    <span className="obc-src-badge"><Globe size={10} /> {b.owid_src}</span>
                    <span className="obc-fact" style={{ borderLeftColor: b.color }}>{b.owid_fact}</span>
                  </div>
                  <div className="obc-arrow">
                    <ArrowRight size={14} style={{ color: b.color }} />
                    <span className="obc-arrow-label">{b.arrow_label}</span>
                  </div>
                  <div className="obc-our-row">
                    <span className="obc-ub-badge"><Brain size={10} /> UBenergy</span>
                    <span className="obc-use" style={{ borderLeftColor: `${b.color}88` }}>{b.our_use}</span>
                  </div>
                  <Link to={b.link} className="obc-cta">
                    <BIcon size={12} /> {b.link_label} <ArrowRight size={11} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card owid-facts mt-3">
          <h3 className="section-title">{t.owid.facts_title}</h3>
          <div className="facts-grid">
            {KEY_FACTS.map(f => {
              const FIcon = f.Icon;
              return (
                <div key={f.label} className="fact-item">
                  <span className="fact-icon">{FIcon && <FIcon size={20} />}</span>
                  <div className="fact-text">
                    <div className="fact-label">{f.label}</div>
                    <div className="fact-value">{f.value}</div>
                    <div className="fact-note">{f.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="owid-citation card mt-3">
          <h4>{t.owid.citation_title}</h4>
          <div className="citation-box">
            <code>
              Ritchie, H., Roser, M., Rosado, P. (2022). "Energy". Published online at OurWorldInData.org.
              Retrieved from: https://ourworldindata.org/energy [Online Resource]
            </code>
          </div>
          <p className="citation-note">{t.owid.citation_note}</p>
        </div>

        {/* ── Local MN Building Energy Data ── */}
        <div className="owid-local-section mt-3">
          <div className="owid-local-header">
            <div className="owid-local-title-row">
              <Building2 size={22} style={{ color: "#e63946" }} />
              <h2>{lang === "mn" ? "УБ — Барилгын дулааны мэдээлэл" : "UB — Building Heat Energy Data"}</h2>
            </div>
            <p className="owid-local-subtitle">
              {lang === "mn"
                ? "Улаанбаатар хотын дулаан хангамж болон барилгын эрчим хүчний хэрэглээний албан ёсны статистик мэдээлэл"
                : "Official statistics on Ulaanbaatar's district heating and building energy consumption"}
            </p>
          </div>

          {/* Stat cards */}
          <div className="owid-local-stats">
            {[
              {
                icon: <Building2 size={20} />,
                color: "#1a6eb5",
                value: "3,500+",
                label: lang === "mn" ? "Дулааны сүлжээнд холбогдсон барилга" : "Buildings connected to district heat",
                source: "dulaan.mn",
              },
              {
                icon: <Thermometer size={20} />,
                color: "#e63946",
                value: "~70–100",
                unit: "Гкал/жил",
                label: lang === "mn" ? "Нэг орон сууцны жилийн дулааны хэрэглээ" : "Avg. apartment heat consumption per year",
                source: "dulaan.mn",
              },
              {
                icon: <Zap size={20} />,
                color: "#f4a261",
                value: "250–350",
                unit: "кВт·цаг/м²",
                label: lang === "mn" ? "Хуучин барилгын дулааны эрчим хүчний хэрэглэх хэмжээ" : "Heat energy intensity — Soviet-era buildings",
                source: "tog.mn",
              },
              {
                icon: <TrendingUp size={20} />,
                color: "#2a9d8f",
                value: "~45%",
                label: lang === "mn" ? "Нийт эрчим хүчний хэрэглээнд барилгын эзлэх хувь" : "Share of total energy consumed by buildings",
                source: "tog.mn",
              },
              {
                icon: <BarChart2 size={20} />,
                color: "#a8c5e0",
                value: "7 сар",
                label: lang === "mn" ? "Халаалтын сезоны үргэлжлэх хугацаа (10-р — 4-р сар)" : "Heating season duration (Oct – Apr)",
                source: "dulaan.mn",
              },
              {
                icon: <Cloud size={20} />,
                color: "#6c757d",
                value: "95%+",
                label: lang === "mn" ? "ДЦС-ийн дулаан нийлүүлэлтийн эзлэх хувь" : "District heat supplied by CHP plants",
                source: "dulaan.mn",
              },
            ].map((s, i) => (
              <div key={i} className="owid-local-stat-card card">
                <span className="owid-local-stat-icon" style={{ background: `${s.color}1a`, color: s.color }}>
                  {s.icon}
                </span>
                <div className="owid-local-stat-body">
                  <div className="owid-local-stat-value">
                    {s.value}
                    {s.unit && <span className="owid-local-stat-unit"> {s.unit}</span>}
                  </div>
                  <div className="owid-local-stat-label">{s.label}</div>
                  <div className="owid-local-stat-src">{s.source}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Data table */}
          <div className="card mt-3 owid-local-table-wrap">
            <h4 style={{ marginBottom: "1rem" }}>
              {lang === "mn" ? "Барилгын ангиллаар дулааны хэрэглээ" : "Heat Consumption by Building Type"}
            </h4>
            <div className="owid-local-table-scroll">
              <table className="owid-local-table">
                <thead>
                  <tr>
                    <th>{lang === "mn" ? "Барилгын төрөл" : "Building Type"}</th>
                    <th>{lang === "mn" ? "Баригдсан он" : "Built"}</th>
                    <th>{lang === "mn" ? "Дулааны эрчим хүч (кВт·цаг/м²/жил)" : "Heat Intensity (kWh/m²/yr)"}</th>
                    <th>{lang === "mn" ? "Тайлбар" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      type: lang === "mn" ? "Зөвлөлтийн стандарт (хуучин)" : "Soviet-era standard panel",
                      built: "1960–1990",
                      heat: "280–350",
                      note: lang === "mn" ? "Дулаан алдагдал өндөр" : "High heat loss, poor insulation",
                    },
                    {
                      type: lang === "mn" ? "Орчин үеийн орон сууц" : "Modern residential",
                      built: "2000–2015",
                      heat: "160–220",
                      note: lang === "mn" ? "Сайжруулсан тусгаарлалт" : "Improved insulation standards",
                    },
                    {
                      type: lang === "mn" ? "Шинэ барилга (БНМХ)" : "New build (current standard)",
                      built: "2015–одоо",
                      heat: "100–150",
                      note: lang === "mn" ? "БНбД 23-02 стандарт" : "Meets BNbD 23-02 standard",
                    },
                    {
                      type: lang === "mn" ? "Оффис / Арилжааны барилга" : "Office / Commercial",
                      built: "2000–одоо",
                      heat: "120–200",
                      note: lang === "mn" ? "Хэрэглэгдэх байдлаас хамаарна" : "Varies by occupancy & systems",
                    },
                    {
                      type: lang === "mn" ? "Нийтийн ашиглалтын барилга" : "Public / institutional",
                      built: "1970–одоо",
                      heat: "180–300",
                      note: lang === "mn" ? "Эмнэлэг, сургууль гэх мэт" : "Hospitals, schools, etc.",
                    },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td><strong>{row.type}</strong></td>
                      <td>{row.built}</td>
                      <td><span className="owid-local-heat-badge">{row.heat}</span></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Source citations */}
          <div className="owid-local-sources card mt-3">
            <h4 style={{ marginBottom: "0.75rem" }}>
              {lang === "mn" ? "Эх сурвалж" : "Sources"}
            </h4>
            <div className="owid-local-src-list">
              <a
                href="https://www.dulaan.mn"
                target="_blank"
                rel="noopener noreferrer"
                className="owid-local-src-link"
              >
                <Thermometer size={15} />
                <div>
                  <strong>Дулаан ХК</strong>
                  <span>
                    {lang === "mn"
                      ? " — Улаанбаатар хотын дулаан хангамжийн нэгдсэн сүлжээний компани. Дулааны хэрэглээ, холболтын статистик."
                      : " — Ulaanbaatar District Heating Network Company. Heat consumption and connection statistics."}
                  </span>
                  <span className="owid-local-src-url"> dulaan.mn</span>
                </div>
                <ExternalLink size={13} style={{ flexShrink: 0, color: "var(--text-secondary)" }} />
              </a>
              <a
                href="https://www.tog.mn/news/5"
                target="_blank"
                rel="noopener noreferrer"
                className="owid-local-src-link"
              >
                <Zap size={15} />
                <div>
                  <strong>ТОГ.МН</strong>
                  <span>
                    {lang === "mn"
                      ? " — Монгол Улсын эрчим хүчний мэдээллийн портал. Барилгын эрчим хүчний хэрэглээний тайлан."
                      : " — Mongolia's energy sector news portal. Building energy consumption reports."}
                  </span>
                  <span className="owid-local-src-url"> tog.mn/news/5</span>
                </div>
                <ExternalLink size={13} style={{ flexShrink: 0, color: "var(--text-secondary)" }} />
              </a>
              <div className="owid-local-src-note">
                <Info size={13} />
                <span>
                  {lang === "mn"
                    ? "Дээрх тоон үзүүлэлтүүд нь БОАЖЯ, Эрчим хүчний яам болон Дулаан ХК-ийн нийтэлсэн тайлан дээр үндэслэсэн болно."
                    : "Figures are based on reports published by the Ministry of Environment, Ministry of Energy, and Dulaan LLC."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
