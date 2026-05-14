/**
 * Safe localStorage wrappers — silent no-ops when storage is unavailable
 * (private browsing mode, Safari ITP, storage quota exceeded).
 */

export function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      // Evict oldest weather cache to free space, then retry once
      try { localStorage.removeItem("ub_weather_cache"); } catch {}
      try { localStorage.setItem(key, value); return true; } catch {}
    }
    return false;
  }
}

export function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* private mode */ }
}

export function storageGetJSON(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

export function storageSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      try { localStorage.removeItem("ub_weather_cache"); } catch {}
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch {}
    }
    return false;
  }
}
