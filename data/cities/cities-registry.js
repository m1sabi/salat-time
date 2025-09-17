// /data/cities/cities-registry.js
(function () {
  window.cities = window.cities || {};
  window.cityCountryMap = window.cityCountryMap || {};

  // Registers (or overwrites) a city + its country code.
  window.registerCity = function registerCity(key, def, countryCode) {
    if (!key || !def || !countryCode) return;
    window.cities[key] = def;
    window.cityCountryMap[key] = countryCode;
  };
})();
