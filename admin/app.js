const loginForm = document.getElementById('login-form');
const loginScreen = document.getElementById('admin-login');
const adminApp = document.getElementById('admin-app');
const toggleButtons = document.querySelectorAll('[data-toggle="password"]');
const tabButtons = document.querySelectorAll('.tab-btn');

const statTotal = document.getElementById('stat-total');
const statPresent = document.getElementById('stat-present');
const statLate = document.getElementById('stat-late');
const statAbsent = document.getElementById('stat-absent');
const currentTime = document.getElementById('current-time');
const currentDate = document.getElementById('current-date');

const attendanceTable = document.getElementById('attendance-table').querySelector('tbody');
const employeesTable = document.getElementById('employees-table').querySelector('tbody');
const attendanceHistory = document.getElementById('attendance-history').querySelector('tbody');
const reportsTable = document.getElementById('reports-table').querySelector('tbody');
const reportsFrom = document.getElementById('reports-from');
const reportsTo = document.getElementById('reports-to');
const filterReportsBtn = document.getElementById('filter-reports');
const refreshReportsBtn = document.getElementById('refresh-reports');
const dtrEmployee = document.getElementById('dtr-employee');
const dtrMonth = document.getElementById('dtr-month');
const generateDtrBtn = document.getElementById('generate-dtr');
const printDtrBtn = document.getElementById('print-dtr');
const dtrPreview = document.getElementById('dtr-preview');

const addEmployeeModal = document.getElementById('add-employee-modal');
const addEmployeeForm = document.getElementById('add-employee-form');
const employeeSearch = document.getElementById('employee-search');

const reportPreview = document.getElementById('report-preview');
const adminRegisterModal = document.getElementById('admin-register-modal');
const adminRegisterForm = document.getElementById('admin-register-form');
const adminForgotModal = document.getElementById('admin-forgot-modal');
const adminForgotForm = document.getElementById('admin-forgot-form');
const notifBtn = document.getElementById('notif-btn');
const notifPanel = document.getElementById('notif-panel');
const notifList = document.getElementById('notif-list');
const notifCount = document.getElementById('notif-count');
const notifEmpty = document.getElementById('notif-empty');
const markNotifReadBtn = document.getElementById('mark-notif-read');
const msgBtn = document.getElementById('msg-btn');
const msgPanel = document.getElementById('msg-panel');
const msgList = document.getElementById('msg-list');
const msgCount = document.getElementById('msg-count');
const msgEmpty = document.getElementById('msg-empty');
const markMsgReadBtn = document.getElementById('mark-msg-read');
const menuBtn = document.getElementById('menu-btn');
const menuPanel = document.getElementById('menu-panel');
const helpBtn = document.getElementById('need-help-btn');
const helpDetails = document.getElementById('help-details');
const logoutBtn = document.getElementById('logout-btn');

let employeesCache = [];
let attendanceCache = [];
let notificationsCache = [];
let messagesCache = [];
let reportsCache = [];
let reportMap = new Map();
let refreshTimer = null;

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

function formatDateTimeStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function updateBadge(el, count) {
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('hidden', count <= 0);
}

function tickClock() {
  const now = new Date();
  currentTime.textContent = formatTime(now);
  currentDate.textContent = formatDate(now);
}

function setView(viewId) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('hidden', view.id !== viewId);
  });
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId));
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

function buildReportKey(employeeId, date) {
  return `${employeeId || ''}|${date || ''}`;
}

function updateReportMap(list) {
  reportMap = new Map();
  list.forEach((report) => {
    reportMap.set(buildReportKey(report.employeeId, report.reportDate), report);
  });
}

