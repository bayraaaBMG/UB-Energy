// ─── Firestore helpers — replaces localStorage auth/data storage ───────────────
import { db } from "../lib/firebase";
import {
  collection, collectionGroup, doc,
  setDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, limit, onSnapshot, writeBatch,
  serverTimestamp,
} from "firebase/firestore";

// ─── User profile ──────────────────────────────────────────────────────────────

export async function createUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), {
    ...data,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(uid, updates) {
  await updateDoc(doc(db, "users", uid), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ─── Buildings ─────────────────────────────────────────────────────────────────

export async function saveFirestoreBuilding(uid, building) {
  const ref = doc(db, "users", uid, "buildings", String(building.id));
  await setDoc(ref, building);
}

export async function updateFirestoreBuilding(uid, buildingId, updates) {
  const ref = doc(db, "users", uid, "buildings", String(buildingId));
  await updateDoc(ref, updates);
}

export async function deleteFirestoreBuilding(uid, buildingId) {
  await deleteDoc(doc(db, "users", uid, "buildings", String(buildingId)));
}

export async function batchSaveFirestoreBuildings(uid, buildings) {
  const batch = writeBatch(db);
  buildings.forEach(b => {
    const ref = doc(db, "users", uid, "buildings", String(b.id));
    batch.set(ref, b);
  });
  await batch.commit();
}

export function subscribeUserBuildings(uid, callback) {
  const q = query(
    collection(db, "users", uid, "buildings"),
    orderBy("submittedAt", "desc")
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => d.data())));
}

// Admin: query all users' buildings via collection group
export function subscribeAllBuildings(callback) {
  const q = query(collectionGroup(db, "buildings"), orderBy("submittedAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => d.data())));
}

// ─── Predictions ───────────────────────────────────────────────────────────────

export async function saveFirestorePrediction(uid, entry) {
  const id = String(entry.id || Date.now());
  const ref = doc(db, "users", uid, "predictions", id);
  await setDoc(ref, { ...entry, id, savedAt: entry.savedAt || new Date().toISOString() });
}

export async function deleteFirestorePrediction(uid, id) {
  await deleteDoc(doc(db, "users", uid, "predictions", String(id)));
}

export async function clearFirestorePredictions(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const batch = writeBatch(db);
  const q = query(collection(db, "users", uid, "predictions"));
  const all = await import("firebase/firestore").then(m =>
    m.getDocs(q)
  );
  all.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export function subscribePredictions(uid, callback) {
  const q = query(
    collection(db, "users", uid, "predictions"),
    orderBy("savedAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => d.data())));
}

// ─── Scenarios ─────────────────────────────────────────────────────────────────

export async function saveFirestoreScenario(uid, scenario) {
  const id = String(scenario.id || Date.now());
  const ref = doc(db, "users", uid, "scenarios", id);
  await setDoc(ref, { ...scenario, id, savedAt: scenario.savedAt || new Date().toISOString() });
}

export async function deleteFirestoreScenario(uid, id) {
  await deleteDoc(doc(db, "users", uid, "scenarios", String(id)));
}

export function subscribeScenarios(uid, callback) {
  const q = query(
    collection(db, "users", uid, "scenarios"),
    orderBy("savedAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => d.data())));
}

// ─── Favorites ─────────────────────────────────────────────────────────────────

export async function saveFirestoreFavorite(uid, building) {
  const id = String(building.id);
  const ref = doc(db, "users", uid, "favorites", id);
  await setDoc(ref, {
    ...building,
    favoritedAt: new Date().toISOString(),
  });
}

export async function deleteFirestoreFavorite(uid, buildingId) {
  await deleteDoc(doc(db, "users", uid, "favorites", String(buildingId)));
}

export function subscribeFavorites(uid, callback) {
  const q = query(
    collection(db, "users", uid, "favorites"),
    orderBy("favoritedAt", "desc"),
    limit(200)
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => d.data())));
}
