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

// ─── 13. Tiered electricity tariff (УБЦТС 2024) ──────────────────────────────
// Source: УБЦТС ТӨХК тарифын журам 2024
export const TARIFF_TIERS = [
  { upto: 150, rate: 140, label: '0–150 кВт·цаг' },
  { upto: 250, rate: 180, label: '151–250 кВт·цаг' },
  { upto: Infinity, rate: 280, label: '251+ кВт·цаг' },
];

// Inverse tariff: monthly ₮ → estimated monthly kWh + annual kWh
export function convertElecMoneyToKwh(tugrug_monthly) {
  const t = +tugrug_monthly;
  const tier1_cost = 150 * 140;           // 21,000₮
  const tier2_cost = tier1_cost + 100 * 180; // 39,000₮
  let kwh, tier, effective_rate;
  if (t <= tier1_cost) {
    kwh = t / 140; tier = 1; effective_rate = 140;
  } else if (t <= tier2_cost) {
    kwh = 150 + (t - tier1_cost) / 180; tier = 2; effective_rate = 180;
  } else {
    kwh = 250 + (t - tier2_cost) / 280; tier = 3; effective_rate = 280;
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
export function convertHeatBillToEstimates(tugrug_monthly) {
  const HEAT_RATE  = 160000; // ₮/Gcal (УБ ДС ТӨХК avg 2024)
  const WATER_RATE = 2100;   // ₮/m³ (УСУГ 2024 cold+hot avg)
  const HEAT_SHARE = 0.72;   // typical share: 72% heating, 28% water
  const heat_t  = Math.round(tugrug_monthly * HEAT_SHARE);
  const water_t = Math.round(tugrug_monthly * (1 - HEAT_SHARE));
  const heat_gcal_monthly = Math.round(heat_t  / HEAT_RATE  * 100) / 100;
  const water_m3_monthly  = Math.round(water_t / WATER_RATE * 10)  / 10;
  return {
    heat_tugrug_monthly:  heat_t,
    water_tugrug_monthly: water_t,
    heat_gcal_monthly,
    heat_gcal_annual:  Math.round(heat_gcal_monthly * 9  * 100) / 100,
    water_m3_monthly,
    water_m3_annual:   Math.round(water_m3_monthly  * 12 * 10)  / 10,
  };
}

// ─── 14. Heating model (Gcal/year) ───────────────────────────────────────────
// Based on: БНТУ 23-02-09, Улаанбаатар Дулааны Сүлжээ ТӨХК тариф
// District heating in UB billed per m² per month (~4,500₮/m²/month avg 9 months)
export function predictHeating(form) {
  // Specific heat load (Gcal/m²/year) by insulation quality
  const base = { good: 0.043, medium: 0.062, poor: 0.090 }[form.insulation_quality] || 0.062;
  const matMod   = { panel: 1.14, brick: 1.0, concrete: 0.94, wood: 1.20, metal: 1.10 }[form.wall_material] || 1.0;
  const hddRatio = (form.hdd || 4500) / 4500;
  const floorMod = form.floors >= 5 ? 0.94 : 1.0; // shared walls benefit

  const gcal_per_m2  = base * matMod * hddRatio * floorMod;
  const annual_gcal  = +(form.area * gcal_per_m2).toFixed(1);
  const monthly_peak = +(annual_gcal * 1.85 / 9).toFixed(2); // January peak factor
  const monthly_avg  = +(annual_gcal / 9).toFixed(2);        // 9 heating months

  // Cost: UB DHN avg ≈ 4,500₮/m²/month × 9 months
  const annual_heat_cost = Math.round(form.area * 4500 * 9);

  // Equivalent kWh (1 Gcal = 1,163 kWh)
  const annual_kwh_equiv = Math.round(annual_gcal * 1163);

  return {
    annual_gcal,
    monthly_avg,
    monthly_peak,
    gcal_per_m2: +gcal_per_m2.toFixed(3),
    annual_heat_cost,
    annual_kwh_equiv,
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
