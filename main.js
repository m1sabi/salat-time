// ============================
// main.js — robust JSON loading (flat or per-country), tz-correct times,
// latitude rule for calc methods, dynamic hiding of UOIF below 45°,
// single-fire Azan scheduler that shows a OneSignal-driven notification
// with a "Stop Azan" action, plus mobile audio unlock.
// ============================

// IMPORTANT: We rely on OneSignal's SW only. Do NOT register another SW here.

// ====== ELEMENT SELECTORS ======
const elements = {
  countrySelect: document.getElementById("countrySelect"),
  citySelect: document.getElementById("citySelect"),
  daySelect: document.getElementById("daySelect"),
  prevDayBtn: document.getElementById("prevDayBtn"),
  nextDayBtn: document.getElementById("nextDayBtn"),
  selectedDayCell: document.getElementById("selectedDayCell"),

  sunriseCell: document.getElementById("sunriseCell"),
  sunsetCell: document.getElementById("sunsetCell"),
  fajrCell: document.getElementById("fajrCell"),
  ishaaCell: document.getElementById("ishaaCell"),

  // Makkah-based cells (show ONLY for lat >= 49)
  makkahFotorCell: document.getElementById("makkahFotorCell"),
  makkahIshaaCell: document.getElementById("makkahIshaaCell"),

  // Optional Dhuhr/Asr
  dhuhrCell: document.getElementById("dhuhrCell"),
  asrCell: document.getElementById("asrCell"),

  latitudeCell: document.getElementById("latitudeCell"),
  soundSelect: document.getElementById("soundSelect"),
  previewBtn: document.getElementById("previewBtn"),
  azanSound: document.getElementById("azanSound"),

  // Pray method selector
  calcMethodSelect: document.getElementById("calcMethodSelect"),

  // Countdown and digital clock
  countdown: document.getElementById("countdown"),
  digitalClock: document.getElementById("digitalClock"),
};

// ====== STATE ======
let countdownActive = false;
let cooldownUntil = 0;
let askedForNotify = false;

// keep a template of the UOIF <option> so we can remove/add it
let UOIF_OPTION_TEMPLATE = null;

// prevent multiple popups inside the same minute (per prayer)
const triggeredThisMinute = {
  Sunrise: null,
  Fajr: null,
  Dhuhr: null,
  Asr: null,
  Maghrib: null,
  Ishaa: null
};

// Per-prayer audio toggle
const PRAYER_KEYS = [
  "sunrise","fajr","dhuhr","asr","maghrib","ishaa",
  "makkah_maghrib","makkah_ishaa"
];

function loadAlarmEnabled() {
  try {
    const raw = localStorage.getItem("alarmEnabled");
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  const allOn = {};
  PRAYER_KEYS.forEach(k => allOn[k] = true);
  return allOn;
}
function saveAlarmEnabled(val) {
  try { localStorage.setItem("alarmEnabled", JSON.stringify(val)); } catch (_) {}
}
let alarmEnabled = loadAlarmEnabled();

// ====== UTILITIES ======
function timeToMinutes(t) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}
function timeToSeconds(t) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 3600 + mm * 60;
}
function minutesToTime(m) {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}
function subtract1h05(timeStr) { return minutesToTime(timeToMinutes(timeStr) - 65); }
function add1h05(timeStr)      { return minutesToTime(timeToMinutes(timeStr) + 65); }

