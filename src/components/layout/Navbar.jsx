import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLang } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  Home, LogIn, Brain, LayoutDashboard, Upload, Database,
  Settings, Accessibility, Lightbulb, Map, Menu, X, Globe, LogOut, Zap,
  CloudSun, BarChart2, Package
} from "lucide-react";
import { APP_NAME } from "../../config/constants";
import "./Navbar.css";

const navItems = (t, user) => [
  // ── Public ──
  { path: "/", label: t.nav.home, icon: Home },
  { path: "/weather", label: t.nav.weather, icon: CloudSun, badge: t.nav.badge_new },
  { path: "/predictor", label: t.nav.predictor, icon: Brain },
  { path: "/map", label: t.nav.map, icon: Map },
  { path: "/owid", label: t.nav.owid, icon: BarChart2, badge: t.nav.badge_new },
  { path: "/recommendations", label: t.nav.recommendations, icon: Lightbulb },
  { path: "/accessibility", label: t.nav.accessibility, icon: Accessibility },
  // ── Private (login required) ──
  ...(user ? [
    { path: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { path: "/data-input", label: t.nav.dataInput, icon: Upload },
    { path: "/database", label: t.nav.database, icon: Database },
    { path: "/my-space", label: t.nav.mySpace, icon: Package },
    ...(user.role === "admin" ? [{ path: "/admin", label: t.nav.admin, icon: Settings }] : []),
  ] : []),
];

export default function Navbar() {
  const { t, toggleLang } = useLang();
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
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
            <span>{t.common.lang_switch}</span>
          </button>

          {user ? (
            <div className="user-menu">
              <Link to="/profile" className="user-info" title={t.nav.profile}>
                <div className="user-avatar">
                  {user.avatar
                    ? <img src={user.avatar} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    : user.name.charAt(0)
                  }
                </div>
                <span className="user-name">{user.name}</span>
              </Link>
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
