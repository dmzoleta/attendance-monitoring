const loginForm = document.getElementById('employee-login-form');
const loginScreen = document.getElementById('employee-login');
const appScreen = document.getElementById('employee-app');
const navButtons = document.querySelectorAll('.nav-btn');
const toggleButtons = document.querySelectorAll('[data-toggle="password"]');

const empName = document.getElementById('emp-name');
const empMeta = document.getElementById('emp-meta');
const empAvatar = document.getElementById('emp-avatar');
const empAvatar2 = document.getElementById('emp-avatar-2');
const empName2 = document.getElementById('emp-name-2');
const empRole = document.getElementById('emp-role');

const statDays = document.getElementById('stat-days');
const statLate = document.getElementById('stat-late');
const statAbsent = document.getElementById('stat-absent');
const statCards = document.querySelectorAll('.stat-card[data-stat]');
const statModal = document.getElementById('stat-modal');
const statModalTitle = document.getElementById('stat-modal-title');
const statModalSubtitle = document.getElementById('stat-modal-subtitle');
const statModalTable = document.getElementById('stat-modal-table');
const statModalEmpty = document.getElementById('stat-modal-empty');
const closeStatModalBtn = document.getElementById('close-stat-modal');
const barangayModal = document.getElementById('barangay-modal');
const openBarangayBtn = document.getElementById('open-barangay');
const closeBarangayBtn = document.getElementById('close-barangay-modal');
const cancelBarangayBtn = document.getElementById('cancel-barangay');
const saveBarangayBtn = document.getElementById('save-barangay');
const barangayMunicipality = document.getElementById('barangay-municipality');
const barangaySelect = document.getElementById('barangay-select');
const barangayOtherWrap = document.getElementById('barangay-other-wrap');
const barangayOtherInput = document.getElementById('barangay-other');

const empTime = document.getElementById('emp-time');
const empDate = document.getElementById('emp-date');
const mapPreview = document.getElementById('map-preview');

const locationName = document.getElementById('location-name');
const locationLat = document.getElementById('location-lat');
const locationLng = document.getElementById('location-lng');
const locationAccuracy = document.getElementById('location-accuracy');
const empLocation = document.getElementById('emp-location');
const gpsStatus = document.getElementById('gps-status');

const timeInBtn = document.getElementById('time-in');
const timeOutBtn = document.getElementById('time-out');
const gpsRefreshBtn = document.getElementById('gps-refresh');

const recordsTable = document.getElementById('records-table').querySelector('tbody');
const recordsMonth = document.getElementById('records-month');

const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const serverModal = document.getElementById('server-modal');
const serverUrlInput = document.getElementById('server-url');
const openServerBtn = document.getElementById('open-server-settings');
const closeServerBtn = document.getElementById('close-server-settings');
const cancelServerBtn = document.getElementById('cancel-server-settings');
const saveServerBtn = document.getElementById('save-server-settings');
const logoutBtn = document.getElementById('logout-btn');
const registerModal = document.getElementById('register-modal');
const openRegisterBtn = document.getElementById('open-register');
const closeRegisterBtn = document.getElementById('close-register');
const cancelRegisterBtn = document.getElementById('cancel-register');
const registerForm = document.getElementById('register-form');
const forgotModal = document.getElementById('forgot-modal');
const openForgotBtn = document.getElementById('open-forgot');
const closeForgotBtn = document.getElementById('close-forgot');
const cancelForgotBtn = document.getElementById('cancel-forgot');
const forgotForm = document.getElementById('forgot-form');
const otpModal = document.getElementById('otp-modal');
const otpForm = document.getElementById('otp-form');
const closeOtpBtn = document.getElementById('close-otp');
const resendOtpBtn = document.getElementById('resend-otp');
const concernModal = document.getElementById('concern-modal');
const openConcernBtn = document.getElementById('open-concern');
const closeConcernBtn = document.getElementById('close-concern');
const cancelConcernBtn = document.getElementById('cancel-concern');
const concernForm = document.getElementById('concern-form');
const reportForm = document.getElementById('daily-report-form');
const reportFileInput = document.getElementById('report-file');
const reportFileName = document.getElementById('report-file-name');
const reportPreviewBox = document.getElementById('report-preview-box');
const reportPreviewImg = document.getElementById('report-preview');
const reportDateLabel = document.getElementById('report-date-label');
const reportEmpName = document.getElementById('report-emp-name');
const reportEmpPosition = document.getElementById('report-emp-position');
const reportDivision = document.getElementById('report-division');
const reportSection = document.getElementById('report-section');
const reportLogDate = document.getElementById('report-log-date');
const reportLogTimes = document.getElementById('report-log-times');
const reportSubmittedName = document.getElementById('report-submitted-name');
const reportSubmittedPosition = document.getElementById('report-submitted-position');
const loginStatus = document.getElementById('login-status');
const rememberLogin = document.getElementById('remember-login');

