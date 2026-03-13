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

const empTime = document.getElementById('emp-time');
const empDate = document.getElementById('emp-date');

const locationName = document.getElementById('location-name');
const locationLat = document.getElementById('location-lat');
const locationLng = document.getElementById('location-lng');
const empLocation = document.getElementById('emp-location');

const timeInBtn = document.getElementById('time-in');
const timeOutBtn = document.getElementById('time-out');

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

let currentUser = null;
let attendanceCache = [];
let photoData = '';
let pendingOtpEmail = '';
const appConfig = typeof window !== 'undefined' && window.APP_CONFIG ? window.APP_CONFIG : {};
const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
const defaultApiBase = appConfig.apiBase || '';
const storedApiBase = localStorage.getItem('apiBase') || '';
const storedOverride = localStorage.getItem('apiBaseOverride') === 'true';

let apiBase = '';
if (isCapacitor) {
  apiBase = storedOverride ? storedApiBase : (defaultApiBase || storedApiBase || 'http://10.0.2.2:5173');
} else {
  apiBase = defaultApiBase || window.location.origin;
}

serverUrlInput.value = storedOverride ? storedApiBase : apiBase;

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
  return !!(record.timeInAM || record.timeInPM || record.timeIn);
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

function pickPhoto(item) {
  return item.photoInAM || item.photoInPM || item.photoOutAM || item.photoOutPM || item.photo || '';
}

function pickLocation(item) {
  return item.locationInAM || item.locationInPM || item.locationOutAM || item.locationOutPM || item.location || '';
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

function renderRecords(list) {
  recordsTable.innerHTML = '';
  list.forEach((item) => {
    const photo = pickPhoto(item);
    const location = pickLocation(item);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${item.timeInAM || item.timeIn || '--'}</td>
      <td>${item.timeOutAM || '--'}</td>
      <td>${item.timeInPM || '--'}</td>
      <td>${item.timeOutPM || item.timeOut || '--'}</td>
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

function updateLocation() {
  if (!navigator.geolocation) {
    locationName.textContent = 'Boac';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      locationLat.textContent = latitude.toFixed(4);
      locationLng.textContent = longitude.toFixed(4);
      locationName.textContent = 'Current Location';
      empLocation.textContent = 'Current Location';
    },
    () => {
      locationName.textContent = 'Boac';
    }
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
    location: locationName.textContent,
    latitude: locationLat.textContent,
    longitude: locationLng.textContent,
    photo: photoData
  };
  const result = await api('/api/attendance/timein', { method: 'POST', body: JSON.stringify(payload) });
  await loadAttendance();
  computeStats();
  filterRecordsByMonth();
  const slotLabel = result.slot === 'PM' ? 'Afternoon' : 'Morning';
  alert(`Time in recorded (${slotLabel}).`);
  photoData = '';
  if (photoPreview) photoPreview.src = 'assets/avatar-generic.svg';
}

async function markTimeOut() {
  if (!requirePhoto()) return;
  const payload = {
    employeeId: currentUser.id,
    timeOut: timeNow(),
    date: isoToday(),
    location: locationName.textContent,
    latitude: locationLat.textContent,
    longitude: locationLng.textContent,
    photo: photoData
  };
  const result = await api('/api/attendance/timeout', { method: 'POST', body: JSON.stringify(payload) });
  await loadAttendance();
  computeStats();
  filterRecordsByMonth();
  const slotLabel = result.slot === 'PM' ? 'Afternoon' : 'Morning';
  alert(`Time out recorded (${slotLabel}).`);
  photoData = '';
  if (photoPreview) photoPreview.src = 'assets/avatar-generic.svg';
}

async function startEmployeeSession(user) {
  currentUser = user;
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  empName.textContent = currentUser.name.split(' ')[0];
  empMeta.textContent = `${currentUser.id} · ${currentUser.office}`;
  empAvatar.src = currentUser.avatar;
  empAvatar2.src = currentUser.avatar;
  empName2.textContent = currentUser.name;
  empRole.textContent = `${currentUser.position} · ${currentUser.office}`;

  await loadAttendance();
  computeStats();
  filterRecordsByMonth();
  updateLocation();
  tickClock();
}

function logoutEmployee() {
  currentUser = null;
  attendanceCache = [];
  photoData = '';
  if (photoPreview) photoPreview.src = 'assets/avatar-generic.svg';
  loginForm.reset();
  setView('emp-dashboard');
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  closeServerModal();
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

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

recordsMonth.addEventListener('change', filterRecordsByMonth);

document.getElementById('refresh-location').addEventListener('click', updateLocation);

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

setInterval(tickClock, 1000);

if (!recordsMonth.value) {
  const now = new Date();
  recordsMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

tickClock();
