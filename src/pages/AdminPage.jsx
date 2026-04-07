import { useState } from "react";
import { useLang } from "../contexts/LanguageContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useConfirm } from "../hooks/useConfirm";
import { useAuth } from "../contexts/AuthContext";
import {
  Settings, Users, BarChart2, Database, Shield,
  CheckCircle, TrendingUp, Trash2, Lock
} from "lucide-react";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { adminStats } from "../data/mockData";
import { storageGetJSON, storageSetJSON } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";
import "./AdminPage.css";

const ADMIN_USER = {
  id: "admin_1", name: "Админ", email: "admin@test.mn",
  type: "official", org: "UB Energy", role: "admin",
  createdAt: new Date("2024-01-01").toISOString(),
};

function loadAllUsers() {
  const stored = storageGetJSON(STORAGE_KEYS.users, []);
  return [ADMIN_USER, ...stored.filter(u => u.email !== ADMIN_USER.email)];
}

const COLORS = ["#1a6eb5", "#2a9d8f", "#e9c46a", "#e63946", "#f4a261"];

export default function AdminPage() {
  const { t, lang } = useLang();
  usePageTitle(t.nav.admin);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const { confirmId: deleteUserId, ask: askDelete, confirm: confirmDelete, cancel: cancelDelete } = useConfirm();
  const [allUsers, setAllUsers] = useState(() => loadAllUsers());

  const buildingTypeData = [
    { name: t.predictor.building_types.apartment, value: 45, fill: COLORS[0] },
    { name: t.predictor.building_types.office,    value: 22, fill: COLORS[1] },
    { name: t.predictor.building_types.school,    value: 15, fill: COLORS[2] },
    { name: t.predictor.building_types.hospital,  value: 8,  fill: COLORS[3] },
    { name: t.admin.other,                        value: 10, fill: COLORS[4] },
  ];

  if (!user || user.role !== "admin") {
    return (
      <div className="admin-restricted container">
        <div className="card restricted-card">
          <Lock size={48} opacity={0.4} />
          <h2>{t.admin.restricted_title}</h2>
          <p>{t.admin.restricted_msg}</p>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            {t.admin.restricted_detail.replace("{email}", user?.email)}
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview",  label: t.admin.overview,         icon: BarChart2  },
    { id: "users",     label: t.admin.user_management,  icon: Users      },
    { id: "data",      label: t.admin.data_control,     icon: Database   },
    { id: "settings",  label: t.admin.system_settings,  icon: Settings   },
  ];

  const sysInfoRows = [
    { label: t.admin.last_backup,   value: adminStats.lastBackup    },
    { label: t.admin.uptime,        value: adminStats.systemUptime  },
    { label: t.admin.total_buildings, value: `${adminStats.totalBuildings} ${t.admin.buildings_unit}` },
    { label: t.admin.ml_version,    value: "v2.3.1"                 },
    { label: t.admin.api_today,     value: `1,842 ${t.admin.req_unit}` },
    { label: t.admin.avg_response,  value: "124ms"                  },
  ];

  const dataActions = [
    { label: t.admin.backup,     color: "btn-primary"   },
    { label: t.admin.csv_import, color: "btn-secondary" },
    { label: t.admin.json_import,color: "btn-secondary" },
    { label: t.admin.clear_cache,color: "btn-secondary" },
    { label: t.admin.retrain_ml, color: "btn-success"   },
  ];

  const logEntries = [
    { time: "2026-04-01 14:23", mn: "ML загвар амжилттай дахин сургагдлаа",              en: "ML model retrained successfully",               type: "success" },
    { time: "2026-04-01 13:11", mn: "Шинэ хэрэглэгч бүртгэгдлээ: bold@example.mn",      en: "New user registered: bold@example.mn",           type: "info"    },
    { time: "2026-04-01 11:45", mn: "Нийт 842 таамаглал хийгдлээ",                       en: "842 predictions completed",                      type: "info"    },
    { time: "2026-04-01 09:00", mn: "Автомат нөөцлөлт дууслаа",                          en: "Automatic backup completed",                     type: "success" },
    { time: "2026-03-31 22:34", mn: "API хүсэлтийн хязгаар давагдлаа (IP: 192.168.1.5)",en: "API rate limit exceeded (IP: 192.168.1.5)",      type: "warning" },
  ];

  const settingsFields = [
    { label: t.admin.api_url_label,      value: "https://api.energymn.mn/v2", type: "text"   },
    { label: t.admin.ml_ver_label,       value: "v2.3.1",                    type: "text"   },
    { label: t.admin.backup_freq_label,  value: "24",                        type: "number" },
    { label: t.admin.api_limit_label,    value: "100",                       type: "number" },
  ];

  return (
    <div className="admin-page">
      <div className="container">
        <div className="page-header flex-between">
          <div>
            <h1><Shield size={28} style={{ marginRight: 8, verticalAlign: "middle" }} />{t.admin.title}</h1>
            <p>{t.admin.subtitle}</p>
          </div>
          <span className="badge badge-success">Admin</span>
        </div>

        <div className="admin-tabs mb-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`admin-tab ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="animate-fade">
            <div className="grid grid-4 mb-3">
              {[
                { label: t.admin.total_users,  value: `${allUsers.length} ${t.admin.users_unit}`,                          icon: Users,        color: "#3a8fd4" },
                { label: t.admin.active_users, value: `${adminStats.activeUsers} ${t.admin.users_unit}`,                   icon: CheckCircle,  color: "#2a9d8f" },
                { label: t.admin.predictions,  value: `${adminStats.totalPredictions.toLocaleString()} ${t.admin.pred_unit}`, icon: TrendingUp, color: "#e9c46a" },
                { label: t.admin.uptime,       value: adminStats.systemUptime,                  icon: Shield,       color: "#f4a261" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div className="card admin-stat-card" key={label}>
                  <div className="asc-icon" style={{ background: `${color}22`, color }}>
                    <Icon size={20} />
                  </div>
                  <div className="asc-value">{value}</div>
                  <div className="asc-label">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-2">
              <div className="card">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.admin.type_dist}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={buildingTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false} fontSize={11}
                    />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }} formatter={(v) => [`${v} ${t.admin.buildings_unit}`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.admin.sys_info}</h3>
                <div className="sys-info-list">
                  {sysInfoRows.map(({ label, value }) => (
                    <div key={label} className="sys-info-row">
                      <span className="sys-label">{label}</span>
                      <span className="sys-value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === "users" && (
          <div className="animate-fade">
            <div className="data-table-wrap card" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">{t.admin.user_name}</th>
                    <th scope="col">{t.admin.user_email}</th>
                    <th scope="col">{t.admin.user_type}</th>
                    <th scope="col">{t.admin.user_org}</th>
                    <th scope="col">{t.admin.user_status}</th>
                    <th scope="col">{t.admin.user_registered}</th>
                    <th scope="col">{t.database.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u, i) => (
                    <tr key={u.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>
                        {u.name}
                        {u.role === "admin" && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: "0.65rem" }}>admin</span>}
                      </td>
                      <td className="text-muted">{u.email}</td>
                      <td>
                        <span className={`badge ${u.type === "official" ? "badge-primary" : "badge-warning"}`}>
                          {u.type === "official" ? t.admin.type_official : t.admin.type_personal}
                        </span>
                      </td>
                      <td>{u.org || "—"}</td>
                      <td>
                        <span className="badge badge-success">{t.admin.status_active}</span>
                      </td>
                      <td className="text-muted">{u.createdAt ? u.createdAt.slice(0, 10) : "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          {u.role !== "admin" && deleteUserId === u.id ? (
                            <>
                              <button className="action-btn-sm danger" aria-label={t.admin.confirm_delete}
                                onClick={() => confirmDelete((id) => {
                                  const stored = storageGetJSON(STORAGE_KEYS.users, []);
                                  storageSetJSON(STORAGE_KEYS.users, stored.filter(s => s.id !== id));
                                  setAllUsers(loadAllUsers());
                                })}>
                                {t.admin.confirm_yes}
                              </button>
                              <button className="action-btn-sm" aria-label={t.common.close} onClick={cancelDelete}>
                                {t.admin.confirm_no}
                              </button>
                            </>
                          ) : u.role !== "admin" && (
                            <button className="action-btn-sm danger" title={t.database.delete} aria-label={t.database.delete}
                              onClick={() => askDelete(u.id)}>
                              <Trash2 size={13} />
                            </button>
                          ) }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data control */}
        {activeTab === "data" && (
          <div className="animate-fade grid grid-2">
            <div className="card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.admin.data_management}</h3>
              <div className="data-actions">
                {dataActions.map(({ label, color }) => (
                  <button key={label} className={`btn ${color}`}>{label}</button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.admin.logs_title}</h3>
              <div className="log-list">
                {logEntries.map((log, i) => (
                  <div key={i} className={`log-entry ${log.type}`}>
                    <span className="log-time">{log.time}</span>
                    <span className="log-msg">{log[lang]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        {activeTab === "settings" && (
          <div className="animate-fade">
            <div className="card settings-card">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.admin.settings_title}</h3>
              <div className="settings-list">
                {settingsFields.map(({ label, value, type }) => (
                  <div key={label} className="setting-row">
                    <label className="form-label" htmlFor={`admin-setting-${label}`}>{label}</label>
                    <input id={`admin-setting-${label}`} defaultValue={value} type={type} className="form-input" />
                  </div>
                ))}
                <button className="btn btn-primary">{t.admin.save}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
