import { createContext, useContext, useState, useEffect } from "react";
import { storageGetJSON, storageSetJSON, storageRemove } from "../utils/storage";
import { STORAGE_KEYS } from "../config/constants";

const AuthContext = createContext();

// ─── localStorage keys ────────────────────────────────────────────────────────
const USERS_KEY   = STORAGE_KEYS.users;
const SESSION_KEY = STORAGE_KEYS.session;

// ─── PBKDF2 password hashing (Web Crypto API) ─────────────────────────────────
// Passwords for localStorage users are hashed; admin is in-memory demo only.
const PBKDF2_ITER = 150_000;

function genSalt() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function hashPw(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ITER, hash: "SHA-256" },
    key, 256
  );
  return Array.from(new Uint8Array(bits)).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function verifyPw(plain, storedHash, salt) {
  return (await hashPw(plain, salt)) === storedHash;
}

// ─── Pre-seeded demo admin (in-memory only, plaintext — intentional demo) ────
const ADMIN = {
  id: "admin_1",
  name: "Админ",
  email: "admin@ubenergy.mn",
  password: "demo_admin_only",  // plaintext, in-memory, demo-only
  type: "official",
  org: "UBenergy",
  role: "admin",
  isDemo: true,
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
  const login = async (email, password) => {
    const found = getAllUsers().find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!found) return false;

    let ok = false;
    if (found.isDemo) {
      // Demo admin: plaintext comparison (in-memory only, never stored)
      ok = found.password === password;
    } else if (found.pwHash && found.pwSalt) {
      // Hashed password (new users)
      ok = await verifyPw(password, found.pwHash, found.pwSalt);
    } else if (found.password) {
      // Legacy plaintext — verify then migrate to hashed
      ok = found.password === password;
      if (ok) {
        const pwSalt = genSalt();
        const pwHash = await hashPw(password, pwSalt);
        const stored = loadUsers();
        saveUsers(stored.map(u =>
          u.id === found.id ? { ...u, pwHash, pwSalt, password: undefined } : u
        ));
      }
    }

    if (!ok) return false;
    const { password: _pw, pwHash: _h, pwSalt: _s, ...session } = found;
    setUser(session);
    return true;
  };

  // ── register ──
  const register = async ({ name, email, password, type, org }) => {
    if (getAllUsers().find(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return { ok: false, error: "email_taken" };
    }
    if (password.length < 8) return { ok: false, error: "too_short" };

    const pwSalt = genSalt();
    const pwHash = await hashPw(password, pwSalt);

    const newUser = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      pwHash,
      pwSalt,
      type,
      org: org || "",
      role: "user",
      createdAt: new Date().toISOString(),
    };
    saveUsers([...loadUsers(), newUser]);
    const { pwHash: _h, pwSalt: _s, ...session } = newUser;
    setUser(session);
    return { ok: true };
  };

  // ── logout ──
  const logout = () => setUser(null);

  // ── checkEmailForReset — step 1: verify email exists ──
  const checkEmailForReset = (email) => {
    const found = getAllUsers().find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!found) return { ok: false, error: "email_not_found" };
    if (found.id === ADMIN.id) return { ok: false, error: "admin_reset" };
    return { ok: true };
  };

  // ── resetPassword — step 2: set new password for verified email ──
  const resetPassword = async (email, newPassword) => {
    if (newPassword.length < 8) return { ok: false, error: "too_short" };
    const stored = loadUsers();
    const exists = stored.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!exists) return { ok: false, error: "email_not_found" };
    const pwSalt = genSalt();
    const pwHash = await hashPw(newPassword, pwSalt);
    saveUsers(stored.map(u =>
      u.email.toLowerCase() === email.trim().toLowerCase()
        ? { ...u, pwHash, pwSalt, password: undefined }
        : u
    ));
    return { ok: true };
  };

  // ── updateUser ──
  const updateUser = async ({ name, currentPassword, newPassword, avatar }) => {
    const allUsers = getAllUsers();
    const full = allUsers.find(u => u.id === user.id);
    if (!full) return { ok: false, error: "not_found" };

    // Password change requested
    if (newPassword !== undefined) {
      let currentOk = false;
      if (full.isDemo) {
        currentOk = full.password === currentPassword;
      } else if (full.pwHash && full.pwSalt) {
        currentOk = await verifyPw(currentPassword, full.pwHash, full.pwSalt);
      } else {
        currentOk = full.password === currentPassword;
      }
      if (!currentOk) return { ok: false, error: "wrong_password" };
      if (newPassword.length < 8) return { ok: false, error: "too_short" };
    }

    let updatedPwFields = {};
    if (newPassword !== undefined && !full.isDemo) {
      const pwSalt = genSalt();
      const pwHash = await hashPw(newPassword, pwSalt);
      updatedPwFields = { pwHash, pwSalt, password: undefined };
    }

    const updated = {
      ...full,
      name: name ?? full.name,
      avatar: avatar !== undefined ? avatar : full.avatar,
      ...updatedPwFields,
    };

    if (!full.isDemo) {
      const stored = loadUsers();
      saveUsers(stored.map(u => u.id === user.id ? updated : u));
    }

    const { password: _pw, pwHash: _h, pwSalt: _s, ...session } = updated;
    setUser(session);
    return { ok: true };
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, updateUser, checkEmailForReset, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