let currentUser = null;
let attendanceCache = [];
let photoData = '';
let reportAttachmentData = '';
let reportAttachmentName = '';
let pendingOtpEmail = '';
let autoRestoreAttempted = false;
let lastAddress = '';
let confirmedBarangay = null;
const BARANGAY_STORAGE_KEY = 'confirmedBarangay';
const BARANGAY_DATA = {
  Marinduque: {
    Boac: [
      'Agot',
      'Agumaymayan',
      'Apitong',
      'Balagasan',
      'Balaring',
      'Balimbing',
      'Bamban',
      'Bangbangalon',
      'Boi',
      'Boton',
      'Buliasnin',
      'Bunganay',
      'Caganhao',
      'Canat',
      'Catubugan',
      'Cawit',
      'Daig',
      'Daypay',
      'Duyay',
      'Hinapulan',
      'Ihatub',
      'Isok I',
      'Isok II',
      'Laylay',
      'Lupac',
      'Mahinhin',
      'Mainit',
      'Malbog',
      'Maligaya',
      'Malusak',
      'Mansiwat',
      'Mataas na Bayan',
      'Maybo',
      'Mercado',
      'Murallon',
      'Pawa',
      'Pili',
      'Poctoy',
      'Poras',
      'Puting Buhangin',
      'San Miguel',
      'Santol',
      'Sawi',
      'Tabigue',
      'Tabi',
      'Tagwak',
      'Tambunan',
      'Tampus',
      'Tanza',
      'Tugos',
      'Tumagabok',
      'Tumapon'
    ],
    Gasan: [],
    Mogpog: [],
    'Santa Cruz': [],
    Buenavista: [],
    Torrijos: []
  }
};
const appConfig = typeof window !== 'undefined' && window.APP_CONFIG ? window.APP_CONFIG : {};
const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
const defaultApiBase = appConfig.apiBase || '';
const storedApiBase = localStorage.getItem('apiBase') || '';
const storedOverride = localStorage.getItem('apiBaseOverride') === 'true';
lastAddress = localStorage.getItem('lastAddress') || '';
loadConfirmedBarangay();

let apiBase = '';
if (isCapacitor) {
  apiBase = storedOverride ? storedApiBase : (defaultApiBase || storedApiBase || 'http://10.0.2.2:5173');
} else {
  apiBase = defaultApiBase || window.location.origin;
}

serverUrlInput.value = storedOverride ? storedApiBase : apiBase;
if (rememberLogin) {
  const rememberFlag = localStorage.getItem('rememberLogin');
  rememberLogin.checked = rememberFlag !== 'false';
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function loadConfirmedBarangay() {
  try {
    const stored = localStorage.getItem(BARANGAY_STORAGE_KEY);
    confirmedBarangay = stored ? JSON.parse(stored) : null;
  } catch (err) {
    confirmedBarangay = null;
  }
}

function formatBarangayLabel(value) {
  if (!value) return '';
  return value.replace(/^brgy\.?\s+/i, 'Barangay ');
}

function formatConfirmedLocation(data) {
  if (!data || !data.barangay) return '';
  const barangay = formatBarangayLabel(data.barangay);
  const municipality = data.municipality || 'Boac';
  const province = data.province || 'Marinduque';
  return `${barangay}, ${municipality}, ${province}, Philippines`;
}

function applyConfirmedLocation() {
  if (!confirmedBarangay) return;
  const label = formatConfirmedLocation(confirmedBarangay);
  if (!label) return;
  locationName.textContent = label;
  empLocation.textContent = label;
  lastAddress = label;
  localStorage.setItem('lastAddress', label);
}

function addressContainsBarangay(address, barangay) {
  if (!address || !barangay) return false;
  const normalized = normalizeText(address);
  const target = normalizeText(barangay);
  return normalized.includes(target);
}

function applyConfirmedOverride(address) {
  if (!confirmedBarangay) return address;
  if (addressContainsBarangay(address, confirmedBarangay.barangay)) return address;
  return formatConfirmedLocation(confirmedBarangay) || address;
}

function inferMunicipality(address) {
  const normalized = normalizeText(address);
  const options = Object.keys(BARANGAY_DATA.Marinduque || {});
  const hit = options.find((name) => normalizeText(name) && normalized.includes(normalizeText(name)));
  return hit || 'Boac';
}

function getBarangayList(municipality) {
  const provinceData = BARANGAY_DATA.Marinduque || {};
  return provinceData[municipality] || [];
}

function populateBarangaySelect(municipality) {
  const list = getBarangayList(municipality);
  barangaySelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = list.length ? 'Select barangay' : 'Other (type below)';
  barangaySelect.appendChild(placeholder);
  list.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    barangaySelect.appendChild(opt);
  });
  const otherOpt = document.createElement('option');
  otherOpt.value = '__other__';
  otherOpt.textContent = 'Other (type below)';
  barangaySelect.appendChild(otherOpt);
  toggleBarangayOther();
}

function toggleBarangayOther() {
  const selected = barangaySelect.value;
  if (selected === '__other__' || !selected) {
    barangayOtherWrap.classList.remove('hidden');
  } else {
    barangayOtherWrap.classList.add('hidden');
  }
}

function isoToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function hasAttendance(record) {
  return !!(record.timeInAM || record.timeOutAM || record.timeInPM || record.timeOutPM || record.timeIn || record.timeOut);
}

function isLateMorning(record) {
  const t = record.timeInAM || record.timeIn || '';
  const minutes = timeToMinutes(t);
  return minutes !== null && minutes > 8 * 60;
}

function isLateAfternoon(record) {
  const t = record.timeInPM || '';
  const minutes = timeToMinutes(t);
  return minutes !== null && minutes > 13 * 60;
}

function tickClock() {
  const now = new Date();
  empTime.textContent = formatTime(now);
  empDate.textContent = formatDate(now);
  if (reportDateLabel) reportDateLabel.textContent = `Date: ${formatDate(now)}`;
}

function setView(viewId) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('hidden', view.id !== viewId);
  });
  navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId));
}

function setStatusCell(cell, status) {
  if (!cell) return;
  const statusLower = status.toLowerCase();
  cell.classList.remove('status-present', 'status-late', 'status-absent');
  if (statusLower === 'present') cell.classList.add('status-present');
  if (statusLower === 'late') cell.classList.add('status-late');
  if (statusLower === 'absent') cell.classList.add('status-absent');
}

function setLoginStatus(message) {
  if (!loginStatus) return;
  if (message) {
    loginStatus.textContent = message;
    loginStatus.classList.remove('hidden');
  } else {
    loginStatus.textContent = '';
    loginStatus.classList.add('hidden');
  }
}

