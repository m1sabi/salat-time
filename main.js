// ====== ELEMENT SELECTORS ======
const elements = {
  citySelect: document.getElementById("citySelect"),
  daySelect: document.getElementById("daySelect"),
  prevDayBtn: document.getElementById("prevDayBtn"),
  nextDayBtn: document.getElementById("nextDayBtn"),
  selectedDayCell: document.getElementById("selectedDayCell"),
  sunriseCell: document.getElementById("sunriseCell"),
  sunsetCell: document.getElementById("sunsetCell"),
  fajrCell: document.getElementById("fajrCell"),
  ishaaCell: document.getElementById("ishaaCell"),
  makkaFotorCell: document.getElementById("makkaFotorCell"),
  latitudeCell: document.getElementById("latitudeCell"),
  soundSelect: document.getElementById("soundSelect"),
  previewBtn: document.getElementById("previewBtn"),
  azanSound: document.getElementById("azanSound")
};

// ====== CITY AND SOUND DATA ======
const cities = [ "stuttgart", "dortmund", "bremen", "muenchen", "friedrichshafen", "duesseldorf", "leipzig", "freiburg", "berlin", "nuremberg", "karlsruhe", "frankfurt", "hamburg", "ravensburg", "erfurt", "konstanz", "sibbhult", "kristianstad", "neu_ulm" ];
//"essen", "mannheim", "kiel", "koblenz", "regensburg", "augsburg", "lindau", "tuebingen", "testcity", "rostock", "flensburg", "ulm", 
const soundOptions = [
  { file: "hasan-bl3lol.mp3", label: "حسن بعلول" },
  { file: "haddad.mp3", label: "أحمد حداد" },
  { file: "adham-sharkawi.mp3", label: "أدهم شرقاوي" },
  { file: "trabulsi.mp3", label: "أحمد طرابلسي" },
  { file: "Badi3-Jado.mp3", label: "بديع جادو" },
  { file: "Izziddin-Amarna.mp3", label: "عز الدين عمارنة" },
  { file: "Mahmoud-Najjar.mp3", label: "محمود النجار" },
  { file: "Samer-Saghir.mp3", label: "سامر الصغير" }
];

// ====== STATE ======
let redSecondsActive = false;
let countdownActive = false;
let lastPlayedPrayer = null;
let cooldown = false;

// ====== NOTIFICATIONS ======
Notification.requestPermission();

// ====== UTILITY FUNCTIONS ======
function timeToMinutes(t) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}
function minutesToTime(m) {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}
function subtract1h05(timeStr) {
  return minutesToTime(timeToMinutes(timeStr) - 65);
}
function add1h05(timeStr) {
  return minutesToTime(timeToMinutes(timeStr) + 65);
}
function extractLocalTime(isoString) {
  return isoString.split("T")[1].substring(0, 5);
}

// ====== DOM POPULATION ======
cities.forEach(city => {
  const opt = document.createElement("option");
  opt.value = city;
  opt.textContent = city.charAt(0).toUpperCase() + city.slice(1);
  elements.citySelect.appendChild(opt);
});
for (let i = 1; i <= 30; i++) {
  const opt = document.createElement("option");
  opt.value = i.toString();
  opt.textContent = `اليوم ${i}`;
  elements.daySelect.appendChild(opt);
}
soundOptions.forEach(option => {
  const opt = document.createElement("option");
  opt.value = option.file;
  opt.textContent = option.label;
  elements.soundSelect.appendChild(opt);
});

// ====== SETTINGS RESTORE ======
const savedCity = localStorage.getItem("selectedCity") || cities[0];
const today = new Date().getDate();
elements.citySelect.value = savedCity;
elements.daySelect.value = today <= 30 ? today.toString() : "1";
const savedSound = localStorage.getItem("azanSound");
if (savedSound) {
  elements.soundSelect.value = savedSound;
  elements.azanSound.src = `./azan/${savedSound}`;
} else {
  elements.azanSound.src = `./azan/${elements.soundSelect.value}`;
}