function shorten(text, max = 90) {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function isImageAttachment(data) {
  return typeof data === 'string' && data.startsWith('data:image');
}

function openReportPrint(report) {
  if (!report) return;
  const attachmentName = report.attachmentName || 'attachment';
  const attachmentHtml = report.attachmentData
    ? (isImageAttachment(report.attachmentData)
      ? `<img src="${report.attachmentData}" alt="Attachment" style="max-width:100%; margin-top:12px; border-radius:10px;" />`
      : `<a href="${report.attachmentData}" download="${attachmentName}">Download attachment</a>`)
    : '<em>No attachment</em>';

  const printWindow = window.open('', '', 'width=900,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>Employee Daily Report</title>
        <style>
          body { font-family: "Trebuchet MS", sans-serif; padding: 24px; color: #1f2b45; }
          h1 { color: #0d2d6a; margin-bottom: 6px; }
          .meta { margin-bottom: 16px; color: #3b4a6b; }
          .summary { background: #f4f7ff; padding: 14px; border-radius: 12px; }
        </style>
      </head>
      <body>
        <h1>SDO Marinduque Daily Report</h1>
        <div class="meta">
          <div><strong>Employee:</strong> ${report.employeeName || 'Employee'}</div>
          <div><strong>Office:</strong> ${report.office || '--'}</div>
          <div><strong>Date:</strong> ${report.reportDate || '--'}</div>
        </div>
        <div class="summary">${report.summary || ''}</div>
        <div style="margin-top: 16px;">
          <strong>Attachment:</strong><br />
          ${attachmentHtml}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
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
}

async function loadSummary() {
  const data = await api(`/api/summary?date=${isoToday()}`);
  statTotal.textContent = data.totalEmployees;
  statPresent.textContent = data.present;
  statLate.textContent = data.late;
  statAbsent.textContent = data.absent;
}

async function loadAttendanceToday() {
  const today = isoToday();
  const [data, reportData] = await Promise.all([
    api(`/api/attendance/today?date=${today}`),
    api(`/api/reports?from=${today}&to=${today}`)
  ]);
  attendanceCache = data.attendance;
  reportsCache = reportData.reports || [];
  updateReportMap(reportsCache);
  attendanceTable.innerHTML = '';
  data.attendance.forEach((item) => {
    const photo = pickPhoto(item);
    const location = pickLocation(item);
    const report = reportMap.get(buildReportKey(item.employeeId, item.date));
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.employeeId}</td>
      <td>${item.employeeName}</td>
      <td>${item.office}</td>
      <td>${item.timeInAM || item.timeIn || '--'}</td>
      <td>${item.timeOutAM || '--'}</td>
      <td>${item.timeInPM || '--'}</td>
      <td>${item.timeOutPM || item.timeOut || '--'}</td>
      <td class="status-cell">${item.status || '--'}</td>
      <td>${photo ? `<img class="table-photo" src="${photo}" alt="Photo" />` : '--'}</td>
      <td>
        ${report ? `<button class="table-action-btn" data-report="${report.id}" data-employee="${item.employeeId}" data-date="${item.date}">Print Report</button>` : '--'}
      </td>
      <td class="table-location">${location || '--'}</td>
    `;
    setStatusCell(row.querySelector('.status-cell'), item.status || '');
    attendanceTable.appendChild(row);
  });
}

async function loadEmployees() {
  const data = await api('/api/employees');
  employeesCache = data.employees;
  renderEmployees(employeesCache);
  populateDtrEmployees();
}

function renderEmployees(list) {
  employeesTable.innerHTML = '';
  list.forEach((emp) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${emp.id}</td>
      <td>${emp.name}</td>
      <td>${emp.position}</td>
      <td>${emp.office}</td>
      <td>${emp.status}</td>
    `;
    employeesTable.appendChild(row);
  });
}

async function loadAttendanceHistory(from, to) {
  const query = new URLSearchParams({ from, to }).toString();
  const [data, reportData] = await Promise.all([
    api(`/api/attendance?${query}`),
    api(`/api/reports?${query}`)
  ]);
  reportsCache = reportData.reports || [];
  updateReportMap(reportsCache);
  attendanceHistory.innerHTML = '';
  data.attendance.forEach((item) => {
    const photo = pickPhoto(item);
    const location = pickLocation(item);
    const report = reportMap.get(buildReportKey(item.employeeId, item.date));
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${item.employeeName}</td>
      <td>${item.office}</td>
      <td>${item.timeInAM || item.timeIn || '--'}</td>
      <td>${item.timeOutAM || '--'}</td>
      <td>${item.timeInPM || '--'}</td>
      <td>${item.timeOutPM || item.timeOut || '--'}</td>
      <td class="status-cell">${item.status || '--'}</td>
      <td>${photo ? `<img class="table-photo" src="${photo}" alt="Photo" />` : '--'}</td>
      <td>
        ${report ? `<button class="table-action-btn" data-report="${report.id}" data-employee="${item.employeeId}" data-date="${item.date}">Print Report</button>` : '--'}
      </td>
      <td class="table-location">${location || '--'}</td>
    `;
    setStatusCell(row.querySelector('.status-cell'), item.status || '');
    attendanceHistory.appendChild(row);
  });
}

function renderNotifications(list) {
  notifList.innerHTML = '';
  if (!list.length) {
    notifEmpty.classList.remove('hidden');
  } else {
    notifEmpty.classList.add('hidden');
  }
  list.forEach((note) => {
    const item = document.createElement('div');
    item.className = `panel-item ${note.read ? '' : 'unread'}`;
    item.innerHTML = `
      <div class="panel-title">${note.title || 'Notification'}</div>
      <div class="panel-message">${note.message || ''}</div>
      <div class="panel-meta">${formatDateTimeStamp(note.createdAt)}</div>
    `;
    notifList.appendChild(item);
  });
  const unread = list.filter((n) => !n.read).length;
  updateBadge(notifCount, unread);
}

async function loadNotifications() {
  try {
    const data = await api('/api/notifications');
    notificationsCache = data.notifications || [];
    renderNotifications(notificationsCache);
  } catch (err) {
    // ignore notification failures
  }
}

function renderMessages(list) {
  msgList.innerHTML = '';
  if (!list.length) {
    msgEmpty.classList.remove('hidden');
  } else {
    msgEmpty.classList.add('hidden');
  }
  list.forEach((msg) => {
    const item = document.createElement('div');
    item.className = `panel-item ${msg.read ? '' : 'unread'}`;
    item.innerHTML = `
      <div class="panel-title">${msg.subject || 'Concern'}</div>
      <div class="panel-message">${msg.employeeName || 'Employee'}${msg.office ? ` · ${msg.office}` : ''}</div>
      <div class="panel-message">${msg.message || ''}</div>
      <div class="panel-meta">${formatDateTimeStamp(msg.createdAt)}</div>
    `;
    msgList.appendChild(item);
  });
  const unread = list.filter((m) => !m.read).length;
  updateBadge(msgCount, unread);
}

async function loadMessages() {
  try {
    const data = await api('/api/messages');
    messagesCache = data.messages || [];
    renderMessages(messagesCache);
  } catch (err) {
    // ignore message failures
  }
}

function renderReportsTable(list) {
  reportsTable.innerHTML = '';
  list.forEach((report) => {
    const attachmentLabel = report.attachmentName || (report.attachmentData ? 'Attachment' : '--');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${report.reportDate || '--'}</td>
      <td>${report.employeeName || '--'}</td>
      <td>${report.office || '--'}</td>
      <td class="summary-cell">${shorten(report.summary || '--')}</td>
      <td>${attachmentLabel}</td>
      <td>
        <button class="table-action-btn ghost" data-report="${report.id}" data-employee="${report.employeeId}" data-date="${report.reportDate}">Print</button>
      </td>
    `;
    reportsTable.appendChild(row);
  });
  updateReportMap(list);
}

async function loadReportsTable(from, to) {
  const query = new URLSearchParams({ from, to }).toString();
  const data = await api(`/api/reports?${query}`);
  reportsCache = data.reports || [];
  renderReportsTable(reportsCache);
}

function populateDtrEmployees() {
  if (!dtrEmployee) return;
  dtrEmployee.innerHTML = '<option value="" disabled selected>Select Employee</option>';
  employeesCache.forEach((emp) => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = `${emp.name} (${emp.id})`;
    dtrEmployee.appendChild(option);
  });
}

async function generateDtr() {
  const employeeId = dtrEmployee.value;
  const monthValue = dtrMonth.value;
  if (!employeeId || !monthValue) {
    dtrPreview.textContent = 'Select an employee and month first.';
    return;
  }
  const [year, month] = monthValue.split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = new Date(year, month, 0);
  const to = `${year}-${String(month).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
  const query = new URLSearchParams({ from, to, employeeId }).toString();
  const data = await api(`/api/attendance?${query}`);
  const list = (data.attendance || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

  dtrPreview.innerHTML = '';
  if (!list.length) {
    dtrPreview.textContent = 'No attendance records found for this employee.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Time In (AM)</th>
        <th>Time Out (AM)</th>
        <th>Time In (PM)</th>
        <th>Time Out (PM)</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${list.map((item) => `
        <tr>
          <td>${item.date}</td>
          <td>${item.timeInAM || item.timeIn || '--'}</td>
          <td>${item.timeOutAM || '--'}</td>
          <td>${item.timeInPM || '--'}</td>
          <td>${item.timeOutPM || item.timeOut || '--'}</td>
          <td>${item.status || '--'}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  dtrPreview.appendChild(table);
}

function printDtr() {
  if (!dtrPreview.innerHTML.trim()) {
    dtrPreview.textContent = 'Generate a DTR first.';
    return;
  }
  const printWindow = window.open('', '', 'width=900,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>DTR Print</title>
        <style>
          body { font-family: "Trebuchet MS", sans-serif; padding: 24px; }
          h1 { color: #0d2d6a; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
        </style>
      </head>
      <body>
        <h1>SDO Marinduque - Daily Time Record</h1>
        ${dtrPreview.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function closePanels() {
  [notifPanel, msgPanel, menuPanel].forEach((panel) => {
    if (panel) panel.classList.add('hidden');
  });
}

function togglePanel(panel) {
  const isOpen = panel && !panel.classList.contains('hidden');
  closePanels();
  if (panel && !isOpen) panel.classList.remove('hidden');
}

function logoutAdmin() {
  closePanels();
  loginScreen.classList.remove('hidden');
  adminApp.classList.add('hidden');
  loginForm.reset();
  notificationsCache = [];
  messagesCache = [];
  updateBadge(notifCount, 0);
  updateBadge(msgCount, 0);
  if (refreshTimer) clearInterval(refreshTimer);
}

function openAddEmployee() {
  addEmployeeModal.classList.remove('hidden');
}

function closeAddEmployee() {
  addEmployeeModal.classList.add('hidden');
  addEmployeeForm.reset();
}

async function handleAddEmployee(event) {
  event.preventDefault();
  const formData = new FormData(addEmployeeForm);
  const payload = Object.fromEntries(formData.entries());
  await api('/api/employees', { method: 'POST', body: JSON.stringify(payload) });
  await loadEmployees();
  closeAddEmployee();
}

async function generateReport() {
  const monthValue = document.getElementById('report-month').value;
  const office = document.getElementById('report-office').value;
  if (!monthValue) {
    reportPreview.textContent = 'Please select a month.';
    return;
  }
  const [year, month] = monthValue.split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = new Date(year, month, 0);
  const to = `${year}-${String(month).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;

  const query = new URLSearchParams({ from, to }).toString();
  const data = await api(`/api/attendance?${query}`);
  let list = data.attendance;
  if (office) list = list.filter((item) => item.office === office);

  reportPreview.innerHTML = '';
  if (!list.length) {
    reportPreview.textContent = 'No records found for the selected filters.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Employee</th>
        <th>Office</th>
        <th>Time In</th>
        <th>Time Out</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${list.map((item) => `
        <tr>
          <td>${item.date}</td>
          <td>${item.employeeName}</td>
          <td>${item.office}</td>
          <td>${item.timeIn || '--'}</td>
          <td>${item.timeOut || '--'}</td>
          <td>${item.status}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  reportPreview.appendChild(table);
}

function downloadReport() {
  if (!reportPreview.innerHTML.trim()) {
    reportPreview.textContent = 'Generate a report first.';
    return;
  }
  const printWindow = window.open('', '', 'width=900,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>Attendance Report</title>
        <style>
          body { font-family: "Trebuchet MS", sans-serif; padding: 24px; }
          h1 { color: #0d2d6a; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
        </style>
      </head>
      <body>
        <h1>SDO Marinduque Attendance Report</h1>
        ${reportPreview.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function handleReportPrintClick(event) {
  const btn = event.target.closest('button[data-report]');
  if (!btn) return;
  const reportId = btn.dataset.report;
  const employeeId = btn.dataset.employee;
  const reportDate = btn.dataset.date;
  let report = reportsCache.find((r) => r.id === reportId);
  if (!report && employeeId && reportDate) {
    try {
      const query = new URLSearchParams({ employeeId, from: reportDate, to: reportDate }).toString();
      const data = await api(`/api/reports?${query}`);
      report = (data.reports || [])[0];
      if (report) {
        reportsCache = data.reports || [];
        updateReportMap(reportsCache);
      }
    } catch (err) {
      alert('Unable to load report.');
      return;
    }
  }
  if (!report) {
    alert('No report found for this date.');
    return;
  }
  openReportPrint(report);
}

function openAdminRegister() {
  adminRegisterModal.classList.remove('hidden');
}

function closeAdminRegister() {
  adminRegisterModal.classList.add('hidden');
  adminRegisterForm.reset();
}

async function handleAdminRegister(event) {
  event.preventDefault();
  const formData = new FormData(adminRegisterForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/admin/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    alert('Admin registered. You can now log in.');
    closeAdminRegister();
  } catch (err) {
    alert(err.message || 'Registration failed.');
  }
}

function openAdminForgot() {
  adminForgotModal.classList.remove('hidden');
}

function closeAdminForgot() {
  adminForgotModal.classList.add('hidden');
  adminForgotForm.reset();
}

async function handleAdminForgot(event) {
  event.preventDefault();
  const formData = new FormData(adminForgotForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/password-reset', {
      method: 'POST',
      body: JSON.stringify({ role: 'admin', username: payload.username, newPassword: payload.newPassword })
    });
    alert('Password updated.');
    closeAdminForgot();
  } catch (err) {
    alert(err.message || 'Reset failed.');
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (adminApp.classList.contains('hidden')) return;
    loadSummary();
    loadNotifications();
    loadMessages();
    const active = document.querySelector('.tab-btn.active');
    if (active && active.dataset.view === 'dashboard-view') {
      loadAttendanceToday();
    }
  }, 10000);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const username = String(payload.username || '').trim();
    const password = String(payload.password || '').trim();
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'admin', username, password })
    });
    loginScreen.classList.add('hidden');
    adminApp.classList.remove('hidden');
    await Promise.all([loadSummary(), loadAttendanceToday(), loadEmployees(), loadNotifications(), loadMessages()]);
    tickClock();
    startAutoRefresh();
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Cannot reach the server. Make sure the server is running and try again.');
      return;
    }
    alert(err.message || 'Login failed.');
  }
});

setInterval(tickClock, 1000);

toggleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setView(btn.dataset.view);
    if (btn.dataset.view === 'attendance-view') {
      const today = new Date();
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      loadAttendanceHistory(from, to);
    }
    if (btn.dataset.view === 'reports-view') {
      const today = new Date();
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (reportsFrom) reportsFrom.value = from;
      if (reportsTo) reportsTo.value = to;
      loadReportsTable(from, to);
      if (dtrMonth && !dtrMonth.value) {
        dtrMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      }
      populateDtrEmployees();
    }
  });
});

