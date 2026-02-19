window.cities = window.cities || {};
window.cityCountryMap = window.cityCountryMap || {};

Object.assign(window.cities, {
  damascus: { lat: 33.5138, lng: 36.2765, label_ar: "دمشق", label_en: "Damascus" },
  aleppo:       { lat: 36.13, lng: 37.10, label_ar: "حلب",        label_en: "Aleppo" },
  homs:         { lat: 34.44, lng: 36.43, label_ar: "حمص",        label_en: "Homs" },
  tartus:       { lat: 34.55, lng: 35.52, label_ar: "طرطوس",      label_en: "Tartus" },
  daraa:        { lat: 32.37, lng: 36.06, label_ar: "درعا",       label_en: "Daraa" },
  hama:         { lat: 35.08, lng: 36.45, label_ar: "حماة",       label_en: "Hama" },
  idlib:        { lat: 35.46, lng: 36.40, label_ar: "إدلب",       label_en: "Idlib" },
  "an-nabk":    { lat: 34.01, lng: 36.44, label_ar: "النبك",      label_en: "An-Nabk" },
  "ar-raqqah":  { lat: 35.57, lng: 39.00, label_ar: "الرقة",      label_en: "Ar-Raqqah" },
  "deir-ez-zor":{ lat: 35.20, lng: 40.09, label_ar: "دير الزور",  label_en: "Deir ez-Zor" },
  "al-hasakah": { lat: 36.30, lng: 40.45, label_ar: "الحسكة",     label_en: "Al-Hasakah" },
  baniyas:      { lat: 35.08, lng: 36.05, label_ar: "بانياس",     label_en: "Baniyas" },
  jableh:       { lat: 35.17, lng: 36.03, label_ar: "جبلة",       label_en: "Jableh" },
  "ras-al-basit": { lat: 35.51, lng: 35.48, label_ar: "رأس البسيط", label_en: "Ras al-Basit" },
  kasab:        { lat: 35.92, lng: 35.98, label_ar: "كسب",        label_en: "Kasab" },
  masyaf:       { lat: 35.06, lng: 36.20, label_ar: "مصياف",      label_en: "Masyaf" },
});

Object.assign(window.cityCountryMap, {
  damascus:"sy",aleppo:"sy", homs:"sy", tartus:"sy", daraa:"sy", hama:"sy", idlib:"sy",
  "an-nabk":"sy", "ar-raqqah":"sy", "deir-ez-zor":"sy", "al-hasakah":"sy",
  baniyas:"sy", jableh:"sy", "ras-al-basit":"sy", kasab:"sy", masyaf:"sy",
});
