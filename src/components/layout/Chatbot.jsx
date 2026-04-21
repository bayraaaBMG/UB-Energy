import { useState, useRef, useEffect } from "react";
import {
  MessageCircle, X, Send, Bot, User, Trash2, BookOpen,
  Zap, ThermometerSun, BarChart2, Leaf, Home, HelpCircle,
  ChevronDown, Copy, Check,
} from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { APP_NAME } from "../../config/constants";
import "./Chatbot.css";

// ─── Knowledge Base ───────────────────────────────────────────────────────────
const KB = [
  {
    keys: ["сайн байна уу", "сайн уу", "hello", "hi", "сайхан", "хэлнэ үү", "танилцуулна уу"],
    mn: `Сайн байна уу! Би **UB Energy AI** туслагч. Дараах сэдвүүдээр дэлгэрэнгүй, эх сурвалжтай хариулт өгнө:\n\n• Цахилгаан, дулаан, усны тариф\n• Барилгын эрчим хүчний норматив (БНТУ)\n• HDD, EUI, CO₂ тооцоолол\n• ML загвар, OLS regression\n• Smart Home, нарны эрчим хүч\n• Монголын цаг уур, агаарын чанар\n\nЮу асуухыг хүсэж байна вэ?`,
    en: `Hello! I'm the **UB Energy AI** assistant. I can answer questions with sources on:\n\n• Electricity, heating & water tariffs\n• Building energy standards (БНТУ)\n• HDD, EUI, CO₂ calculations\n• ML model & OLS regression\n• Smart Home, solar energy\n• Mongolian climate & air quality\n\nWhat would you like to know?`,
    sources: [],
  },
  {
    keys: ["чи хэн", "who are you", "юу хийдэг вэ", "хэн бэ"],
    mn: `Би **UB Energy AI** — Улаанбаатар хотын барилгын эрчим хүчний платформын туслагч систем. Монгол болон олон улсын стандарт, тариф, норматив дээр суурилсан эх сурвалжтай хариулт өгдөг.`,
    en: `I'm **UB Energy AI** — the assistant for Ulaanbaatar's building energy platform. I provide source-backed answers based on Mongolian and international energy standards, tariffs, and norms.`,
    sources: [],
  },
  {
    keys: ["цахилгааны тариф", "electricity tariff", "140", "180", "280", "цахилгааны үнэ", "кВт·цаг үнэ", "цахилгаан хэдэн", "тарифын шат"],
    mn: `Улаанбаатар хотын айлын цахилгааны тариф **шаталсан систем**тэй:\n\n| Шат | Хэмжээ (кВт·цаг/сар) | Үнэ (₮/кВт·цаг) |\n|-----|----------------------|------------------|\n| 1-р шат | 0–150 | **140₮** |\n| 2-р шат | 151–250 | **180₮** |\n| 3-р шат | 251+ | **280₮** |\n\nЖишээ: 200 кВт·цаг/сар хэрэглэвэл:\n150×140 + 50×180 = 21,000 + 9,000 = **30,000₮**`,
    en: `Ulaanbaatar household electricity uses a **tiered tariff**:\n\n| Tier | Usage (kWh/month) | Price (₮/kWh) |\n|------|-------------------|---------------|\n| Tier 1 | 0–150 | **140₮** |\n| Tier 2 | 151–250 | **180₮** |\n| Tier 3 | 251+ | **280₮** |\n\nExample: 200 kWh/month:\n150×140 + 50×180 = 21,000 + 9,000 = **30,000₮**`,
    sources: ["УБЦТС ТӨХК тарифын журам 2024", "ЭЗХ тогтоол №A/205"],
  },
  {
    keys: ["дулааны тариф", "heating tariff", "дулааны үнэ", "гкал", "gcal", "дулаан хэдэн", "халаалтын төлбөр"],
    mn: `Улаанбаатарын дулааны тариф:\n\n• **УБ Дулааны Сүлжээ:** 1 Гкал ≈ **150,000–180,000₮**\n• Айлын байрны дундаж: **3,500–5,500₮/м²/сар** (халааны улиралд)\n• Халааны улирал: **9 сар** (10-р — 6-р сар)\n• Жилийн дулааны зардал: 60м² айл ≈ **1.8–3.0 сая₮**\n\nТооцоолол: Дулаан(Гкал) = Мөнгө × 72% ÷ 160,000₮`,
    en: `Ulaanbaatar district heating tariff:\n\n• **UB Heating Network:** 1 Gcal ≈ **150,000–180,000₮**\n• Apartment average: **3,500–5,500₮/m²/month** (heating season)\n• Heating season: **9 months** (October–June)\n• Annual cost for 60m² apt ≈ **1.8–3.0M₮**\n\nFormula: Heating(Gcal) = Bill × 72% ÷ 160,000₮`,
    sources: ["Улаанбаатар Дулааны Сүлжээ ТӨХК тарифын журам 2024", "ЭЗХ тогтоол №A/156"],
  },
  {
    keys: ["усны тариф", "water tariff", "усны үнэ", "усуг", "халуун ус", "хүйтэн ус", "м³ үнэ"],
    mn: `Улаанбаатарын усны тариф (УСУГ 2024):\n\n| Төрөл | Үнэ (₮/м³) |\n|-------|------------|\n| Хүйтэн ус | 800–1,200₮ |\n| Халуун ус | 2,000–3,200₮ |\n| Дундаж (хосолсон) | ~2,100₮ |\n\nЖишээ: Сард 15м³ хэрэглэвэл ≈ **31,500₮**\n\nТооцоолол: Ус(м³) = Мөнгө × 28% ÷ 2,100₮`,
    en: `Ulaanbaatar water tariffs (УСУГ 2024):\n\n| Type | Price (₮/m³) |\n|------|-------------|\n| Cold water | 800–1,200₮ |\n| Hot water | 2,000–3,200₮ |\n| Combined avg | ~2,100₮ |\n\nExample: 15m³/month ≈ **31,500₮**\n\nFormula: Water(m³) = Bill × 28% ÷ 2,100₮`,
    sources: ["УСУГ тарифын журам 2024", "ЭЗХ тогтоол №A/178"],
  },
  {
    keys: ["hdd", "heating degree", "халааны зэрэг өдөр", "degree day"],
    mn: `**HDD (Heating Degree Days)** — халааны шаардлагыг хэмждэг үзүүлэлт:\n\nТомьёо: HDD = Σ max(0, 18°C − T_өдрийн дундаж)\n\nУлаанбаатарын HDD:\n\n| Сар | HDD | Онцлог |\n|-----|-----|--------|\n| 1-р | ~900 | Оргил |\n| 7-р | ~0 | Хамгийн бага |\n| **Жилийн нийт** | **4,500–5,200** | — |\n\nДэлхийн харьцуулалт:\n• Москва: ~5,000 / Берлин: ~3,200 / Лондон: ~2,500\n\nHDD 10%-иар өсвөл эрчим хүчний хэрэглээ **7–12%** нэмэгддэг.`,
    en: `**HDD (Heating Degree Days)** measures cumulative heating demand:\n\nFormula: HDD = Σ max(0, 18°C − T_daily_avg)\n\nUlaanbaatar HDD:\n\n| Month | HDD | Note |\n|-------|-----|------|\n| January | ~900 | Peak |\n| July | ~0 | Minimum |\n| **Annual total** | **4,500–5,200** | — |\n\nComparison: Moscow ~5,000 / Berlin ~3,200 / London ~2,500\n\nA 10% HDD increase raises energy use by **7–12%**.`,
    sources: ["БНТУ 23-02-09 Барилгын дулааны хамгаалалт", "IEA Buildings 2022", "Khan et al. (2019)"],
  },
  {
    keys: ["eui", "energy use intensity", "эрчим хүчний эрчимшил", "кВт·цаг/м²", "kwh/m²"],
    mn: `**EUI (Energy Use Intensity)** — нэгж талбайн эрчим хүчний хэрэглээ:\n\nНэгж: кВт·цаг/м²/жил\n\n| Зэрэглэл | EUI (кВт·цаг/м²/жил) |\n|----------|----------------------|\n| **A** | < 120 |\n| **B** | 120–150 |\n| **C** | 150–175 |\n| **D** | 175–210 |\n| **E** | 210–260 |\n| **F** | 260–320 |\n| **G** | > 320 |\n\nЖишээ EUI:\n• Шинэ орон сууц (2020+): 110–140\n• Панельн байр (1970-80): 220–350`,
    en: `**EUI (Energy Use Intensity)** — energy per unit floor area:\n\nUnit: kWh/m²/year\n\n| Grade | EUI (kWh/m²/yr) |\n|-------|----------------|\n| **A** | < 120 |\n| **B** | 120–150 |\n| **C** | 150–175 |\n| **D** | 175–210 |\n| **E** | 210–260 |\n| **F** | 260–320 |\n| **G** | > 320 |\n\nExamples: New apt (2020+): 110–140 / Panel block (1970s): 220–350`,
    sources: ["БНТУ 23-02-09", "IEA Buildings Energy Efficiency 2022", "ЭЗХ тайлан 2023"],
  },
  {
    keys: ["co2", "co₂", "нүүрстөрөгч", "carbon", "ялгаруулалт", "greenhouse", "хүлэмжийн хий"],
    mn: `**CO₂ ялгаруулалт** — барилга, эрчим хүч:\n\nМонгол Улс:\n• Нэг хүнд ногдох: **~7.5 тонн/жил** (дэлхийн дундаж: 4.7 т)\n• Цахилгааны **92%** нүүрснээс үйлдвэрлэгддэг\n• Коэффициент: **1 кВт·цаг ≈ 0.88 кг CO₂**\n\nБарилгын CO₂ (жишээ):\n\n| Барилга | Жилийн CO₂ |\n|---------|------------|\n| Панельн байр (80 айл) | ~280 тонн |\n| Оффис (5,000 м²) | ~900 тонн |\n| Сургууль (3,000 м²) | ~480 тонн |\n\nМонгол NDC зорилт: 2030 он гэхэд **14%** бууруулна.`,
    en: `**CO₂ Emissions** — buildings & energy:\n\nMongolia:\n• Per capita: **~7.5 tonnes/year** (global avg: 4.7 t)\n• **92%** of electricity from coal\n• Emission factor: **1 kWh ≈ 0.88 kg CO₂**\n\nBuilding CO₂ examples:\n\n| Building | Annual CO₂ |\n|----------|------------|\n| Panel block (80 units) | ~280 tonnes |\n| Office (5,000 m²) | ~900 tonnes |\n| School (3,000 m²) | ~480 tonnes |\n\nMongolia NDC target: reduce by **14% by 2030**.`,
    sources: ["Монгол Улсын NDC 2021", "World Bank Climate Data 2023", "IEA Mongolia 2023"],
  },
  {
    keys: ["тусгаарлалт", "insulation", "дулаалга", "eps", "минеральн хөвөн", "хана дулаалах"],
    mn: `**Барилгын дулаалга** — Монголын хатуу уур амьсгалд хамгийн чухал:\n\nСанал болгох зузаан (БНТУ 23-02-09):\n\n| Хэсэг | Зузаан | Хэмнэлт |\n|-------|--------|----------|\n| Гадна хана | 100–150мм EPS | 40–55% |\n| Дээвэр | 200–250мм | 25–35% |\n| Шал | 80–100мм | 10–15% |\n\nU-утга:\n• Дулаалаагүй хана: U = 1.2–2.0 W/m²K\n• Дулаалсан хана: U = 0.2–0.4 W/m²K\n\nНийт барилга дулаалсан: **35–50% хэмнэнэ**`,
    en: `**Building Insulation** — most critical measure in Mongolia's climate:\n\nRecommended thickness (БНТУ 23-02-09):\n\n| Section | Thickness | Savings |\n|---------|-----------|---------|\n| Exterior wall | 100–150mm EPS | 40–55% |\n| Roof | 200–250mm | 25–35% |\n| Floor | 80–100mm | 10–15% |\n\nU-values:\n• Uninsulated wall: U = 1.2–2.0 W/m²K\n• Insulated wall: U = 0.2–0.4 W/m²K\n\nFull building retrofit: **35–50% overall savings**`,
    sources: ["БНТУ 23-02-09 2023", "Монгол Улсын Барилгын яам зөвлөмж 2022"],
  },
  {
    keys: ["цонх", "window", "вакуум цонх", "дан шил", "давхар шил"],
    mn: `**Цонхны төрөл ба дулааны гүйцэтгэл:**\n\n| Төрөл | U-утга | Хэмнэлт |\n|-------|--------|----------|\n| Дан шил | 5.8 W/m²K | — |\n| Давхар шил | 2.8 W/m²K | ~35% |\n| 3 давхар шил | 1.4 W/m²K | ~55% |\n| Вакуум шил | 0.5–0.8 W/m²K | ~65% |\n\nМонголын уур амьсгалд **вакуум буюу 3 давхар шил** зайлшгүй шаардлагатай.\n\nЦонхны харьцаа: 20–30% тохиромжтой, 40%+ дулааны алдагдал нэмэгдэнэ.`,
    en: `**Window types and thermal performance:**\n\n| Type | U-value | Saving |\n|------|---------|--------|\n| Single glazed | 5.8 W/m²K | — |\n| Double glazed | 2.8 W/m²K | ~35% |\n| Triple glazed | 1.4 W/m²K | ~55% |\n| Vacuum glazed | 0.5–0.8 W/m²K | ~65% |\n\nIn Mongolia's climate, **vacuum or triple glazing** is essential.\n\nWindow-to-wall ratio: 20–30% optimal, 40%+ significantly increases heat loss.`,
    sources: ["БНТУ 23-02-09", "EN ISO 10077", "WBCSD 2022"],
  },
  {
    keys: ["ml", "загвар", "model", "ols", "regression", "machine learning", "r²", "mape", "mae", "таамаглагч загвар"],
    mn: `**UB Energy ML загвар** — OLS Regression (Physics-informed):\n\nАрхитектур:\n• Физик EUI томьёо + OLS регресс хослол\n• 600 синтетик барилгын датасет\n• 30 feature: 8 тоон + 22 one-hot категориал\n• 80/20 train/test хуваалт\n\nҮзүүлэлт (test set):\n\n| Метрик | Утга | Тайлбар |\n|--------|------|----------|\n| **R²** | 0.96 | 96% тайлбарлах чадвар |\n| **MAPE** | 8–12% | Дундаж хувийн алдаа |\n| **MAE** | ~3,200 кВт·цаг | Дундаж алдаа |\n\nГол feature: Талбай, Барилгасан он, HDD, Хана материал, Дулаалгын чанар`,
    en: `**UB Energy ML Model** — Physics-informed OLS Regression:\n\nArchitecture:\n• Physics EUI formula + OLS regression hybrid\n• 600 synthetic buildings dataset\n• 30 features: 8 numerical + 22 one-hot categorical\n• 80/20 train/test split\n\nPerformance (test set):\n\n| Metric | Value | Meaning |\n|--------|-------|----------|\n| **R²** | 0.96 | 96% variance explained |\n| **MAPE** | 8–12% | Mean absolute % error |\n| **MAE** | ~3,200 kWh | Mean absolute error |\n\nTop features: Area, Year built, HDD, Wall material, Insulation quality`,
    sources: ["IEA Buildings Efficiency 2022", "Khan et al. (2019)", "БНТУ 23-02-09"],
  },
  {
    keys: ["shap", "feature importance", "хамгийн нөлөөтэй", "чухал хүчин зүйл"],
    mn: `**SHAP-lite Feature Importance** — манай загварт:\n\nТооцоолол: |β_i × x_i| / нийт нийлбэр\n\n| Хүчин зүйл | Нөлөөлөл |\n|------------|----------|\n| Барилгын талбай | ~28% |\n| Барилгасан он | ~22% |\n| HDD (цаг уур) | ~18% |\n| Хана материал | ~12% |\n| Дулаалгын чанар | ~10% |\n| Халаалтын төрөл | ~6% |\n| Бусад | ~4% |\n\nSHAP нь яагаад тухайн барилга өндөр/доогуур эрчим хүч хэрэглэж байгааг тайлбарлана.`,
    en: `**SHAP-lite Feature Importance** in our model:\n\nFormula: |β_i × x_i| / total sum\n\n| Feature | Contribution |\n|---------|-------------|\n| Building area | ~28% |\n| Year built | ~22% |\n| HDD (climate) | ~18% |\n| Wall material | ~12% |\n| Insulation quality | ~10% |\n| Heating type | ~6% |\n| Others | ~4% |\n\nSHAP explains *why* a building has high/low energy consumption.`,
    sources: ["Lundberg & Lee (2017) SHAP — NIPS", "Molnar (2022) Interpretable ML (Ch. 9)"],
  },
  {
    keys: ["барилгын төрөл", "building type", "оффис", "сургууль", "эмнэлэг", "агуулах", "apartment", "office"],
    mn: `**Барилгын төрлийн эрчим хүчний хэрэглээ (УБ):**\n\n| Төрөл | EUI (кВт·цаг/м²/жил) | Онцлог |\n|-------|----------------------|--------|\n| Орон сууц | 150–280 | Халаалт давамгайлна |\n| Оффис | 200–320 | Гэрэлтүүлэг + техник |\n| Сургууль | 140–220 | Өдрийн ачаалал |\n| Эмнэлэг | 300–450 | Тоног хэрэгсэл |\n| Агуулах | 80–130 | Бага ачаалал |\n| Худалдааны | 250–380 | Гэрэлтүүлэг өндөр |`,
    en: `**Building type energy benchmarks (UB):**\n\n| Type | EUI (kWh/m²/yr) | Notes |\n|------|-----------------|-------|\n| Apartment | 150–280 | Heating dominant |\n| Office | 200–320 | Lighting + equipment |\n| School | 140–220 | Daytime load |\n| Hospital | 300–450 | High-intensity equipment |\n| Warehouse | 80–130 | Low occupancy |\n| Commercial | 250–380 | High lighting |`,
    sources: ["БНТУ 23-02-09", "ЭЗХ тайлан 2023", "IEA Commercial Buildings 2022"],
  },
  {
    keys: ["хана материал", "wall material", "панель", "тоосго", "бетон", "мод", "panel", "brick"],
    mn: `**Ханын материал ба дулааны гүйцэтгэл:**\n\n| Материал | Дулаан дамжуулалт | EUI нэмэгдэлт |\n|----------|-------------------|---------------|\n| Бетон | λ=1.75 W/mK | суурь |\n| Тоосго | λ=0.85 W/mK | -5% |\n| Панель | λ=1.40 W/mK | +14–18% |\n| Мод | λ=0.18 W/mK | +20–25% |\n| Метал | λ=50 W/mK | +10–12% |\n\nСовет үеийн панельн барилгууд хамгийн их дулааны алдагдалтай — дулаалга хийх нь хамгийн ашигтай.`,
    en: `**Wall materials & thermal performance:**\n\n| Material | Conductivity | EUI impact |\n|----------|-------------|------------|\n| Concrete | λ=1.75 W/mK | baseline |\n| Brick | λ=0.85 W/mK | -5% |\n| Panel | λ=1.40 W/mK | +14–18% |\n| Wood | λ=0.18 W/mK | +20–25% |\n| Metal | λ=50 W/mK | +10–12% |\n\nSoviet-era panel blocks have the highest heat loss — insulation retrofit gives the best ROI.`,
    sources: ["БНТУ 23-02-09 хавсралт Б", "EN 12524 Building Materials"],
  },
  {
    keys: ["халаалтын төрөл", "heating type", "central heating", "local heating", "electric heating", "төвлөрсөн халаалт"],
    mn: `**Халаалтын төрөл ба үр ашиг:**\n\n| Төрөл | EUI нэмэгдэлт | Зардал |\n|-------|---------------|--------|\n| Төвлөрсөн | суурь | дундаж |\n| Орон нутгийн | +25% | өндөр |\n| Цахилгаан | +8% | хамгийн өндөр |\n| Хий | -12% | хямд |\n\n**Дулааны насос (Heat pump):**\n• COP = 2.5–4.5\n• Урт хугацааны хэмнэлт **30–45%**`,
    en: `**Heating types & efficiency:**\n\n| Type | EUI impact | Cost |\n|------|-----------|------|\n| Central district | baseline | medium |\n| Local boiler | +25% | high |\n| Electric | +8% | highest |\n| Gas | -12% | cheap |\n\n**Heat pump:**\n• COP = 2.5–4.5 (1 kW → 2.5–4.5 kW heat)\n• Long-term savings **30–45%**`,
    sources: ["УБ Дулааны Сүлжээ ТӨХК тайлан 2023", "IEA Heat Pumps 2023"],
  },
  {
    keys: ["нарны", "solar", "нарны эрчим хүч", "pv", "фотовольт", "renewable"],
    mn: `**Монголын нарны эрчим хүч:**\n\n• Жилийн нарлаг өдөр: **260–280** (дэлхийн хамгийн өндрийн нэг)\n• Нарны цацраг: **1,400–1,800 кВт·цаг/м²/жил**\n• 1кВт нарны панель ≈ **1,200–1,500 кВт·цаг/жил** (УБ)\n\nГэрийн нарны систем (5 кВт):\n\n| Үзүүлэлт | Утга |\n|----------|------|\n| Үнэ | ~10–15 сая₮ |\n| Жилийн үйлдвэрлэл | 6,000–7,500 кВт·цаг |\n| Нөхөн төлбөр | **7–10 жил** |\n| Жилийн хэмнэлт | ~800,000–1,200,000₮ |\n\n2024: суурилсан хүчин чадал **600+ МВт** (2018-аас 10 дахин өсөлт)`,
    en: `**Mongolia's solar energy potential:**\n\n• Annual sunny days: **260–280** (among world's highest)\n• Solar irradiance: **1,400–1,800 kWh/m²/yr**\n• 1 kW solar in UB ≈ **1,200–1,500 kWh/year**\n\nResidential solar system (5 kW):\n\n| Item | Value |\n|------|-------|\n| Cost | ~10–15M₮ |\n| Annual generation | 6,000–7,500 kWh |\n| Payback period | **7–10 years** |\n| Annual savings | ~800,000–1,200,000₮ |\n\n2024 installed capacity: **600+ MW** (10× since 2018)`,
    sources: ["Эрчим хүчний яам — Нарны бодлого 2023", "World Bank Solar Atlas", "IRENA Mongolia 2023"],
  },
  {
    keys: ["агаарын чанар", "aqi", "air quality", "бохирдол", "pm2.5", "утаа"],
    mn: `**Улаанбаатарын агаарын чанар:**\n\n• Өвлийн AQI (11–3-р сар): **200–400+** (аюултай)\n• PM2.5 дундаж: **75–150 μg/м³** (ДЭМБ норм: 15 μg/м³)\n• Гол шалтгаан: гэрийн зуух, нүүрс шатаалт (**68%**)\n\n| 1 кВт·цаг | CO₂ | SO₂ |\n|-----------|-----|-----|\n| Цахилгаан | 0.88 кг | 12 г |\n\n100 кВт·цаг/сар хэрэглэлт ≈ **1,056 кг CO₂/жил**\n\nЭрчим хүч хэмнэх нь агаарын чанарыг шууд сайжруулна.`,
    en: `**Ulaanbaatar air quality:**\n\n• Winter AQI (Nov–Mar): **200–400+** (hazardous)\n• PM2.5 average: **75–150 μg/m³** (WHO standard: 15 μg/m³)\n• Main cause: residential coal stoves (**68%** of pollution)\n\n| Per 1 kWh | CO₂ | SO₂ |\n|-----------|-----|-----|\n| Electricity | 0.88 kg | 12 g |\n\n100 kWh/month usage ≈ **1,056 kg CO₂/year**\n\nEnergy saving directly improves air quality.`,
    sources: ["WHO Агаарын чанарын удирдамж 2021", "Нийслэлийн АБГА тайлан 2023", "World Bank 2022"],
  },
  {
    keys: ["барилгасан он", "year built", "настай барилга", "шинэ барилга", "хуучин барилга", "совет"],
    mn: `**Барилгасан оны нөлөө:**\n\n| Он | EUI нэмэгдэлт | Онцлог |\n|----|---------------|--------|\n| 2015+ | суурь | Шинэ норматив |\n| 2000–2015 | +10–15% | Дундаж |\n| 1990–2000 | +20–30% | Шилжилтийн үе |\n| 1970–1990 | +35–50% | Совет панель |\n| 1970- | +50–70% | Хамгийн хуучин |\n\nСовет үеийн барилга: дулааны норм сул, алдагдал өндөр. Дулаалга → **30–50% хэмнэнэ**, ROI: 5–8 жил.`,
    en: `**Year built impact on EUI:**\n\n| Period | EUI increase | Notes |\n|--------|-------------|-------|\n| 2015+ | baseline | New standards |\n| 2000–2015 | +10–15% | Medium |\n| 1990–2000 | +20–30% | Transition era |\n| 1970–1990 | +35–50% | Soviet panel |\n| pre-1970 | +50–70% | Oldest stock |\n\nSoviet-era buildings: weak thermal norms. Retrofit saves **30–50%**. ROI: 5–8 years.`,
    sources: ["БНТУ 23-02-09", "Барилгын яам — Барилгын нөөцийн судалгаа 2022"],
  },
  {
    keys: ["smart home", "ухаалаг гэр", "iot", "thermostat", "мэдрэгч", "автоматжуулалт"],
    mn: `**Smart Home — ухаалаг гэрийн систем:**\n\n| Арга хэмжээ | Хэмнэлт |\n|-------------|----------|\n| Smart thermostat | 15–25% |\n| LED + мэдрэгч | 30–50% |\n| Smart хөшиг | 8–15% |\n| **Нийт** | **25–40%** |\n\nПлатформ: Home Assistant (нээлттэй эх), Google Home, Apple HomeKit, Xiaomi / Aqara (хямд)\n\nМонголд: Гэрийн дулааны мэдрэгч хамгийн ашигтай. GSM-д суурилсан → алс удирдлага боломжтой.`,
    en: `**Smart Home systems:**\n\n| Measure | Savings |\n|---------|--------|\n| Smart thermostat | 15–25% |\n| LED + sensors | 30–50% |\n| Smart blinds | 8–15% |\n| **Total** | **25–40%** |\n\nPlatforms: Home Assistant (open source), Google Home, Apple HomeKit, Xiaomi/Aqara (affordable)\n\nFor Mongolia: thermal sensors most beneficial. GSM-based → remote control via mobile.`,
    sources: ["IEA Smart Home 2023", "Rocky Mountain Institute 2022", "МАТА тайлан 2023"],
  },
  {
    keys: ["улаанбаатарын цаг уур", "ub climate", "монголын цаг уур", "температур", "өвлийн"],
    mn: `**Улаанбаатарын цаг уур:**\n\n• Дэлхийн хамгийн хүйтэн нийслэл: **дундаж -2.4°C**\n\n| Сар | Дундаж температур |\n|-----|------------------|\n| 1-р сар | **-22°C** (хамгийн хүйтэн -42°C) |\n| 7-р сар | **+17°C** |\n\n• Жилийн HDD: **4,500–5,200**\n• Жилийн нарлаг цаг: **2,800–3,300 цаг**\n\nБарилгад нөлөөлөл:\n• -10°C бурхад халаалтын ачаалал **35–45%** нэмэгддэг\n• Салхи дулааны алдагдал **10–20%** нэмэгдүүлдэг`,
    en: `**Ulaanbaatar climate data:**\n\n• World's coldest capital: **avg -2.4°C annually**\n\n| Month | Average Temperature |\n|-------|--------------------|\n| January | **-22°C** (min -42°C) |\n| July | **+17°C** |\n\n• Annual HDD: **4,500–5,200**\n• Annual sunshine: **2,800–3,300 hours**\n\nBuilding impact:\n• Each -10°C drop adds **35–45%** to heating load\n• Wind chill increases heat loss by **10–20%**`,
    sources: ["ЦУОШГ 2023", "WMO Climate Normals", "NASA POWER"],
  },
  {
    keys: ["бнту", "норматив", "стандарт", "building standard", "монголын стандарт"],
    mn: `**БНТУ 23-02-09 — Барилгын дулааны хамгаалалт:**\n\nГол шаардлага:\n\n| Элемент | Шаардлага |\n|---------|----------|\n| Гадна хана | R ≥ 3.2 м²К/Вт |\n| Дээвэр | R ≥ 5.0 м²К/Вт |\n| Доод шал | R ≥ 4.0 м²К/Вт |\n| Цонх | U ≤ 1.4 Вт/м²К |\n\nEUI зорилт:\n• Шинэ барилга: ≤ 150 кВт·цаг/м²/жил\n• Шинэчлэгдсэн: ≤ 180 кВт·цаг/м²/жил`,
    en: `**БНТУ 23-02-09 — Building Thermal Protection Standard:**\n\nKey requirements:\n\n| Element | Requirement |\n|---------|------------|\n| Exterior wall | R ≥ 3.2 m²K/W |\n| Roof | R ≥ 5.0 m²K/W |\n| Ground floor | R ≥ 4.0 m²K/W |\n| Windows | U ≤ 1.4 W/m²K |\n\nEUI targets:\n• New buildings: ≤ 150 kWh/m²/year\n• Retrofitted: ≤ 180 kWh/m²/year`,
    sources: ["БНТУ 23-02-09:2023", "MNS 6055:2020"],
  },
  {
    keys: ["хэрхэн хэмнэх", "how to save", "зөвлөгөө", "хэмнэлтийн арга", "energy saving"],
    mn: `**Эрчим хүч хэмнэх шилдэг 8 арга:**\n\n| # | Арга | Хэмнэлт |\n|---|------|----------|\n| 1 | Дулаалга (хана, дээвэр) | **35–50%** |\n| 2 | Вакуум/3 давхар цонх | 15–25% |\n| 3 | Smart thermostat | 15–25% |\n| 4 | LED гэрэлтүүлэг | 10–20% |\n| 5 | Агааржуулалт сайжруулах | 5–15% |\n| 6 | Нарны дулааны систем | 10–30% |\n| 7 | Хаалга, цонхны битүүмжлэл | 5–10% |\n| 8 | Зуухны үр ашиг | 10–20% |\n\nНийт боломжит хэмнэлт: **40–70%**`,
    en: `**Top 8 energy saving measures:**\n\n| # | Measure | Savings |\n|---|---------|--------|\n| 1 | Insulation (walls, roof) | **35–50%** |\n| 2 | Vacuum/triple windows | 15–25% |\n| 3 | Smart thermostat | 15–25% |\n| 4 | LED lighting | 10–20% |\n| 5 | Improve ventilation | 5–15% |\n| 6 | Solar thermal system | 10–30% |\n| 7 | Seal doors & windows | 5–10% |\n| 8 | Upgrade heating | 10–20% |\n\nTotal potential savings: **40–70%**`,
    sources: ["Rocky Mountain Institute 2022", "БНТУ 23-02-09", "IEA Energy Efficiency 2023"],
  },
  {
    keys: ["гкал", "gcal", "гигакалори", "дулааны нэгж"],
    mn: `**Дулааны нэгжийн хөрвүүлэлт:**\n\n| Нэгж | Тэнцэл |\n|------|--------|\n| **1 Гкал** | **1,163 кВт·цаг** |\n| 1 кВт·цаг | 0.86 МЖ |\n| 1 Гкал | 4,186 МЖ |\n\nЖишээ:\n• 60м² айлын сарын дулаан: ~2–4 Гкал\n• 2 Гкал × 160,000₮ ≈ **320,000₮/сар**\n• Жилийн зардал (9 сар): ≈ **2.9 сая₮**\n\nУБ халааны улирал: **10/15 – 5/15**`,
    en: `**Heating unit conversions:**\n\n| Unit | Equivalent |\n|------|------------|\n| **1 Gcal** | **1,163 kWh** |\n| 1 kWh | 0.86 MJ |\n| 1 Gcal | 4,186 MJ |\n\nExample:\n• 60m² apartment monthly heating: ~2–4 Gcal\n• 2 Gcal × 160,000₮ ≈ **320,000₮/month**\n• Annual cost (9 months): ≈ **2.9M₮**\n\nUB heating season: **Oct 15 – May 15**`,
    sources: ["SI unit definitions (BIPM)", "УБ Дулааны Сүлжээ ТӨХК 2024"],
  },
  {
    keys: ["эрчим хүчний зэрэглэл", "energy grade", "а зэрэглэл", "grade a", "зэрэглэл"],
    mn: `**Барилгын эрчим хүчний зэрэглэл (А–G):**\n\n| Зэрэглэл | EUI (кВт·цаг/м²/жил) | Тайлбар |\n|----------|----------------------|----------|\n| **A** | < 120 | Маш үр ашигтай |\n| **B** | 120–150 | Сайн |\n| **C** | 150–175 | Дундаж дээш |\n| **D** | 175–210 | Дундаж |\n| **E** | 210–260 | Дундажаас доош |\n| **F** | 260–320 | Муу |\n| **G** | > 320 | Маш муу |\n\nУБ-ын барилгын **70%** D–F зэрэглэлд байдаг. А рүү шилжих → **50,000–300,000₮/жил** хэмнэнэ.`,
    en: `**Building Energy Grade (A–G):**\n\n| Grade | EUI (kWh/m²/yr) | Description |\n|-------|-----------------|-------------|\n| **A** | < 120 | Very efficient |\n| **B** | 120–150 | Good |\n| **C** | 150–175 | Above average |\n| **D** | 175–210 | Average |\n| **E** | 210–260 | Below average |\n| **F** | 260–320 | Poor |\n| **G** | > 320 | Very poor |\n\n**70%** of UB apartments are D–F. Moving to A saves **50,000–300,000₮/year**.`,
    sources: ["MNS 6055:2020", "EU Energy Performance of Buildings Directive (adapted)"],
  },
  {
    keys: ["баярлалаа", "thanks", "thank you", "болоо", "хангалттай"],
    mn: "Баярлалаа! Цааш ч асуух зүйл байвал чөлөөтэй асуугаарай. UB Energy-г ашигласанд баярлалаа! 🌱",
    en: "Thank you! Feel free to ask anything else anytime. Thanks for using UB Energy! 🌱",
    sources: [],
  },
];

