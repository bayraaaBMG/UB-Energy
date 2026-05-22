import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, Brain, Map, CloudSun, BarChart2, Lightbulb,
  LayoutDashboard, Upload, Database, Package, Settings,
  HelpCircle, MessageSquare, LogOut, X, Zap,
} from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { useSidebar } from "../../contexts/SidebarContext";
import FeedbackModal from "./FeedbackModal";
import "./Sidebar.css";

const mainNavItems = (t, user) => [
  { path: "/",               label: t.nav.home,            icon: Home },
  { path: "/predictor",      label: t.nav.predictor,       icon: Brain },
  { path: "/map",            label: t.nav.map,             icon: Map },
  { path: "/weather",        label: t.nav.weather,         icon: CloudSun },
  { path: "/owid",           label: t.nav.owid,            icon: BarChart2 },
  { path: "/recommendations",label: t.nav.recommendations, icon: Lightbulb },
  ...(user ? [
    { path: "/dashboard",  label: t.nav.dashboard, icon: LayoutDashboard },
    { path: "/data-input", label: t.nav.dataInput, icon: Upload },
    { path: "/database",   label: t.nav.database,  icon: Database },
    { path: "/my-space",   label: t.nav.mySpace,   icon: Package },
    ...(user.role === "admin" ? [{ path: "/admin", label: t.nav.admin, icon: Settings }] : []),
  ] : []),
];

export default function Sidebar() {
  const { t } = useLang();
  const { user, logout } = useAuth();
  const { open, close } = useSidebar();
  const location = useLocation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const items = mainNavItems(t, user);

  function openFeedback() {
    close();          // sidebar хаах
    setFeedbackOpen(true);
  }

  return (
    <>
      <div
        className={`sidebar-overlay ${open ? "visible" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
        {/* Header — logo + close */}
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={close}>
            <Zap size={20} className="sidebar-brand-icon" aria-hidden="true" />
            <span className="sidebar-brand-text">
              <span className="sidebar-brand-main">UB</span>
              <span className="sidebar-brand-sub">Energy</span>
            </span>
          </Link>
          <button className="sidebar-close-btn" onClick={close} aria-label="Хаах">
            <X size={18} />
          </button>
        </div>

        {/* Main nav */}
        <nav className="sidebar-nav">
          {items.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={`sidebar-link ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={close}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <Link to="/accessibility" className="sidebar-link" onClick={close}>
            <HelpCircle size={17} aria-hidden="true" />
            <span>{t.nav.help}</span>
          </Link>
          <Link to="/profile" className="sidebar-link" onClick={close}>
            <Settings size={17} aria-hidden="true" />
            <span>{t.nav.settingsLabel}</span>
          </Link>
          <button className="sidebar-link sidebar-link-btn" onClick={openFeedback}>
            <MessageSquare size={17} aria-hidden="true" />
            <span>{t.nav.feedback}</span>
          </button>
          {user && (
            <button
              className="sidebar-link sidebar-link-btn sidebar-logout"
              onClick={() => { logout(); close(); }}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>{t.nav.logout}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Feedback modal — rendered outside sidebar for correct z-index stacking */}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        user={user}
      />
    </>
  );
}
