# UB-Energy — Улаанбаатарын барилгын эрчим хүчний платформ

Монголын барилгуудын эрчим хүчний хэрэглээг урьдчилан таамаглаж, харьцуулж, дүн шинжилгээ хийх вэб платформ.

## Онцлог

- **ML загвар** — OLS regression, R² ≈ 0.96, 30 орцтой
- **Интерактив газрын зураг** — Leaflet + OpenStreetMap OSM дата
- **Цаг агаар** — Цаг агаарын урьдчилсан мэдээ + HDD тооцоолол
- **Dashboard** — Recharts ашиглан барилгын эрчим хүчний дүрслэл
- **Хэрэглэгчийн систем** — Бүртгэл, нэвтрэлт, өөрийн орон зай
- **Олон хэл** — Монгол / Англи
- **Хүртээмж** — WCAG 2.1 AA, өндөр контраст, хэмжээ тохируулга

## Технологи

| Хэсэг | Хэрэгсэл |
|-------|----------|
| UI Framework | React 19 + Vite 8 |
| Routing | React Router 7 |
| Charts | Recharts 3 |
| Map | Leaflet + React-Leaflet |
| 3D | Three.js + React Three Fiber |
| Icons | Lucide-React |
| Deploy | Vercel |

## Хөгжүүлэлт

```bash
npm install
npm run dev
```

## Байршуулах

```bash
npm run build
```

Vercel дээр автоматаар CI/CD тохируулагдсан байна.

## Бүтэц

```
src/
├── components/    # Navbar, Footer, Chatbot, ErrorBoundary, Building3D
├── contexts/      # Auth, Language, Theme
├── hooks/         # useApp, usePageTitle, useConfirm
├── pages/         # 17 хуудас
├── utils/         # storage, buildingStorage, userDataStorage
├── ml/            # OLS regression загвар
├── i18n/          # mn.js, en.js орчуулга
└── data/          # mockData.js
```