function saveLogin(username, password) {
  localStorage.setItem('lastLogin', JSON.stringify({ username, password }));
  localStorage.setItem('rememberLogin', 'true');
}

function clearSavedLogin() {
  localStorage.removeItem('lastLogin');
  localStorage.removeItem('rememberLogin');
}

function saveProfile(payload) {
  localStorage.setItem('employeeProfile', JSON.stringify(payload));
}

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem('employeeProfile') || 'null');
  } catch (err) {
    return null;
  }
}

function pickPhoto(item) {
  return item.photoInAM || item.photoInPM || item.photoOutAM || item.photoOutPM || item.photo || '';
}

function pickLocation(item) {
  return item.locationInAM || item.locationInPM || item.locationOutAM || item.locationOutPM || item.location || '';
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`${apiBase}/api/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) return data.address;
    }
  } catch (err) {
    // ignore server reverse-geocode errors
  }

  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1`;
    const osmRes = await fetch(osmUrl, { headers: { 'Accept-Language': 'en,fil;q=0.9' } });
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      if (osmData) {
        const addr = osmData.address || {};
        const roadLine = [addr.house_number, addr.road].filter(Boolean).join(' ');
        const place =
          addr.barangay ||
          addr.neighbourhood ||
          addr.suburb ||
          addr.village ||
          addr.hamlet ||
          addr.quarter ||
          addr.city_district ||
          addr.subdistrict ||
          addr.municipality ||
          addr.town ||
          addr.city;
        const municipality = addr.city || addr.town || addr.municipality || addr.county;
        const province = addr.state || addr.region || addr.province;
        const parts = [];
        if (roadLine) parts.push(roadLine);
        if (place && !parts.includes(place)) parts.push(place);
        if (municipality && !parts.includes(municipality)) parts.push(municipality);
        if (province && !parts.includes(province)) parts.push(province);
        if (addr.postcode) parts.push(addr.postcode);
        if (addr.country) parts.push(addr.country);
        if (parts.length) return parts.join(', ');
        if (osmData.display_name) return osmData.display_name;
      }
    }
  } catch (err) {
    // ignore fallback errors
  }
  return '';
}

function updateMapPreview(lat, lng) {
  if (!mapPreview) return;
  mapPreview.onerror = () => {
    mapPreview.src = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=17&size=600x320&markers=${lat},${lng},red-pushpin`;
  };
  mapPreview.src = `${apiBase}/api/map?lat=${lat}&lng=${lng}&ts=${Date.now()}`;
}

function setGpsStatus(message) {
  if (gpsStatus) gpsStatus.textContent = message;
}

let gpsWatchId = null;
let nativeWatchId = null;
let lastCoords = null;
let lastMapAt = 0;
let lastAddressAt = 0;
const ADDRESS_ACCURACY_THRESHOLD = 6;
const ADDRESS_STABLE_HITS = 4;
const BEST_SAMPLE_WINDOW_MS = 20000;
let accuracyStreak = 0;

function getCapacitorGeo() {
  if (typeof window === 'undefined') return null;
  if (!window.Capacitor || !window.Capacitor.Plugins) return null;
  return window.Capacitor.Plugins.Geolocation || null;
}

async function ensureNativePermission() {
  const geo = getCapacitorGeo();
  if (!geo) return false;
  try {
    const current = await geo.checkPermissions();
    if (current && (current.location === 'granted' || current.coarseLocation === 'granted')) return true;
    const requested = await geo.requestPermissions();
    const status = requested ? (requested.location || requested.coarseLocation) : null;
    return status === 'granted';
  } catch (err) {
    return false;
  }
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  if (!a || !b) return 0;
  const R = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function chooseBetterPosition(best, candidate) {
  if (!candidate) return best;
  if (!best) return candidate;
  const bestAcc = best.coords ? best.coords.accuracy : best.accuracy || 9999;
  const candAcc = candidate.coords ? candidate.coords.accuracy : candidate.accuracy || 9999;
  if (candAcc + 0.1 < bestAcc) return candidate;
  return best;
}

function collectBestWebPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let best = null;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        best = chooseBetterPosition(best, pos);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
    setTimeout(() => {
      navigator.geolocation.clearWatch(id);
      resolve(best);
    }, BEST_SAMPLE_WINDOW_MS);
  });
}

async function collectBestNativePosition() {
  const geo = getCapacitorGeo();
  if (!geo) return null;
  let best = null;
  let watchId = null;
  try {
    const idResult = await geo.watchPosition(
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0, distanceFilter: 1 },
      (pos, err) => {
        if (err) return;
        best = chooseBetterPosition(best, pos);
      }
    );
    watchId = idResult && typeof idResult === 'object' && 'id' in idResult ? idResult.id : idResult;
  } catch (err) {
    return null;
  }
  await new Promise((resolve) => setTimeout(resolve, BEST_SAMPLE_WINDOW_MS));
  if (watchId !== null) {
    try {
      geo.clearWatch({ id: watchId });
    } catch (err) {
      // ignore
    }
  }
  return best;
}

async function applyLocationUpdate(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const latValue = latitude.toFixed(5);
  const lngValue = longitude.toFixed(5);
  locationLat.textContent = latValue;
  locationLng.textContent = lngValue;
  if (locationAccuracy) locationAccuracy.textContent = `${Math.round(accuracy)} m`;
  if (confirmedBarangay) {
    applyConfirmedLocation();
  }

  const now = Date.now();
  const moved = lastCoords ? distanceMeters(lastCoords, { lat: latitude, lng: longitude }) : 9999;
  const shouldUpdateMap = moved > 10 || now - lastMapAt > 10000;
  const shouldUpdateAddress = moved > 25 || now - lastAddressAt > 20000;

  if (shouldUpdateMap) {
    updateMapPreview(latitude, longitude);
    lastMapAt = now;
  }

  if (accuracy <= ADDRESS_ACCURACY_THRESHOLD) {
    accuracyStreak += 1;
  } else {
    accuracyStreak = 0;
  }

  if (accuracy > ADDRESS_ACCURACY_THRESHOLD || accuracyStreak < ADDRESS_STABLE_HITS) {
    const fallback = lastAddress || localStorage.getItem('lastAddress') || '';
    if (fallback) {
      locationName.textContent = fallback;
      empLocation.textContent = fallback;
    }
    setGpsStatus(`Improving GPS accuracy · ±${Math.round(accuracy)}m (move outdoors)`);
    lastCoords = { lat: latitude, lng: longitude };
    return;
  }

  if (shouldUpdateAddress) {
    setGpsStatus('Fetching address…');
    try {
      const address = await reverseGeocode(latitude, longitude);
      if (address) {
        const finalAddress = applyConfirmedOverride(address);
        locationName.textContent = finalAddress;
        empLocation.textContent = finalAddress;
        lastAddress = finalAddress;
        localStorage.setItem('lastAddress', finalAddress);
        setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m`);
      } else {
        const fallback = lastAddress || localStorage.getItem('lastAddress') || '';
        if (fallback && moved < 80) {
          locationName.textContent = fallback;
          empLocation.textContent = fallback;
          setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m`);
        } else {
          locationName.textContent = 'Address unavailable';
          empLocation.textContent = 'Address unavailable';
          setGpsStatus('Address unavailable. Live GPS continues.');
        }
      }
    } catch (err) {
      const fallback = lastAddress || localStorage.getItem('lastAddress') || '';
      if (fallback && moved < 80) {
        locationName.textContent = fallback;
        empLocation.textContent = fallback;
        setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m`);
      } else {
        locationName.textContent = 'Address unavailable';
        empLocation.textContent = 'Address unavailable';
        setGpsStatus('Address unavailable. Live GPS continues.');
      }
    }
    lastAddressAt = now;
  } else {
    setGpsStatus(`Live GPS · ±${Math.round(accuracy)}m`);
  }

  lastCoords = { lat: latitude, lng: longitude };
}

