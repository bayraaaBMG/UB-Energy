import { storageGetJSON, storageSetJSON } from "./storage";
import { STORAGE_KEYS } from "../config/constants";

const STORAGE_KEY = STORAGE_KEYS.buildings;

export function getUserBuildings(userId = null) {
  const all = storageGetJSON(STORAGE_KEY, []);
  if (!userId) return all;
  return all.filter(b => !b.userId || b.userId === userId);
}

export function saveUserBuilding(record) {
  const existing = storageGetJSON(STORAGE_KEY, []);
  storageSetJSON(STORAGE_KEY, [...existing, record]);
}

export function deleteUserBuilding(id) {
  const all = storageGetJSON(STORAGE_KEY, []);
  storageSetJSON(STORAGE_KEY, all.filter(b => b.id !== id));
}
