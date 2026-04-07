/**
 * Safe localStorage wrappers — silent no-ops when storage is unavailable
 * (private browsing mode, Safari ITP, storage quota exceeded).
 */

export function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* quota or private mode */ }
}

export function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* private mode */ }
}

export function storageGetJSON(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

export function storageSetJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota or private mode */ }
}
