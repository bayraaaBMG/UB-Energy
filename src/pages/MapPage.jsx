import { useState } from "react";
import { useLang } from "../contexts/LanguageContext";
import { Map, Building2, Zap, Filter } from "lucide-react";
import { buildingsData } from "../data/mockData";
import UBMap from "../components/UBMap";
import "./MapPage.css";

export default function MapPage() {
  const { t } = useLang();
  const [selected, setSelected] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const typeLabels = t.predictor.building_types;
  const filtered = typeFilter === "all" ? buildingsData : buildingsData.filter(b => b.type === typeFilter);

  return (
    <div className="map-page">
      <div className="container">
        <div className="page-header">
          <h1><Map size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.map.title}</h1>
          <p>{t.map.subtitle}</p>
        </div>

        <div className="map-layout">
          <div className="map-main card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="map-toolbar">
              <div className="flex gap-1 align-center">
                <Filter size={14} style={{ color: "var(--text3)" }} />
                <select className="form-select" style={{ width: "auto", padding: "0.4rem 0.7rem", fontSize: "0.85rem" }}
                  value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="all">{t.map.all_buildings}</option>
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <span className="map-count">{filtered.length} {t.map.buildings_unit}</span>
            </div>

            <div className="map-container">
              <UBMap
                buildings={filtered}
                selected={selected}
                onSelect={setSelected}
                northLabel={t.map.north}
                usageUnit={t.common.units_kwh}
                ariaLabel={t.map.title}
              />
            </div>

            <div className="map-legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "#2a9d8f" }} />
                {t.map.legend_low} (&lt;40k)
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "#f4a261" }} />
                {t.map.legend_medium} (40k-80k)
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "#e63946" }} />
                {t.map.legend_high} (&gt;80k)
              </span>
              <span className="legend-note">{t.map.unit_kwh_yr}</span>
            </div>
          </div>

          <div className="map-sidebar">
            {selected ? (
              <div className="building-detail card animate-fade">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>
                  <Building2 size={16} style={{ marginLeft: 8 }} />
                  {selected.name}
                </h3>
                <div className="detail-rows">
                  <div className="detail-row">
                    <span>{t.map.detail_type}</span>
                    <span>{typeLabels[selected.type] || selected.type}</span>
                  </div>
                  <div className="detail-row">
                    <span>{t.map.detail_area}</span>
                    <span>{selected.area.toLocaleString()} {t.common.units_sqm}</span>
                  </div>
                  <div className="detail-row">
                    <span>{t.map.detail_floors}</span>
                    <span>{selected.floors}</span>
                  </div>
                  <div className="detail-row">
                    <span>{t.map.detail_year}</span>
                    <span>{selected.year}</span>
                  </div>
                  <div className="detail-row">
                    <span>{t.map.detail_district}</span>
                    <span>{selected.district}</span>
                  </div>
                  <div className="detail-row highlight">
                    <span><Zap size={13} style={{ marginRight: 4 }} />{t.map.detail_annual}</span>
                    <span className="usage-highlight">{selected.usage.toLocaleString()} {t.common.units_kwh}</span>
                  </div>
                  <div className="detail-row">
                    <span>{t.map.detail_intensity}</span>
                    <span>{Math.round(selected.usage / selected.area)} {t.map.unit_kwh_m2}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card no-selection">
                <Map size={36} opacity={0.3} />
                <p>{t.map.select_hint}</p>
              </div>
            )}

            <div className="map-stats card">
              <h3 className="section-title" style={{ fontSize: "0.95rem" }}>{t.map.stats_title}</h3>
              <div className="detail-rows">
                <div className="detail-row">
                  <span>{t.map.stat_count}</span>
                  <span>{filtered.length}</span>
                </div>
                <div className="detail-row">
                  <span>{t.map.stat_total}</span>
                  <span>{filtered.reduce((s, b) => s + b.usage, 0).toLocaleString()} {t.common.units_kwh}</span>
                </div>
                <div className="detail-row">
                  <span>{t.map.stat_intensity}</span>
                  <span>{Math.round(filtered.reduce((s, b) => s + b.usage / b.area, 0) / filtered.length)} {t.map.unit_kwh_m2}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
