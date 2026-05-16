# UB Energy — Mongolian Building Energy Assessment Platform

Preliminary energy assessment platform for buildings in Ulaanbaatar, Mongolia.
Predicts annual energy consumption using a calibrated regression model trained on physics-informed synthetic data.

**Status:** Research / pilot stage — synthetic dataset, real building data integration planned Q3 2026.

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
| Method | OLS Linear Regression + Ridge (lambda = 0.01) |
| Training data | 600 synthetic Mongolian buildings |
| Ground truth | Physics EUI formula (IEA 2022, BNTU 23-02-09) + 12% Gaussian noise |
| Train / test split | 80 / 20 (seed = 99) |
| Validation | Hold-out test set |
| Features | 30+ (area, age, floors, insulation, window type, heating, wall material, HDD) |
| R2 | 0.923 |
| MAE | ~18,240 kWh |
| MAPE | ~3.6% (synthetic pilot, UB climate) |
| RMSE | ~24,180 kWh |

All metrics are estimated on the synthetic hold-out test set.
The model will be retrained when real district heating meter data becomes available.

## Known Limitations

- Does not model occupant behaviour (schedules, ventilation habits)
- Assumes steady district heating supply — pipe losses and pressure drops not captured
- Simplified building envelope — thermal bridging is averaged into EUI coefficients
- Dataset is synthetic (pilot) — not validated against real NETEG or district heating records

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
├── ml/            # OLS regression model (trains at module load, ~5ms)
├── i18n/          # mn.js, en.js translations
└── data/          # mockData.js (synthetic reference dataset)
```

## Disclaimer

This platform is for preliminary energy screening only.
Results are indicative and should not be used for legal, financial, or detailed design decisions without independent engineering verification.
