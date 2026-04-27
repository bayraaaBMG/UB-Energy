// Баянмонгол хорооллын 82 айлтай 12 давхар байрны эрчим хүчний хэрэглээний өгөгдөл
// Энэ файл нь dashboard дээр харагдах chart, map, model metric, feature importance-ийн өгөгдлийг өгнө
// Өгөгдөл нь 2020–2025 оны цаг тутмын dataset-ээс нэгтгэсэн realistic synthetic data

export const monthlyEnergyData = [
  { month: "1-р сар", month_en: "Jan", usage: 165610, temperature: -20.3, hdd: 28521, predicted: 163126 },
  { month: "2-р сар", month_en: "Feb", usage: 147808, temperature: -16.8, hdd: 23696, predicted: 146477 },
  { month: "3-р сар", month_en: "Mar", usage: 95311, temperature: -5.7, hdd: 17598, predicted: 95025 },
  { month: "4-р сар", month_en: "Apr", usage: 86206, temperature: 3.4, hdd: 10561, predicted: 86465 },
  { month: "5-р сар", month_en: "May", usage: 86532, temperature: 9.9, hdd: 6289, predicted: 87311 },
  { month: "6-р сар", month_en: "Jun", usage: 35197, temperature: 16.1, hdd: 2531, predicted: 34669 },
  { month: "7-р сар", month_en: "Jul", usage: 36309, temperature: 18.6, hdd: 1188, predicted: 35982 },
  { month: "8-р сар", month_en: "Aug", usage: 36264, temperature: 15.9, hdd: 2302, predicted: 36156 },
  { month: "9-р сар", month_en: "Sep", usage: 91802, temperature: 10.4, hdd: 5740, predicted: 92077 },
  { month: "10-р сар", month_en: "Oct", usage: 99375, temperature: 0.1, hdd: 13345, predicted: 100270 },
  { month: "11-р сар", month_en: "Nov", usage: 104640, temperature: -10.2, hdd: 20306, predicted: 103071 },
  { month: "12-р сар", month_en: "Dec", usage: 165810, temperature: -20.4, hdd: 28582, predicted: 164318 },
];

// Өдрийн хэрэглээний chart-д ашиглана
// Энэ нь 2025 оны 1-р сарын өдөр бүрийн хэрэглээний жишээ
export const dailyEnergyData = [
  { day: "1", usage: 7256, temperature: -23.4, predicted: 7147 },
  { day: "2", usage: 3882, temperature: -22.9, predicted: 3847 },
  { day: "3", usage: 4928, temperature: -20.1, predicted: 4914 },
  { day: "4", usage: 6444, temperature: -20.5, predicted: 6464 },
  { day: "5", usage: 5126, temperature: -18.8, predicted: 5173 },
  { day: "6", usage: 4451, temperature: -17.2, predicted: 4384 },
  { day: "7", usage: 5577, temperature: -16.2, predicted: 5526 },
  { day: "8", usage: 6702, temperature: -25.8, predicted: 6681 },
  { day: "9", usage: 4083, temperature: -24.9, predicted: 4096 },
  { day: "10", usage: 5240, temperature: -22.8, predicted: 5287 },
  { day: "11", usage: 6794, temperature: -23.6, predicted: 6693 },
  { day: "12", usage: 4704, temperature: -21.9, predicted: 4662 },
  { day: "13", usage: 4567, temperature: -19.4, predicted: 4553 },
  { day: "14", usage: 6008, temperature: -22.2, predicted: 6026 },
  { day: "15", usage: 5948, temperature: -16.2, predicted: 6001 },
  { day: "16", usage: 4018, temperature: -15.2, predicted: 3957 },
  { day: "17", usage: 5177, temperature: -15.9, predicted: 5130 },
  { day: "18", usage: 7029, temperature: -16.3, predicted: 7007 },
  { day: "19", usage: 3577, temperature: -14.6, predicted: 3588 },
  { day: "20", usage: 4759, temperature: -16.5, predicted: 4802 },
  { day: "21", usage: 6186, temperature: -18.7, predicted: 6093 },
  { day: "22", usage: 5429, temperature: -16.0, predicted: 5380 },
  { day: "23", usage: 4243, temperature: -14.8, predicted: 4231 },
  { day: "24", usage: 5211, temperature: -11.8, predicted: 5227 },
  { day: "25", usage: 6427, temperature: -14.6, predicted: 6485 },
  { day: "26", usage: 4052, temperature: -25.1, predicted: 3991 },
  { day: "27", usage: 5366, temperature: -26.8, predicted: 5318 },
  { day: "28", usage: 6679, temperature: -24.1, predicted: 6659 },
  { day: "29", usage: 5047, temperature: -24.9, predicted: 5062 },
  { day: "30", usage: 4648, temperature: -21.6, predicted: 4690 },
  { day: "31", usage: 6060, temperature: -24.4, predicted: 5970 },
];

