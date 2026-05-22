import { Link, useLocation } from "react-router-dom";
import { Home, Brain, LayoutDashboard, Map, User, LogIn } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LanguageContext";
import "./BottomNav.css";

export default function BottomNav() {
  const { user } = useAuth();
  const { t } = useLang();
  const location = useLocation();

  const items = [
    { path: "/",          icon: Home,            label: t.nav.home      },
    { path: "/predictor", icon: Brain,           label: t.nav.predictor },
    { path: "/dashboard", icon: LayoutDashboard, label: t.nav.dashboard },
    { path: "/map",       icon: Map,             label: t.nav.map       },
    user
      ? { path: "/profile", icon: User,  label: t.nav.profile }
      : { path: "/login",   icon: LogIn, label: t.nav.login   },
  ];

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(({ path, icon: Icon, label }) => {
        const isActive = location.pathname === path ||
          (path !== "/" && location.pathname.startsWith(path));
        return (
          <Link
            key={path}
            to={path}
            className={`bnav-item ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
