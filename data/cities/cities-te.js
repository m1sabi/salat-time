window.cities = window.cities || {};
window.cityCountryMap = window.cityCountryMap || {};

Object.assign(window.cities, {
  registerCity("Test_City",       { lat: 48.78, lng:  9.18, alt: 245, label_ar: "مدينة التجربة",       label_en: "test city" }, C);
})();

Object.assign(window.cityCountryMap, {
  Test_City:"te"
});
