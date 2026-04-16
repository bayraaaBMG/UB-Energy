// ─── Per-user localStorage helpers ────────────────────────────────────────────
// Keys are namespaced per userId so data stays isolated between accounts.

const LIMITS = { predictions: 100, scenarios: 50, favorites: 200 };

const key = (base, userId) => `${base}_${userId || "guest"}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function read(k) {
  try { return JSON.parse(localStorage.getItem(k) || "[]"); }
  catch { return []; }
}

function write(k, data) {
  try { localStorage.setItem(k, JSON.stringify(data)); } catch {}
}

// ── Predictions ──────────────────────────────────────────────────────────────

export function getPredictions(userId) {
  return read(key("ub_predictions", userId));
}

export function savePrediction(userId, entry) {
  const list = getPredictions(userId);
  list.unshift({ ...entry, id: Date.now(), savedAt: new Date().toISOString() });
  write(key("ub_predictions", userId), list.slice(0, LIMITS.predictions));
}

export function deletePrediction(userId, id) {
  write(key("ub_predictions", userId), getPredictions(userId).filter(p => p.id !== id));
}

export function clearPredictions(userId) {
  write(key("ub_predictions", userId), []);
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

export function getScenarios(userId) {
  return read(key("ub_scenarios", userId));
}

export function saveScenario(userId, scenario) {
  const list = getScenarios(userId);
  const existing = list.findIndex(s => s.id === scenario.id);
  if (existing >= 0) {
    list[existing] = { ...scenario, updatedAt: new Date().toISOString() };
  } else {
    list.unshift({ ...scenario, id: scenario.id || Date.now(), savedAt: new Date().toISOString() });
  }
  write(key("ub_scenarios", userId), list.slice(0, LIMITS.scenarios));
}

export function deleteScenario(userId, id) {
  write(key("ub_scenarios", userId), getScenarios(userId).filter(s => s.id !== id));
}

// ── Favorites ─────────────────────────────────────────────────────────────────

export function getFavorites(userId) {
  return read(key("ub_favorites", userId));
}

export function isFavorite(userId, buildingId) {
  return getFavorites(userId).some(f => f.id === buildingId);
}

export function toggleFavorite(userId, building) {
  const list = getFavorites(userId);
  const idx = list.findIndex(f => f.id === building.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({ ...building, favoritedAt: new Date().toISOString() });
    if (list.length > LIMITS.favorites) list.pop();
  }
  write(key("ub_favorites", userId), list);
}

export function removeFavorite(userId, buildingId) {
  write(key("ub_favorites", userId), getFavorites(userId).filter(f => f.id !== buildingId));
}
