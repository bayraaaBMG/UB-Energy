import { useState } from "react";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";

import {
  Globe, ExternalLink, RefreshCw, Info, ChevronDown, ChevronUp,
  Zap, User, Plug, Building2, Cloud, Leaf, Sun, TrendingUp, Thermometer, BarChart2,
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
        <span className="owid-expand-btn" aria-hidden="true">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
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

        <div className="owid-info-banner card mb-3">
          <Info size={18} style={{ color: "var(--primary-light)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>{t.owid.what_is}</strong>
            <p>{t.owid.what_is_desc}</p>
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
      </div>
    </div>
  );
}