document.getElementById('open-add-employee').addEventListener('click', openAddEmployee);
document.getElementById('close-add-employee').addEventListener('click', closeAddEmployee);
document.getElementById('cancel-add-employee').addEventListener('click', closeAddEmployee);
addEmployeeForm.addEventListener('submit', handleAddEmployee);

employeeSearch.addEventListener('input', (event) => {
  const term = event.target.value.toLowerCase();
  const filtered = employeesCache.filter((emp) =>
    emp.name.toLowerCase().includes(term) ||
    emp.id.toLowerCase().includes(term) ||
    emp.office.toLowerCase().includes(term)
  );
  renderEmployees(filtered);
});

document.getElementById('refresh-attendance').addEventListener('click', () => {
  loadSummary();
  loadAttendanceToday();
});

document.getElementById('refresh-employees').addEventListener('click', loadEmployees);

attendanceTable.addEventListener('click', handleReportPrintClick);
attendanceHistory.addEventListener('click', handleReportPrintClick);
reportsTable.addEventListener('click', handleReportPrintClick);

document.getElementById('filter-attendance').addEventListener('click', () => {
  const from = document.getElementById('attendance-from').value;
  const to = document.getElementById('attendance-to').value;
  if (!from || !to) {
    alert('Select start and end dates.');
    return;
  }
  loadAttendanceHistory(from, to);
});

