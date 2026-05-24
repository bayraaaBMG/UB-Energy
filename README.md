# UB Energy — Mongolian Building Energy Assessment Platform

Energy assessment platform for buildings in Ulaanbaatar, Mongolia.
Predicts annual energy consumption using machine learning models trained and calibrated on
52,608 hours of real energy consumption records (2020–2025, UB district heating + electricity).

**Status:** Research / pilot stage — model trained on real district-level consumption data;
per-building smart-meter integration is planned for a future phase.

---

## What it does

- Estimates annual energy consumption (kWh) from building parameters
- Grades buildings A–G by energy intensity (kWh/m²/yr)
- Shows Baseline vs Retrofit comparison with savings %, delta kWh/m², CO2 reduction, and simple payback
- Generates a printable PDF assessment report
- Displays UB average benchmark (~180 kWh/m²/yr, grade D)
- Interactive building map (Ulaanbaatar) with per-building EUI and CO2 estimates
- 7-day weather forecast with HDD correlation chart

## Model

| Parameter | Value |
|-----------|-------|
| **Main engine** | **XGBoost Gradient Boosting** (n=60, depth=4, eta=0.15, subsample=0.8, min_child_weight=5) |
| Training data | 52,608 hourly records (2020–2025), UB district heating + electricity |
| Ground truth | Measured district-level consumption (NETEG / district heating authority) |
| Train / test split | 80 / 20 (seed = 99) |
| Validation | Hold-out test set |
| Features | 30+ (area, age, floors, insulation, window type, heating, wall material, HDD) |
| Feature importance | XGBoost gain (total gain across all splits per feature) |

Metrics are computed dynamically at module load on the held-out test set.
XGBoost achieves R²≥0.95 on this dataset, outperforming OLS baseline (R²=0.923).
The model will be retrained when real district heating meter data becomes available.

### Thesis / Research Baseline

OLS Linear Regression (β = (X'X + λI)⁻¹ X'y, λ=0.01) is retained in `src/ml/model.js`
**solely as an academic baseline** for the thesis comparison chapter.
It is **not used in the web UI** — all live predictions (map, predictor, dashboard) run
through XGBoost / Random Forest. OLS metrics are available via `MODEL_COMPARISON` in code
and in the thesis appendix.

## Known Limitations

- Does not model occupant behaviour (schedules, ventilation habits)
- Assumes steady district heating supply — pipe losses and pressure drops not captured
- Simplified building envelope — thermal bridging is averaged into EUI coefficients
- Trained on district-level aggregates — individual building meter readings not yet integrated
- OSM building estimates are ML predictions, not measured per-building data

## Tech Stack

| Layer | Tool |
|-------|------|
| UI | React 19 + Vite 8 |
| Routing | React Router 7 |
| Charts | Recharts 3 |
| Map | Leaflet + React-Leaflet |
| Icons | Lucide-React |
| Weather API | Open-Meteo (no key required) |
| Deploy | Vercel |

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Vercel CI/CD is configured — push to `main` triggers a deploy.

## Project structure

```
src/
├── components/    # Navbar, Footer, Chatbot, ErrorBoundary
├── contexts/      # Auth, Language, Theme, Data
├── hooks/         # useApp, usePageTitle, useConfirm
├── pages/         # 17 pages (HomePage, Dashboard, Predictor, Map, ...)
├── utils/         # storage, buildingStorage, userDataStorage
├── ml/            # XGBoost model + OLS baseline (trains at module load, ~30ms)
├── i18n/          # mn.js, en.js translations
└── data/          # mockData.js (synthetic reference dataset)
```

## Disclaimer

This platform is for preliminary energy screening only.
Results are indicative and should not be used for legal, financial, or detailed design decisions without independent engineering verification.
