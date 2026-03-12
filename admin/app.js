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

const addEmployeeModal = document.getElementById('add-employee-modal');
const addEmployeeForm = document.getElementById('add-employee-form');
const employeeSearch = document.getElementById('employee-search');

const reportPreview = document.getElementById('report-preview');

let employeesCache = [];
let attendanceCache = [];
let refreshTimer = null;

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
  const statusLower = status.toLowerCase();
  cell.classList.remove('status-present', 'status-late', 'status-absent');
  if (statusLower === 'present') cell.classList.add('status-present');
  if (statusLower === 'late') cell.classList.add('status-late');
  if (statusLower === 'absent') cell.classList.add('status-absent');
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
  const data = await api('/api/summary');
  statTotal.textContent = data.totalEmployees;
  statPresent.textContent = data.present;
  statLate.textContent = data.late;
  statAbsent.textContent = data.absent;
}

async function loadAttendanceToday() {
  const data = await api('/api/attendance/today');
  attendanceCache = data.attendance;
  attendanceTable.innerHTML = '';
  data.attendance.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.employeeId}</td>
      <td>${item.employeeName}</td>
      <td>${item.office}</td>
      <td>${item.timeIn || '--'}</td>
      <td>${item.timeOut || '--'}</td>
      <td>${item.status}</td>
    `;
    setStatusCell(row.lastElementChild, item.status);
    attendanceTable.appendChild(row);
  });
}

async function loadEmployees() {
  const data = await api('/api/employees');
  employeesCache = data.employees;
  renderEmployees(employeesCache);
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
  const data = await api(`/api/attendance?${query}`);
  attendanceHistory.innerHTML = '';
  data.attendance.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${item.employeeName}</td>
      <td>${item.office}</td>
      <td>${item.timeIn || '--'}</td>
      <td>${item.timeOut || '--'}</td>
      <td>${item.status}</td>
    `;
    setStatusCell(row.lastElementChild, item.status);
    attendanceHistory.appendChild(row);
  });
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

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (adminApp.classList.contains('hidden')) return;
    loadSummary();
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
    await Promise.all([loadSummary(), loadAttendanceToday(), loadEmployees()]);
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

tickClock();
