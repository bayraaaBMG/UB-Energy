import { useState } from "react";
import { useLang } from "../contexts/LanguageContext";
import { Database, Download, Search, Eye, Trash2, Filter } from "lucide-react";
import { buildingsData } from "../data/mockData";
import "./DatabasePage.css";

const TYPE_COLORS = {
  apartment: "#3a8fd4", office: "#2a9d8f", school: "#e9c46a",
  hospital: "#e63946", warehouse: "#a8c5e0", commercial: "#f4a261"
};

function downloadCSV(data, typeLabels, headers) {
  const rows = data.map(d => [d.id, d.name, typeLabels[d.type] || d.type, d.area, d.usage, d.year, d.district, d.floors]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "buildings_data.csv"; a.click();
}

function downloadJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "buildings_data.json"; a.click();
}

export default function DatabasePage() {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const typeLabels = t.predictor.building_types;
  const csvHeaders = ["ID", t.database.building, t.database.type, t.database.area, t.common.usage, t.database.year, t.database.district, t.database.floors];

  const filtered = buildingsData.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.district.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || b.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="database-page">
      <div className="container">
        <div className="page-header">
          <h1><Database size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.database.title}</h1>
          <p>{t.database.subtitle}</p>
        </div>

        {/* Controls */}
        <div className="db-controls card mb-3">
          <div className="db-controls-left">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                className="search-input"
                placeholder={t.database.search}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="type-filter">
              <Filter size={14} />
              <select className="form-select" style={{ width: "auto" }}
                value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">{t.database.all_types}</option>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="db-download-btns">
            <button className="btn btn-secondary" onClick={() => downloadCSV(filtered, typeLabels, csvHeaders)}>
              <Download size={16} />
              {t.database.download_csv}
            </button>
            <button className="btn btn-secondary" onClick={() => downloadJSON(filtered)}>
              <Download size={16} />
              {t.database.download_json}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="db-stats mb-3">
          <span className="db-stat-badge">{t.database.total_buildings}: <strong>{filtered.length}</strong> {t.database.buildings_unit}</span>
          <span className="db-stat-badge">
            {t.database.total_area}: <strong>{filtered.reduce((s, b) => s + b.area, 0).toLocaleString()}</strong> {t.common.units_sqm}
          </span>
          <span className="db-stat-badge">
            {t.database.total_usage}: <strong>{filtered.reduce((s, b) => s + b.usage, 0).toLocaleString()}</strong> {t.common.units_kwh}
          </span>
        </div>

        {/* Table */}
        <div className="data-table-wrap card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t.database.building}</th>
                <th>{t.database.type}</th>
                <th>{t.database.area}</th>
                <th>{t.database.usage}</th>
                <th>{t.database.year}</th>
                <th>{t.database.district}</th>
                <th>{t.database.floors}</th>
                <th>{t.database.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td className="text-muted">{b.id}</td>
                  <td>
                    <div className="building-name-cell">
                      <span>{b.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="type-badge" style={{ background: `${TYPE_COLORS[b.type]}22`, color: TYPE_COLORS[b.type], border: `1px solid ${TYPE_COLORS[b.type]}55` }}>
                      {typeLabels[b.type] || b.type}
                    </span>
                  </td>
                  <td>{b.area.toLocaleString()} {t.common.units_sqm}</td>
                  <td>
                    <span className={`usage-val ${b.usage > 80000 ? "high" : b.usage > 40000 ? "mid" : "low"}`}>
                      {b.usage.toLocaleString()}
                    </span>
                  </td>
                  <td>{b.year}</td>
                  <td>{b.district}</td>
                  <td>{b.floors}</td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn view" title={t.database.view}><Eye size={14} /></button>
                      <button className="action-btn delete" title={t.database.delete}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="empty-state">
              <Database size={40} opacity={0.3} />
              <p>{t.database.no_data}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
