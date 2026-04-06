// Mock data for the energy consumption website

export const monthlyEnergyData = [
  { month: "1-р сар",  month_en: "Jan", usage: 4200, temperature: -18, hdd: 560, predicted: 4150 },
  { month: "2-р сар",  month_en: "Feb", usage: 3900, temperature: -15, hdd: 510, predicted: 3850 },
  { month: "3-р сар",  month_en: "Mar", usage: 3200, temperature: -5,  hdd: 420, predicted: 3100 },
  { month: "4-р сар",  month_en: "Apr", usage: 2100, temperature: 5,   hdd: 280, predicted: 2050 },
  { month: "5-р сар",  month_en: "May", usage: 1200, temperature: 14,  hdd: 120, predicted: 1180 },
  { month: "6-р сар",  month_en: "Jun", usage: 800,  temperature: 20,  hdd: 30,  predicted: 820  },
  { month: "7-р сар",  month_en: "Jul", usage: 750,  temperature: 22,  hdd: 10,  predicted: 780  },
  { month: "8-р сар",  month_en: "Aug", usage: 780,  temperature: 21,  hdd: 15,  predicted: 800  },
  { month: "9-р сар",  month_en: "Sep", usage: 1100, temperature: 12,  hdd: 150, predicted: 1080 },
  { month: "10-р сар", month_en: "Oct", usage: 2400, temperature: 0,   hdd: 340, predicted: 2350 },
  { month: "11-р сар", month_en: "Nov", usage: 3500, temperature: -10, hdd: 450, predicted: 3480 },
  { month: "12-р сар", month_en: "Dec", usage: 4000, temperature: -16, hdd: 530, predicted: 3950 },
];

// Static daily data — seeded to avoid chart flicker on hot-reload
const _DAILY_USAGE     = [128,142,115,138,121,109,145,132,118,140,125,112,137,123,119,143,130,116,141,127,113,139,124,120,144,131,117,136,122,118];
const _DAILY_TEMP      = [-19,-18,-20,-19,-17,-21,-18,-20,-19,-18,-20,-17,-19,-21,-18,-20,-19,-17,-21,-18,-20,-19,-18,-21,-17,-20,-18,-19,-20,-18];
const _DAILY_PREDICTED = [122,138,110,133,116,104,140,127,114,135,119,108,132,118,115,138,125,111,136,122,109,134,119,116,139,126,113,131,117,114];
export const dailyEnergyData = Array.from({ length: 30 }, (_, i) => ({
  day:         `${i + 1}`,
  usage:       _DAILY_USAGE[i],
  temperature: _DAILY_TEMP[i],
  predicted:   _DAILY_PREDICTED[i],
}));

export const yearlyEnergyData = [
  { year: "2018", usage: 28000, predicted: 27500 },
  { year: "2019", usage: 29500, predicted: 29000 },
  { year: "2020", usage: 27000, predicted: 27200 },
  { year: "2021", usage: 30000, predicted: 29800 },
  { year: "2022", usage: 31500, predicted: 31200 },
  { year: "2023", usage: 32000, predicted: 31900 },
  { year: "2024", usage: 33000, predicted: 32800 },
  { year: "2025", usage: 33500, predicted: 33300 },
  { year: "2026", usage: null,  predicted: 34000 },
];

export const featureImportanceData = [
  { feature: "Талбай (м²)",     feature_en: "Area (m²)",         importance: 0.28 },
  { feature: "HDD",             feature_en: "HDD",                importance: 0.22 },
  { feature: "Барилгасан он",   feature_en: "Year Built",         importance: 0.15 },
  { feature: "Давхрын тоо",     feature_en: "Floors",             importance: 0.12 },
  { feature: "Цонхны харьцаа",  feature_en: "Window Ratio",       importance: 0.10 },
  { feature: "Ханын материал",  feature_en: "Wall Material",       importance: 0.08 },
  { feature: "Халаалтын төрөл", feature_en: "Heating Type",        importance: 0.05 },
];