// Жилийн хэрэглээний chart-д ашиглана
// 2026–2027 оны usage null: ирээдүйн бодит хэрэглээ байхгүй, зөвхөн forecast утга
export const yearlyEnergyData = [
  { year: "2020", usage: 1150855, predicted: 1133593 },
  { year: "2021", usage: 1141547, predicted: 1131273 },
  { year: "2022", usage: 1153439, predicted: 1149979 },
  { year: "2023", usage: 1153391, predicted: 1156851 },
  { year: "2024", usage: 1153893, predicted: 1164278 },
  { year: "2025", usage: 1152059, predicted: 1134778 },
  { year: "2026", usage: null,    predicted: 1172796 },
  { year: "2027", usage: null,    predicted: 1185400 },
];

// Машин сургалтын model ямар feature-үүдийг хамгийн их ашиглаж байгааг харуулна
export const featureImportanceData = [
  { feature: "Гадна температур", feature_en: "Outdoor Temperature", importance: 0.31 },
  { feature: "Халаалтын улирал", feature_en: "Heating Season", importance: 0.21 },
  { feature: "Өмнөх 24 цагийн хэрэглээ", feature_en: "Lag 24h Usage", importance: 0.16 },
  { feature: "Цаг", feature_en: "Hour of Day", importance: 0.11 },
  { feature: "Оргил цаг", feature_en: "Peak Hour", importance: 0.08 },
  { feature: "Чийгшил", feature_en: "Humidity", importance: 0.07 },
  { feature: "Салхины хурд", feature_en: "Wind Speed", importance: 0.06 },
];

// SHAP explanation буюу тухайн таамагт feature бүр хэрхэн нөлөөлж байгааг харуулна
// Эерэг impact нь хэрэглээг өсгөж, сөрөг impact нь хэрэглээг бууруулж байна гэсэн утгатай
export const shapData = [
  { feature: "Температур: -25°C", feature_en: "Temperature: -25°C", impact: 2.7 },
  { feature: "Халаалтын улирал: тийм", feature_en: "Heating season: yes", impact: 2.1 },
  { feature: "Өмнөх өдөр өндөр хэрэглээтэй", feature_en: "High lag-24 usage", impact: 1.4 },
  { feature: "Оройн оргил цаг", feature_en: "Evening peak hour", impact: 0.9 },
  { feature: "Амралтын өдөр", feature_en: "Weekend", impact: 0.4 },
  { feature: "Зуны улирал", feature_en: "Summer season", impact: -1.8 },
  { feature: "Температур: +20°C", feature_en: "Temperature: +20°C", impact: -2.4 },
];

// Model-ийн үнэлгээний үзүүлэлтүүд
// MAE/RMSE бага байх тусам сайн, R2 1-д ойр байх тусам сайн
export const modelMetrics = {
  mae: 38.6,
  rmse: 52.4,
  r2: 0.941,
  mape: 6.7,
};

