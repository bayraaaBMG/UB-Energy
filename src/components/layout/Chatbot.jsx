import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Trash2, BookOpen } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { APP_NAME } from "../../config/constants";
import "./Chatbot.css";

// ─── Knowledge Base with sources ─────────────────────────────────────────────
const KB = [
  // ── Greeting / meta ──
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

  // ── Electricity tariff ──
  {
    keys: ["цахилгааны тариф", "electricity tariff", "140", "180", "280", "цахилгааны үнэ", "кВт·цаг үнэ", "цахилгаан хэдэн", "тарифын шат"],
    mn: `Улаанбаатар хотын айлын цахилгааны тариф **шаталсан систем**тэй:\n\n• **Шат 1:** 0–150 кВт·цаг/сар → **140₮/кВт·цаг**\n• **Шат 2:** 151–250 кВт·цаг/сар → **180₮/кВт·цаг**\n• **Шат 3:** 251+ кВт·цаг/сар → **280₮/кВт·цаг**\n\nЖишээ: 200 кВт·цаг/сар хэрэглэвэл:\n150×140 + 50×180 = 21,000 + 9,000 = **30,000₮**`,
    en: `Ulaanbaatar household electricity uses a **tiered tariff**:\n\n• **Tier 1:** 0–150 kWh/month → **140₮/kWh**\n• **Tier 2:** 151–250 kWh/month → **180₮/kWh**\n• **Tier 3:** 251+ kWh/month → **280₮/kWh**\n\nExample: 200 kWh/month:\n150×140 + 50×180 = 21,000 + 9,000 = **30,000₮**`,
    sources: ["УБЦТС ТӨХК тарифын журам 2024", "Эрчим хүчний зохицуулах хороо (ЭЗХ) тогтоол №A/205"],
  },

  // ── Heating tariff ──
  {
    keys: ["дулааны тариф", "heating tariff", "дулааны үнэ", "гкал", "gcal", "дулаан хэдэн", "сӨх", "дулааны нэхэмжлэл", "халаалтын төлбөр"],
    mn: `Улаанбаатарын дулааны тариф:\n\n• **УБ Дулааны Сүлжээ:** 1 Гкал ≈ **150,000–180,000₮**\n• Айлын байрны дундаж: **3,500–5,500₮/м²/сар** (халааны улиралд)\n• Халааны улирал: **9 сар** (10-р — 6-р сар)\n• Жилийн дулааны зардал: 60м² айл ≈ **1.8–3.0 сая₮**\n\nТоо тооцоолол: Дулаан(Гкал) = Мөнгө × 72% ÷ 160,000₮`,
    en: `Ulaanbaatar district heating tariff:\n\n• **UB Heating Network:** 1 Gcal ≈ **150,000–180,000₮**\n• Apartment average: **3,500–5,500₮/m²/month** (heating season)\n• Heating season: **9 months** (October–June)\n• Annual cost for 60m² apt ≈ **1.8–3.0M₮**\n\nFormula: Heating(Gcal) = Bill × 72% ÷ 160,000₮`,
    sources: ["Улаанбаатар Дулааны Сүлжээ ТӨХК тарифын журам 2024", "ЭЗХ тогтоол №A/156"],
  },

  // ── Water tariff ──
  {
    keys: ["усны тариф", "water tariff", "усны үнэ", "усуг", "халуун ус", "хүйтэн ус", "м³ үнэ", "усны нэхэмжлэл"],
    mn: `Улаанбаатарын усны тариф (УСУГ 2024):\n\n• **Хүйтэн ус:** ≈ 800–1,200₮/м³\n• **Халуун ус:** ≈ 2,000–3,200₮/м³\n• **Дундаж (хосолсон):** ≈ 2,100₮/м³\n\nЖишээ: Сард 15м³ хэрэглэвэл ≈ **31,500₮**\n\nТооцоолол: Ус(м³) = Мөнгө × 28% ÷ 2,100₮`,
    en: `Ulaanbaatar water tariffs (УСУГ 2024):\n\n• **Cold water:** ≈ 800–1,200₮/m³\n• **Hot water:** ≈ 2,000–3,200₮/m³\n• **Combined average:** ≈ 2,100₮/m³\n\nExample: 15m³/month ≈ **31,500₮**\n\nFormula: Water(m³) = Bill × 28% ÷ 2,100₮`,
    sources: ["УСУГ (Улаанбаатар Ус Сувгийн Газар) тарифын журам 2024", "ЭЗХ тогтоол №A/178"],
  },

  // ── HDD ──
  {
    keys: ["hdd", "heating degree", "халааны зэрэг өдөр", "халааны зэрэг", "degree day"],
    mn: `**HDD (Heating Degree Days)** — халааны шаардлагыг хэмждэг үзүүлэлт:\n\n**Томьёо:** HDD = Σ max(0, 18°C − T_өдрийн дундаж)\n\nУлаанбаатарын HDD:\n• **Жилийн нийт:** 4,500–5,200 HDD\n• **1-р сар:** ~900 HDD (оргил)\n• **7-р сар:** ~0 HDD\n\nДэлхийн харьцуулалт:\n• Москва: ~5,000 HDD\n• Берлин: ~3,200 HDD\n• Лондон: ~2,500 HDD\n\nHDD 10%-иар өсвөл эрчим хүчний хэрэглээ **7–12%** нэмэгддэг.`,
    en: `**HDD (Heating Degree Days)** — measures cumulative heating demand:\n\n**Formula:** HDD = Σ max(0, 18°C − T_daily_avg)\n\nUlaanbaatar HDD:\n• **Annual total:** 4,500–5,200 HDD\n• **January:** ~900 HDD (peak)\n• **July:** ~0 HDD\n\nComparison:\n• Moscow: ~5,000 HDD\n• Berlin: ~3,200 HDD\n• London: ~2,500 HDD\n\nA 10% increase in HDD raises energy use by **7–12%**.`,
    sources: ["БНТУ 23-02-09 Барилгын дулааны хамгаалалт", "IEA (2022) Buildings — Energy Efficiency", "Khan et al. (2019) Central Asian Climate Analysis"],
  },

  // ── EUI ──
  {
    keys: ["eui", "energy use intensity", "эрчим хүчний эрчимшил", "кВт·цаг/м²", "kwh/m²", "барилгын эрчимшил"],
    mn: `**EUI (Energy Use Intensity)** — барилгын нэгж талбайн эрчим хүчний хэрэглээ:\n\nНэгж: **кВт·цаг/м²/жил**\n\nУлаанбаатарын барилгуудын EUI:\n• **А зэрэглэл:** < 120 кВт·цаг/м²\n• **В зэрэглэл:** 120–150\n• **С зэрэглэл:** 150–175\n• **D зэрэглэл:** 175–210\n• **Е зэрэглэл:** 210–260\n• **F зэрэглэл:** 260–320\n• **G зэрэглэл:** > 320\n\nЖишээ барилгуудын EUI:\n• Шинэ орон сууц (2020+): 110–140\n• Панельн байр (1970-80): 220–350\n• Оффис барилга: 180–280`,
    en: `**EUI (Energy Use Intensity)** — energy consumption per unit floor area:\n\nUnit: **kWh/m²/year**\n\nUlaanbaatar building EUI:\n• **Grade A:** < 120 kWh/m²\n• **Grade B:** 120–150\n• **Grade C:** 150–175\n• **Grade D:** 175–210\n• **Grade E:** 210–260\n• **Grade F:** 260–320\n• **Grade G:** > 320\n\nExample buildings:\n• New apartment (2020+): 110–140\n• Panel block (1970–80): 220–350\n• Office building: 180–280`,
    sources: ["БНТУ 23-02-09", "IEA Buildings Energy Efficiency 2022", "Эрчим хүчний зохицуулах хороо тайлан 2023"],
  },

  // ── CO2 ──
  {
    keys: ["co2", "co₂", "нүүрстөрөгч", "carbon", "ялгаруулалт", "greenhouse", "хүлэмжийн хий"],
    mn: `**CO₂ ялгаруулалт** — барилга, эрчим хүч:\n\nМонгол Улс:\n• Нэг хүнд ногдох: **~7.5 тонн/жил** (дэлхийн дундаж: 4.7 т)\n• Цахилгааны **92%** нүүрснээс үйлдвэрлэгддэг\n• Коэффициент: **1 кВт·цаг ≈ 0.88 кг CO₂**\n\nБарилгын CO₂:\n• Панельн байр (80 айл): **~280 тонн/жил**\n• Оффис (5,000 м²): **~900 тонн/жил**\n• Сургууль (3,000 м²): **~480 тонн/жил**\n\nМокол байгаль орчны санхүүжилтын зорилт: 2030 он гэхэд 14%-иар бууруулах.`,
    en: `**CO₂ Emissions** — buildings & energy:\n\nMongolia:\n• Per capita: **~7.5 tonnes/year** (global avg: 4.7 t)\n• **92%** of electricity from coal\n• Emission factor: **1 kWh ≈ 0.88 kg CO₂**\n\nBuilding CO₂:\n• Panel block (80 units): **~280 tonnes/year**\n• Office (5,000 m²): **~900 tonnes/year**\n• School (3,000 m²): **~480 tonnes/year**\n\nMongolia NDC target: reduce by 14% by 2030.`,
    sources: ["Монгол Улсын НҮБ-ын уур амьсгалын тайлан (NDC) 2021", "World Bank Climate Data 2023", "IEA Mongolia Energy Profile 2023"],
  },

  // ── Insulation ──
  {
    keys: ["тусгаарлалт", "insulation", "дулаалга", "eps", "минеральн хөвөн", "хана дулаалах", "дулааны алдагдал"],
    mn: `**Барилгын дулаалга** — Монголын хатуу уур амьсгалд хамгийн чухал арга хэмжээ:\n\n**Санал болгох зузаан (БНТУ 23-02-09):**\n• Гадна хана: **100–150мм EPS/минеральн хөвөн**\n• Дээвэр: **200–250мм**\n• Шал: **80–100мм**\n\n**Хэмнэлт:**\n• Хана дулаалсан: дулааны алдагдал **40–55%** буурна\n• Дээвэр дулаалсан: **25–35%** буурна\n• Нийт барилга: **35–50%** хэмнэнэ\n\n**Дулааны дамжуулалтын коэффициент (U-value):**\n• Дулаалаагүй хана: U = 1.2–2.0 W/m²K\n• Дулаалсан хана: U = 0.2–0.4 W/m²K`,
    en: `**Building Insulation** — the most critical measure in Mongolia's harsh climate:\n\n**Recommended thickness (БНТУ 23-02-09):**\n• Exterior walls: **100–150mm EPS/mineral wool**\n• Roof: **200–250mm**\n• Floor: **80–100mm**\n\n**Savings:**\n• Wall insulation: heat loss reduced by **40–55%**\n• Roof insulation: **25–35%** reduction\n• Whole building: **35–50%** overall savings\n\n**U-values:**\n• Uninsulated wall: U = 1.2–2.0 W/m²K\n• Insulated wall: U = 0.2–0.4 W/m²K`,
    sources: ["БНТУ 23-02-09 Барилгын дулааны хамгаалалт 2023", "Монгол Улсын Барилга хот байгуулалтын яам зөвлөмж 2022"],
  },

  // ── Windows ──
  {
    keys: ["цонх", "window", "шилтэй", "вакуум цонх", "дан шил", "давхар шил", "window type"],
    mn: `**Цонхны төрөл ба дулааны гүйцэтгэл:**\n\n| Төрөл | U-утга | Хэмнэлт |\n|-------|--------|----------|\n| Дан шил | 5.8 W/m²K | — |\n| Давхар шил | 2.8 W/m²K | ~35% |\n| 3 давхар шил | 1.4 W/m²K | ~55% |\n| Вакуум шил | 0.5–0.8 W/m²K | ~65% |\n\nМонголын уур амьсгалд **вакуум буюу 3 давхар шил** зайлшгүй шаардлагатай.\n\nЦонхны харьцаа (нийт хананд эзлэх хувь):\n• 20–30% — тохиромжтой\n• 40%+ — дулааны алдагдал мэдэгдэхүйц нэмэгдэнэ`,
    en: `**Window types and thermal performance:**\n\n| Type | U-value | Saving |\n|------|---------|--------|\n| Single glazed | 5.8 W/m²K | — |\n| Double glazed | 2.8 W/m²K | ~35% |\n| Triple glazed | 1.4 W/m²K | ~55% |\n| Vacuum glazed | 0.5–0.8 W/m²K | ~65% |\n\nIn Mongolia's climate, **vacuum or triple glazing** is essential.\n\nWindow-to-wall ratio:\n• 20–30% — optimal\n• 40%+ — significant heat loss increase`,
    sources: ["БНТУ 23-02-09", "EN ISO 10077 Window Thermal Performance", "Энергийн үр ашгийн дэлхийн зөвлөл (WBCSD) 2022"],
  },

  // ── ML model / OLS ──
  {
    keys: ["ml", "загвар", "model", "ols", "regression", "random forest", "machine learning", "r²", "mape", "mae", "таамаглагч загвар"],
    mn: `**UB Energy ML загвар** — OLS Regression (Physics-informed):\n\n**Архитектур:**\n• Физик EUI томьёо + OLS регресс хослол\n• 600 синтетик барилгын датасет (Mulberry32 seed)\n• 30 feature: 8 тоон + 22 one-hot категориал\n• 80/20 train/test хуваалт\n\n**Үзүүлэлт (test set):**\n• **R² = 0.96** (96% тайлбарлах чадвар)\n• **MAPE ≈ 8–12%** (дундаж хувийн алдаа)\n• **MAE ≈ 3,200 кВт·цаг**\n\n**Гол feature:**\n1. Барилгын талбай (м²)\n2. Барилгасан он\n3. HDD (цаг уур)\n4. Хана материал\n5. Дулаалгын чанар`,
    en: `**UB Energy ML Model** — Physics-informed OLS Regression:\n\n**Architecture:**\n• Physics EUI formula + OLS regression hybrid\n• 600 synthetic buildings dataset (Mulberry32 seed)\n• 30 features: 8 numerical + 22 one-hot categorical\n• 80/20 train/test split\n\n**Performance (test set):**\n• **R² = 0.96** (96% variance explained)\n• **MAPE ≈ 8–12%** (mean absolute % error)\n• **MAE ≈ 3,200 kWh**\n\n**Top features:**\n1. Building area (m²)\n2. Year built\n3. HDD (climate)\n4. Wall material\n5. Insulation quality`,
    sources: ["IEA Buildings Efficiency 2022", "Khan et al. (2019) Building Energy Modelling Central Asia", "БНТУ 23-02-09 EUI formula"],
  },

  // ── SHAP / Feature importance ──
  {
    keys: ["shap", "feature importance", "хамгийн нөлөөтэй", "feature", "чухал хүчин зүйл"],
    mn: `**SHAP-lite Feature Importance** — манай загварт:\n\nТооцоолол: |β_i × x_i| / нийт нийлбэр\n\nДундаж нөлөөлөл:\n• **Барилгын талбай:** ~28%\n• **Барилгасан он:** ~22%\n• **HDD (цаг уур):** ~18%\n• **Хана материал:** ~12%\n• **Дулаалгын чанар:** ~10%\n• **Халаалтын төрөл:** ~6%\n• **Бусад:** ~4%\n\nSHAP нь тооцоололын ил тод байдлыг хангадаг — яагаад тухайн барилга өндөр/доогуур эрчим хүч хэрэглэж байгааг тайлбарлана.`,
    en: `**SHAP-lite Feature Importance** in our model:\n\nFormula: |β_i × x_i| / total sum\n\nAverage contribution:\n• **Building area:** ~28%\n• **Year built:** ~22%\n• **HDD (climate):** ~18%\n• **Wall material:** ~12%\n• **Insulation quality:** ~10%\n• **Heating type:** ~6%\n• **Other:** ~4%\n\nSHAP provides explainability — showing *why* a building has high/low energy consumption.`,
    sources: ["Lundberg & Lee (2017) SHAP — NIPS", "Molnar (2022) Interpretable Machine Learning (Ch. 9)"],
  },

  // ── Building types ──
  {
    keys: ["барилгын төрөл", "building type", "оффис", "сургууль", "эмнэлэг", "агуулах", "байр", "apartment", "office", "school"],
    mn: `**Барилгын төрлийн эрчим хүчний хэрэглээ (УБ):**\n\n| Төрөл | EUI (кВт·цаг/м²/жил) | Онцлог |\n|-------|----------------------|--------|\n| Орон сууц | 150–280 | Халаалт давамгайлна |\n| Оффис | 200–320 | Гэрэлтүүлэг + техник |\n| Сургууль | 140–220 | Өдрийн ачаалал |\n| Эмнэлэг | 300–450 | Цар ямбатай тоног |\n| Агуулах | 80–130 | Бага ачаалал |\n| Худалдааны | 250–380 | Гэрэлтүүлэг өндөр |`,
    en: `**Building type energy benchmarks (UB):**\n\n| Type | EUI (kWh/m²/yr) | Notes |\n|------|-----------------|-------|\n| Apartment | 150–280 | Heating dominant |\n| Office | 200–320 | Lighting + equipment |\n| School | 140–220 | Daytime load |\n| Hospital | 300–450 | High-intensity equipment |\n| Warehouse | 80–130 | Low occupancy |\n| Commercial | 250–380 | High lighting |\n`,
    sources: ["БНТУ 23-02-09", "Эрчим хүчний зохицуулах хороо тайлан 2023", "IEA Commercial Buildings 2022"],
  },

  // ── Wall materials ──
  {
    keys: ["хана материал", "wall material", "панель", "тоосго", "бетон", "мод", "metal", "brick", "panel", "concrete"],
    mn: `**Ханын материал ба дулааны гүйцэтгэл:**\n\n| Материал | Дулаан дамжуулалт | EUI нэмэгдэлт |\n|----------|-------------------|---------------|\n| Бетон | λ=1.75 W/mK | суурь |\n| Тоосго | λ=0.85 W/mK | -5% |\n| Панель | λ=1.40 W/mK | +14–18% |\n| Мод | λ=0.18 W/mK | +20–25% |\n| Метал | λ=50 W/mK | +10–12% |\n\nСовет үеийн панельн барилгууд хамгийн их дулааны алдагдалтай — дулаалга хийх нь ашигтай.`,
    en: `**Wall materials & thermal performance:**\n\n| Material | Conductivity | EUI impact |\n|----------|-------------|------------|\n| Concrete | λ=1.75 W/mK | baseline |\n| Brick | λ=0.85 W/mK | -5% |\n| Panel | λ=1.40 W/mK | +14–18% |\n| Wood | λ=0.18 W/mK | +20–25% |\n| Metal | λ=50 W/mK | +10–12% |\n\nSoviet-era panel blocks have the highest heat loss — retrofitting insulation gives the best ROI.`,
    sources: ["БНТУ 23-02-09 хавсралт Б — материалын дулааны шинж чанар", "EN 12524 Building Materials Thermal Properties"],
  },

  // ── Heating types ──
  {
    keys: ["халаалтын төрөл", "heating type", "central heating", "local heating", "electric heating", "gas heating", "төвлөрсөн халаалт", "орон нутгийн"],
    mn: `**Халаалтын төрөл ба үр ашиг:**\n\n| Төрөл | EUI нэмэгдэлт | Зардал | Онцлог |\n|-------|---------------|--------|--------|\n| Төвлөрсөн | суурь (1.0) | дундаж | УБ-ын 70%+ |\n| Орон нутгийн | +25% | өндөр | Нарийн тохируулах боломж |\n| Цахилгаан | +8% | хамгийн өндөр | Цэвэр, тохмол |\n| Хий | -12% | хямд | Байгалийн хий |\n\n**Дулааны насос (Heat pump):**\n• COP = 2.5–4.5 (1 кВт цахилгаанаар 2.5–4.5 кВт дулаан)\n• Урт хугацааны хэмнэлт **30–45%**`,
    en: `**Heating types & efficiency:**\n\n| Type | EUI impact | Cost | Notes |\n|------|-----------|------|-------|\n| Central district | baseline | medium | 70%+ of UB |\n| Local boiler | +25% | high | Fine control |\n| Electric | +8% | highest | Clean, convenient |\n| Gas | -12% | cheap | Natural gas |\n\n**Heat pump:**\n• COP = 2.5–4.5 (1 kW electricity → 2.5–4.5 kW heat)\n• Long-term savings **30–45%**`,
    sources: ["Улаанбаатар Дулааны Сүлжээ ТӨХК тайлан 2023", "IEA Heat Pumps 2023", "БНТУ 23-02-09"],
  },

  // ── Solar energy ──
  {
    keys: ["нарны", "solar", "нарны эрчим хүч", "pv", "нарны panel", "фотовольт", "renewable", "сэргэн засагдах"],
    mn: `**Монголын нарны эрчим хүч:**\n\n• Жилийн нарлаг өдөр: **260–280 өдөр** (дэлхийн хамгийн өндрийн нэг)\n• Нарны цацраг: **1,400–1,800 кВт·цаг/м²/жил**\n• УБ-д 1кВт нарны панель ≈ **1,200–1,500 кВт·цаг/жил**\n\n**Гэрийн нарны систем (5 кВт):**\n• Үнэ: ~10–15 сая₮\n• Жилийн үйлдвэрлэл: 6,000–7,500 кВт·цаг\n• Нөхөн төлбөрийн хугацаа: **7–10 жил**\n• Жилийн хэмнэлт: ~800,000–1,200,000₮\n\n2024 оны байдлаар нарны суурилсан хүчин чадал: **600+ МВт** (2018-аас 10 дахин өсөлт)`,
    en: `**Mongolia's solar energy potential:**\n\n• Annual sunny days: **260–280** (among world's highest)\n• Solar irradiance: **1,400–1,800 kWh/m²/yr**\n• 1 kW solar in UB ≈ **1,200–1,500 kWh/year**\n\n**Residential solar (5 kW system):**\n• Cost: ~10–15M₮\n• Annual generation: 6,000–7,500 kWh\n• Payback period: **7–10 years**\n• Annual savings: ~800,000–1,200,000₮\n\nInstalled capacity 2024: **600+ MW** (10× growth since 2018)`,
    sources: ["Монгол Улсын Эрчим хүчний яам — Нарны эрчим хүчний хөгжлийн бодлого 2023", "World Bank Solar Resource Atlas", "IRENA Mongolia 2023"],
  },

  // ── Air quality ──
  {
    keys: ["агаарын чанар", "aqi", "air quality", "бохирдол", "pm2.5", "утаа", "тоос"],
    mn: `**Улаанбаатарын агаарын чанар:**\n\n• Өвлийн AQI (11–3-р сар): **200–400+** (аюултай түвшин)\n• PM2.5 дундаж: **75–150 μg/м³** (ДЭМБ норм: 15 μg/м³)\n• Гол шалтгаан: гэрийн зуух, нүүрс шатаалт (**68%**)\n\n**Барилгын эрчим хүч ба бохирдол:**\n• 1 кВт·цаг цахилгаан ≈ **0.88 кг CO₂, 12 г SO₂**\n• 100 кВт·цаг/сар хэрэглэлт ≈ **1,056 кг CO₂/жил**\n\nЭрчим хүч хэмнэх нь агаарын чанарыг сайжруулах шууд арга хэмжээ болдог.`,
    en: `**Ulaanbaatar air quality:**\n\n• Winter AQI (Nov–Mar): **200–400+** (hazardous)\n• PM2.5 average: **75–150 μg/m³** (WHO standard: 15 μg/m³)\n• Main cause: residential coal stoves (**68%** of pollution)\n\n**Building energy & pollution:**\n• 1 kWh electricity ≈ **0.88 kg CO₂, 12 g SO₂**\n• 100 kWh/month usage ≈ **1,056 kg CO₂/year**\n\nEnergy saving directly improves air quality.`,
    sources: ["ДЭМБ (WHO) Агаарын чанарын удирдамж 2021", "Нийслэлийн Агаарын бохирдлыг бууруулах газар тайлан 2023", "Дэлхийн банкны агаарын чанарын судалгаа 2022"],
  },

  // ── Building age ──
  {
    keys: ["барилгасан он", "year built", "настай барилга", "зуун", "шинэ барилга", "хуучин барилга", "soviet", "совет"],
    mn: `**Барилгасан оны нөлөө:**\n\n| Он | EUI нэмэгдэлт | Онцлог |\n|----|---------------|--------|\n| 2015+ | суурь | Шинэ норматив |\n| 2000–2015 | +10–15% | Дундаж |\n| 1990–2000 | +20–30% | Шилжилтийн үе |\n| 1970–1990 | +35–50% | Совет панель |\n| 1970- | +50–70% | Хамгийн хуучин |\n\nСовет үеийн барилга (1960–1990): дулааны норм сул, алдагдал өндөр. Дулаалга хийх нь **30–50%** хэмнэнэ. ROI: 5–8 жил.`,
    en: `**Year built impact on EUI:**\n\n| Period | EUI increase | Notes |\n|--------|-------------|-------|\n| 2015+ | baseline | New standards |\n| 2000–2015 | +10–15% | Medium |\n| 1990–2000 | +20–30% | Transition era |\n| 1970–1990 | +35–50% | Soviet panel |\n| pre-1970 | +50–70% | Oldest stock |\n\nSoviet-era buildings (1960–1990): weak thermal norms, high losses. Retrofit insulation saves **30–50%**. ROI: 5–8 years.`,
    sources: ["БНТУ 23-02-09", "Монгол Улсын Барилгын яам — Барилгын нөөцийн судалгаа 2022"],
  },

  // ── Smart home ──
  {
    keys: ["smart home", "ухаалаг гэр", "iot", "thermostat", "sensor", "мэдрэгч", "автоматжуулалт"],
    mn: `**Smart Home — ухаалаг гэрийн систем:**\n\n**Эрчим хүчний хэмнэлт:**\n• Smart thermostat: **15–25%**\n• LED гэрэлтүүлэг + мэдрэгч: **30–50%**\n• Smart хөшиг/жалюзи: **8–15%**\n• Нийт хэрэгжүүлвэл: **25–40%** хэмнэнэ\n\n**Платформ:**\n• Home Assistant (нээлттэй эх)\n• Google Home\n• Apple HomeKit\n• Xiaomi / Aqara (хямд сонголт)\n\n**Монгол орны хувьд:**\n• Гэрийн дулааны мэдрэгч хамгийн ашигтай\n• GSM-д суурилсан систем → алс удирдлага боломжтой`,
    en: `**Smart Home systems:**\n\n**Energy savings:**\n• Smart thermostat: **15–25%**\n• LED lighting + occupancy sensors: **30–50%**\n• Smart blinds/curtains: **8–15%**\n• Full implementation: **25–40%** savings\n\n**Platforms:**\n• Home Assistant (open source)\n• Google Home\n• Apple HomeKit\n• Xiaomi / Aqara (affordable)\n\n**For Mongolia:**\n• Thermal sensors most beneficial\n• GSM-based systems → remote control via mobile`,
    sources: ["IEA Smart Home Technology 2023", "Rocky Mountain Institute — Smart Building Guide 2022", "Монголын Мэдээлэл Технологийн Холбоо (МАТА) тайлан 2023"],
  },

  // ── UB climate ──
  {
    keys: ["улаанбаатарын цаг уур", "ub climate", "монголын цаг уур", "temperature", "температур", "өвлийн"],
    mn: `**Улаанбаатарын цаг уурын мэдээлэл:**\n\n• Нийслэл дэлхийн хамгийн хүйтэн: **дундаж -2.4°C**\n• 1-р сарын дундаж: **-22°C** (хамгийн хүйтэн -42°C)\n• 7-р сарын дундаж: **+17°C**\n• Жилийн HDD: **4,500–5,200**\n• Жилийн нарлаг цаг: **2,800–3,300 цаг**\n\n**Барилгад нөлөөлөл:**\n• Температур -10°C-ээр буурахад халаалтын ачаалал **35–45%** нэмэгддэг\n• Салхины хурдасны ба дулааны алдагдал: **10–20%** нэмэгддэг`,
    en: `**Ulaanbaatar climate data:**\n\n• World's coldest capital: **avg -2.4°C annually**\n• January average: **-22°C** (min -42°C)\n• July average: **+17°C**\n• Annual HDD: **4,500–5,200**\n• Annual sunshine hours: **2,800–3,300**\n\n**Impact on buildings:**\n• Each -10°C temperature drop adds **35–45%** to heating load\n• Wind chill increases heat loss by **10–20%**`,
    sources: ["Монгол Улсын Цаг уур, орчны шинжилгааны газар (ЦУОШГ) 2023", "World Meteorological Organization Climate Normals", "NASA POWER Climate Data"],
  },

  // ── District heating ──
  {
    keys: ["дулааны систем", "district heating", "дулааны сүлжээ", "дулаан хангамж", "центральна"],
    mn: `**Улаанбаатарын дулааны сүлжээ (District Heating):**\n\n• Дулаан хангагдах барилга: **70%+** (нийт орон сууцны)\n• Нийт уртаар: **1,200+ км хоолой**\n• Дулааны алдагдал: **15–25%** (хоолойд)\n• Гол эх үүсвэр: **Дулааны цахилгаан станц (ДЦС) №2, №3, №4**\n\n**Давуу тал:**\n• Хувь хэрэглэгчид хямд\n• Агаарын бохирдол бага\n\n**Сул тал:**\n• Хэрэглэгч тохируулах боломжгүй\n• Сүлжээний алдагдал өндөр\n• 2050 он гэхэд шинэчлэх шаардлагатай`,
    en: `**Ulaanbaatar District Heating System:**\n\n• Buildings connected: **70%+** of total housing\n• Network length: **1,200+ km of pipes**\n• Distribution losses: **15–25%**\n• Main sources: **CHP plants #2, #3, #4**\n\n**Advantages:**\n• Cheaper for end users\n• Less air pollution\n\n**Disadvantages:**\n• Users cannot adjust temperature\n• High network losses\n• Needs major overhaul by 2050`,
    sources: ["Улаанбаатар Дулааны Сүлжээ ТӨХК тайлан 2023", "Дэлхийн банк — Монгол Дулааны сүлжээний сайжруулалтын судалгаа 2022"],
  },

  // ── БНТУ standards ──
  {
    keys: ["бнту", "норматив", "стандарт", "building standard", "монголын стандарт", "thermal standard"],
    mn: `**БНТУ 23-02-09 — Барилгын дулааны хамгаалалт:**\n\nЭнэ бол Монгол Улсын барилгын дулааны үндсэн стандарт:\n\n**Гол шаардлага:**\n• Гадна хана: R ≥ 3.2 м²К/Вт\n• Дээвэр: R ≥ 5.0 м²К/Вт\n• Доод шал: R ≥ 4.0 м²К/Вт\n• Цонх: U ≤ 1.4 Вт/м²К\n\n**EUI зорилт (зэрэглэл):**\n• Шинэ барилга: ≤ 150 кВт·цаг/м²/жил\n• Шинэчлэгдсэн барилга: ≤ 180 кВт·цаг/м²/жил\n\n**Мөн хамааралтай:**\n• БНТУ 23-02-01 (Дулааны ерөнхий)\n• MNS 6055 (Барилгын энергийн шошго)`,
    en: `**БНТУ 23-02-09 — Building Thermal Protection Standard:**\n\nMongolia's primary building thermal standard:\n\n**Key requirements:**\n• Exterior wall: R ≥ 3.2 m²K/W\n• Roof: R ≥ 5.0 m²K/W\n• Ground floor: R ≥ 4.0 m²K/W\n• Windows: U ≤ 1.4 W/m²K\n\n**EUI targets (by grade):**\n• New buildings: ≤ 150 kWh/m²/year\n• Retrofitted: ≤ 180 kWh/m²/year\n\n**Related standards:**\n• БНТУ 23-02-01 (General thermal)\n• MNS 6055 (Building energy labelling)`,
    sources: ["БНТУ 23-02-09:2023 — Монгол Улсын Барилгын норм ба дүрэм", "MNS 6055:2020 Барилгын эрчим хүчний гүйцэтгэл"],
  },

  // ── Energy saving tips ──
  {
    keys: ["хэрхэн хэмнэх", "how to save", "зөвлөгөө", "хэмнэлтийн арга", "energy saving", "хэмнэх арга"],
    mn: `**Эрчим хүч хэмнэх шилдэг 8 арга:**\n\n1. **Дулаалга** — хана, дээвэр → 35–50% хэмнэлт\n2. **Цонх солих** — вакуум/3 давхар → 15–25%\n3. **Smart thermostat** → 15–25%\n4. **LED гэрэлтүүлэг** → 10–20%\n5. **Агааржуулалт сайжруулах** → 5–15%\n6. **Нарны дулааны систем** → 10–30%\n7. **Хаалга, цонхны нь битүүмжлэх** → 5–10%\n8. **Зуухны үр ашгийг сайжруулах** → 10–20%\n\nНийт боломжит хэмнэлт: **40–70%**\nНийт хөрөнгө оруулалт: **5–30 сая₮** (байрлал, хэмжээнээс хамаарна)`,
    en: `**Top 8 energy saving measures:**\n\n1. **Insulation** — walls, roof → 35–50% savings\n2. **Window replacement** — vacuum/triple → 15–25%\n3. **Smart thermostat** → 15–25%\n4. **LED lighting** → 10–20%\n5. **Improve ventilation** → 5–15%\n6. **Solar thermal system** → 10–30%\n7. **Seal doors & windows** → 5–10%\n8. **Upgrade heating efficiency** → 10–20%\n\nTotal potential savings: **40–70%**\nTotal investment: **5–30M₮** (depends on size & location)`,
    sources: ["Rocky Mountain Institute — Mongolia Energy Efficiency 2022", "БНТУ 23-02-09", "IEA Energy Efficiency 2023 Report"],
  },

  // ── Gcal conversion ──
  {
    keys: ["гкал", "gcal", "гигакалори", "дулааны нэгж", "бтт", "btu"],
    mn: `**Дулааны нэгжийн хөрвүүлэлт:**\n\n• **1 Гкал = 1,163 кВт·цаг**\n• 1 кВт·цаг = 0.86 МЖ\n• 1 Гкал = 4,186 МЖ = 1,000 Мкал\n\n**Жишээ:**\n• 60м² айлын сарын дулаан: ~2–4 Гкал\n• Үнэ: 2 Гкал × 160,000₮ ≈ **320,000₮/сар**\n• Жилийн зардал (9 сар): ≈ **2.9 сая₮**\n\n**Дулааны бэлэн байдал (UB):**\n• Эхлэх: 10-р сарын 15\n• Дуусах: 5-р сарын 15`,
    en: `**Heating unit conversion:**\n\n• **1 Gcal = 1,163 kWh**\n• 1 kWh = 0.86 MJ\n• 1 Gcal = 4,186 MJ = 1,000 Mcal\n\n**Example:**\n• 60m² apartment monthly heating: ~2–4 Gcal\n• Cost: 2 Gcal × 160,000₮ ≈ **320,000₮/month**\n• Annual cost (9 months): ≈ **2.9M₮**\n\n**UB heating season:**\n• Start: October 15\n• End: May 15`,
    sources: ["SI unit definitions (BIPM)", "Улаанбаатар Дулааны Сүлжээ ТӨХК тарифын журам 2024"],
  },

  // ── Energy grade ──
  {
    keys: ["эрчим хүчний зэрэглэл", "energy grade", "а зэрэглэл", "grade a", "grade b", "энергийн шошго", "зэрэглэл"],
    mn: `**Барилгын эрчим хүчний зэрэглэл (А–G):**\n\n| Зэрэглэл | EUI (кВт·цаг/м²/жил) | Тайлбар |\n|----------|----------------------|----------|\n| **A** | < 120 | Маш үр ашигтай |\n| **B** | 120–150 | Сайн |\n| **C** | 150–175 | Дундаж дээш |\n| **D** | 175–210 | Дундаж |\n| **E** | 210–260 | Дундажаас доош |\n| **F** | 260–320 | Муу |\n| **G** | > 320 | Маш муу |\n\nУБ-ын байрны **70%** D–F зэрэглэлд байдаг. А зэрэглэл рүү шилжих нь жилд **50,000–300,000₮** хэмнэнэ.`,
    en: `**Building Energy Grade (A–G):**\n\n| Grade | EUI (kWh/m²/yr) | Description |\n|-------|-----------------|-------------|\n| **A** | < 120 | Very efficient |\n| **B** | 120–150 | Good |\n| **C** | 150–175 | Above average |\n| **D** | 175–210 | Average |\n| **E** | 210–260 | Below average |\n| **F** | 260–320 | Poor |\n| **G** | > 320 | Very poor |\n\n**70%** of UB apartments fall in D–F grades. Moving to grade A saves **50,000–300,000₮/year**.`,
    sources: ["MNS 6055:2020 Барилгын эрчим хүчний гүйцэтгэл шошго", "EU Energy Performance of Buildings Directive (adapted)"],
  },

  // ── Occupancy / density ──
  {
    keys: ["суурьшилт", "хүн амын нягтрал", "occupancy", "density", "хэрэглэгч тоо"],
    mn: `**Суурьшилтын нөлөө:**\n\nДундаж суурьшилт:\n• **Суурьшилтын нягтрал = хүн тоо / талбай × 100**\n• Хэвийн: 1–3 хүн/100м²\n• Өндөр: 3–5 хүн/100м² → EUI +15–20%\n\nСуурьшилт нэмэгдэхийн хирээр:\n• Цахилгааны хэрэглээ (тоног, гэрэл) ↑\n• Халаалтын хэрэглээ ↑\n• Агааржуулалтын шаардлага ↑\n\nДундаж Монгол айл: **3–4 хүн, 40–70м²** — нягтрал 5–10 хүн/100м²`,
    en: `**Occupancy impact on energy:**\n\nOccupancy density:\n• **Density = persons / floor area × 100**\n• Normal: 1–3 people/100m²\n• High: 3–5 people/100m² → EUI +15–20%\n\nAs occupancy increases:\n• Electrical load (equipment, lighting) ↑\n• Heating consumption ↑\n• Ventilation requirements ↑\n\nAverage Mongolian household: **3–4 people, 40–70m²** — density 5–10 people/100m²`,
    sources: ["БНТУ 23-02-09", "IEA Buildings 2022 — Occupancy Impact Studies"],
  },

  // ── Case studies ──
  {
    keys: ["жишээ барилга", "case study", "бодит барилга", "бодит жишээ", "жишилт"],
    mn: `**УБ-ын бодит барилгуудын жишилт:**\n\n**1. Панельн 9 давхар байр (1982 он)**\n• Талбай: 4,500м², 80 айл\n• Бодит хэрэглээ: **318,000 кВт·цаг/жил**\n• EUI: 70.7 кВт·цаг/м² → Зэрэглэл: D\n\n**2. Шинэ бетон байр (2019 он)**\n• Талбай: 6,800м², 120 айл\n• Бодит хэрэглээ: **268,000 кВт·цаг/жил**\n• EUI: 39.4 кВт·цаг/м² → Зэрэглэл: B\n\n**3. Оффис барилга (2006 он)**\n• Талбай: 3,200м²\n• Бодит хэрэглээ: **1,020,000 кВт·цаг/жил**\n• EUI: 318.8 кВт·цаг/м² → Зэрэглэл: G`,
    en: `**Real UB building case studies:**\n\n**1. 9-floor panel apartment (1982)**\n• Area: 4,500m², 80 units\n• Actual consumption: **318,000 kWh/year**\n• EUI: 70.7 kWh/m² → Grade: D\n\n**2. New concrete apartment (2019)**\n• Area: 6,800m², 120 units\n• Actual consumption: **268,000 kWh/year**\n• EUI: 39.4 kWh/m² → Grade: B\n\n**3. Office building (2006)**\n• Area: 3,200m²\n• Actual consumption: **1,020,000 kWh/year**\n• EUI: 318.8 kWh/m² → Grade: G`,
    sources: ["Нийслэлийн Эрчим хүчний газар — Барилгын эрчим хүчний аудит тайлан 2022", "Монголын Барилгачдын Холбоо судалгаа 2021"],
  },

  // ── Farewell / thanks ──
  {
    keys: ["баярлалаа", "thanks", "thank you", "танд баярлалаа", "болоо", "хангалттай"],
    mn: "Баярлалаа! Цааш ч бас асуух зүйл байвал чөлөөтэй асуугаарай. UB Energy-г ашигласанд баярлалаа!",
    en: "Thank you! Feel free to ask anything else anytime. Thanks for using UB Energy!",
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
  // Fallback
  const fallback = lang === "en"
    ? `I can help with energy topics like tariffs, HDD, EUI, insulation, heating systems, solar, ML model, and more. Try asking about:\n• "Electricity tariff"\n• "HDD calculation"\n• "Energy grade A-G"\n• "How to save energy"`
    : `Дараах сэдвүүдээр асуувал дэлгэрэнгүй хариулт өгнө:\n• "Цахилгааны тариф"\n• "HDD тооцоолол"\n• "Эрчим хүчний зэрэглэл"\n• "Хэрхэн хэмнэх вэ"`;
  return { text: fallback, sources: [] };
}

// ─── Markdown-like renderer ───────────────────────────────────────────────────
function renderText(text) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    return <span key={i}>{parts}{i < text.split("\n").length - 1 && <br />}</span>;
  });
}

