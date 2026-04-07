import { createContext, useContext, useState, useEffect } from "react";
import { storageGetJSON, storageSetJSON, storageRemove } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";

const AuthContext = createContext();

// ─── localStorage keys ────────────────────────────────────────────────────────
const USERS_KEY   = STORAGE_KEYS.users;
const SESSION_KEY = STORAGE_KEYS.session;

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
  return storageGetJSON(USERS_KEY, []);
}

function saveUsers(users) {
  storageSetJSON(USERS_KEY, users);
}

// Merge admin into stored users (always first, always present)
function getAllUsers() {
  const stored = loadUsers().filter(u => u.email !== ADMIN.email);
  return [ADMIN, ...stored];
}

function loadSession() {
  try {
    const raw = storageGetJSON(SESSION_KEY, null);
    if (!raw) return null;
    // Expired?
    if (raw.expiresAt && raw.expiresAt < Date.now()) {
      storageRemove(SESSION_KEY);
      return null;
    }
    // User still exists?
    const exists = getAllUsers().find(u => u.id === raw.id);
    if (!exists) {
      storageRemove(SESSION_KEY);
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
    if (user) storageSetJSON(SESSION_KEY, { ...user, expiresAt: Date.now() + SESSION_TTL });
    else storageRemove(SESSION_KEY);
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
