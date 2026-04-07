import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLang } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  Home, LogIn, Brain, LayoutDashboard, Upload, Database,
  Settings, Accessibility, Lightbulb, Map, Menu, X, Globe, LogOut, Zap,
  CloudSun, BarChart2
} from "lucide-react";
import { APP_NAME } from "../../config/constants";
import "./Navbar.css";

const navItems = (t, user) => [
  { path: "/", label: t.nav.home, icon: Home, public: true },
  ...(user ? [
    { path: "/weather", label: t.nav.weather, icon: CloudSun, badge: t.nav.badge_new },
    { path: "/predictor", label: t.nav.predictor, icon: Brain },
    { path: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { path: "/data-input", label: t.nav.dataInput, icon: Upload },
    { path: "/database", label: t.nav.database, icon: Database },
    { path: "/map", label: t.nav.map, icon: Map },
    { path: "/owid", label: t.nav.owid, icon: BarChart2, badge: t.nav.badge_new },
    { path: "/recommendations", label: t.nav.recommendations, icon: Lightbulb },
    { path: "/accessibility", label: t.nav.accessibility, icon: Accessibility },
    ...(user.role === "admin" ? [{ path: "/admin", label: t.nav.admin, icon: Settings }] : []),
  ] : []),
];

export default function Navbar() {
  const { t, lang, toggleLang } = useLang();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const items = navItems(t, user);

  return (
    <nav className="navbar" ref={navRef}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <Zap size={22} className="brand-icon" />
          <span className="brand-text">
            <span className="brand-main">UB</span>
            <span className="brand-sub">Energy</span>
          </span>
        </Link>

        <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
          {items.map(({ path, label, icon: Icon, badge }) => (
            <Link
              key={path}
              to={path}
              className={`nav-link ${location.pathname === path ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={16} />
              <span>{label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </Link>
          ))}
        </div>

        <div className="navbar-actions">
          <button className="lang-btn" onClick={toggleLang} title="Switch language">
            <Globe size={16} />
            <span>{lang === "mn" ? "EN" : "МН"}</span>
          </button>

          {user ? (
            <div className="user-menu">
              <div className="user-info">
                <div className="user-avatar">{user.name.charAt(0)}</div>
                <span className="user-name">{user.name}</span>
              </div>
              <button className="btn btn-secondary" onClick={logout} style={{ padding: "0.4rem 0.8rem" }}>
                <LogOut size={15} />
                <span className="hide-mobile">{t.nav.logout}</span>
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary">
              <LogIn size={16} />
              <span>{t.nav.login}</span>
            </Link>
          )}

          {user && (
            <button
              className="menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? t.common.close : "Menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