document.getElementById('generate-report').addEventListener('click', generateReport);
document.getElementById('download-report').addEventListener('click', downloadReport);

if (filterReportsBtn) {
  filterReportsBtn.addEventListener('click', () => {
    const from = reportsFrom.value;
    const to = reportsTo.value;
    if (!from || !to) {
      alert('Select start and end dates.');
      return;
    }
    loadReportsTable(from, to);
  });
}

if (refreshReportsBtn) {
  refreshReportsBtn.addEventListener('click', () => {
    const today = new Date();
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (reportsFrom) reportsFrom.value = from;
    if (reportsTo) reportsTo.value = to;
    loadReportsTable(from, to);
  });
}

if (generateDtrBtn) generateDtrBtn.addEventListener('click', generateDtr);
if (printDtrBtn) printDtrBtn.addEventListener('click', printDtr);

document.getElementById('open-admin-register').addEventListener('click', openAdminRegister);
document.getElementById('close-admin-register').addEventListener('click', closeAdminRegister);
document.getElementById('cancel-admin-register').addEventListener('click', closeAdminRegister);
adminRegisterForm.addEventListener('submit', handleAdminRegister);

document.getElementById('open-admin-forgot').addEventListener('click', openAdminForgot);
document.getElementById('close-admin-forgot').addEventListener('click', closeAdminForgot);
document.getElementById('cancel-admin-forgot').addEventListener('click', closeAdminForgot);
adminForgotForm.addEventListener('submit', handleAdminForgot);