async function startGpsWatch() {
  const capGeo = getCapacitorGeo();
  if (capGeo) {
    if (nativeWatchId !== null) return;
    const ok = await ensureNativePermission();
    if (!ok) {
      setGpsStatus('Location denied. Tap Update to allow.');
      return;
    }
    setGpsStatus('Live GPS started. Waiting for signal…');
    try {
      const idResult = await capGeo.watchPosition(
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0, distanceFilter: 1, minimumUpdateInterval: 1000 },
        (pos, err) => {
          if (err) {
            setGpsStatus('Unable to get GPS. Tap Update to retry.');
            return;
          }
          applyLocationUpdate(pos);
        }
      );
      nativeWatchId = idResult && typeof idResult === 'object' && 'id' in idResult ? idResult.id : idResult;
    } catch (err) {
      setGpsStatus('Unable to get GPS. Tap Update to retry.');
    }
    return;
  }
  if (!navigator.geolocation) {
    setGpsStatus('Geolocation not supported on this device.');
    return;
  }
  if (gpsWatchId !== null) return;
  setGpsStatus('Live GPS started. Waiting for signal…');
  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      applyLocationUpdate(pos);
    },
    (err) => {
      if (err && err.code === 1) {
        setGpsStatus('Location denied. Tap Update to allow.');
      } else {
        setGpsStatus('Unable to get GPS. Tap Update to retry.');
      }
    },
    { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
  );
}

function stopGpsWatch() {
  const capGeo = getCapacitorGeo();
  if (capGeo && nativeWatchId !== null) {
    try {
      capGeo.clearWatch({ id: nativeWatchId });
    } catch (err) {
      // ignore clear errors
    }
    nativeWatchId = null;
  }
  if (gpsWatchId === null) return;
  navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId = null;
}

async function api(path, options = {}, attempt = 0) {
  const target = `${apiBase}${path}`;
  try {
    const res = await fetch(target, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      data = { message: text };
    }
    if (!res.ok) {
      const error = new Error(data.message || 'Request failed');
      error.status = res.status;
      throw error;
    }
    return data;
  } catch (err) {
    if (defaultApiBase && apiBase !== defaultApiBase) {
      apiBase = defaultApiBase;
      localStorage.setItem('apiBase', apiBase);
      localStorage.setItem('apiBaseOverride', 'false');
      return api(path, options, attempt + 1);
    }
    if (err.name === 'TypeError' && attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return api(path, options, attempt + 1);
    }
    throw err;
  }
}

async function loadAttendance() {
  const data = await api(`/api/attendance?employeeId=${currentUser.id}`);
  attendanceCache = data.attendance;
  updateReportContext();
}

function computeStats() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthRecords = attendanceCache.filter((item) => item.date && item.date.startsWith(monthKey));
  const byDate = new Map();
  monthRecords.forEach((item) => {
    if (!byDate.has(item.date)) byDate.set(item.date, item);
  });

  const records = Array.from(byDate.values());
  const attended = records.filter(hasAttendance);
  const totalDays = attended.length;
  const lateCount = attended.filter((rec) => isLateMorning(rec) || isLateAfternoon(rec)).length;
  const daysSoFar = now.getDate();
  const absent = Math.max(daysSoFar - totalDays, 0);

  statDays.textContent = totalDays;
  statLate.textContent = lateCount;
  statAbsent.textContent = absent;
}

function buildMonthDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = now.getDate();
  const dates = [];
  for (let day = 1; day <= days; day += 1) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push(dateStr);
  }
  return dates;
}