// Газрын зураг болон building list дээр харагдах барилгын мэдээлэл
// Гол судалгааны барилга нь Баянмонгол-1 байр
export const buildingsData = [
  {
    id: 1,
    name: "Баянмонгол-1 байр",
    type: "apartment",
    area: 8420,
    usage: 1150864,
    year: 2014,
    district: "Баянзүрх",
    lat: 47.9059,
    lng: 106.9474,
    floors: 12,
    apartments: 82,
    height: 36,
    volume: 303120,
    co2: 805.6,
    rating: "B",
  },
  {
    id: 2,
    name: "Баянмонгол-2 байр",
    type: "apartment",
    area: 7900,
    usage: 1048000,
    year: 2013,
    district: "Баянзүрх",
    lat: 47.9065,
    lng: 106.9481,
    floors: 12,
    apartments: 78,
    height: 36,
    volume: 284400,
    co2: 733.6,
    rating: "B",
  },
  {
    id: 3,
    name: "Баянмонгол үйлчилгээний төв",
    type: "commercial",
    area: 5200,
    usage: 865000,
    year: 2015,
    district: "Баянзүрх",
    lat: 47.9048,
    lng: 106.9465,
    floors: 5,
    height: 15,
    volume: 78000,
    co2: 605.5,
    rating: "A",
  },
  {
    id: 4,
    name: "Сансар 12 давхар байр",
    type: "apartment",
    area: 6800,
    usage: 965000,
    year: 2008,
    district: "Баянзүрх",
    lat: 47.9192,
    lng: 106.9368,
    floors: 12,
    apartments: 72,
    height: 36,
    volume: 244800,
    co2: 675.5,
    rating: "C",
  },
  {
    id: 5,
    name: "Натур хотхон байр",
    type: "apartment",
    area: 9100,
    usage: 1215000,
    year: 2016,
    district: "Баянзүрх",
    lat: 47.9027,
    lng: 106.9327,
    floors: 16,
    apartments: 96,
    height: 48,
    volume: 436800,
    co2: 850.5,
    rating: "A",
  },
  {
    id: 6,
    name: "13-р хороолол оффис",
    type: "office",
    area: 4300,
    usage: 720000,
    year: 2011,
    district: "Баянзүрх",
    lat: 47.9102,
    lng: 106.9302,
    floors: 8,
    height: 24,
    volume: 103200,
    co2: 504.0,
    rating: "B",
  },
];

// Дүүргийн filter/dropdown дээр ашиглагдана
export const ulaanbaatarDistricts = [
  "Баянгол",
  "Баянзүрх",
  "Чингэлтэй",
  "Сүхбаатар",
  "Сонгинохайрхан",
  "Хан-Уул",
  "Налайх",
  "Багануур",
  "Багахангай",
];

// Admin dashboard-ийн статистик хэсэгт ашиглагдана
// Тайлбар: totalUsers / activeUsers / totalPredictions нь Demo статистик болно.
// Бодит тоо нь backend/database интеграциас гарна.
export const adminStats = {
  totalUsers: 1284,
  activeUsers: 412,
  totalPredictions: 52608,
  totalBuildings: buildingsData.length,
  systemUptime: "99.7%",
  lastBackup: "2026-04-27 03:00",
  demoNote: "Demo статистик — бодит backend байхгүй тул эдгээр тоо нь жишиг утга болно",
};

// Өгөгдлийн тайлбар — chart болон тайлбар хэсэгт ашиглагдана
export const dataDescription = {
  mn: "Бодит нөхцөлд ойртуулсан синтетик өгөгдөл — Баянмонгол-1 байрны 2020–2025 оны цаг тутмын датасет (82 айл, 12 давхар, 8420 м²)",
  en: "Realistic synthetic data — Bayanmongol-1 building hourly dataset 2020–2025 (82 apartments, 12 floors, 8,420 m²)",
};