function parseTodayTimeToDate(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return null;
  const now = new Date();
  const [hh, mm] = hhmm.split(':').map(Number);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

// --- Timezone helpers ---
const FALLBACK_COUNTRY_TZS = {
  sy: "Asia/Damascus",
  de: "Europe/Berlin",
  se: "Europe/Stockholm",
  sa: "Asia/Riyadh",
  jo: "Asia/Amman",
  sd: "Africa/Khartoum",
};
function getCityLatLng(cityKey) {
  if (window.cities && window.cities[cityKey]) {
    const c = window.cities[cityKey];
    return { lat: c.lat, lng: c.lng };
  }
  return null;
}
function getCityCountryCode(cityKey) {
  if (window.cityCountryMap && window.cityCountryMap[cityKey]) {
    return window.cityCountryMap[cityKey];
  }
  return null;
}
function getCountryTimezone(code) {
  const c = (window.countries && window.countries[code]) || {};
  return c.tz || FALLBACK_COUNTRY_TZS[code] || undefined;
}
function getCityTimezone(cityKey) {
  const cc = getCityCountryCode(cityKey);
  if (!cc) return undefined;
  return getCountryTimezone(cc);
}
function extractLocalTimeFromISO(isoString, timeZone) {
  try {
    const d = new Date(isoString);
    if (timeZone) {
      return d.toLocaleTimeString("en-GB", {
        hour12: false, hour: "2-digit", minute: "2-digit", timeZone
      });
    } else {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  } catch (_) {
    return (isoString.split("T")[1] || "").substring(0, 5) || "—";
  }
}
function daysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// ====== Country + City dropdowns ======
function populateCountryDropdown() {
  const sel = elements.countrySelect;
  if (!sel) return;

  const countries = (window && window.countries) || null;
  if (!countries || !Object.keys(countries).length) {
    sel.style.display = "none";
    return;
  }

  sel.innerHTML = "";
  Object.entries(countries).forEach(([key, c]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = c.label_ar || key;
    sel.appendChild(opt);
  });
}

function rebuildCityDropdown() {
  const citySel = elements.citySelect;
  if (!citySel || !window.cities) return;

  const selectedCountry = elements.countrySelect && elements.countrySelect.style.display !== "none"
    ? elements.countrySelect.value
    : null;

  citySel.innerHTML = "";

  const entries = Object.entries(window.cities).filter(([key]) => {
    if (!selectedCountry || !window.cityCountryMap) return true;
    const ctry = window.cityCountryMap[key];
    return ctry === selectedCountry;
  });

  const list = entries.length ? entries : Object.entries(window.cities);

  list.forEach(([key, city]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = city.label_ar && city.label_en
      ? `${city.label_ar} (${city.label_en})`
      : (city.label_ar || key);
    citySel.appendChild(opt);
  });
}

// ====== Day dropdown (1..31) ======
(function populateDayDropdown() {
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement("option");
    opt.value = i.toString();
    opt.textContent = `اليوم ${i}`;
    elements.daySelect.appendChild(opt);
  }
})();

// ====== Sounds from sounds.js (if present) ======
if (window.soundOptions && Array.isArray(window.soundOptions)) {
  window.soundOptions.forEach(option => {
    const opt = document.createElement("option");
    opt.value = option.file;
    opt.textContent = option.label;
    elements.soundSelect.appendChild(opt);
  });
}

// ====== RESTORE SETTINGS & INITIAL BUILD ======
(function initSelectors() {
  populateCountryDropdown();

  const selCountry = localStorage.getItem("selectedCountry");
  if (selCountry && elements.countrySelect && elements.countrySelect.style.display !== "none") {
    const has = Array.from(elements.countrySelect.options).some(o => o.value === selCountry);
    if (has) elements.countrySelect.value = selCountry;
  }

  rebuildCityDropdown();

  const savedCity = localStorage.getItem("selectedCity")
    || (elements.citySelect.options[0]?.value || "");
  elements.citySelect.value = savedCity;

  const todayDate = new Date();
  const safeToday = Math.min(todayDate.getDate(), daysInCurrentMonth());
  elements.daySelect.value = String(safeToday);

  const savedSound = localStorage.getItem("azanSound");
  if (savedSound) elements.soundSelect.value = savedSound;
  elements.azanSound.src = `./azan/${elements.soundSelect.value}`;

  const savedMethod = localStorage.getItem("calcMethod") || "UOIF";
  if (elements.calcMethodSelect) elements.calcMethodSelect.value = savedMethod;

  // Capture a template of the UOIF option (to reinsert later if needed)
  const uoifOpt = elements.calcMethodSelect?.querySelector('option[value="UOIF"]');
  if (uoifOpt) UOIF_OPTION_TEMPLATE = uoifOpt.cloneNode(true);

  // Enforce method availability for current city at load
  enforceMethodAvailabilityForSelectedCity();
})();

// ====== NOTIFICATION PERMISSION ======
function requestNotifyIfNeeded() {
  if (askedForNotify) return;
  askedForNotify = true;
  if ("Notification" in window && Notification.permission === "default") {
    try { Notification.requestPermission(); } catch (_) {}
  }
}

// ====== EVENT LISTENERS ======
elements.countrySelect?.addEventListener("change", () => {
  localStorage.setItem("selectedCountry", elements.countrySelect.value);
  rebuildCityDropdown();

  const currentCity = localStorage.getItem("selectedCity");
  const stillExists = currentCity &&
    Array.from(elements.citySelect.options).some(o => o.value === currentCity);

  elements.citySelect.value = stillExists
    ? currentCity
    : (elements.citySelect.options[0]?.value || "");

  localStorage.setItem("selectedCity", elements.citySelect.value);
  requestNotifyIfNeeded();
  enforceMethodAvailabilityForSelectedCity();
  applyCalcMethodUI();
  updateTable();
});

elements.citySelect.addEventListener("change", () => {
  localStorage.setItem("selectedCity", elements.citySelect.value);
  requestNotifyIfNeeded();
  enforceMethodAvailabilityForSelectedCity();
  applyCalcMethodUI();
  updateTable();
});

elements.daySelect.addEventListener("change", () => { requestNotifyIfNeeded(); updateTable(); });

elements.prevDayBtn?.addEventListener("click", () => {
  requestNotifyIfNeeded();
  let d = parseInt(elements.daySelect.value, 10);
  if (d > 1) { elements.daySelect.value = String(d - 1); updateTable(); }
});

elements.nextDayBtn?.addEventListener("click", () => {
  requestNotifyIfNeeded();
  let d = parseInt(elements.daySelect.value, 10);
  const maxDay = daysInCurrentMonth();
  if (d < maxDay) { elements.daySelect.value = String(d + 1); updateTable(); }
});

elements.soundSelect.addEventListener("change", () => {
  requestNotifyIfNeeded();
  const selected = elements.soundSelect.value;
  localStorage.setItem("azanSound", selected);
  elements.azanSound.src = `./azan/${selected}`;
  elements.azanSound.load();
});
elements.previewBtn?.addEventListener("click", () => {
  requestNotifyIfNeeded();
  elements.azanSound.play().catch(() => {});
});
document.getElementById("stopAzan")?.addEventListener("click", stopAzan);

elements.calcMethodSelect?.addEventListener("change", () => {
  requestNotifyIfNeeded();
  localStorage.setItem("calcMethod", elements.calcMethodSelect.value);
  applyCalcMethodUI();
  updateTable();
});

// ====== Method availability by latitude (hide/show UOIF) ======
function ensureUOIFVisible(show) {
  const select = elements.calcMethodSelect;
  if (!select) return;

  const exists = !!select.querySelector('option[value="UOIF"]');

  if (show) {
    if (!exists && UOIF_OPTION_TEMPLATE) {
      select.insertBefore(UOIF_OPTION_TEMPLATE.cloneNode(true), select.firstChild);
    }
  } else {
    if (exists) {
      const opt = select.querySelector('option[value="UOIF"]');
      select.removeChild(opt);
    }
    if (select.value === 'UOIF') {
      const fallback = select.querySelector('option[value="MWL"]') ? 'MWL' : (select.options[0]?.value || '');
      if (fallback) {
        select.value = fallback;
        localStorage.setItem("calcMethod", fallback);
      }
    }
  }
}

function enforceMethodAvailabilityForSelectedCity() {
  const cityKey = (elements.citySelect?.value || "").toLowerCase();
  const coords  = getCityLatLng(cityKey);
  const lat     = coords ? coords.lat : null;

  if (typeof lat === "number") {
    ensureUOIFVisible(lat >= 45);
  }
}

// ====== Ensure warning element exists under the Method+Day selectors ======
function ensureMethodWarningEl() {
  let warn = document.getElementById('methodWarning');
  if (!warn) {
    warn = document.createElement('div');
    warn.id = 'methodWarning';
    warn.className = 'warning-text';
    warn.style.display = 'none';
    warn.style.textAlign = 'center';
    warn.style.width = '100%';
    warn.style.maxWidth = '560px';
    warn.style.margin = '4px auto 0';
    warn.style.fontWeight = '600';
    warn.style.color = 'red';
    const methodSelectorsRow = elements.calcMethodSelect?.closest('.selectors');
    if (methodSelectorsRow && methodSelectorsRow.parentElement) {
      methodSelectorsRow.parentElement.insertBefore(warn, methodSelectorsRow.nextSibling);
    } else {
      elements.calcMethodSelect?.parentElement?.appendChild(warn);
    }
  }
  return warn;
}

// ---- Mobile audio unlock (Android/iOS friendly; once per session) ----
let __audioUnlocked = false;

function showSoundUnlockBanner(msg = "Tap to enable Azan sound") {
  // Small, non-intrusive banner shown only if audio is blocked
  let b = document.getElementById("soundUnlockBanner");
  if (!b) {
    b = document.createElement("div");
    b.id = "soundUnlockBanner";
    b.style.cssText = [
      "position:fixed",
      "left:0",
      "right:0",
      "bottom:0",
      "z-index:9999",
      "padding:12px 14px",
      "text-align:center",
      "background:rgba(15,15,18,.95)",
      "color:#fff",
      "backdrop-filter:saturate(120%) blur(6px)"
    ].join(";");

    b.innerHTML = `
      <button id="soundUnlockBtn" style="
        border:0;
        border-radius:10px;
        padding:10px 14px;
        font-size:16px;
        font-weight:800;
        cursor:pointer;
      ">🔊 ${msg}</button>
    `;

    document.body.appendChild(b);
    document.getElementById("soundUnlockBtn")?.addEventListener("click", unlockAzanAudioOnce);
  } else {
    const btn = b.querySelector("#soundUnlockBtn");
    if (btn) btn.textContent = `🔊 ${msg}`;
  }
}

function hideSoundUnlockBanner() {
  document.getElementById("soundUnlockBanner")?.remove();
}

function unlockAzanAudioOnce() {
  if (__audioUnlocked) return;

  const el = document.getElementById("azanSound");
  if (!el) return;

  // make sure it has a valid src before trying
  if (!el.src || el.src.endsWith("/azan/")) {
    const selected =
      document.getElementById("soundSelect")?.value || "hasan-bl3lol.mp3";
    el.src = `./azan/${selected}`;
    el.load();
  }

  el.muted = false;
  el.volume = 1;

  el.play()
    .then(() => {
      try {
        el.pause();
        el.currentTime = 0;
      } catch (_) {}
      __audioUnlocked = true;
      hideSoundUnlockBanner();
    })
    .catch(() => {
      // still blocked; user needs a real tap
      showSoundUnlockBanner();
    });
}

// listen to multiple gesture types (Android-friendly)
// (we keep them for the session; unlockAzanAudioOnce exits early after success)
["touchstart", "touchend", "pointerdown", "click", "keydown"].forEach((evt) => {
  window.addEventListener(evt, unlockAzanAudioOnce, { passive: true });
});

document
  .getElementById("previewBtn")
  ?.addEventListener("click", unlockAzanAudioOnce);
document
  .getElementById("soundSelect")
  ?.addEventListener("change", unlockAzanAudioOnce);


// === Apply UI for calc method (color + centered warning line) ===
function applyCalcMethodUI() {
  const select = elements.calcMethodSelect;
  if (!select) return;

  const warn = ensureMethodWarningEl();

  select.classList.remove('invalid-method', 'valid-method');
  select.style.color = '';
  select.style.fontWeight = '';
  Array.from(select.options).forEach(o => { o.style.color = ''; o.style.fontWeight = ''; });

  const val = select.value;

  const cityKey = (elements.citySelect?.value || "").toLowerCase();
  const coords  = getCityLatLng(cityKey);
  const lat     = coords ? coords.lat : null;
  const isHighLat = typeof lat === "number" && lat >= 45;

  const paintGreen = () => {
    select.classList.add('valid-method');
    select.style.color = 'green';
    select.style.fontWeight = '700';
    select.options[select.selectedIndex].style.color = 'green';
    select.options[select.selectedIndex].style.fontWeight = '700';
  };
  const paintRed = () => {
    select.classList.add('invalid-method');
    select.style.color = 'red';
    select.style.fontWeight = '600';
    select.options[select.selectedIndex].style.color = 'red';
    select.options[select.selectedIndex].style.fontWeight = '700';
  };

  if (typeof lat === "number") {
    ensureUOIFVisible(isHighLat);
  }

  const isMWLorUmm = (val === 'MWL' || val === 'UmmAlQura');

  if (isHighLat) {
    if (val === 'UOIF') {
      paintGreen();
      warn.textContent = '';
      warn.style.display = 'none';
    } else if (isMWLorUmm) {
      paintRed();
      warn.textContent = 'توقيت غير مناسب لأوروبا';
      warn.style.display = 'block';
    } else {
      warn.textContent = '';
      warn.style.display = 'none';
    }
  } else {
    if (isMWLorUmm) paintGreen();
    warn.textContent = '';
    warn.style.display = 'none';
  }
}

window.addEventListener('load', applyCalcMethodUI);

// ====== PrayTimes helpers ======
function getSelectedAsrSchool() {
  const sel = elements.calcMethodSelect;
  if (!sel) return "Standard";
  const opt = sel.options[sel.selectedIndex];
  return opt?.dataset?.asr === "Hanafi" ? "Hanafi" : "Standard";
}
function getPTTimes(cityKey, dateISO, methodCode="MWL", asrSchool="Standard") {
  if (typeof PrayTimes === "undefined") return null;
  const coords = getCityLatLng(cityKey);
  if (!coords) return null;

  const [y,m,d] = dateISO.split("-").map(Number);
  const localDate = new Date(y, m-1, d);

  let baseMethod = "MWL";
  if (methodCode === "UmmAlQura") baseMethod = "Makkah";
  if (methodCode === "UOIF") baseMethod = "UOIF";

  const pt = new PrayTimes(baseMethod);

  if (methodCode === "MWL" || methodCode === "UmmAlQura") {
    pt.adjust({
      asr: asrSchool === "Hanafi" ? "Hanafi" : "Standard",
      fajr: 18, isha: 18, ishaInterval: 0,
      highLats: "None", dhuhr: 0
    });
  } else {
    pt.adjust({ asr: asrSchool === "Hanafi" ? "Hanafi" : "Standard", highLats: "None", dhuhr: 0 });
  }

  const times = pt.getTimes(localDate, [coords.lat, coords.lng], "auto");
  const mm5 = (x) => (x || "--:--").substring(0,5);
  return {
    fajr:   mm5(times.fajr),
    sunrise:mm5(times.sunrise),
    dhuhr:  mm5(times.dhuhr),
    asr:    mm5(times.asr),
    sunset: mm5(times.sunset),
    maghrib:mm5(times.maghrib || times.sunset),
    isha:   mm5(times.isha)
  };
}

// ====== JSON path helpers ======
function getCityJsonUrls(cityKey) {
  const enc = encodeURIComponent(cityKey);
  const cc  = getCityCountryCode(cityKey);
  const urls = [];
  if (cc) urls.push(`./cities-json/${cc}/${enc}.json`);
  urls.push(`./cities-json/${enc}.json`);
  return urls;
}
function getMakkahJsonUrls() {
  return ["./cities-json/sa/makkah.json", "./cities-json/makkah.json"];
}

// ====== RENDER A TOGGLE INSIDE A MAKKAH CELL ======
function setMakkahCell(cell, key, timeStr) {
  if (!cell) return;
  if (!timeStr || timeStr === "—") {
    cell.textContent = "—";
    return;
  }
  const on = !!alarmEnabled[key];

  const small = window.matchMedia("(max-width:600px)").matches;
  const size = small ? '0.85rem' : '1rem';

  cell.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
      <span>${timeStr}</span>
      <button type="button" class="sound-toggle"
        title="${on ? "إيقاف صوت هذا الوقت" : "تشغيل صوت هذا الوقت"}"
        style="border:none;background:none;cursor:pointer;font-size:${size};"
        data-tkey="${key}">
        ${on ? "🔊" : "🔇"}
      </button>
    </div>
  `;
  const btn = cell.querySelector("button.sound-toggle");
  btn.onclick = () => {
    const k = btn.getAttribute("data-tkey");
    alarmEnabled[k] = !alarmEnabled[k];
    saveAlarmEnabled(alarmEnabled);
    btn.textContent = alarmEnabled[k] ? "🔊" : "🔇";
    btn.title = alarmEnabled[k] ? "إيقاف صوت هذا الوقت" : "تشغيل صوت هذا الوقت";
  };
}

// ====== POPUP (custom modal with Stop button) ======
function ensurePopupElements() {
  if (document.getElementById("azanOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "azanOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);
    display:none;align-items:center;justify-content:center;`;
  const box = document.createElement("div");
  box.id = "azanBox";
  box.style.cssText = `
    background:#fff;border-radius:10px;max-width:92%;width:360px;padding:18px;
    text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4);font-size:16px;`;
  box.innerHTML = `
    <div id="azanImgWrap" style="margin-bottom:10px"></div>
    <div id="azanMsg" style="margin-bottom:14px"></div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button id="azanStopBtn" style="padding:8px 14px;font-weight:bold">إيقاف الأذان</button>
      <button id="azanCloseBtn" style="padding:8px 14px;">إغلاق</button>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("azanStopBtn").onclick = () => { stopAzan(); hidePopup(); };
  document.getElementById("azanCloseBtn").onclick = hidePopup;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) hidePopup(); });
}
function showPopup(imgSrc, text, autoCloseMs = 8000) {
  ensurePopupElements();
  const overlay = document.getElementById("azanOverlay");
  const imgWrap = document.getElementById("azanImgWrap");
  const msg = document.getElementById("azanMsg");
  imgWrap.innerHTML = `<img src="${imgSrc}" alt="" style="width:100px;height:72px;">`;
  msg.textContent = text;
  overlay.style.display = "flex";
  if (showPopup._timer) clearTimeout(showPopup._timer);
  showPopup._timer = setTimeout(hidePopup, autoCloseMs);
}
function hidePopup() {
  const overlay = document.getElementById("azanOverlay");
  if (overlay) overlay.style.display = "none";
  if (showPopup._timer) clearTimeout(showPopup._timer);
}

// Fallback: compute Makkah sunrise/sunset with PrayTimes if JSON missing
function getMakkahSunTimes(dateISO) {
  if (typeof PrayTimes === "undefined") return null;
  const MAKKAH = { lat: 21.3891, lng: 39.8579 };
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const pt = new PrayTimes("Makkah");
  pt.adjust({ highLats: "None", dhuhr: 0 });
  const t = pt.getTimes(dt, [MAKKAH.lat, MAKKAH.lng], "auto");
  const mm5 = s => (s || "--:--").substring(0,5);
  return { sunrise: mm5(t.sunrise), sunset:  mm5(t.sunset) };
}

// ====== MAIN FUNCTION ======
async function updateTable() {
  // Countdown block sizing
  if (elements.countdown) {
    const w = Math.min(window.innerWidth * 0.6, 420);
    elements.countdown.style.display = "block";
    elements.countdown.style.margin = "6px auto";
    elements.countdown.style.textAlign = "center";
    elements.countdown.style.width = w + "px";
    elements.countdown.style.fontSize = (w * 0.18) + "px";
    elements.countdown.style.fontWeight = "bold";
    elements.countdown.style.lineHeight = "1.1";
  }

  const cityKey = (elements.citySelect.value || "").toLowerCase();
  if (!cityKey) { clearCells(); return; }

  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const day   = parseInt(elements.daySelect.value, 10);
  const todayISO = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

  // ---- Load city JSON (try per-country then flat) ----
  let data = null, usedUrl = null;
  const urls = getCityJsonUrls(cityKey);
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        data = await r.json();
        usedUrl = url;
        break;
      }
    } catch (_) {}
  }
  if (!data) {
    console.warn(`[salat] JSON not found for "${cityKey}". Tried:`, urls);
    clearCells();
    return;
  }

  const found = data.find(item => item.day === todayISO);
  if (!found) { clearCells(); return; }

  // FORMAT sunrise/sunset IN CITY'S TIMEZONE
  const tz = getCityTimezone(cityKey);
  const sunrise = extractLocalTimeFromISO(found.sunrise, tz);
  const sunset  = extractLocalTimeFromISO(found.sunset,  tz);

  // determine effective method subject to latitude rule
  const methodChosen = elements.calcMethodSelect ? elements.calcMethodSelect.value : "UOIF";
  const coordsGate = getCityLatLng(cityKey);
  const latGate = coordsGate ? coordsGate.lat : null;

  // enforce availability each update (defensive)
  if (typeof latGate === "number") {
    ensureUOIFVisible(latGate >= 45);
  }

  // rule:
  // - lat < 45  -> MWL/UmmAlQura allowed
  // - lat >= 45 -> force 1h05 (UOIF behavior for Fajr/Isha)
  let effectiveMethod = methodChosen;
  const isHighLat = typeof latGate === "number" && latGate >= 45;
  if (isHighLat) effectiveMethod = "UOIF";

  // compute Fajr/Isha
  let fajr, ishaa;
  if ((effectiveMethod === "MWL" || effectiveMethod === "UmmAlQura") && typeof PrayTimes !== "undefined") {
    const ptTimesFi = getPTTimes(cityKey, todayISO, effectiveMethod, getSelectedAsrSchool());
    if (ptTimesFi) { fajr = ptTimesFi.fajr; ishaa = ptTimesFi.isha; }
    else { fajr = subtract1h05(sunrise); ishaa = add1h05(sunset); }
  } else {
    fajr = subtract1h05(sunrise);
    ishaa = add1h05(sunset);
  }

  // write middle column
  elements.selectedDayCell.textContent = "التوقيت";
  elements.sunriseCell.textContent = sunrise;
  elements.sunsetCell.textContent  = sunset;
  elements.fajrCell.textContent    = fajr;
  elements.ishaaCell.textContent   = ishaa;

  // latitude label
  const coords = getCityLatLng(cityKey);
  const lat = coords ? coords.lat : null;
  elements.latitudeCell.textContent = (lat !== null && lat !== undefined) ? `${(+lat).toFixed(2)}°` : "—";

  document.dispatchEvent(new Event('latitude:updated'));
  applyCalcMethodUI();

  // --- Makkah-based fasting length (only if lat >= 49) ---
  if (lat !== null && lat >= 49) {
    let mSunrise, mSunset;

    let mjson = null;
    for (const url of getMakkahJsonUrls()) {
      try {
        const mresp = await fetch(url, { cache: "no-store" });
        if (mresp.ok) { mjson = await mresp.json(); break; }
      } catch (_) {}
    }
    if (mjson) {
      const mtoday = mjson.find(e => e.day === todayISO);
      if (mtoday) {
        mSunrise = extractLocalTimeFromISO(mtoday.sunrise, FALLBACK_COUNTRY_TZS.sa);
        mSunset  = extractLocalTimeFromISO(mtoday.sunset,  FALLBACK_COUNTRY_TZS.sa);
      }
    }
    if ((!mSunrise || !mSunset) && typeof PrayTimes !== "undefined") {
      const mk = getMakkahSunTimes(todayISO);
      if (mk) { mSunrise = mk.sunrise; mSunset = mk.sunset; }
    }

    if (mSunrise && mSunset) {
      const mFajr   = subtract1h05(mSunrise);
      const fastMin = timeToMinutes(mSunset) - timeToMinutes(mFajr);
      let cityMagMin = timeToMinutes(elements.fajrCell.textContent) + fastMin;
      if (cityMagMin >= 1440) cityMagMin -= 1440;
      const makkahMaghrib = minutesToTime(cityMagMin);
      const makkahIshaa   = add1h05(makkahMaghrib);

      setMakkahCell(elements.makkahFotorCell, "makkah_maghrib", makkahMaghrib);
      setMakkahCell(elements.makkahIshaaCell, "makkah_ishaa",   makkahIshaa);
    } else {
      setMakkahCell(elements.makkahFotorCell, "makkah_maghrib", "—");
      setMakkahCell(elements.makkahIshaaCell, "makkah_ishaa",   "—");
    }
  } else {
    setMakkahCell(elements.makkahFotorCell, "makkah_maghrib", "—");
    setMakkahCell(elements.makkahIshaaCell, "makkah_ishaa",   "—");
  }

  // Dhuhr/Asr from PrayTimes (if available)
  if (typeof PrayTimes !== "undefined" && (elements.dhuhrCell || elements.asrCell)) {
    const ptTimes = getPTTimes(cityKey, todayISO, effectiveMethod, getSelectedAsrSchool());
    if (ptTimes) {
      if (elements.dhuhrCell) elements.dhuhrCell.textContent = ptTimes.dhuhr;
      if (elements.asrCell)   elements.asrCell.textContent   = ptTimes.asr;
    }
  }

  // (Re)build the sound toggles
  initSoundToggles();

  // Feed the single-fire scheduler with today's times
  scheduleAzanFromCells();

  // countdown + clock color
  checkAndStartCountdown();
}

function clearCells() {
  elements.selectedDayCell.textContent = "وقت الصلاة";
  elements.sunriseCell.textContent = "—";
  elements.sunsetCell.textContent  = "—";
  elements.fajrCell.textContent    = "—";
  elements.ishaaCell.textContent   = "—";
  if (elements.dhuhrCell) elements.dhuhrCell.textContent = "—";
  if (elements.asrCell)   elements.asrCell.textContent   = "—";
  setMakkahCell(elements.makkahFotorCell, "makkah_maghrib", "—");
  setMakkahCell(elements.makkahIshaaCell, "makkah_ishaa",   "—");
}

// ====== CLOCK + COUNTDOWN ======
function startCountdown(durationSec) {
  if (countdownActive) return;
  countdownActive = true;

  elements.countdown.classList.add('active');

  let remaining = durationSec;
  const tick = () => {
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    const secColor = remaining < 60 ? "red" : "inherit";
    elements.countdown.innerHTML =
      `⏳ ${String(min).padStart(2,"0")}:<span style="color:${secColor}">${String(sec).padStart(2,"0")}</span>`;
    remaining -= 1;
    if (remaining < 0) {
      clearInterval(interval);
      elements.countdown.textContent = "";
      elements.countdown.classList.remove('active');
      countdownActive = false;
    }
  };
  tick();
  const interval = setInterval(tick, 1000);
}

function updateDigitalClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const currentTotalSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const getSec = (txt) => txt && txt.includes(":") ? timeToSeconds(txt) : null;
  const fajrSec    = getSec(elements.fajrCell.textContent);
  const sunriseSec = getSec(elements.sunriseCell.textContent);
  const dhuhrSec   = getSec(elements.dhuhrCell?.textContent || "");
  const asrSec     = getSec(elements.asrCell?.textContent   || "");
  const maghribSec = getSec(elements.sunsetCell.textContent);
  const ishaaSec   = getSec(elements.ishaaCell.textContent);

  const targets = [fajrSec, sunriseSec, dhuhrSec, asrSec, maghribSec, ishaaSec].filter(v => typeof v === "number");
  const withinLastMinute = targets.some(t => t - currentTotalSec <= 60 && t - currentTotalSec >= 0);

  elements.digitalClock.innerHTML =
    `<span>${hh}:${mm}:<span style="color:${withinLastMinute ? "red" : "green"}">${ss}</span></span>`;
}

function checkAndStartCountdown() {
  const now = new Date();
  const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const getSec = (txt) => txt && txt.includes(":") ? timeToSeconds(txt) : null;

  const times = [
    { key: "fajr",    sec: getSec(elements.fajrCell.textContent) },
    { key: "sunrise", sec: getSec(elements.sunriseCell.textContent) },
    { key: "dhuhr",   sec: getSec(elements.dhuhrCell?.textContent || "") },
    { key: "asr",     sec: getSec(elements.asrCell?.textContent   || "") },
    { key: "maghrib", sec: getSec(elements.sunsetCell.textContent) },
    { key: "ishaa",   sec: getSec(elements.ishaaCell.textContent) }
  ];

  for (const { sec } of times) {
    if (typeof sec !== "number") continue;
    const diff = sec - currentSec;
    if (diff <= 60 && diff > 0) { startCountdown(diff); break; }
  }
}

// ====== NOTIFICATIONS & TRIGGERS (legacy helpers kept for UI) ======
function stopAzan() {
  try { elements.azanSound.pause(); elements.azanSound.currentTime = 0; } catch (_) {}
  cooldownUntil = Date.now() + 70 * 1000;
}

function initSoundToggles() {
  const rows = document.querySelectorAll(".common-table tr.tr-times");
  rows.forEach((tr) => {
    const th = tr.querySelector("th");
    if (!th) return;
    const label = (th.textContent || "").trim();
    const map = {
      "الشروق": "sunrise",
      "الفجر": "fajr",
      "الظهر": "dhuhr",
      "العصر": "asr",
      "الغروب": "maghrib",
      "العشاء": "ishaa"
    };
    const key = map[label];
    if (!key) return;

    let btn = th.querySelector(".sound-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sound-toggle";
      const small = window.matchMedia("(max-width:600px)").matches;
      btn.style.cssText =
        `margin-right:${small ? 4 : 6}px;` +
        `font-size:${small ? 0.8 : 0.95}rem;` +
        `cursor:pointer;border:none;background:none;`;
      th.prepend(btn);
    }
    const on = !!alarmEnabled[key];
    btn.textContent = on ? "🔊" : "🔇";
    btn.title = on ? "إيقاف صوت هذا الوقت" : "تشغيل صوت هذا الوقت";
    btn.onclick = () => {
      alarmEnabled[key] = !alarmEnabled[key];
      saveAlarmEnabled(alarmEnabled);
      btn.textContent = alarmEnabled[key] ? "🔊" : "🔇";
      btn.title = alarmEnabled[key] ? "إيقاف صوت هذا الوقت" : "تشغيل صوت هذا الوقت";
    };
  });
}

// ====== SINGLE-FIRE AZAN SCHEDULER ======
const AzanScheduler = (function () {
  const STORAGE_KEY_PREFIX = 'azanPlayed:'; // azanPlayed:YYYY-MM-DD:Label
  const COOLDOWN_MS = 6 * 60 * 1000;

  const audio = elements.azanSound; // reuse your single audio element
  let isPlaying = false;
  let cooldownUntilTS = 0;

  // SW → page stop message
  navigator.serviceWorker?.addEventListener('message', (evt) => {
    if (evt?.data?.type === 'STOP_AZAN') {
      try { elements.azanSound.pause(); elements.azanSound.currentTime = 0; } catch {}
      stopNow();
    }
  });

  audio.addEventListener('ended', () => { isPlaying = false; });

  function todayStamp(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  function keyFor(label) { return `${STORAGE_KEY_PREFIX}${todayStamp()}:${label}`; }
  function hasPlayed(label) { return localStorage.getItem(keyFor(label)) === '1'; }
  function markPlayed(label) { localStorage.setItem(keyFor(label), '1'); }

  function withinSameSecond(now, target) {
    return target && Math.abs(now.getTime() - target.getTime()) <= 1000;
  }

  function showNotification(labelAr, iconPath) {
    if (!('Notification' in window)) return;

    const doShow = () => {
      if (navigator.serviceWorker?.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(`Azan – ${labelAr}`, {
            body: `It's time for ${labelAr}.`,
            vibrate: [200, 100, 200],
            requireInteraction: true,
            actions: [{ action: 'stop-azan', title: 'Stop Azan' }],
            tag: `azan-${labelAr}`,
            icon: iconPath || 'images/mosque1.png'
          });
        });
      } else if (Notification.permission === 'granted') {
        new Notification(`Azan – ${labelAr}`, { body: `It's time for ${labelAr}.` });
      }
    };

    if (Notification.permission === 'default') {
      Notification.requestPermission().then(() => {
        if (Notification.permission === 'granted') doShow();
      });
    } else if (Notification.permission === 'granted') {
      doShow();
    }
  }

  async function trigger(label, iconPath) {
    if (isPlaying) return;
    isPlaying = true;
    cooldownUntilTS = Date.now() + COOLDOWN_MS;

    const arMap = {
      Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر",
      Asr: "العصر", Maghrib: "المغرب", Ishaa: "العشاء",
      "Maghrib_Makkah": "المغرب (مكة)", "Ishaa_Makkah": "العشاء (مكة)"
    };
    showNotification(arMap[label] || label, iconPath);

    try { await audio.play(); } catch (e) { /* autoplay blocked, ignore */ }
  }

  function stopNow() {
    try { audio.pause(); audio.currentTime = 0; } catch {}
    isPlaying = false;
  }

  // Public API
  let times = {
    Fajr: null, Sunrise: null, Dhuhr: null, Asr: null, Maghrib: null, Ishaa: null,
    Maghrib_Makkah: null, Ishaa_Makkah: null
  };

  return {
    updateTimes(obj) {
      times = { ...times, ...obj };
    },
    tick() {
      const now = new Date();
      if (Date.now() < cooldownUntilTS) return;

      const entries = Object.entries(times);
      for (const [label, dateObj] of entries) {
        if (!(dateObj instanceof Date)) continue;
        if (hasPlayed(label)) continue;
        if (withinSameSecond(now, dateObj)) {
          markPlayed(label);
          const icon = (label.includes('Maghrib') ? 'images/sunrise1.png'
                      : label.includes('Ishaa') ? 'images/mosque1.png'
                      : 'images/mosque1.png');
          trigger(label, icon);
          break;
        }
      }
    },
    stop: stopNow
  };
})();