export const shapData = [
  { feature: "Талбай: 1200м²",        feature_en: "Area: 1200m²",         impact:  2.5 },
  { feature: "HDD: 4200",             feature_en: "HDD: 4200",             impact:  1.8 },
  { feature: "Он: 1995",              feature_en: "Year: 1995",            impact:  1.2 },
  { feature: "Цонх: 25%",             feature_en: "Window: 25%",           impact:  0.9 },
  { feature: "Давхар: 9",             feature_en: "Floors: 9",             impact:  0.7 },
  { feature: "Материал: Панель",      feature_en: "Material: Panel",       impact: -0.5 },
  { feature: "Халаалт: Төвлөрсөн",   feature_en: "Heating: Central",      impact: -0.8 },
];

export const modelMetrics = {
  mae: 245.3,
  rmse: 312.7,
  r2: 0.924,
  mape: 8.2,
};

// height = floors × 3m, volume = area × height, co2 = usage × 0.7 / 1000 (tonnes)
// rating: A=2015+, B=2010-14, C=2004-09, D=1995-2003, E=1990-94, F=1983-89, G=<1983
export const buildingsData = [
  { id: 1,  name: "Сансар 15-р байр",        type: "apartment",  area: 2400,  usage: 38500,  year: 1992, district: "Чингэлтэй", lat: 47.915, lng: 106.915, floors: 9,  height: 27, volume: 64800,  co2: 27.0, rating: "E" },
  { id: 2,  name: "Монгол Цахилгаан ХК",     type: "office",     area: 3200,  usage: 52000,  year: 2005, district: "Сүхбаатар", lat: 47.920, lng: 106.920, floors: 8,  height: 24, volume: 76800,  co2: 36.4, rating: "C" },
  { id: 3,  name: "1-р Дунд сургууль",       type: "school",     area: 4500,  usage: 65000,  year: 1985, district: "Баянзүрх",  lat: 47.910, lng: 106.940, floors: 3,  height: 9,  volume: 40500,  co2: 45.5, rating: "F" },
  { id: 4,  name: "Энхтайвны 5-р байр",      type: "apartment",  area: 1800,  usage: 29000,  year: 1998, district: "Баянгол",   lat: 47.905, lng: 106.890, floors: 5,  height: 15, volume: 27000,  co2: 20.3, rating: "D" },
  { id: 5,  name: "Хан-Уул оффис",           type: "office",     area: 1500,  usage: 24500,  year: 2010, district: "Хан-Уул",   lat: 47.895, lng: 106.870, floors: 4,  height: 12, volume: 18000,  co2: 17.2, rating: "B" },
  { id: 6,  name: "3-р эмнэлэг",             type: "hospital",   area: 6000,  usage: 98000,  year: 1988, district: "Сүхбаатар", lat: 47.925, lng: 106.930, floors: 6,  height: 18, volume: 108000, co2: 68.6, rating: "F" },
  { id: 7,  name: "Нарантуул 8-р байр",      type: "apartment",  area: 3600,  usage: 58000,  year: 2001, district: "Чингэлтэй", lat: 47.918, lng: 106.900, floors: 12, height: 36, volume: 129600, co2: 40.6, rating: "D" },
  { id: 8,  name: "Их Дэлгүүр",              type: "commercial", area: 8000,  usage: 125000, year: 2008, district: "Сүхбаатар", lat: 47.922, lng: 106.915, floors: 5,  height: 15, volume: 120000, co2: 87.5, rating: "C" },
  { id: 9,  name: "Зайсан 12-р байр",        type: "apartment",  area: 5000,  usage: 75000,  year: 2015, district: "Хан-Уул",   lat: 47.888, lng: 106.865, floors: 16, height: 48, volume: 240000, co2: 52.5, rating: "A" },
  { id: 10, name: "Технологийн Их Сургууль", type: "school",     area: 12000, usage: 185000, year: 1969, district: "Чингэлтэй", lat: 47.912, lng: 106.905, floors: 4,  height: 12, volume: 144000, co2: 129.5,rating: "G" },
];

export const ulaanbaatarDistricts = [
  "Баянгол", "Баянзүрх", "Чингэлтэй", "Сүхбаатар", "Сонгинохайрхан", "Хан-Уул", "Налайх", "Багануур", "Багахангай"
];

export const adminStats = {
  totalUsers: 1247,
  activeUsers: 389,
  totalPredictions: 8432,
  totalBuildings: buildingsData.length,
  systemUptime: "99.7%",
  lastBackup: "2026-04-01 03:00",
};