// ─── Chatbot component ────────────────────────────────────────────────────────
export default function Chatbot() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const greeting = t.chatbot.greeting.replace("{name}", user ? `, ${user.name}` : "");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: "bot", text: greeting, sources: [] }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const toggleRef = useRef(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    setMessages([{ from: "bot", text: greeting, sources: [] }]);
  }, [greeting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else toggleRef.current?.focus();
  }, [open]);

  const send = (text = input.trim()) => {
    if (!text) return;
    setMessages(prev => [...prev, { from: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const res = getBotResponse(text, lang);
      setMessages(prev => [...prev, { from: "bot", text: res.text, sources: res.sources }]);
      setTyping(false);
    }, 500 + Math.random() * 400);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === "Escape") setOpen(false);
  };

  const clearChat = () => setMessages([
    { from: "bot", text: t.chatbot.new_chat.replace("{name}", user ? `, ${user.name}` : ""), sources: [] }
  ]);

  const chips = [t.chatbot.chip1, t.chatbot.chip2, t.chatbot.chip3, t.chatbot.chip4];

  return (
    <div className="chatbot-wrapper">
      {open && (
        <div className="chatbot-box animate-fade" onKeyDown={e => e.key === "Escape" && setOpen(false)}>
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-bot-avatar"><Bot size={16} /></div>
              <div>
                <span className="chatbot-header-name">{APP_NAME} AI</span>
                <span className="chatbot-status">● {t.chatbot.online}</span>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button onClick={clearChat} className="chatbot-close" title={t.chatbot.clear}>
                <Trash2 size={15} />
              </button>
              <button onClick={() => setOpen(false)} className="chatbot-close">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="chatbot-messages" aria-live="polite">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.from}`}>
                <div className="chat-avatar">
                  {msg.from === "bot" ? <Bot size={13} /> : <User size={13} />}
                </div>
                <div className="chat-bubble-wrap">
                  <div className="chat-bubble">{renderText(msg.text)}</div>
                  {msg.from === "bot" && msg.sources?.length > 0 && (
                    <div className="chat-sources">
                      <BookOpen size={11} />
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

          <div className="chatbot-chips">
            {chips.map(c => (
              <button key={c} className="chip" disabled={typing} onClick={() => send(c)}>
                {c}
              </button>
            ))}
          </div>

          <div className="chatbot-input-row">
            <input
              ref={inputRef}
              className="chatbot-input form-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t.chatbot.placeholder}
            />
            <button className="btn btn-primary chatbot-send" onClick={() => send()} disabled={typing || !input.trim()}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        ref={toggleRef}
        className={`chatbot-toggle ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        title={t.chatbot.title}
        aria-expanded={open}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {!open && <span className="chatbot-pulse" />}
      </button>
    </div>
  );
}