// ====== EVENT LISTENERS ======
elements.citySelect.addEventListener("change", () => {
  localStorage.setItem("selectedCity", elements.citySelect.value);
  elements.daySelect.value = "1";
  updateTable();
});
elements.daySelect.addEventListener("change", updateTable);
elements.prevDayBtn.addEventListener("click", () => {
  let d = parseInt(elements.daySelect.value, 10);
  if (d > 1) {
    elements.daySelect.value = (d - 1).toString();
    updateTable();
  }
});
elements.nextDayBtn.addEventListener("click", () => {
  let d = parseInt(elements.daySelect.value, 10);
  if (d < 30) {
    elements.daySelect.value = (d + 1).toString();
    updateTable();
  }
});
elements.soundSelect.addEventListener("change", () => {
  const selected = elements.soundSelect.value;
  localStorage.setItem("azanSound", selected);
  elements.azanSound.src = `./azan/${selected}`;
  elements.azanSound.load();
});
elements.previewBtn.addEventListener("click", () => {
  elements.azanSound.play().catch(err => console.error("Audio preview failed", err));
});
document.getElementById("stopAzan").addEventListener("click", () => {
  elements.azanSound.pause();
  elements.azanSound.currentTime = 0;
  cooldown = true;
});

// ====== MAIN TABLE FUNCTION ======
async function updateTable() {
  const city = elements.citySelect.value.toLowerCase();
  const day = parseInt(elements.daySelect.value, 10);
  const todayISO = `2025-04-${String(day).padStart(2, "0")}`;

  // Fetch city data
  const response = await fetch(`./cities-json/${city}.json`);
  if (!response.ok) return;
  const data = await response.json();
  const found = data.find(item => item.day === todayISO);
  if (!found) return;

  const sunrise = extractLocalTime(found.sunrise);
  const sunset = extractLocalTime(found.sunset);
  const fajr = subtract1h05(sunrise);
  const ishaa = add1h05(sunset);

  elements.selectedDayCell.textContent = todayISO.split("-").reverse().join("-");
  elements.sunriseCell.textContent = sunrise;
  elements.sunsetCell.textContent = sunset;
  elements.fajrCell.textContent = fajr;
  elements.ishaaCell.textContent = ishaa;

  if (typeof cityLatitude !== "undefined" && cityLatitude[city]) {
    elements.latitudeCell.textContent = `${cityLatitude[city].lat}°`;
  } else {
    elements.latitudeCell.textContent = "—";
  }

  // ====== Fetch Makkah data for Iftar logic ======
  let makkahResponse = await fetch("./cities-json/makkah.json");
  if (makkahResponse.ok) {
    let makkahJson = await makkahResponse.json();
    let makkahToday = makkahJson.find(e => e.day === todayISO);
    if (makkahToday) {
      let makkahSunrise = extractLocalTime(makkahToday.sunrise);
      let makkahSunset = extractLocalTime(makkahToday.sunset);
      let makkahFajr = subtract1h05(makkahSunrise);

      let makkahFastMin = timeToMinutes(makkahSunset) - timeToMinutes(makkahFajr);
      let cityFajrMin = timeToMinutes(fajr);
      let cityMaghribMin = cityFajrMin + makkahFastMin;
      if (cityMaghribMin >= 1440) cityMaghribMin -= 1440;

      elements.makkaFotorCell.textContent = minutesToTime(cityMaghribMin);
    } else {
      elements.makkaFotorCell.textContent = "—";
    }
  } else {
    elements.makkaFotorCell.textContent = "—";
  }

  checkAzanTrigger(fajr, sunset, ishaa);
  checkAndStartCountdown(fajr, sunset, ishaa);
}

// (Rest of the file: updateDigitalClock, startCountdown, checkAzanTrigger, triggerAzan, etc.) — unchanged