function buildEmployeeStatusList(type) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthRecords = attendanceCache.filter((item) => item.date && item.date.startsWith(monthKey));
  const byDate = new Map();
  monthRecords.forEach((item) => {
    if (!byDate.has(item.date)) byDate.set(item.date, item);
  });
  const records = Array.from(byDate.values()).filter(hasAttendance);
  const lateRecords = records.filter((rec) => isLateMorning(rec) || isLateAfternoon(rec));
  const allDates = buildMonthDates();

  if (type === 'late') return lateRecords;
  if (type === 'present') return records;

  return allDates
    .filter((date) => !byDate.has(date) || !hasAttendance(byDate.get(date)))
    .map((date) => ({ date, status: 'Absent' }));
}

function renderStatModalRows(list, type) {
  if (!statModalTable) return;
  const tbody = statModalTable.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list.length) {
    if (statModalEmpty) statModalEmpty.classList.remove('hidden');
    return;
  }
  if (statModalEmpty) statModalEmpty.classList.add('hidden');

  list
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .forEach((item) => {
      const row = document.createElement('tr');
      const statusLabel = item.status || (type === 'late' ? 'Late' : type === 'present' ? 'Present' : 'Absent');
      const amIn = item.timeInAM || item.timeIn || '--';
      const pmIn = item.timeInPM || '--';
      row.innerHTML = `
        <td>${item.date || '--'}</td>
        <td class="status-cell">${statusLabel}</td>
        <td>${amIn}</td>
        <td>${pmIn}</td>
      `;
      setStatusCell(row.querySelector('.status-cell'), statusLabel);
      tbody.appendChild(row);
    });
}

function openStatModal(type) {
  if (!statModal) return;
  const labelMap = {
    present: 'Present Days',
    late: 'Late Days',
    absent: 'Absent Days'
  };
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (statModalTitle) statModalTitle.textContent = labelMap[type] || 'Status Details';
  if (statModalSubtitle) statModalSubtitle.textContent = `Coverage: ${monthLabel}`;
  const list = buildEmployeeStatusList(type);
  renderStatModalRows(list, type);
  statModal.classList.remove('hidden');
}

function closeStatModal() {
  if (statModal) statModal.classList.add('hidden');
}

function openBarangayModal() {
  if (!barangayModal) return;
  const currentAddress = locationName.textContent || empLocation.textContent || '';
  const municipality = confirmedBarangay && confirmedBarangay.municipality
    ? confirmedBarangay.municipality
    : inferMunicipality(currentAddress);
  if (barangayMunicipality) {
    barangayMunicipality.innerHTML = '';
    const options = Object.keys(BARANGAY_DATA.Marinduque || {});
    const extras = ['Other'];
    const merged = [...new Set([...options, ...extras])];
    merged.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      barangayMunicipality.appendChild(opt);
    });
    barangayMunicipality.value = municipality || 'Boac';
  }
  populateBarangaySelect(barangayMunicipality ? barangayMunicipality.value : 'Boac');
  if (confirmedBarangay && confirmedBarangay.barangay) {
    const match = Array.from(barangaySelect.options).find((opt) => opt.value === confirmedBarangay.barangay);
    if (match) {
      barangaySelect.value = confirmedBarangay.barangay;
    } else {
      barangaySelect.value = '__other__';
      if (barangayOtherInput) barangayOtherInput.value = confirmedBarangay.barangay;
    }
    toggleBarangayOther();
  }
  barangayModal.classList.remove('hidden');
}

function closeBarangayModal() {
  if (barangayModal) barangayModal.classList.add('hidden');
}

function handleBarangaySave() {
  const municipality = barangayMunicipality ? barangayMunicipality.value : 'Boac';
  let barangay = '';
  if (barangaySelect && barangaySelect.value && barangaySelect.value !== '__other__') {
    barangay = barangaySelect.value;
  } else if (barangayOtherInput) {
    barangay = barangayOtherInput.value.trim();
  }
  if (!barangay) {
    alert('Please select or type your barangay.');
    return;
  }
  confirmedBarangay = {
    barangay,
    municipality: municipality === 'Other' ? 'Boac' : municipality,
    province: 'Marinduque',
    confirmedAt: Date.now()
  };
  localStorage.setItem(BARANGAY_STORAGE_KEY, JSON.stringify(confirmedBarangay));
  applyConfirmedLocation();
  setGpsStatus('Barangay confirmed. Location saved.');
  closeBarangayModal();
}

function getTodayAttendance() {
  const today = isoToday();
  return attendanceCache.find((item) => item.date === today) || null;
}

function updateReportContext() {
  if (!currentUser) return;
  if (reportEmpName) reportEmpName.textContent = currentUser.name || '--';
  if (reportEmpPosition) reportEmpPosition.textContent = currentUser.position || 'Staff';
  if (reportSection) reportSection.textContent = currentUser.office || '--';
  if (reportDivision) reportDivision.textContent = 'Office of the Schools Division Superintendent';
  if (reportSubmittedName) reportSubmittedName.textContent = currentUser.name || '--';
  if (reportSubmittedPosition) reportSubmittedPosition.textContent = currentUser.position || 'Staff';

  const record = getTodayAttendance();
  const inAm = record ? (record.timeInAM || record.timeIn || '--') : '--';
  const outAm = record ? (record.timeOutAM || '--') : '--';
  const inPm = record ? (record.timeInPM || '--') : '--';
  const outPm = record ? (record.timeOutPM || record.timeOut || '--') : '--';
  if (reportLogDate) {
    const now = new Date();
    reportLogDate.textContent = formatDate(now);
  }
  if (reportLogTimes) {
    reportLogTimes.innerHTML = `
      <div>AM In: ${inAm}</div>
      <div>AM Out: ${outAm}</div>
      <div>PM In: ${inPm}</div>
      <div>PM Out: ${outPm}</div>
    `;
  }
}

