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

function hasAnyAttendanceLocal(item) {
  if (!item) return false;
  return !!(
    item.timeInAM ||
    item.timeOutAM ||
    item.timeInPM ||
    item.timeOutPM ||
    item.timeIn ||
    item.timeOut
  );
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isImageAttachment(data) {
  return typeof data === 'string' && data.startsWith('data:image');
}

async function fetchAttendanceForReport(employeeId, reportDate) {
  if (!employeeId || !reportDate) return null;
  const query = new URLSearchParams({ employeeId, from: reportDate, to: reportDate }).toString();
  const data = await api(`/api/attendance?${query}`);
  return (data.attendance || [])[0] || null;
}

async function openReportPrint(report) {
  if (!report) return;
  const attachmentName = report.attachmentName || 'attachment';
  const attachmentLabel = report.attachmentData ? attachmentName : 'No attachment';
  const attachmentHtml = report.attachmentData
    ? (isImageAttachment(report.attachmentData)
      ? `<img src="${report.attachmentData}" alt="Attachment" style="max-width:100%; margin-top:12px; border-radius:6px;" />`
      : `<a href="${report.attachmentData}" download="${attachmentName}">Download attachment</a>`)
    : '<em>No attachment</em>';

  let attendanceRecord = null;
  try {
    attendanceRecord = await fetchAttendanceForReport(report.employeeId, report.reportDate);
  } catch (err) {
    attendanceRecord = null;
  }

  const emp = employeesCache.find((item) => item.id === report.employeeId) || {};
  const employeeName = emp.name || report.employeeName || 'Employee';
  const employeePosition = emp.position || 'Staff';
  const employeeOffice = emp.office || report.office || '';
  const reportDate = report.reportDate || '--';
  const timeInAM = attendanceRecord ? (attendanceRecord.timeInAM || attendanceRecord.timeIn || '--') : '--';
  const timeOutAM = attendanceRecord ? (attendanceRecord.timeOutAM || '--') : '--';
  const timeInPM = attendanceRecord ? (attendanceRecord.timeInPM || '--') : '--';
  const timeOutPM = attendanceRecord ? (attendanceRecord.timeOutPM || attendanceRecord.timeOut || '--') : '--';
  const summaryHtml = escapeHtml(report.summary || '').replace(/\n/g, '<br>');
  const sealUrl = `${window.location.origin}/admin/assets/deped-seal.png`;
  const depedLogo = `${window.location.origin}/admin/assets/deped-wordmark.png`;
  const bagongLogo = `${window.location.origin}/admin/assets/bagong-pilipinas.png`;
  const sdoLogo = `${window.location.origin}/admin/assets/logo.jpg`;

  const printWindow = window.open('', '', 'width=900,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>Individual Daily Log and Accomplishment Report</title>
        <style>
          @page { size: A4; margin: 18mm; }
          body { font-family: "Times New Roman", serif; color: #111; margin: 0; }
          .report-header { text-align: center; }
          .seal { width: 76px; height: 76px; object-fit: contain; margin: 0 auto 4px; display: block; }
          .header-text { line-height: 1.1; }
          .rep { font-size: 12px; letter-spacing: 0.02em; font-family: "Old English Text MT", "Garamond", "Times New Roman", serif; }
          .dept { font-weight: 700; font-size: 20px; letter-spacing: 0.04em; text-transform: uppercase; font-family: "Old English Text MT", "Garamond", "Times New Roman", serif; }
          .division { font-weight: 700; font-size: 11px; letter-spacing: 0.14em; }
          .header-lines { margin: 6px 0 2px; }
          .header-line { border-top: 2px solid #000; }
          .header-line.thin { border-top: 1px solid #000; margin-top: 2px; }
          .office-line { font-size: 12px; font-weight: 700; text-align: left; margin: 4px 0 2px; }
          .title { margin: 10px 0 2px; font-weight: 700; font-size: 13px; text-align: center; }
          .subtitle { margin: 0 0 10px; font-weight: 700; font-size: 12px; text-align: center; }
          .meta { font-size: 12px; margin-top: 2px; }
          .meta-row { display: flex; gap: 10px; margin: 4px 0; align-items: flex-end; }
          .meta-label { width: 90px; font-weight: 700; }
          .meta-line { flex: 1; border-bottom: 1px solid #000; min-height: 14px; }
          table.report { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          table.report th, table.report td { border: 1px solid #000; padding: 6px; vertical-align: top; }
          table.report th { text-align: center; font-weight: 700; }
          .logs { line-height: 1.5; white-space: pre-line; }
          .signatures { display: flex; justify-content: space-between; margin-top: 18px; font-size: 12px; }
          .sig { width: 44%; text-align: center; }
          .sig-line { border-top: 1px solid #000; margin-top: 22px; }
          .footer { position: fixed; left: 18mm; right: 18mm; bottom: 12mm; font-size: 10px; }
          .footer-line { border-top: 1.5px solid #000; margin-bottom: 6px; }
          .footer-content { display: flex; gap: 18px; align-items: center; }
          .footer-logos { display: flex; gap: 10px; align-items: center; }
          .footer-logos img { width: 46px; height: 46px; object-fit: contain; }
          .footer-text { line-height: 1.3; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <img class="seal" src="${sealUrl}" alt="Seal" />
          <div class="header-text">
            <div class="rep">Republic of the Philippines</div>
            <div class="dept">Department of Education</div>
            <div class="division">SCHOOLS DIVISION OF MARINDUQUE</div>
          </div>
          <div class="header-lines">
            <div class="header-line"></div>
            <div class="header-line thin"></div>
          </div>
          <div class="office-line">Office of the Schools Division Superintendent</div>
          <div class="header-line thin"></div>
          <div class="title">INDIVIDUAL DAILY LOG AND ACCOMPLISHMENT REPORT</div>
          <div class="subtitle">(WORK FROM HOME)</div>
        </div>

        <div class="meta">
          <div class="meta-row"><span class="meta-label">NAME:</span><span class="meta-line">${escapeHtml(employeeName)}</span></div>
          <div class="meta-row"><span class="meta-label">POSITION:</span><span class="meta-line">${escapeHtml(employeePosition)}</span></div>
          <div class="meta-row"><span class="meta-label">DIVISION:</span><span class="meta-line">Office of the Schools Division Superintendent</span></div>
          <div class="meta-row"><span class="meta-label">SECTION:</span><span class="meta-line">${escapeHtml(employeeOffice || '--')}</span></div>
          <div class="meta-row"><span class="meta-label">Date/s Covered:</span><span class="meta-line">${escapeHtml(reportDate)}</span></div>
        </div>

        <table class="report">
          <thead>
            <tr>
              <th>Date and Actual Time Logs</th>
              <th>Actual Accomplishments</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="logs">${escapeHtml(reportDate)}\nAM In: ${escapeHtml(timeInAM)}\nAM Out: ${escapeHtml(timeOutAM)}\nPM In: ${escapeHtml(timeInPM)}\nPM Out: ${escapeHtml(timeOutPM)}</td>
              <td>${summaryHtml || '&nbsp;'}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig">
            <div>Submitted by:</div>
            <div class="sig-line"></div>
            <div><strong>${escapeHtml(employeeName)}</strong></div>
            <div>${escapeHtml(employeePosition)}</div>
          </div>
          <div class="sig">
            <div>Attested by:</div>
            <div class="sig-line"></div>
            <div><strong>MAY BERNADETH O. DE LA ROSA</strong></div>
            <div>Administrative Officer V</div>
          </div>
        </div>

        <div style="margin-top: 10px; font-size: 11px;">
          <strong>Attachment:</strong> <em>${escapeHtml(attachmentLabel)}</em><br/>
          ${report.attachmentData ? attachmentHtml : ''}
        </div>

        <div class="footer">
          <div class="footer-line"></div>
          <div class="footer-content">
            <div class="footer-logos">
              <img src="${depedLogo}" alt="DepEd" onerror="this.style.display='none'" />
              <img src="${bagongLogo}" alt="Bagong Pilipinas" onerror="this.style.display='none'" />
              <img src="${sdoLogo}" alt="SDO Marinduque" onerror="this.style.display='none'" />
            </div>
            <div class="footer-text">
              Address: T. Roque St., Malusak, Boac, Marinduque<br/>
              Tel. No.: (042) 754-0247 ● Fax No.: (042) 332-1611<br/>
              Email: marinduque@deped.gov.ph<br/>
              Website: https://depedmarinduque.com
            </div>
          </div>
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
      <td>${item.timeInAM || '--'}</td>
      <td>${item.timeOutAM || '--'}</td>
      <td>${item.timeInPM || '--'}</td>
      <td>${item.timeOutPM || '--'}</td>
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
      <td>${item.timeInAM || '--'}</td>
      <td>${item.timeOutAM || '--'}</td>
      <td>${item.timeInPM || '--'}</td>
      <td>${item.timeOutPM || '--'}</td>
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
  const map = new Map(list.map((item) => [item.date, item]));
  const employee = employeesCache.find((emp) => emp.id === employeeId);
  const employeeName = employee ? employee.name : (list[0] ? list[0].employeeName : 'Employee');
  const employeeOffice = employee ? employee.office : (list[0] ? list[0].office : '');
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = toDate.getDate();

  const rows = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const rec = map.get(dateStr);
    const hasAttendance = hasAnyAttendanceLocal(rec);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const weekendLabel = dayOfWeek === 0 ? 'Sun' : (dayOfWeek === 6 ? 'Sat' : '');

    if (!hasAttendance) {
      if (weekendLabel) {
        rows.push(`
          <tr>
            <td class="center">${day}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="center weekend">${weekendLabel}</td>
          </tr>
        `);
      } else {
        rows.push(`
          <tr>
            <td class="center">${day}</td>
            <td colspan="4" class="center absent">ABSENT</td>
            <td></td>
            <td></td>
          </tr>
        `);
      }
      continue;
    }

    rows.push(`
      <tr>
        <td class="center">${day}</td>
        <td class="center">${rec.timeInAM || rec.timeIn || ''}</td>
        <td class="center">${rec.timeOutAM || ''}</td>
        <td class="center">${rec.timeInPM || ''}</td>
        <td class="center">${rec.timeOutPM || rec.timeOut || ''}</td>
        <td></td>
        <td class="center">${weekendLabel}</td>
      </tr>
    `);
  }

  dtrPreview.innerHTML = `
    <div class="dtr-sheet">
      <div class="dtr-header">
        <div>
          <div class="dtr-title">DAILY TIME RECORD</div>
          <div class="dtr-sub">Name: <strong>${employeeName}</strong></div>
          <div class="dtr-sub">For the month of <strong>${monthLabel}</strong></div>
          <div class="dtr-sub">Office hours for arrival and departure</div>
        </div>
        <div class="dtr-formno">CIVIL SERVICE FORM No. 48</div>
      </div>

      <div class="dtr-meta">
        <div>(Regular days)</div>
        <div>(Saturdays)</div>
        <div>Service as required</div>
      </div>

      <table class="dtr-table">
        <thead>
          <tr>
            <th rowspan="2" class="center">DAY</th>
            <th colspan="2" class="center">A.M.</th>
            <th colspan="2" class="center">P.M.</th>
            <th colspan="2" class="center">UNDERTIME</th>
          </tr>
          <tr>
            <th class="center">Arrival</th>
            <th class="center">Departure</th>
            <th class="center">Arrival</th>
            <th class="center">Departure</th>
            <th class="center">Hours</th>
            <th class="center">Minutes</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>

      <div class="dtr-footer">
        <div class="dtr-total">TOTAL</div>
        <p class="dtr-cert">
          I CERTIFY on my honor that the above is a true and correct report of the hours of work performed,
          record of which was made daily at the time of arrival at and departure from office.
        </p>
        <div class="dtr-signatures">
          <div>Verified as to the prescribed office hours</div>
          <div class="line"></div>
          <div class="line"></div>
        </div>
        <div class="dtr-office">Office: <strong>${employeeOffice || ''}</strong></div>
      </div>
    </div>
  `;
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
          body { font-family: "Times New Roman", serif; padding: 24px; color: #1b1b1b; }
          .dtr-sheet { border: 1px solid #222; padding: 16px; }
          .dtr-header { display: flex; justify-content: space-between; align-items: flex-start; }
          .dtr-title { font-weight: 700; font-size: 18px; }
          .dtr-sub { font-size: 12px; margin-top: 2px; }
          .dtr-formno { font-size: 12px; }
          .dtr-meta { display: flex; gap: 18px; font-size: 11px; margin: 6px 0 10px; }
          .dtr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .dtr-table th, .dtr-table td { border: 1px solid #222; padding: 4px; }
          .center { text-align: center; }
          .absent { font-weight: 700; letter-spacing: 2px; }
          .weekend { color: #a00; font-weight: 700; }
          .dtr-footer { margin-top: 14px; font-size: 11px; }
          .dtr-total { font-weight: 700; margin-bottom: 8px; }
          .dtr-signatures { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
          .line { flex: 1; border-bottom: 1px solid #222; height: 1px; }
          .dtr-office { margin-top: 6px; }
        </style>
      </head>
      <body>
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
  await openReportPrint(report);
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