if (notifBtn && notifPanel) {
  notifBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(notifPanel);
    loadNotifications();
  });
  notifPanel.addEventListener('click', (event) => event.stopPropagation());
}

if (msgBtn && msgPanel) {
  msgBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(msgPanel);
    loadMessages();
  });
  msgPanel.addEventListener('click', (event) => event.stopPropagation());
}

if (menuBtn && menuPanel) {
  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(menuPanel);
  });
  menuPanel.addEventListener('click', (event) => event.stopPropagation());
}

if (markNotifReadBtn) {
  markNotifReadBtn.addEventListener('click', async () => {
    try {
      await api('/api/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) });
      await loadNotifications();
    } catch (err) {
      alert(err.message || 'Unable to mark notifications.');
    }
  });
}

if (markMsgReadBtn) {
  markMsgReadBtn.addEventListener('click', async () => {
    try {
      await api('/api/messages/read', { method: 'POST', body: JSON.stringify({ all: true }) });
      await loadMessages();
    } catch (err) {
      alert(err.message || 'Unable to mark messages.');
    }
  });
}

if (helpBtn && helpDetails) {
  helpBtn.addEventListener('click', () => {
    helpDetails.classList.toggle('hidden');
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', logoutAdmin);
}

document.addEventListener('click', closePanels);

tickClock();
