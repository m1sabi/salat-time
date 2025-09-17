/*!
 * PrayTimes.js (lite) — minimal subset for Fajr/Sunrise/Dhuhr/Asr/Sunset/Isha
 * Supports methods: MWL, Makkah (UmmAlQura), UOIF
 * Allows angle overrides via adjust({fajr, isha, ishaInterval, asr, highLats, dhuhr})
 * Based on Hamid Zarrabi-Zadeh's PrayTimes (MIT). Trimmed for your needs.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PrayTimes = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  function D2R(d){ return (d*Math.PI)/180; }
  function R2D(r){ return (r*180)/Math.PI; }
  function fixAngle(a){ return a - 360*Math.floor(a/360); }
  function fixHour(a){ return a - 24*Math.floor(a/24); }

  function sin(d){ return Math.sin(D2R(d)); }
  function cos(d){ return Math.cos(D2R(d)); }
  function tan(d){ return Math.tan(D2R(d)); }
  function asin(x){ return R2D(Math.asin(x)); }
  function acos(x){ return R2D(Math.acos(x)); }
  function atan(x){ return R2D(Math.atan(x)); }
  function atan2(y,x){ return R2D(Math.atan2(y,x)); }

  function decimalTimeToString(time) {
    if (isNaN(time)) return null;
    time = fixHour(time+0.5/60); // add 30 seconds
    var h = Math.floor(time), m = Math.floor((time-h)*60);
    return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
  }

  var methods = {
    MWL: { fajr: 18, isha: 17 },
    Makkah: { fajr: 18.5, isha: '90 min' }, // base; we can override to 18°
    UOIF: { fajr: 12, isha: 12 } // placeholder; you override in your code if needed
  };

  function julian(date) {
    // date is local Date
    var year = date.getFullYear(), month = date.getMonth()+1, day = date.getDate();
    if (month <= 2){ year -= 1; month += 12; }
    var A = Math.floor(year/100);
    var B = 2 - A + Math.floor(A/4);
    var jd = Math.floor(365.25*(year+4716)) + Math.floor(30.6001*(month+1)) + day + B - 1524.5;
    return jd;
  }

  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fixAngle(357.529 + 0.98560028*D);
    var q = fixAngle(280.459 + 0.98564736*D);
    var L = fixAngle(q + 1.915*sin(g) + 0.020*sin(2*g));
    var e = 23.439 - 0.00000036*D;
    var RA = atan2(cos(e)*sin(L), cos(L))/15;
    RA = fixHour(RA);
    var d = asin(sin(e)*sin(L));
    var EqT = q/15 - RA;
    return { decl: d, eqt: EqT };
  }

  function computeMidDay(t, jd) {
    var sp = sunPosition(jd + t);
    var Z = fixHour(12 - sp.eqt);
    return Z;
  }

  function computeTime(G, t, jd, lat, lng) {
    var sp = sunPosition(jd + t);
    var D = sp.decl, Z = computeMidDay(t, jd);
    var term = (-sin(G) - sin(D)*sin(lat)) / (cos(D)*cos(lat));
    if (Math.abs(term) > 1) return NaN;
    var V = (1/15) * acos(term);
    return Z + (G > 90 ? -V : V);
  }

  function getAsrFactor(asr) {
    // asr: "Standard" (shadow factor 1) or "Hanafi" (factor 2)
    return asr === 'Hanafi' ? 2 : 1;
  }

  function computeAsr(asr, t, jd, lat, lng) {
    var sp = sunPosition(jd + t);
    var D = sp.decl;
    var G = - R2D(Math.atan(1/(getAsrFactor(asr)+tan(Math.abs(lat-D)))));
    return computeTime(90 + G, t, jd, lat, lng);
  }

  function timezoneOffset(date, tz) {
    if (tz === 'auto') return -date.getTimezoneOffset()/60;
    if (typeof tz === 'number') return tz;
    return 0;
  }

  function PrayTimes(method) {
    this.method = methods[method] ? method : 'MWL';
    this.settings = {
      fajr: methods[this.method].fajr,
      isha: methods[this.method].isha,
      ishaInterval: (typeof methods[this.method].isha === 'string' && methods[this.method].isha.indexOf('min')>0)
        ? parseFloat(methods[this.method].isha)
        : 0,
      dhuhr: 0, // minutes after Z
      asr: 'Standard',
      highLats: 'None'
    };
  }

  PrayTimes.prototype.adjust = function(opts){
    opts = opts || {};
    if (opts.fajr != null) this.settings.fajr = opts.fajr;
    if (opts.isha != null) this.settings.isha = opts.isha;
    if (opts.ishaInterval != null) this.settings.ishaInterval = opts.ishaInterval;
    if (opts.dhuhr != null) this.settings.dhuhr = opts.dhuhr;
    if (opts.asr) this.settings.asr = opts.asr;
    if (opts.highLats) this.settings.highLats = opts.highLats;
  };

  PrayTimes.prototype.getTimes = function(date, coords, tz) {
    var lat = coords[0], lng = coords[1];
    var tzHours = timezoneOffset(date, tz || 'auto');

    var jDate = julian(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0,0,0)) - lng/360;

    // initial estimates
    var t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    for (var i=0;i<3;i++) {
      var Z = computeMidDay(t.dhuhr/24, jDate);
      var F = this.settings.fajr;
      var I = this.settings.isha;
      var ishaInt = this.settings.ishaInterval;

      var sp0 = sunPosition(jDate + t.sunrise/24);
      var D = sp0.decl;

      // Fajr/Sunrise/Sunset by angle
      t.fajr = computeTime(180 - F, t.fajr/24, jDate, lat, lng);
      t.sunrise = computeTime(180 - 0.833, t.sunrise/24, jDate, lat, lng);
      t.sunset  = computeTime(0.833, t.sunset/24, jDate, lat, lng);

      // Dhuhr
      t.dhuhr = Z + this.settings.dhuhr/60;

      // Asr
      t.asr = computeAsr(this.settings.asr, t.asr/24, jDate, lat, lng);

      // Isha by angle or fixed interval
      if (ishaInt && isFinite(ishaInt)) {
        t.isha = t.sunset + ishaInt/60;
      } else {
        t.isha = computeTime(I, t.isha/24, jDate, lat, lng);
      }
    }

    // to local time
    var times = {
      fajr: decimalTimeToString(t.fajr + tzHours),
      sunrise: decimalTimeToString(t.sunrise + tzHours),
      dhuhr: decimalTimeToString(t.dhuhr + tzHours),
      asr: decimalTimeToString(t.asr + tzHours),
      sunset: decimalTimeToString(t.sunset + tzHours),
      maghrib: decimalTimeToString(t.sunset + tzHours), // keep sunset as maghrib
      isha: decimalTimeToString(t.isha + tzHours)
    };
    return times;
  };

  return PrayTimes;
}));