function renderRecords(list) {
  recordsTable.innerHTML = '';
  list.forEach((item) => {
    const photo = pickPhoto(item);
    const location = pickLocation(item);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${item.timeInAM || '--'}</td>
      <td>${item.timeOutAM || '--'}</td>
      <td>${item.timeInPM || '--'}</td>
      <td>${item.timeOutPM || '--'}</td>
      <td class="status-cell">${item.status || '--'}</td>
      <td>${photo ? `<img class="table-photo" src="${photo}" alt="Photo" />` : '--'}</td>
      <td class="table-location">${location || '--'}</td>
    `;
    setStatusCell(row.querySelector('.status-cell'), item.status || '');
    recordsTable.appendChild(row);
  });
}

function filterRecordsByMonth() {
  const monthValue = recordsMonth.value;
  if (!monthValue) {
    renderRecords(attendanceCache);
    return;
  }
  const [year, month] = monthValue.split('-');
  const filtered = attendanceCache.filter((item) => item.date.startsWith(`${year}-${month}`));
  renderRecords(filtered);
}

async function updateLocation() {
  const capGeo = getCapacitorGeo();
  if (capGeo) {
    setGpsStatus('Requesting location permission…');
    const ok = await ensureNativePermission();
    if (!ok) {
      setGpsStatus('Location denied or unavailable. Tap Update to allow.');
      alert('Please allow location access (Allow While Using) for accurate GPS.');
      return;
    }
    try {
      setGpsStatus('Improving GPS accuracy…');
      const best = await collectBestNativePosition();
      if (best) {
        applyLocationUpdate(best);
      } else {
        const pos = await capGeo.getCurrentPosition({ enableHighAccuracy: true, timeout: 60000, maximumAge: 0 });
        applyLocationUpdate(pos);
      }
      startGpsWatch();
    } catch (err) {
      setGpsStatus('Unable to get GPS. Tap Update to retry.');
    }
    return;
  }
  if (!navigator.geolocation) {
    locationName.textContent = lastAddress || 'Address unavailable';
    setGpsStatus('Geolocation not supported on this device.');
    return;
  }
  setGpsStatus('Requesting location permission…');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      setGpsStatus('Improving GPS accuracy…');
      const best = await collectBestWebPosition();
      applyLocationUpdate(best || pos);
      startGpsWatch();
    },
    (err) => {
      setGpsStatus('Location denied or unavailable. Tap Update to allow.');
      if (err && err.code === 1) {
        alert('Please allow location access (Allow While Using) for accurate GPS.');
      }
    },
    { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
  );
}

function requirePhoto() {
  if (photoData) return true;
  alert('Please take a photo first.');
  if (photoInput) photoInput.click();
  return false;
}

async function markTimeIn() {
  if (!requirePhoto()) return;
  const payload = {
    employeeId: currentUser.id,
    timeIn: timeNow(),
    date: isoToday(),
    useServerTime: true,
    location: locationName.textContent,
    latitude: locationLat.textContent,
    longitude: locationLng.textContent,
    photo: photoData
  };
  try {
    const result = await api('/api/attendance/timein', { method: 'POST', body: JSON.stringify(payload) });
    await loadAttendance();
    computeStats();
    filterRecordsByMonth();
    const slotLabel = result.slot === 'PM' ? 'Afternoon' : 'Morning';
    alert(`Time in recorded (${slotLabel}).`);
  } catch (err) {
    alert(err.message || 'Time in failed.');
  }
}

async function markTimeOut() {
  if (!requirePhoto()) return;
  const payload = {
    employeeId: currentUser.id,
    timeOut: timeNow(),
    date: isoToday(),
    useServerTime: true,
    location: locationName.textContent,
    latitude: locationLat.textContent,
    longitude: locationLng.textContent,
    photo: photoData
  };
  try {
    const result = await api('/api/attendance/timeout', { method: 'POST', body: JSON.stringify(payload) });
    await loadAttendance();
    computeStats();
    filterRecordsByMonth();
    const slotLabel = result.slot === 'PM' ? 'Afternoon' : 'Morning';
    alert(`Time out recorded (${slotLabel}).`);
  } catch (err) {
    alert(err.message || 'Time out failed.');
  }
}

async function startEmployeeSession(user) {
  currentUser = user;
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  empName.textContent = currentUser.name.split(' ')[0];
  empMeta.textContent = `${currentUser.id} · ${currentUser.office}`;
  empAvatar.src = 'assets/logo.jpg';
  empAvatar2.src = 'assets/logo.jpg';
  empName2.textContent = currentUser.name;
  empRole.textContent = `${currentUser.position} · ${currentUser.office}`;

  await loadAttendance();
  computeStats();
  filterRecordsByMonth();
  updateReportContext();
  const latestWithPhoto = attendanceCache.slice().reverse().find((item) => pickPhoto(item));
  if (latestWithPhoto) {
    photoData = pickPhoto(latestWithPhoto);
    if (photoPreview) photoPreview.src = photoData;
  } else if (photoPreview) {
    photoPreview.src = 'assets/photo-placeholder.svg';
  }
  updateLocation();
  tickClock();
}

function logoutEmployee() {
  currentUser = null;
  attendanceCache = [];
  photoData = '';
  if (photoPreview) photoPreview.src = 'assets/photo-placeholder.svg';
  resetReportForm();
  loginForm.reset();
  setView('emp-dashboard');
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  clearSavedLogin();
  closeServerModal();
  stopGpsWatch();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const username = String(payload.username || '').trim();
    const password = String(payload.password || '').trim();
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'employee', username, password })
    });
    if (!rememberLogin || rememberLogin.checked) {
      saveLogin(username, password);
    } else {
      clearSavedLogin();
    }
    if (result.user) {
      saveProfile({
        name: result.user.name,
        office: result.user.office,
        employeeType: result.user.employeeType || 'Regular',
        email: result.user.email || username,
        password
      });
    }
    await startEmployeeSession(result.user);
  } catch (err) {
    const message = err.message || 'Invalid credentials. Use email or ID.';
    if (message.toLowerCase().includes('email not verified')) {
      const username = String(payload.username || '').trim();
      if (username) {
        pendingOtpEmail = username;
        openOtpModal();
      }
    }
    alert(message);
  }
});

function openServerModal() {
  serverModal.classList.remove('hidden');
}

function closeServerModal() {
  serverModal.classList.add('hidden');
}

function saveServerSettings() {
  const value = serverUrlInput.value.trim();
  if (value) {
    apiBase = value;
    localStorage.setItem('apiBase', apiBase);
    localStorage.setItem('apiBaseOverride', 'true');
  } else {
    apiBase = defaultApiBase || (isCapacitor ? 'http://10.0.2.2:5173' : window.location.origin);
    localStorage.setItem('apiBase', apiBase);
    localStorage.setItem('apiBaseOverride', 'false');
  }
  closeServerModal();
  alert('Server URL saved.');
}

function openRegisterModal() {
  registerModal.classList.remove('hidden');
}

function closeRegisterModal() {
  registerModal.classList.add('hidden');
  registerForm.reset();
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const result = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    saveProfile(payload);
    const loginUser = loginForm.querySelector('input[name="username"]');
    const loginPass = loginForm.querySelector('input[name="password"]');
    if (loginUser) loginUser.value = payload.email || result.employee.email || result.employee.id;
    if (loginPass) loginPass.value = payload.password;
    pendingOtpEmail = payload.email || result.employee.email;
    closeRegisterModal();
    openOtpModal();
    if (result.emailError) {
      alert(`Email not sent: ${result.emailError}`);
    }
    if (result.devOtp) {
      alert(`OTP (dev): ${result.devOtp}`);
    } else {
      alert('OTP sent to your email. Please enter the code to verify.');
    }
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Server not reachable. Try again after the server wakes up.');
    } else {
      alert(err.message || 'Registration failed.');
    }
  }
}

function openForgotModal() {
  forgotModal.classList.remove('hidden');
}

function closeForgotModal() {
  forgotModal.classList.add('hidden');
  forgotForm.reset();
}

async function handleForgot(event) {
  event.preventDefault();
  const formData = new FormData(forgotForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/password-reset', {
      method: 'POST',
      body: JSON.stringify({ role: 'employee', username: payload.username, newPassword: payload.newPassword })
    });
    alert('Password updated. You can log in now.');
    closeForgotModal();
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Server not reachable. Try again after the server wakes up.');
    } else {
      alert(err.message || 'Reset failed.');
    }
  }
}

function openOtpModal() {
  if (!otpModal) return;
  otpModal.classList.remove('hidden');
}

function closeOtpModal() {
  if (!otpModal) return;
  otpModal.classList.add('hidden');
  if (otpForm) otpForm.reset();
}

async function handleOtpVerify(event) {
  event.preventDefault();
  if (!pendingOtpEmail) {
    alert('Missing email for verification. Please register again.');
    return;
  }
  const formData = new FormData(otpForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/register/verify', {
      method: 'POST',
      body: JSON.stringify({ email: pendingOtpEmail, otp: payload.otp })
    });
    alert('Email verified. You can now log in.');
    closeOtpModal();
  } catch (err) {
    alert(err.message || 'OTP verification failed.');
  }
}

async function handleOtpResend() {
  if (!pendingOtpEmail) {
    alert('Missing email for verification. Please register again.');
    return;
  }
  try {
    const result = await api('/api/register/resend', {
      method: 'POST',
      body: JSON.stringify({ email: pendingOtpEmail })
    });
    if (result.emailError) {
      alert(`Email not sent: ${result.emailError}`);
    }
    if (result.devOtp) {
      alert(`OTP resent (dev): ${result.devOtp}`);
    } else {
      alert('OTP resent. Please check your email.');
    }
  } catch (err) {
    alert(err.message || 'Unable to resend OTP.');
  }
}

function openConcernModal() {
  concernModal.classList.remove('hidden');
}

function closeConcernModal() {
  concernModal.classList.add('hidden');
  concernForm.reset();
}

async function handleConcern(event) {
  event.preventDefault();
  if (!currentUser) {
    alert('Please log in first.');
    return;
  }
  const formData = new FormData(concernForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        office: currentUser.office,
        subject: payload.subject,
        message: payload.message
      })
    });
    alert('Concern sent to admin.');
    closeConcernModal();
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Server not reachable. Try again after the server wakes up.');
    } else {
      alert(err.message || 'Unable to send concern.');
    }
  }
}

function resetReportForm() {
  reportAttachmentData = '';
  reportAttachmentName = '';
  if (reportFileInput) reportFileInput.value = '';
  if (reportFileName) reportFileName.textContent = 'No file selected';
  if (reportPreviewBox) reportPreviewBox.classList.add('hidden');
  if (reportPreviewImg) reportPreviewImg.removeAttribute('src');
  if (reportForm) reportForm.reset();
}

async function handleDailyReport(event) {
  event.preventDefault();
  if (!currentUser) {
    alert('Please log in first.');
    return;
  }
  const formData = new FormData(reportForm);
  const summary = String(formData.get('summary') || '').trim();
  if (!summary) {
    alert('Please write your daily report first.');
    return;
  }
  const record = getTodayAttendance();
  const timeLogs = record
    ? {
        timeInAM: record.timeInAM || record.timeIn || '',
        timeOutAM: record.timeOutAM || '',
        timeInPM: record.timeInPM || '',
        timeOutPM: record.timeOutPM || record.timeOut || ''
      }
    : {
        timeInAM: '',
        timeOutAM: '',
        timeInPM: '',
        timeOutPM: ''
      };
  try {
    const result = await api('/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        office: currentUser.office,
        reportDate: isoToday(),
        summary,
        timeLogs,
        attachmentName: reportAttachmentName,
        attachment: reportAttachmentData
      })
    });
    if (result && result.report) {
      alert('Report submitted to admin.');
    } else {
      alert('Report submitted.');
    }
    resetReportForm();
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Server not reachable. Try again after the server wakes up.');
    } else {
      alert(err.message || 'Unable to submit report.');
    }
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

recordsMonth.addEventListener('change', filterRecordsByMonth);

document.getElementById('refresh-location').addEventListener('click', updateLocation);
if (gpsRefreshBtn) gpsRefreshBtn.addEventListener('click', updateLocation);

timeInBtn.addEventListener('click', markTimeIn);
timeOutBtn.addEventListener('click', markTimeOut);

photoInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    photoData = e.target.result;
    photoPreview.src = photoData;
  };
  reader.readAsDataURL(file);
});

if (reportFileInput) {
  reportFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      reportAttachmentData = '';
      reportAttachmentName = '';
      if (reportFileName) reportFileName.textContent = 'No file selected';
      if (reportPreviewBox) reportPreviewBox.classList.add('hidden');
      return;
    }
    reportAttachmentName = file.name;
    if (reportFileName) reportFileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      reportAttachmentData = e.target.result;
      if (file.type && file.type.startsWith('image/')) {
        if (reportPreviewImg) reportPreviewImg.src = reportAttachmentData;
        if (reportPreviewBox) reportPreviewBox.classList.remove('hidden');
      } else if (reportPreviewBox) {
        reportPreviewBox.classList.add('hidden');
      }
    };
    reader.readAsDataURL(file);
  });
}

toggleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

openServerBtn.addEventListener('click', openServerModal);
closeServerBtn.addEventListener('click', closeServerModal);
cancelServerBtn.addEventListener('click', closeServerModal);
saveServerBtn.addEventListener('click', saveServerSettings);
if (logoutBtn) logoutBtn.addEventListener('click', logoutEmployee);

openRegisterBtn.addEventListener('click', openRegisterModal);
closeRegisterBtn.addEventListener('click', closeRegisterModal);
cancelRegisterBtn.addEventListener('click', closeRegisterModal);
registerForm.addEventListener('submit', handleRegister);

openForgotBtn.addEventListener('click', openForgotModal);
closeForgotBtn.addEventListener('click', closeForgotModal);
cancelForgotBtn.addEventListener('click', closeForgotModal);
forgotForm.addEventListener('submit', handleForgot);

if (closeOtpBtn) closeOtpBtn.addEventListener('click', closeOtpModal);
if (resendOtpBtn) resendOtpBtn.addEventListener('click', handleOtpResend);
if (otpForm) otpForm.addEventListener('submit', handleOtpVerify);

if (openConcernBtn) openConcernBtn.addEventListener('click', openConcernModal);
if (closeConcernBtn) closeConcernBtn.addEventListener('click', closeConcernModal);
if (cancelConcernBtn) cancelConcernBtn.addEventListener('click', closeConcernModal);
if (concernForm) concernForm.addEventListener('submit', handleConcern);
if (reportForm) reportForm.addEventListener('submit', handleDailyReport);

if (statCards && statCards.length) {
  statCards.forEach((card) => {
    const open = () => openStatModal(card.dataset.stat);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

if (closeStatModalBtn) closeStatModalBtn.addEventListener('click', closeStatModal);
if (statModal) {
  statModal.addEventListener('click', (event) => {
    if (event.target === statModal) closeStatModal();
  });
}

if (openBarangayBtn) openBarangayBtn.addEventListener('click', openBarangayModal);
if (closeBarangayBtn) closeBarangayBtn.addEventListener('click', closeBarangayModal);
if (cancelBarangayBtn) cancelBarangayBtn.addEventListener('click', closeBarangayModal);
if (saveBarangayBtn) saveBarangayBtn.addEventListener('click', handleBarangaySave);
if (barangayMunicipality) {
  barangayMunicipality.addEventListener('change', () => {
    populateBarangaySelect(barangayMunicipality.value);
  });
}
if (barangaySelect) barangaySelect.addEventListener('change', toggleBarangayOther);
if (barangayModal) {
  barangayModal.addEventListener('click', (event) => {
    if (event.target === barangayModal) closeBarangayModal();
  });
}

applyConfirmedLocation();

setInterval(tickClock, 1000);

if (!recordsMonth.value) {
  const now = new Date();
  recordsMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

tickClock();

async function attemptAutoLogin() {
  if (rememberLogin && !rememberLogin.checked) return;
  const rememberFlag = localStorage.getItem('rememberLogin');
  if (rememberFlag === 'false') return;
  const savedLogin = localStorage.getItem('lastLogin');
  if (!savedLogin) return;
  if (autoRestoreAttempted) return;
  let creds = null;
  try {
    creds = JSON.parse(savedLogin);
  } catch (err) {
    return;
  }
  if (!creds || !creds.username || !creds.password) return;
  setLoginStatus('Signing you in automatically...');
  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'employee', username: creds.username, password: creds.password })
    });
    await startEmployeeSession(result.user);
    setLoginStatus('');
  } catch (err) {
    setLoginStatus('');
    const profile = loadProfile();
    if (!autoRestoreAttempted && profile && profile.email) {
      autoRestoreAttempted = true;
      try {
        const restore = await api('/api/register', {
          method: 'POST',
          body: JSON.stringify(profile)
        });
        pendingOtpEmail = profile.email;
        openOtpModal();
        if (restore.emailError) {
          alert(`Account restored, but email not sent: ${restore.emailError}`);
        } else if (restore.devOtp) {
          alert(`Account restored. OTP (dev): ${restore.devOtp}`);
        } else {
          alert('Account restored. OTP sent to your email.');
        }
      } catch (restoreErr) {
        // ignore restore errors
      }
    }
  }
}

attemptAutoLogin();