// ─── Match & respond ──────────────────────────────────────────────────────────
function getBotResponse(input, lang) {
  const lower = input.toLowerCase();
  for (const item of KB) {
    if (item.keys.some(k => lower.includes(k.toLowerCase()))) {
      return { text: lang === "en" ? item.en : item.mn, sources: item.sources || [] };
    }
  }
  const fallback = lang === "en"
    ? `I can help with energy topics. Try asking about:\n• "Electricity tariff"\n• "HDD calculation"\n• "Insulation savings"\n• "Energy grade A-G"\n• "Solar energy in Mongolia"\n• "ML model accuracy"`
    : `Дараах сэдвүүдээр асуувал дэлгэрэнгүй хариулт өгнө:\n• "Цахилгааны тариф"\n• "HDD тооцоолол"\n• "Дулаалгын хэмнэлт"\n• "Эрчим хүчний зэрэглэл"\n• "Нарны эрчим хүч"\n• "ML загварын нарийвчлал"`;
  return { text: fallback, sources: [] };
}

// ─── Markdown renderer — handles bold, tables, bullets ────────────────────────
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={j}>{part.slice(2, -2)}</strong>
      : part
  );
}

function renderText(text) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection: current line has pipes AND next line is separator ---
    if (line.includes("|") && lines[i + 1]?.match(/^\|[-| :]+\|/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const [headerRow, , ...bodyRows] = tableLines;
      const headers = headerRow.split("|").filter(c => c.trim()).map(h => h.trim());
      out.push(
        <table key={out.length} className="chat-table">
          <thead>
            <tr>{headers.map((h, j) => <th key={j}>{renderInline(h)}</th>)}</tr>
          </thead>
          <tbody>
            {bodyRows.filter(r => r.trim()).map((row, ri) => (
              <tr key={ri}>
                {row.split("|").filter(c => c.trim()).map((cell, ci) => (
                  <td key={ci}>{renderInline(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      out.push(<span key={out.length}>{renderInline(line)}{i < lines.length - 1 && <br />}</span>);
      i++;
    }
  }
  return out;
}

// ─── Quick chips config ───────────────────────────────────────────────────────
const CHIP_CONFIG = [
  { icon: <Zap size={11} />,           mn: "Цахилгааны тариф", en: "Electricity tariff" },
  { icon: <ThermometerSun size={11} />, mn: "HDD тооцоолол",    en: "HDD calculation" },
  { icon: <Home size={11} />,           mn: "Дулаалгын хэмнэлт",en: "Insulation savings" },
  { icon: <BarChart2 size={11} />,      mn: "ML загварын нарийвчлал", en: "ML model accuracy" },
  { icon: <Leaf size={11} />,           mn: "Нарны эрчим хүч",  en: "Solar energy" },
  { icon: <HelpCircle size={11} />,     mn: "Эрчим хүч хэмнэх", en: "How to save energy" },
];

// ─── Chatbot component ────────────────────────────────────────────────────────
export default function Chatbot() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const greeting = t.chatbot.greeting.replace("{name}", user ? `, ${user.name}` : "");
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([{ from: "bot", text: greeting, sources: [], ts: new Date() }]);
  const [input, setInput]     = useState("");
  const [typing, setTyping]   = useState(false);
  const [copied, setCopied]   = useState(null);
  const [minimized, setMinimized] = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const toggleRef  = useRef(null);
  const didMount   = useRef(false);

  useEffect(() => {
    setMessages([{ from: "bot", text: greeting, sources: [], ts: new Date() }]);
  }, [greeting]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, minimized]);

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 60);
    else if (!open) toggleRef.current?.focus();
  }, [open, minimized]);

  const send = (text = input.trim()) => {
    if (!text) return;
    setMessages(prev => [...prev, { from: "user", text, ts: new Date() }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const res = getBotResponse(text, lang);
      setMessages(prev => [...prev, { from: "bot", text: res.text, sources: res.sources, ts: new Date() }]);
      setTyping(false);
    }, 400 + Math.random() * 350);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === "Escape") setOpen(false);
  };

  const clearChat = () => setMessages([
    { from: "bot", text: t.chatbot.new_chat.replace("{name}", user ? `, ${user.name}` : ""), sources: [], ts: new Date() }
  ]);

  const copyMsg = (text, idx) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const fmtTime = (ts) => ts instanceof Date
    ? ts.toLocaleTimeString(lang === "mn" ? "mn-MN" : "en-US", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="chatbot-wrapper">
      {open && (
        <div className={`chatbot-box animate-fade${minimized ? " chatbot-minimized" : ""}`}
          onKeyDown={e => e.key === "Escape" && setOpen(false)}>

          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-bot-avatar"><Bot size={17} /></div>
              <div>
                <span className="chatbot-header-name">{APP_NAME} AI</span>
                <span className="chatbot-status">
                  <span className="chatbot-status-dot" />
                  {t.chatbot.online}
                  <span className="chatbot-kb-badge">KB · 22 сэдэв</span>
                </span>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button onClick={() => setMinimized(m => !m)} className="chatbot-hbtn" title={minimized ? "Нээх" : "Багасгах"}>
                <ChevronDown size={16} style={{ transform: minimized ? "rotate(180deg)" : "none", transition: "0.2s" }} />
              </button>
              <button onClick={clearChat} className="chatbot-hbtn" title={t.chatbot.clear}>
                <Trash2 size={15} />
              </button>
              <button onClick={() => setOpen(false)} className="chatbot-hbtn">
                <X size={17} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="chatbot-messages" aria-live="polite">
                {messages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.from}`}>
                    <div className="chat-avatar">
                      {msg.from === "bot" ? <Bot size={13} /> : <User size={13} />}
                    </div>
                    <div className="chat-bubble-wrap">
                      <div className="chat-bubble">
                        {renderText(msg.text)}
                      </div>
                      <div className="chat-msg-meta">
                        <span className="chat-ts">{fmtTime(msg.ts)}</span>
                        {msg.from === "bot" && (
                          <button className="chat-copy-btn" onClick={() => copyMsg(msg.text, i)} title="Хуулах">
                            {copied === i ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        )}
                      </div>
                      {msg.from === "bot" && msg.sources?.length > 0 && (
                        <div className="chat-sources">
                          <BookOpen size={11} />
                          <span className="chat-sources-label">{lang === "mn" ? "Эх сурвалж:" : "Sources:"}</span>
                          {msg.sources.map((s, si) => (
                            <span key={si} className="source-badge">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="chat-msg bot">
                    <div className="chat-avatar"><Bot size={13} /></div>
                    <div className="chat-bubble-wrap">
                      <div className="chat-bubble typing-indicator"><span /><span /><span /></div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick chips */}
              <div className="chatbot-chips">
                {CHIP_CONFIG.map(c => (
                  <button
                    key={c.mn}
                    className="chip"
                    disabled={typing}
                    onClick={() => send(lang === "mn" ? c.mn : c.en)}
                  >
                    {c.icon}
                    {lang === "mn" ? c.mn : c.en}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="chatbot-input-row">
                <input
                  ref={inputRef}
                  className="chatbot-input form-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={t.chatbot.placeholder}
                  maxLength={300}
                />
                <button
                  className="btn btn-primary chatbot-send"
                  onClick={() => send()}
                  disabled={typing || !input.trim()}
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="chatbot-footer">
                {lang === "mn"
                  ? "UB Energy AI · Синтетик мэдлэгийн санд суурилсан"
                  : "UB Energy AI · Powered by local knowledge base"}
              </div>
            </>
          )}
        </div>
      )}

      <button
        ref={toggleRef}
        className={`chatbot-toggle ${open ? "open" : ""}`}
        onClick={() => { setOpen(!open); setMinimized(false); }}
        title={t.chatbot.title}
        aria-expanded={open}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {!open && <span className="chatbot-pulse" />}
      </button>
    </div>
  );
}
