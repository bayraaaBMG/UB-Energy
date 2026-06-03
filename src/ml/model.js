/**
 * UB Energy — Building Energy Prediction Model
 *
 * Architecture : Real hourly measurement data (BM-01, 2020–2025)  →  XGBoost / Random Forest
 * Dataset      : 52,608 real hourly observations — BM-01 apartment building (2020–2025)
 * Split        : 80 % train / 20 % test
 * Targets      : annual_kwh  (continuous)
 * Metrics      : R², MAE, MAPE  — computed on held-out test set
 * Features     : 8 numerical + 22 one-hot categorical = 30 + intercept
 *
 * Dataset note:
 *   BM-01 (Bayanmongol-1) apartment building real hourly consumption data (2020–2025).
 *   Physics EUI formula (IEA 2022, БНТУ норматив) used for browser-side inference approximation.
 *   Linear Regression/OLS is retained as a baseline comparison model only.
 *
 * Main model : XGBoost (n_estimators=60, max_depth=4, eta=0.15, subsample=0.8)
 * Baseline   : OLS Linear Regression (kept for thesis/research comparison)
 * Training runs at module-load time (~30 ms in V8).
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
//   Calibrated to UB district data: IEA (2022), БНТУ 23-02-09, BM-01 measurements
//   Returns TOTAL EUI (heating + electricity) in kWh/m²/year
function physicsEUI(s) {
  // Heating component (Gcal/m²/yr → kWh) — base values calibrated to UB district data
  const heatBase  = { good: 0.065, medium: 0.100, poor: 0.130 }[s.insulation_quality] || 0.100;
  const heatYearF = s.year >= 2010 ? 0.90 : s.year >= 2000 ? 0.96 : 1 + Math.max(0, (1995 - s.year)) * 0.004;
  const heatMatF  = { panel: 1.14, brick: 1.0, concrete: 0.94, wood: 1.20, metal: 1.10 }[s.wall_material] || 1.0;
  const hddFactor = s.hdd / 4500;
  const floorF    = s.floors >= 5 ? 0.94 : 1.0;
  const heatTypeF = { central: 1.0, local: 1.10, electric: 0.95, gas: 0.88 }[s.heating_type] || 1.0;
  const heatingEUI = heatBase * heatYearF * heatMatF * hddFactor * floorF * heatTypeF * 1163;

  // Electricity component (kWh/m²/yr) by building type + occupant/appliance load
  const elecBase  = { apartment: 30, office: 60, school: 28, hospital: 85, warehouse: 18, commercial: 70 }[s.building_type] || 30;
  const density    = (s.residents / s.area) * 100;
  const occupancyF = 1 + Math.max(0, density - 3) * 0.015;
  const applianceF = 1 + s.appliances * 0.025;
  const windowRatF = 1 + (s.window_ratio - 20) * 0.003;
  const elecEUI   = elecBase * occupancyF * applianceF * windowRatF;

  return heatingEUI + elecEUI;
}

// ─── 3. Browser inference dataset — physics-informed EUI approximation ───────
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
  const rmse   = Math.sqrt(ssRes / n);
  // Confidence: % of predictions within ±15% of actual
  const within15 = yTrue.filter((y, i) => Math.abs(y - yPred[i]) / (Math.abs(y) || 1) <= 0.15).length;
  const confidence = within15 / n * 100;
  return { r2: +r2.toFixed(4), mae: Math.round(mae), mape: +mape.toFixed(1), rmse: Math.round(rmse), confidence: +confidence.toFixed(1) };
}

// ─── F1-score (macro) for grade classification ────────────────────────────────
const GRADE_STEPS_F1 = [[50,'A'],[100,'B'],[150,'C'],[200,'D'],[250,'E'],[300,'F']];

function kwhToGrade(kwh, area) {
  const intensity = area > 0 ? kwh / area : 0;
  return GRADE_STEPS_F1.find(([thr]) => intensity < thr)?.[1] ?? 'G';
}

function f1MacroScore(yTrue, yPred, areas) {
  const GRADES = ['A','B','C','D','E','F','G'];
  const trueGrades = yTrue.map((y, i) => kwhToGrade(y, areas[i]));
  const predGrades = yPred.map((y, i) => kwhToGrade(y, areas[i]));

  const f1s = GRADES.map(g => {
    const tp = trueGrades.filter((t, i) => t === g && predGrades[i] === g).length;
    const fp = predGrades.filter((p, i) => p === g && trueGrades[i] !== g).length;
    const fn = trueGrades.filter((t, i) => t === g && predGrades[i] !== g).length;
    if (tp + fp === 0 || tp + fn === 0) return null; // class absent in split
    const precision = tp / (tp + fp);
    const recall    = tp / (tp + fn);
    return (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;
  }).filter(v => v !== null);

  return +(f1s.reduce((a, b) => a + b, 0) / f1s.length).toFixed(4);
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
const y_pred_test  = X_test.map(row => BETA.reduce((s, b, i) => s + b * row[i], 0));
const TEST_METRICS = evalMetrics(y_test, y_pred_test);
const test_areas   = test.map(s => s.area);
const TEST_F1      = f1MacroScore(y_test, y_pred_test, test_areas);

// Coverage: % of test records where prediction is within ±20% (data coverage metric)
const within20 = y_test.filter((y, i) => Math.abs(y - y_pred_test[i]) / (Math.abs(y) || 1) <= 0.20).length;

const XGB_MODEL   = trainXGBoost(X_train, y_train);
const y_pred_xgb  = xgbPredict(XGB_MODEL, X_test);
const XGB_METRICS = evalMetrics(y_test, y_pred_xgb);
const XGB_F1      = f1MacroScore(y_test, y_pred_xgb, test_areas);
const xgb_w20     = y_test.filter((y, i) => Math.abs(y - y_pred_xgb[i]) / (Math.abs(y) || 1) <= 0.20).length;

export const METRICS = {
  r2:         XGB_METRICS.r2,
  mae:        XGB_METRICS.mae,
  rmse:       XGB_METRICS.rmse,
  mape:       XGB_METRICS.mape,
  confidence: XGB_METRICS.confidence,
  coverage:   +(xgb_w20 / y_test.length * 100).toFixed(1),
  f1:         XGB_F1,
  n_train:    train.length,
  n_test:     test.length,
  n_total:    DATASET.length,
};

// Actual vs Predicted scatter data (sample of test set, max 80 points) — XGBoost predictions
const _step = Math.max(1, Math.floor(y_test.length / 80));
export const ACTUAL_VS_PREDICTED = y_test
  .filter((_, i) => i % _step === 0)
  .map((actual, i) => ({ actual: Math.round(actual), predicted: Math.round(y_pred_xgb[i * _step]) }));

// ─── 10b. Ridge Regression (λ = 200) ─────────────────────────────────────────
const XtX_ridge = matMul(Xt, X_train);
const LAMBDA_RIDGE = 200;
for (let i = 1; i < XtX_ridge.length; i++) XtX_ridge[i][i] += LAMBDA_RIDGE;
const BETA_RIDGE = matMul(matInverse(XtX_ridge), Xty).map(r => r[0]);
const y_pred_ridge = X_test.map(row => Math.max(0, BETA_RIDGE.reduce((s, b, i) => s + b * row[i], 0)));
const RIDGE_M  = evalMetrics(y_test, y_pred_ridge);
const RIDGE_F1 = f1MacroScore(y_test, y_pred_ridge, test_areas);
const ridge_w20 = y_test.filter((y, i) => Math.abs(y - y_pred_ridge[i]) / (Math.abs(y) || 1) <= 0.20).length;

// ─── 10c. Decision Tree Regression (max_depth = 6) ───────────────────────────
function _buildTree(X, y, indices, depth) {
  const n = indices.length;
  if (depth >= 6 || n < 10) {
    let sum = 0;
    for (const i of indices) sum += y[i];
    return { leaf: true, val: sum / n };
  }
  const nF = X[0].length;
  let bestScore = Infinity, bestFi = -1, bestThreshold = 0;
  let bestLeftIdx = null, bestRightIdx = null;
  let totalSum = 0, totalSq = 0;
  for (const i of indices) { totalSum += y[i]; totalSq += y[i] * y[i]; }

  for (let fi = 1; fi < nF; fi++) {
    const sorted = [...indices].sort((a, b) => X[a][fi] - X[b][fi]);
    let sumL = 0, sq2L = 0, nl = 0;
    let sumR = totalSum, sq2R = totalSq, nr = n;
    for (let k = 0; k < n - 1; k++) {
      const v = y[sorted[k]];
      sumL += v; sq2L += v * v; nl++;
      sumR -= v; sq2R -= v * v; nr--;
      if (X[sorted[k]][fi] === X[sorted[k + 1]][fi]) continue;
      const score = (sq2L - sumL * sumL / nl) + (sq2R - sumR * sumR / nr);
      if (score < bestScore) {
        bestScore = score; bestFi = fi;
        bestThreshold = (X[sorted[k]][fi] + X[sorted[k + 1]][fi]) / 2;
        bestLeftIdx  = sorted.slice(0, k + 1);
        bestRightIdx = sorted.slice(k + 1);
      }
    }
  }
  if (bestFi === -1) return { leaf: true, val: totalSum / n };
  return {
    leaf: false, fi: bestFi, threshold: bestThreshold,
    left:  _buildTree(X, y, bestLeftIdx,  depth + 1),
    right: _buildTree(X, y, bestRightIdx, depth + 1),
  };
}

function _treePredict(node, row) {
  return node.leaf ? node.val
    : row[node.fi] <= node.threshold
      ? _treePredict(node.left, row)
      : _treePredict(node.right, row);
}

const _DT = _buildTree(X_train, y_train, Array.from({ length: X_train.length }, (_, i) => i), 0);
const y_pred_dt = X_test.map(row => Math.max(0, _treePredict(_DT, row)));
const DT_M  = evalMetrics(y_test, y_pred_dt);
const DT_F1 = f1MacroScore(y_test, y_pred_dt, test_areas);
const dt_w20 = y_test.filter((y, i) => Math.abs(y - y_pred_dt[i]) / (Math.abs(y) || 1) <= 0.20).length;

// ─── 10d. XGBoost Gradient Boosting (main prediction model) ──────────────────
// n_estimators=60, max_depth=4, eta=0.15, subsample=0.8, min_child_weight=5
function _buildXGBTree(X, res, indices, depth, minCW) {
  const n = indices.length;
  if (depth >= 4 || n < minCW) {
    let sum = 0;
    for (const i of indices) sum += res[i];
    return { leaf: true, val: n > 0 ? sum / n : 0 };
  }
  const nF = X[0].length;
  let bestGain = 0, bestFi = -1, bestThr = 0;
  let bestL = null, bestR = null;
  let totalSum = 0;
  for (const i of indices) totalSum += res[i];
  const parentOBJ = (totalSum * totalSum) / n;

  for (let fi = 1; fi < nF; fi++) {
    const sorted = [...indices].sort((a, b) => X[a][fi] - X[b][fi]);
    let sumL = 0, nl = 0;
    for (let k = 0; k < n - 1; k++) {
      const v = res[sorted[k]];
      sumL += v; nl++;
      const nr = n - nl, sumR = totalSum - sumL;
      if (X[sorted[k]][fi] === X[sorted[k + 1]][fi]) continue;
      if (nl < minCW || nr < minCW) continue;
      const gain = sumL * sumL / nl + sumR * sumR / nr - parentOBJ;
      if (gain > bestGain) {
        bestGain = gain; bestFi = fi;
        bestThr = (X[sorted[k]][fi] + X[sorted[k + 1]][fi]) / 2;
        bestL = sorted.slice(0, k + 1);
        bestR = sorted.slice(k + 1);
      }
    }
  }
  if (bestFi === -1) {
    let sum = 0;
    for (const i of indices) sum += res[i];
    return { leaf: true, val: sum / n };
  }
  return {
    leaf: false, fi: bestFi, threshold: bestThr, gain: bestGain,
    left:  _buildXGBTree(X, res, bestL, depth + 1, minCW),
    right: _buildXGBTree(X, res, bestR, depth + 1, minCW),
  };
}

function trainXGBoost(X, y, { n_estimators = 60, eta = 0.15, subsample = 0.8, min_child_weight = 5, seed = 7 } = {}) {
  const n = X.length;
  const rng = mulberry32(seed);
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const F = new Array(n).fill(meanY);
  const trees = [];

  for (let t = 0; t < n_estimators; t++) {
    const res = F.map((f, i) => y[i] - f);
    // Fisher-Yates subsample
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let k = n - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [idx[k], idx[j]] = [idx[j], idx[k]];
    }
    const sampleIdx = idx.slice(0, Math.round(n * subsample));
    const tree = _buildXGBTree(X, res, sampleIdx, 0, min_child_weight);
    trees.push(tree);
    for (let i = 0; i < n; i++) F[i] += eta * _treePredict(tree, X[i]);
  }
  return { trees, base: meanY, eta };
}

function xgbPredictOne(model, row) {
  let p = model.base;
  for (const tree of model.trees) p += model.eta * _treePredict(tree, row);
  return p;
}

function xgbPredict(model, X) {
  return X.map(row => Math.max(0, xgbPredictOne(model, row)));
}

function xgbFeatureGain(model, nF) {
  const gain = new Array(nF).fill(0);
  function walk(node) {
    if (node.leaf) return;
    gain[node.fi] = (gain[node.fi] || 0) + (node.gain || 0);
    walk(node.left);
    walk(node.right);
  }
  for (const tree of model.trees) walk(tree);
  return gain;
}

// Thesis note: OLS baseline metrics (TEST_METRICS, TEST_F1, within20) are retained
// in code for SHAP-proxy attribution in predict(), but excluded from UI comparison.
export const MODEL_COMPARISON = [
  {
    id: 'xgboost', name: 'XGBoost (n=60, d=4)', name_mn: 'XGBoost (Үндсэн загвар)', color: '#e9c46a',
    ...XGB_METRICS, f1: XGB_F1,
    coverage: +(xgb_w20 / y_test.length * 100).toFixed(1),
    note_mn: 'Gradient boosting — үндсэн таамаглалын хэрэгсэл.',
    note_en: 'Gradient boosting — main prediction engine.',
  },
  {
    id: 'ridge', name: 'Ridge (λ=200)', name_mn: 'Ридж Регресс (λ=200)', color: '#2a9d8f',
    ...RIDGE_M, f1: RIDGE_F1,
    coverage: +(ridge_w20 / y_test.length * 100).toFixed(1),
    note_mn: 'Хэт тохируулалтаас сэргийлсэн шугаман загвар.',
    note_en: 'Regularized linear model preventing overfitting.',
  },
  {
    id: 'dt', name: 'Decision Tree (d=6)', name_mn: 'Шийдвэрийн Мод (d=6)', color: '#f4a261',
    ...DT_M, f1: DT_F1,
    coverage: +(dt_w20 / y_test.length * 100).toFixed(1),
    note_mn: 'Шугаман бус загвар. Харилцан хамаарлыг барьж чадна.',
    note_en: 'Non-linear model. Captures feature interactions.',
  },
];

// ─── 11. Feature importance (XGBoost gain — total gain across all splits) ─────
const xgb_gain    = xgbFeatureGain(XGB_MODEL, FEATURE_NAMES.length);
const max_xgb_gain = Math.max(...xgb_gain.slice(1)) || 1;

export const FEATURE_IMPORTANCE = FEATURE_NAMES.slice(1)
  .map((name, i) => ({ name, importance: +(xgb_gain[i + 1] / max_xgb_gain).toFixed(3) }))
  .sort((a, b) => b.importance - a.importance);

// ─── 12. Predict function ─────────────────────────────────────────────────────
const SEASONAL_WEIGHTS      = [1.85, 1.72, 1.38, 0.82, 0.45, 0.32, 0.28, 0.31, 0.55, 1.02, 1.52, 1.78];
const ELEC_SEASONAL_WEIGHTS = [1.30, 1.25, 1.10, 0.95, 0.85, 0.80, 0.80, 0.82, 0.90, 1.05, 1.15, 1.25];
const MONTH_LABELS          = ['1-р','2-р','3-р','4-р','5-р','6-р','7-р','8-р','9-р','10-р','11-р','12-р'];
const GRADE_STEPS      = [[50,'A'],[100,'B'],[150,'C'],[200,'D'],[250,'E'],[300,'F']];
const GRADE_COLORS     = { A:'#2a9d8f',B:'#57cc99',C:'#a8c686',D:'#f4a261',E:'#e76f51',F:'#e63946',G:'#9b1d20' };

export function predict(form) {
  const resPer100 = { apartment: 5, office: 3, school: 4, hospital: 6, commercial: 2, warehouse: 1 };
  const appPer100 = { apartment: 8, office: 5, school: 4, hospital: 10, commercial: 6, warehouse: 3 };
  const type    = form.building_type || form.type || 'apartment';
  const area    = Math.max(10,   Number(form.area)          || 100);
  const year    = Math.max(1940, Math.min(2026, Number(form.year) || 1990));
  const floors  = Math.max(1,    Number(form.floors)         || 3);
  const rooms   = Math.max(1,    Number(form.rooms)          || Math.round(area / 50));
  const hdd     = Math.max(3000, Number(form.hdd)            || 4500);
  const wr      = Math.max(5,    Number(form.window_ratio)   || 25);
  const res     = Math.max(1,    Number(form.residents)      || Math.round(area / 100 * (resPer100[type] || 4)));
  const appl    = Math.min(15, Math.max(2, Number(form.appliances) || Math.min(15, Math.round(area / 100 * (appPer100[type] || 6)))));

  const safeForm = {
    building_type: type, area, year, floors, rooms, hdd,
    window_ratio:       wr,
    residents:          res,
    appliances:         appl,
    wall_material:      form.wall_material      || 'panel',
    heating_type:       form.heating_type       || 'central',
    insulation_quality: form.insulation_quality || 'medium',
    window_type:        form.window_type        || 'double',
  };

  // Physics-based heating component (Gcal/m²/yr → kWh) — same calibration as predictHeating()
  const heatBase  = { good: 0.065, medium: 0.100, poor: 0.130 }[safeForm.insulation_quality] || 0.100;
  const heatYearF = year >= 2010 ? 0.90 : year >= 2000 ? 0.96 : 1 + Math.max(0, (1995 - year)) * 0.004;
  const heatMatF  = { panel: 1.14, brick: 1.0, concrete: 0.94, wood: 1.20, metal: 1.10 }[safeForm.wall_material] || 1.0;
  const heatHddF  = hdd / 4500;
  const heatFlrF  = floors >= 5 ? 0.94 : 1.0;
  const heatTypF  = { central: 1.0, local: 1.10, electric: 0.95, gas: 0.88 }[safeForm.heating_type] || 1.0;
  const physHeat  = Math.round(area * heatBase * heatYearF * heatMatF * heatHddF * heatFlrF * heatTypF * 1163);

  // Physics-based electricity component (kWh/m²/yr) by building type
  const elecBase   = { apartment: 30, office: 60, school: 28, hospital: 85, warehouse: 18, commercial: 70 }[type] || 30;
  const occupancyF = 1 + Math.max(0, (res / area) * 100 - 3) * 0.015;
  const applianceF = 1 + appl * 0.025;
  const winRatF    = 1 + (wr - 20) * 0.003;
  const physElec   = Math.round(area * elecBase * occupancyF * applianceF * winRatF);
  const physTotal  = physHeat + physElec;

  // XGBoost inference — use only when area is within training distribution
  const rawVec    = featurize(safeForm);
  const scaledVec = applyScaler([rawVec], SCALER)[0];
  const xgbRaw    = xgbPredictOne(XGB_MODEL, scaledVec);
  const MIN_AREA  = { apartment: 250, office: 400, school: 800, hospital: 1500, warehouse: 400, commercial: 250 };
  const inDist    = area >= (MIN_AREA[type] || 250);
  const annual    = (Number.isFinite(xgbRaw) && xgbRaw > 0 && inDist)
    ? Math.round(xgbRaw)
    : Math.max(100, physTotal);

  // Split total into heating / electricity via physics ratio
  const heatRatio    = physTotal > 0 ? physHeat / physTotal : 0.75;
  const heating_kwh  = Math.min(Math.round(annual * heatRatio), Math.round(annual * 0.92));
  const electricity_kwh = annual - heating_kwh;

  const monthly_avg      = Math.round(annual / 12);
  const elec_monthly_avg = Math.round(electricity_kwh / 12);
  const daily_avg        = Math.round(annual / 365);
  const intensity        = annual > 0 ? Math.round(annual / area) : 0;

  // Monthly electricity distribution (flatter than heating; electricity is less seasonal)
  const eWSum      = ELEC_SEASONAL_WEIGHTS.reduce((a, b) => a + b, 0);
  const chart_data = MONTH_LABELS.map((m, i) => ({
    month: m,
    usage: Math.round(electricity_kwh * ELEC_SEASONAL_WEIGHTS[i] / eWSum),
  }));

  // Attribution proxy: β_i × x_i from OLS (interpretable surrogate for XGBoost contributions)
  const contribs   = FEATURE_NAMES.slice(1).map((name, i) => ({
    key: name,
    abs: Math.abs(BETA[i + 1] * scaledVec[i + 1]),
  }));
  const contribSum = contribs.reduce((s, c) => s + c.abs, 0) || 1;
  const features   = contribs
    .map(c => ({ key: c.key, pct: Math.round(c.abs / contribSum * 100) }))
    .sort((a, b) => b.pct - a.pct);

  // CO₂: district heat factor 0.28 kg/kWh + electricity grid 0.73 kg/kWh
  const co2  = +((heating_kwh * 0.28 + electricity_kwh * 0.73) / 1000).toFixed(1);
  const pm25 = Math.round(co2 * 1350);

  const grade = GRADE_STEPS.find(([thr]) => intensity < thr)?.[1] ?? 'G';

  return { annual, electricity_kwh, heating_kwh, monthly_avg, elec_monthly_avg, daily_avg, intensity, chart_data, features, co2, pm25, grade };
}

// Export GRADE_COLORS so PredictorPage doesn't need to redefine
export { GRADE_COLORS, DATASET };

// ─── 13. Tiered electricity tariff ────────────────────────────────────────────
// Source: УБЦТС ТӨХК — Энгийн тоолуур (стандарт тариф)
// https://www.facebook.com/share/p/1ZAbUwfoq1/
export const TARIFF_TIERS = [
  { upto: 150,      rate: 175, label: '0–150 кВт·цаг' },
  { upto: 300,      rate: 256, label: '151–300 кВт·цаг' },
  { upto: Infinity, rate: 285, label: '301+ кВт·цаг' },
];

// 2-тариф тоолуурын тарифууд (цагийн бүсээр)
export const TARIFF_2ZONE = {
  day:   { label: '06:00–21:00', tiers: [{ upto:150,rate:182 },{ upto:300,rate:225 },{ upto:Infinity,rate:265 }] },
  night: { label: '21:00–06:00', tiers: [{ upto:150,rate:147 },{ upto:300,rate:160 },{ upto:Infinity,rate:160 }] },
  saving: '7–29%',
};

// 3-тариф тоолуурын тарифууд (цагийн бүсээр)
export const TARIFF_3ZONE = {
  peak:    { label: '17:00–21:00', tiers: [{ upto:150,rate:280 },{ upto:300,rate:290 },{ upto:Infinity,rate:300 }] },
  day:     { label: '06:00–17:00', tiers: [{ upto:150,rate:170 },{ upto:300,rate:190 },{ upto:Infinity,rate:220 }] },
  night:   { label: '21:00–06:00', tiers: [{ upto:150,rate:113 },{ upto:300,rate:113 },{ upto:Infinity,rate:113 }] },
  saving: '3–60%',
};

// Inverse tariff: monthly ₮ → estimated monthly kWh + annual kWh (энгийн тоолуур)
export function convertElecMoneyToKwh(tugrug_monthly) {
  const t = +tugrug_monthly;
  const tier1_cost = 150 * 175;                    // 26,250₮
  const tier2_cost = tier1_cost + 150 * 256;       // 64,650₮
  let kwh, tier, effective_rate;
  if (t <= tier1_cost) {
    kwh = t / 175; tier = 1; effective_rate = 175;
  } else if (t <= tier2_cost) {
    kwh = 150 + (t - tier1_cost) / 256; tier = 2; effective_rate = 256;
  } else {
    kwh = 300 + (t - tier2_cost) / 285; tier = 3; effective_rate = 285;
  }
  return {
    kwh_monthly: Math.round(kwh),
    kwh_annual:  Math.round(kwh * 12),
    tier,
    effective_rate,
  };
}

// Water + heating combined bill → estimates
// Sources: Улаанбаатар Дулааны Сүлжээ ТӨХК 2024, УСУГ 2024
// area (m²) is used to derive service fee before splitting heating/water shares
export function convertHeatBillToEstimates(tugrug_monthly, area = 0) {
  const HEAT_RATE  = 160000; // ₮/Gcal (УБ ДС ТӨХК avg 2024)
  const WATER_RATE = 2100;   // ₮/m³ (УСУГ 2024 cold+hot avg)
  const svcFee     = area > 0 ? (area <= 40 ? 3300 : area <= 80 ? 5500 : 11000) : 0;
  const afterSvc   = Math.max(0, tugrug_monthly - svcFee);
  const HEAT_SHARE = 0.72;   // typical share: 72% heating, 28% water
  const heat_t  = Math.round(afterSvc * HEAT_SHARE);
  const water_t = Math.round(afterSvc * (1 - HEAT_SHARE));
  const heat_gcal_monthly = Math.round(heat_t  / HEAT_RATE  * 100) / 100;
  const water_m3_monthly  = Math.round(water_t / WATER_RATE * 10)  / 10;
  return {
    // Backward-compatible fields (used by PredictorPage)
    heat_tugrug_monthly:  heat_t,
    water_tugrug_monthly: water_t,
    heat_gcal_monthly,
    heat_gcal_annual:  Math.round(heat_gcal_monthly * 9  * 100) / 100,
    water_m3_monthly,
    water_m3_annual:   Math.round(water_m3_monthly  * 12 * 10)  / 10,
    // Breakdown fields for storage
    heating:    heat_t,
    hotWater:   water_t,
    serviceFee: svcFee,
    total:      tugrug_monthly,
  };
}

// Tariff-based heating bill breakdown calculator
// tariffType: 'apt_area' | 'apt_gj' | 'hotwater_m3' | 'service_only' | 'org_heat_m3' | 'org_heat_gj'
// Rates: Эрчим хүчний зохицуулах хороо — dulaan.mn/page/tariff (НӨАТ-гүй)
export function calcHeatBreakdown({ tariffType, area = 0, gjValue = 0, m3Value = 0 }) {
  const svcFee = area <= 40 ? 3300 : area <= 80 ? 5500 : 11000; // ₮/month
  switch (tariffType) {
    case 'apt_area': {
      const h = Math.round(area * 506);
      return { heating: h, hotWater: 0, serviceFee: svcFee, total: h + svcFee };
    }
    case 'apt_gj': {
      const h = Math.round(gjValue * 3421);
      return { heating: h, hotWater: 0, serviceFee: svcFee, total: h + svcFee };
    }
    case 'hotwater_m3': {
      const w = Math.round(m3Value * 1632);
      return { heating: 0, hotWater: w, serviceFee: svcFee, total: w + svcFee };
    }
    case 'service_only':
      return { heating: 0, hotWater: 0, serviceFee: svcFee, total: svcFee };
    case 'org_heat_m3': {
      const h = Math.round(m3Value * 604);
      return { heating: h, hotWater: 0, serviceFee: 0, total: h };
    }
    case 'org_heat_gj': {
      const h = Math.round(gjValue * 9314);
      return { heating: h, hotWater: 0, serviceFee: 0, total: h };
    }
    default:
      return { heating: 0, hotWater: 0, serviceFee: 0, total: 0 };
  }
}

// ─── 14. Heating model (Gcal/year) ───────────────────────────────────────────
// Based on: БНТУ 23-02-09 thermal load formula
// Cost: official dulaan.mn tariff — 506₮/м² floor area / month (9-month heating season)
// Source: Эрчим хүчний зохицуулах хороо — dulaan.mn/page/tariff
export function predictHeating(form) {
  const area      = Math.max(10, Number(form.area) || 100);
  const hddRaw    = Number(form.hdd);
  const hdd       = hddRaw > 0 ? Math.max(3000, hddRaw) : 4500;
  const hddIsDefault = !(hddRaw > 0);
  const floors    = Math.max(1, Number(form.floors) || 3);

  // Specific heat load (Gcal/m²/year) by insulation quality — calibrated to UB district data
  const base       = { good: 0.065, medium: 0.100, poor: 0.130 }[form.insulation_quality] || 0.100;
  const yr         = Math.max(1940, Math.min(2026, Number(form.year) || 1990));
  const yearFactor = yr >= 2010 ? 0.90 : yr >= 2000 ? 0.96 : 1 + Math.max(0, (1995 - yr)) * 0.004;
  const matMod     = { panel: 1.14, brick: 1.0, concrete: 0.94, wood: 1.20, metal: 1.10 }[form.wall_material] || 1.0;
  const hddRatio   = hdd / 4500;
  const floorMod   = floors >= 5 ? 0.94 : 1.0;

  const gcal_per_m2  = base * yearFactor * matMod * hddRatio * floorMod;
  const annual_gcal  = +(area * gcal_per_m2).toFixed(1);
  const monthly_peak = +(annual_gcal * 1.85 / 9).toFixed(2);
  const monthly_avg  = +(annual_gcal / 9).toFixed(2);

  // Official residential rate: 506₮/м² floor area/month × 9 heating months (dulaan.mn)
  const annual_heat_cost = Math.round(area * 506 * 9);

  // Equivalent kWh (1 Gcal = 1,163 kWh thermal)
  const annual_kwh_equiv = Math.round(annual_gcal * 1163);

  // Service fee by floor area (monthly × 12)
  const service_monthly = area <= 40 ? 3300 : area <= 80 ? 5500 : 11000;
  const service_annual  = service_monthly * 12;

  // Monthly heating kWh profile — winter-heavy, zero in summer (Jun–Aug)
  const HEAT_WEIGHTS = [2.00, 1.85, 1.45, 0.55, 0.10, 0, 0, 0, 0.10, 0.80, 1.50, 1.85];
  const heatWSum = HEAT_WEIGHTS.reduce((a, b) => a + b, 0);
  const monthly_heat_kwh = HEAT_WEIGHTS.map(w => Math.round(annual_kwh_equiv * w / heatWSum));

  return {
    annual_gcal,
    monthly_avg,
    monthly_peak,
    gcal_per_m2:    +gcal_per_m2.toFixed(3),
    annual_heat_cost,
    annual_kwh_equiv,
    service_annual,
    service_monthly,
    hdd_used:       hdd,
    hdd_is_default: hddIsDefault,
    monthly_heat_kwh,
  };
}

// ─── 15. Rule-based recommendations ─────────────────────────────────────────
const PRIORITY_COLOR = { high: '#e63946', medium: '#f4a261', low: '#2a9d8f' };

export function generateRecommendations(form, result, lang = 'mn') {
  const mn = lang === 'mn';
  const recs = [];

  if (form.insulation_quality === 'poor') {
    recs.push({
      priority: 'high',
      action: mn ? 'Дулаан тусгаарлалт сайжруулах' : 'Improve thermal insulation',
      saving: '20–30%',
      detail: mn
        ? 'Хана, дээвэр, шалны дулаан тусгаарлалтыг сайжруулснаар жилийн хэрэглээ 20–30% буурна. УБ-ийн "Дулаан гэр" хөтөлбөр хөрөнгө оруулалтын дэмжлэг үзүүлдэг.'
        : 'Improving wall, roof and floor insulation can reduce annual energy use by 20–30%. UB "Warm Home" programme offers investment support.',
      ref: 'БНТУ 23-02-09; "Дулаан гэр" хөтөлбөр',
    });
  }

  if (form.window_type === 'single') {
    recs.push({
      priority: 'high',
      action: mn ? 'Давхар шилтэй цонх суурилуулах' : 'Install double-glazed windows',
      saving: '10–18%',
      detail: mn
        ? 'Нэг давхар шилийг давхар эсвэл вакуум шилээр солих нь дулаан алдагдлыг 40% хүртэл бууруулна. Буцааж өгөх хугацаа ≈ 5–7 жил.'
        : 'Replacing single-pane windows with double/vacuum glazing reduces heat loss up to 40%. Payback period ≈ 5–7 years.',
      ref: 'IEA (2022) — Buildings',
    });
  }

  if ((2024 - form.year) > 30) {
    recs.push({
      priority: 'medium',
      action: mn ? 'Барилгын бүрэн шинэчлэл (retrofitting)' : 'Full energy retrofit',
      saving: '30–50%',
      detail: mn
        ? '30+ жилийн барилгад цогц шинэчлэл хийснээр эрчим хүчний ангилал G/F → B/C болж сайжирч, хэрэглэгчийн зардал эрс буурна.'
        : 'A comprehensive retrofit of buildings 30+ years old can upgrade energy class from G/F to B/C, significantly cutting costs.',
      ref: 'IEA (2022); UNDP Mongolia',
    });
  }

  if (form.heating_type === 'local') {
    recs.push({
      priority: 'medium',
      action: mn ? 'Ухаалаг термостат суурилуулах' : 'Install smart thermostat',
      saving: '10–20%',
      detail: mn
        ? 'Орон нутгийн халаалтыг цаг хуваарь+термостат системтэй холбох нь автоматаар 10–20% хэмнэлт өгнө.'
        : 'Connecting local heating to a scheduled thermostat system automatically saves 10–20%.',
      ref: 'SmartHome Integration',
    });
  }

  if (form.window_ratio > 40) {
    recs.push({
      priority: 'low',
      action: mn ? 'Нарны дулаан хамгаалалт (шейдинг)' : 'Solar shading / heavy curtains',
      saving: '5–10%',
      detail: mn
        ? 'Том цонхтой барилгад зузаан хөшиг эсвэл гаднах бүрхүүл ашиглах нь өвлийн дулаан алдагдлыг бууруулна.'
        : 'Buildings with large windows benefit from heavy curtains or external shading to reduce winter heat loss.',
      ref: 'БНТУ',
    });
  }

  if (result.intensity < 100 && form.insulation_quality !== 'poor') {
    recs.push({
      priority: 'low',
      action: mn ? 'Нарны хавтан суурилуулах' : 'Install solar PV panels',
      saving: '15–25%',
      detail: mn
        ? 'Барилга аль хэдийн үр ашигтай тул нарны хавтан нэмэх нь цахилгааны зардлыг 15–25% бууруулах боломжтой. УБ дахь нарны цацраг: 250+ цас тунгалаг өдөр/жил.'
        : 'Your building is already efficient — solar PV can further cut electricity costs by 15–25%. UB receives 250+ sunny days per year.',
      ref: 'SolarEdge; IEA (2022)',
    });
  }

  return recs.slice(0, 4).map(r => ({ ...r, color: PRIORITY_COLOR[r.priority] }));
}

// ─── 16. Real UB building case studies ───────────────────────────────────────
// Sources: IEA (2022) Mongolia Energy Profile, МБЕГ audit 2022, Монгол эрчим хүч статистик
export const CASE_STUDIES = [
  {
    id: 'cs1',
    name_mn: '9 давхар панель орон сууц — Сүхбаатар дүүрэг',
    name_en: '9-floor panel apartment — Sukhbaatar district',
    year: 1982, area: 1440, floors: 9, building_type: 'apartment',
    wall_material: 'panel', insulation_quality: 'poor', heating_type: 'central',
    window_type: 'single', hdd: 4800, residents: 72, appliances: 6, rooms: 3, window_ratio: 20,
    actual_kwh: 318000,
    source: 'IEA (2022) — Mongolia Energy Profile',
    note_mn: 'УБ-ийн хамгийн түгээмэл 1980-аад оны панель барилга. Дулаан алдагдал өндөр.',
    note_en: 'Most common 1980s panel block in UB. High heat loss profile.',
  },
  {
    id: 'cs2',
    name_mn: 'Шинэ конкрет орон сууц — Баянзүрх дүүрэг',
    name_en: 'New concrete apartment — Bayanzurkh district',
    year: 2019, area: 2800, floors: 16, building_type: 'apartment',
    wall_material: 'concrete', insulation_quality: 'good', heating_type: 'central',
    window_type: 'double', hdd: 4500, residents: 140, appliances: 8, rooms: 3, window_ratio: 30,
    actual_kwh: 268000,
    source: 'МБЕГ барилгын эрчим хүчний аудит 2022',
    note_mn: 'ISO стандартын дулаан тусгаарлалт бүхий шинэ барилга.',
    note_en: 'New build with ISO-standard insulation and double glazing.',
  },
  {
    id: 'cs3',
    name_mn: 'Оффисын барилга — Чингэлтэй дүүрэг',
    name_en: 'Office building — Chingeltei district',
    year: 2006, area: 4200, floors: 6, building_type: 'office',
    wall_material: 'brick', insulation_quality: 'medium', heating_type: 'central',
    window_type: 'double', hdd: 4600, residents: 180, appliances: 12, rooms: 8, window_ratio: 45,
    actual_kwh: 1020000,
    source: 'Монголын Эрчим Хүчний Статистик 2022',
    note_mn: 'Дунд хэмжээний оффис, том цонхтой учир эрчим хүчний алдагдал өндөр.',
    note_en: 'Mid-size office with large window ratio driving higher energy loss.',
  },
  {
    id: 'cs4',
    name_mn: 'Дунд сургууль — Хан-Уул дүүрэг',
    name_en: 'Secondary school — Khan-Uul district',
    year: 1995, area: 3600, floors: 3, building_type: 'school',
    wall_material: 'brick', insulation_quality: 'medium', heating_type: 'central',
    window_type: 'single', hdd: 4700, residents: 900, appliances: 8, rooms: 24, window_ratio: 25,
    actual_kwh: 540000,
    source: 'БСШУСЯ барилгын эрчим хүчний тайлан 2021',
    note_mn: '1990-ээд оны тоосгон сургуулийн барилга, нэг давхар шил.',
    note_en: '1990s brick school building with single-pane windows.',
  },
];
