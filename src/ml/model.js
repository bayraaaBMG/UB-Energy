/**
 * UB Energy — Building Energy Prediction Model
 *
 * Architecture : Physics-informed synthetic dataset  →  OLS Linear Regression
 * Dataset      : 600 synthetic Mongolian buildings (UB climate, seeds = 42)
 * Split        : 80 % train / 20 % test (seed = 99)
 * Targets      : annual_kwh  (continuous)
 * Metrics      : R², MAE, MAPE  — computed on held-out test set
 * Features     : 8 numerical + 22 one-hot categorical = 30 + intercept
 *
 * Justification for synthetic data:
 *   No large Mongolian building energy dataset is publicly available.
 *   Ground-truth values are generated from the validated EUI physics formula
 *   (IEA 2022, БНТУ норматив) plus ±12 % Gaussian measurement noise,
 *   which represents realistic meter-reading variance in UB apartment blocks.
 *
 * Training runs at module-load time (~5 ms in V8).
 */

// ─── 1. Seeded PRNG (Mulberry32 — reproducible across platforms) ─────────────
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller normal sample using a given rng
function randn(rng) {
  let u, v;
  do { u = rng(); v = rng(); } while (u === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── 2. Physics EUI formula (ground-truth generator) ─────────────────────────
//   Based on: IEA (2022), БНТУ 23-02-09, Khan et al. (2019)
function physicsEUI(s) {
  const base = {
    apartment: 175, office: 230, school: 155,
    hospital: 360, warehouse: 95, commercial: 275,
  }[s.building_type] || 175;

  const yearFactor      = 1 + Math.max(0, (2000 - s.year)) * 0.004;
  const hddFactor       = s.hdd / 4200;
  const windowRatioF    = 1 + (s.window_ratio - 20) * 0.008;
  const materialF       = { panel: 1.18, brick: 1.0, concrete: 0.93, wood: 1.22, metal: 1.12 }[s.wall_material] || 1;
  const heatingF        = { central: 1.0, local: 1.25, electric: 1.08, gas: 0.88 }[s.heating_type] || 1;
  const insulationF     = { good: 0.82, medium: 1.0, poor: 1.25 }[s.insulation_quality] || 1;
  const windowTypeF     = { vacuum: 0.88, double: 1.0, single: 1.18 }[s.window_type] || 1;
  const density         = (s.residents / s.area) * 100;
  const occupancyF      = 1 + Math.max(0, density - 3) * 0.015;
  const applianceF      = 1 + s.appliances * 0.025;
  const floorF          = 1 - Math.min(0.08, (s.floors - 1) * 0.008);

  return base * yearFactor * hddFactor * windowRatioF *
    materialF * heatingF * insulationF * windowTypeF *
    occupancyF * applianceF * floorF;
}

// ─── 3. Synthetic dataset — 600 UB buildings ─────────────────────────────────
const BUILDING_TYPES  = ['apartment', 'office', 'school', 'hospital', 'warehouse', 'commercial'];
const WALL_MATERIALS  = ['panel', 'brick', 'concrete', 'wood', 'metal'];
const HEATING_TYPES   = ['central', 'local', 'electric', 'gas'];
const INSULATIONS     = ['good', 'medium', 'poor'];
const WINDOW_TYPES    = ['single', 'double', 'vacuum'];

// UB-realistic building type frequency (apartment-heavy city)
const BT_WEIGHTS = [0.52, 0.18, 0.10, 0.06, 0.08, 0.06];

function generateDataset(n = 600) {
  const rng  = mulberry32(42);
  const rand = (lo, hi) => lo + rng() * (hi - lo);
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const wChoice = (arr, weights) => {
    let r = rng(), cum = 0;
    for (let i = 0; i < arr.length; i++) { cum += weights[i]; if (r < cum) return arr[i]; }
    return arr[arr.length - 1];
  };

  return Array.from({ length: n }, () => {
    const bt    = wChoice(BUILDING_TYPES, BT_WEIGHTS);
    const area  = Math.round(
      bt === 'apartment'  ? rand(300,  8000)  :
      bt === 'office'     ? rand(500,  20000) :
      bt === 'school'     ? rand(1000, 6000)  :
      bt === 'hospital'   ? rand(2000, 15000) :
      bt === 'warehouse'  ? rand(500,  30000) :
                            rand(300,  10000)
    );
    const year    = Math.round(rand(1955, 2022));
    const floors  = Math.round(rand(1, bt === 'apartment' ? 25 : bt === 'office' ? 20 : 5));
    const rooms   = Math.round(rand(1, Math.min(20, Math.max(1, area / 150))));
    const hdd     = Math.round(rand(3800, 5200));          // UB: ~4 500 avg
    const wr      = Math.round(rand(10, 55));
    const res     = Math.max(1, Math.round(rand(2, 8) * area / 100));
    const appl    = Math.round(rand(2, 15));
    const mat     = pick(WALL_MATERIALS);
    const heat    = pick(HEATING_TYPES);
    const ins     = pick(INSULATIONS);
    const win     = pick(WINDOW_TYPES);

    const sample = {
      building_type: bt, area, year, floors, rooms, hdd,
      window_ratio: wr, residents: res, appliances: appl,
      wall_material: mat, heating_type: heat,
      insulation_quality: ins, window_type: win,
    };
    // Ground truth + ±12 % realistic noise
    const eui    = physicsEUI(sample);
    const noise  = 1 + randn(rng) * 0.12;
    const annual = Math.max(100, Math.round(area * eui * noise));

    return { ...sample, annual_kwh: annual };
  });
}

// ─── 4. Feature engineering ───────────────────────────────────────────────────
// Numerical: area, age, floors, rooms, hdd, density, appliances, window_ratio
// One-hot  : building_type (drop commercial), wall_material (drop metal),
//            heating_type (drop gas), insulation (drop poor), window (drop vacuum)

export const FEATURE_NAMES = [
  'intercept',
  'area', 'age', 'floors', 'rooms', 'hdd', 'density', 'appliances', 'window_ratio',
  // building_type (5)
  'bt_apartment', 'bt_office', 'bt_school', 'bt_hospital', 'bt_warehouse',
  // wall_material (4)
  'mat_panel', 'mat_brick', 'mat_concrete', 'mat_wood',
  // heating (3)
  'heat_central', 'heat_local', 'heat_electric',
  // insulation (2)
  'ins_good', 'ins_medium',
  // window (2)
  'win_single', 'win_double',
];

const NUM_IDX = [1, 2, 3, 4, 5, 6, 7, 8]; // numerical feature indices

function featurize(s) {
  const density = (s.residents / s.area) * 100;
  return [
    1,
    s.area,
    2024 - (s.year || 1990),
    s.floors,
    s.rooms || 3,
    s.hdd || 4500,
    density,
    s.appliances,
    s.window_ratio,
    // building type one-hot (ref = commercial)
    s.building_type === 'apartment' ? 1 : 0,
    s.building_type === 'office'    ? 1 : 0,
    s.building_type === 'school'    ? 1 : 0,
    s.building_type === 'hospital'  ? 1 : 0,
    s.building_type === 'warehouse' ? 1 : 0,
    // wall material (ref = metal)
    s.wall_material === 'panel'    ? 1 : 0,
    s.wall_material === 'brick'    ? 1 : 0,
    s.wall_material === 'concrete' ? 1 : 0,
    s.wall_material === 'wood'     ? 1 : 0,
    // heating (ref = gas)
    s.heating_type === 'central'  ? 1 : 0,
    s.heating_type === 'local'    ? 1 : 0,
    s.heating_type === 'electric' ? 1 : 0,
    // insulation (ref = poor)
    s.insulation_quality === 'good'   ? 1 : 0,
    s.insulation_quality === 'medium' ? 1 : 0,
    // window (ref = vacuum)
    s.window_type === 'single' ? 1 : 0,
    s.window_type === 'double' ? 1 : 0,
  ];
}

// ─── 5. Matrix operations ─────────────────────────────────────────────────────
function matMul(A, B) {
  const m = A.length, n = B[0].length, k = B.length;
  const C = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < k; l++)
        C[i][j] += A[i][l] * B[l][j];
  return C;
}

function transpose(A) {
  const m = A.length, n = A[0].length;
  return Array.from({ length: n }, (_, j) =>
    Array.from({ length: m }, (_, i) => A[i][j])
  );
}

// Gauss-Jordan elimination with partial pivoting
function matInverse(A) {
  const n = A.length;
  const M = A.map((row, i) => {
    const r = [...row, ...Array(n).fill(0)];
    r[n + i] = 1;
    return r;
  });
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const d = M[col][col];
    if (Math.abs(d) < 1e-12) continue; // singular column — skip (regularization handles it)
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col];
      for (let j = 0; j < 2 * n; j++) M[row][j] -= f * M[col][j];
    }
  }
  return M.map(row => row.slice(n));
}