// Read times from cells and feed scheduler
function scheduleAzanFromCells() {
  const fajr    = parseTodayTimeToDate(elements.fajrCell.textContent);
  const sunrise = parseTodayTimeToDate(elements.sunriseCell.textContent);
  const dhuhr   = parseTodayTimeToDate(elements.dhuhrCell?.textContent || "");
  const asr     = parseTodayTimeToDate(elements.asrCell?.textContent   || "");
  const maghrib = parseTodayTimeToDate(elements.sunsetCell.textContent);
  const ishaa   = parseTodayTimeToDate(elements.ishaaCell.textContent);

  const mkMag = (() => {
    const t = (elements.makkahFotorCell?.innerText || "").slice(0,5);
    return parseTodayTimeToDate(t);
  })();
  const mkIsh = (() => {
    const t = (elements.makkahIshaaCell?.innerText || "").slice(0,5);
    return parseTodayTimeToDate(t);
  })();

  AzanScheduler.updateTimes({
    Fajr: fajr, Sunrise: sunrise, Dhuhr: dhuhr, Asr: asr, Maghrib: maghrib, Ishaa: ishaa,
    Maghrib_Makkah: mkMag, Ishaa_Makkah: mkIsh
  });
}

// Legacy popup for extra visual cue
function showAzanUI(prayerKey) {
  const arabicMap = {
    sunrise: "الشروق",
    fajr:    "الفجر",
    dhuhr:   "الظهر",
    asr:     "العصر",
    maghrib: "المغرب",
    ishaa:   "العشاء",
    makkah_maghrib: "المغرب (مكة)",
    makkah_ishaa:   "العشاء (مكة)"
  };
  const imgMap = {
    sunrise: "images/sunrise1.png",
    fajr:    "images/sunset1.png",
    dhuhr:   "images/mosque1.png",
    asr:     "images/mosque1.png",
    maghrib: "images/sunrise1.png",
    ishaa:   "images/mosque1.png",
    makkah_maghrib: "images/sunrise1.png",
    makkah_ishaa:   "images/mosque1.png"
  };
  const arabic = arabicMap[prayerKey] || "الصلاة";
  const image = imgMap[prayerKey] || "images/mosque1.png";
  const body = `حان الآن وقت ${arabic} ⏰`;
  showPopup(image, body, 8000);
}

