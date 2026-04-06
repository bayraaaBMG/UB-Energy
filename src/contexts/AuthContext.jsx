import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

// ─── localStorage keys ────────────────────────────────────────────────────────
const USERS_KEY   = "ub_users";
const SESSION_KEY = "ub_session";

// ─── Pre-seeded admin (always available) ─────────────────────────────────────
const ADMIN = {
  id: "admin_1",
  name: "Админ",
  email: "admin@test.mn",
  password: "admin123",
  type: "official",
  org: "UB Energy",
  role: "admin",
  createdAt: new Date("2024-01-01").toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Merge admin into stored users (always first, always present)
function getAllUsers() {
  const stored = loadUsers().filter(u => u.email !== ADMIN.email);
  return [ADMIN, ...stored];
}

function loadSession() {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!raw) return null;
    // Expired?
    if (raw.expiresAt && raw.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    // User still exists?
    const exists = getAllUsers().find(u => u.id === raw.id);
    if (!exists) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return raw;
  }
  catch { return null; }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadSession());

  // Persist session changes (with expiry stamp)
  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, expiresAt: Date.now() + SESSION_TTL }));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);

  // ── login ──
  const login = (email, password) => {
    const found = getAllUsers().find(
      u => u.email.toLowerCase() === email.trim().toLowerCase()
        && u.password === password
    );
    if (!found) return false;
    const { password: _pw, ...session } = found;
    setUser(session);
    return true;
  };

  // ── register ──
  const register = ({ name, email, password, type, org }) => {
    const users = loadUsers();
    // Check duplicate email
    if (getAllUsers().find(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return { ok: false, error: "email_taken" };
    }
    const newUser = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      type,
      org: org || "",
      role: "user",
      createdAt: new Date().toISOString(),
    };
    saveUsers([...users, newUser]);
    const { password: _pw, ...session } = newUser;
    setUser(session);
    return { ok: true };
  };

  // ── logout ──
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