// ====== CLOCK + COUNTDOWN ======
function startCountdown(duration) {
  if (countdownActive) return;
  countdownActive = true;
  const countdown = document.getElementById("countdown");
  countdown.style.display = "block";
  let remaining = duration;

  const interval = setInterval(() => {
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    countdown.textContent = `⏳ ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    if (--remaining < 0) {
      clearInterval(interval);
      countdown.textContent = "";
      countdown.style.display = "none";
      countdownActive = false;
    }
  }, 1000);
}

function updateDigitalClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const fajrMin = timeToMinutes(elements.fajrCell.textContent);
  const maghribMin = timeToMinutes(elements.sunsetCell.textContent);
  const ishaaMin = timeToMinutes(elements.ishaaCell.textContent);

  redSecondsActive = [fajrMin, maghribMin, ishaaMin].some(t => t - currentMinutes <= 3 && t - currentMinutes >= 1);
  if ([fajrMin, maghribMin, ishaaMin].includes(currentMinutes)) {
    redSecondsActive = false;
    const container = document.getElementById("countdown");
    container.innerHTML = "";
    container.style.display = "none";
  }

  document.getElementById("digitalClock").innerHTML = `
    <span>${hh}:${mm}:<span style="color:${redSecondsActive ? "red" : "green"}">${ss}</span></span>`;
}

  function checkAndStartCountdown(fajr, maghrib, ishaa) {
  const now = new Date();
  const currentSec = now.getSeconds();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const currentTotal = currentMin * 60 + currentSec;

  const times = [
    { name: "fajr", time: timeToMinutes(fajr) * 60 },
    { name: "maghrib", time: timeToMinutes(maghrib) * 60 },
    { name: "ishaa", time: timeToMinutes(ishaa) * 60 }
  ];

  for (const { time } of times) {
    const diff = time - currentTotal;

    if (diff <= 120 && diff > 0) { // within 3 minutes window
      startCountdown(diff); // countdown from remaining seconds
      break; // only trigger once
    }
  }
}


function checkAzanTrigger(fajr, maghrib, ishaa) {
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (current === fajr) triggerAzan("Fajr");
  if (current === maghrib) triggerAzan("Maghrib");
  if (current === ishaa) triggerAzan("Ishaa");
}

function triggerAzan(prayerName) {
  if (cooldown || lastPlayedPrayer === prayerName) return;
  lastPlayedPrayer = prayerName;
  cooldown = true;
  elements.azanSound.play().catch(err => console.error("Azan error:", err));
  const arabic = { Fajr: "الفجر", Maghrib: "المغرب", Ishaa: "العشاء" }[prayerName];
  const image = {
    Fajr: "images/sunrise1.png",
    Maghrib: "images/sunset1.png",
    Ishaa: "images/mosque1.png"
  }[prayerName];

  if (Notification.permission === "granted" && navigator.serviceWorker) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.active.postMessage({
      type: "azan",
      title: "📢 الأذان",
      body: `حان الآن وقت صلاة ${arabic} ⏰`,
      icon: image
    });
  });
  }


  if (typeof showPopup === "function") {
    showPopup(`<img src="${image}" style="width:85px;height:60px" /><br><br>! حان الآن وقت صلاة ${arabic}`, 5);
  }

  setTimeout(() => {
    cooldown = false;
    lastPlayedPrayer = null;
  }, 15 * 60 * 1000);
}

// ====== INITIALIZATION ======
window.onload = () => {
  updateTable();
  updateDigitalClock();
  setInterval(updateDigitalClock, 1000);

  // 🔁 Check Azan trigger dynamically
  setInterval(() => {
    const fajr = elements.fajrCell.textContent;
    const maghrib = elements.sunsetCell.textContent;
    const ishaa = elements.ishaaCell.textContent;

    // ✅ Only check if times are ready
    if (![fajr, maghrib, ishaa].includes("—") && fajr && maghrib && ishaa) {
      checkAzanTrigger(fajr, maghrib, ishaa);
    }
  }, 5000); // every 7 seconds
};
// Register the service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(reg => console.log("✅ Service Worker Registered"))
    .catch(err => console.error("❌ Service Worker Registration Failed", err));
}