// Allow SW to stop the audio via page message
window.addEventListener('message', (evt) => {
  if (evt?.data?.type === 'STOP_AZAN') {
    try { elements.azanSound.pause(); elements.azanSound.currentTime = 0; } catch {}
  }
});

// ====== INIT ======
window.onload = () => {
  updateTable();

// optional: when the tab becomes visible again, re-check immediately
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkAndStartCountdown();
  });
  
  // CLOCK
  if (!window.__clockStarted) {
    window.__clockStarted = true;
    updateDigitalClock();
    setInterval(updateDigitalClock, 1000);
	setInterval(checkAndStartCountdown, 1000);
  }

  // SCHEDULER LOOP: once per second
  if (!window.__azanLoopStarted) {
    window.__azanLoopStarted = true;
    const loop = () => AzanScheduler.tick();
    loop();
    setInterval(loop, 1000);
  }
};

// Debug helper (?play=azan)
(function playAzanIfRequested() {
  const params = new URL(location.href).searchParams;
  if (params.get('play') === 'azan') {
    const el = document.getElementById('azanSound');
    if (!el) return;
    el.play().catch(() => {
      const prompt = document.createElement('button');
      prompt.textContent = '▶️ تشغيل الأذان';
      prompt.style.cssText = 'display:block;margin:10px auto;padding:8px 14px;font-weight:bold;';
      prompt.onclick = () => el.play().catch(()=>{});
      document.body.prepend(prompt);
    });
  }
})();

// ============================
// END main.js
// ============================