// ─── 6. StandardScaler ────────────────────────────────────────────────────────
function fitScaler(X) {
  const means = [], stds = [];
  for (const idx of NUM_IDX) {
    const vals = X.map(r => r[idx]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std  = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
    means.push(mean); stds.push(std);
  }
  return { means, stds };
}

function applyScaler(X, scaler) {
  return X.map(row => {
    const r = [...row];
    NUM_IDX.forEach((idx, i) => { r[idx] = (r[idx] - scaler.means[i]) / scaler.stds[i]; });
    return r;
  });
}

// ─── 7. Train/test split (seeded shuffle) ────────────────────────────────────
function splitData(data, testRatio = 0.2, seed = 99) {
  const rng = mulberry32(seed);
  const shuffled = [...data].sort(() => rng() - 0.5);
  const nTest = Math.round(data.length * testRatio);
  return { train: shuffled.slice(nTest), test: shuffled.slice(0, nTest) };
}

// ─── 8. Metrics ───────────────────────────────────────────────────────────────
function evalMetrics(yTrue, yPred) {
  const n = yTrue.length;
  const meanY  = yTrue.reduce((a, b) => a + b, 0) / n;
  const ssTot  = yTrue.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes  = yTrue.reduce((s, y, i) => s + (y - yPred[i]) ** 2, 0);
  const r2     = 1 - ssRes / ssTot;
  const mae    = yTrue.reduce((s, y, i) => s + Math.abs(y - yPred[i]), 0) / n;
  const mape   = yTrue.reduce((s, y, i) => s + Math.abs(y - yPred[i]) / (Math.abs(y) || 1), 0) / n * 100;
  return { r2: +r2.toFixed(4), mae: Math.round(mae), mape: +mape.toFixed(1) };
}

// ─── 9. Training ──────────────────────────────────────────────────────────────
const DATASET       = generateDataset(600);
const { train, test } = splitData(DATASET, 0.2, 99);

const X_train_raw = train.map(featurize);
const y_train     = train.map(s => s.annual_kwh);
const X_test_raw  = test.map(featurize);
const y_test      = test.map(s => s.annual_kwh);

// Fit scaler on train only
const SCALER  = fitScaler(X_train_raw);
const X_train = applyScaler(X_train_raw, SCALER);
const X_test  = applyScaler(X_test_raw, SCALER);

// OLS: β = (X'X + λI)⁻¹ X'y  — Ridge λ=0.01 for numerical stability
const Xt     = transpose(X_train);
const XtX    = matMul(Xt, X_train);
const LAMBDA = 0.01;
for (let i = 1; i < XtX.length; i++) XtX[i][i] += LAMBDA; // don't regularize intercept
const XtXinv = matInverse(XtX);
const Xty    = matMul(Xt, y_train.map(y => [y]));
const BETA   = matMul(XtXinv, Xty).map(r => r[0]);

// ─── 10. Evaluate on held-out test set ───────────────────────────────────────
const y_pred_test = X_test.map(row => BETA.reduce((s, b, i) => s + b * row[i], 0));
const TEST_METRICS = evalMetrics(y_test, y_pred_test);

export const METRICS = {
  r2:      TEST_METRICS.r2,
  mae:     TEST_METRICS.mae,
  mape:    TEST_METRICS.mape,
  n_train: train.length,
  n_test:  test.length,
  n_total: DATASET.length,
};

// ─── 11. Feature importance (normalized |β| of scaled features) ──────────────
//   Equivalent to permutation importance for linear models on scaled data
const raw_importance = BETA.slice(1).map(Math.abs);
const max_imp        = Math.max(...raw_importance);

export const FEATURE_IMPORTANCE = FEATURE_NAMES.slice(1)
  .map((name, i) => ({ name, importance: +(raw_importance[i] / max_imp).toFixed(3) }))
  .sort((a, b) => b.importance - a.importance);

// ─── 12. Predict function ─────────────────────────────────────────────────────
const SEASONAL_WEIGHTS = [1.85, 1.72, 1.38, 0.82, 0.45, 0.32, 0.28, 0.31, 0.55, 1.02, 1.52, 1.78];
const MONTH_LABELS     = ['1-р','2-р','3-р','4-р','5-р','6-р','7-р','8-р','9-р','10-р','11-р','12-р'];
const GRADE_STEPS      = [[50,'A'],[100,'B'],[150,'C'],[200,'D'],[250,'E'],[300,'F']];
const GRADE_COLORS     = { A:'#2a9d8f',B:'#57cc99',C:'#a8c686',D:'#f4a261',E:'#e76f51',F:'#e63946',G:'#9b1d20' };

export function predict(form) {
  const rawVec    = featurize(form);
  const scaledVec = applyScaler([rawVec], SCALER)[0];
  const annual    = Math.max(0, Math.round(BETA.reduce((s, b, i) => s + b * scaledVec[i], 0)));

  const monthly_avg = Math.round(annual / 12);
  const daily_avg   = Math.round(annual / 365);
  const intensity   = annual > 0 ? Math.round(annual / form.area) : 0;

  // Seasonal distribution
  const wSum     = SEASONAL_WEIGHTS.reduce((a, b) => a + b, 0);
  const chart_data = MONTH_LABELS.map((m, i) => ({
    month: m,
    usage: Math.round(annual * SEASONAL_WEIGHTS[i] / wSum),
  }));

  // SHAP-lite: β_i × x_i  per feature (absolute contribution to this prediction)
  const contribs = FEATURE_NAMES.slice(1).map((name, i) => ({
    key: name,
    abs: Math.abs(BETA[i + 1] * scaledVec[i + 1]),
  }));
  const contribSum = contribs.reduce((s, c) => s + c.abs, 0) || 1;
  const features = contribs
    .map(c => ({ key: c.key, pct: Math.round(c.abs / contribSum * 100) }))
    .sort((a, b) => b.pct - a.pct);

  // CO₂ (heating 60 % × 0.28 + electric 40 % × 0.73 kg/kWh)
  const co2  = +((annual * 0.6 * 0.28 + annual * 0.4 * 0.73) / 1000).toFixed(1);
  const pm25 = Math.round(co2 * 1350);

  const grade = GRADE_STEPS.find(([thr]) => intensity < thr)?.[1] ?? 'G';

  return { annual, monthly_avg, daily_avg, intensity, chart_data, features, co2, pm25, grade };
}

// Export GRADE_COLORS so PredictorPage doesn't need to redefine
export { GRADE_COLORS, DATASET };
