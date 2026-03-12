const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DEFAULT_ROOT = path.join(__dirname, '..');
const ROOT = fs.existsSync(path.join(DEFAULT_ROOT, 'admin')) ? DEFAULT_ROOT : process.cwd();
const DATA_PATH = path.join(ROOT, 'data', 'db.json');
const BACKUP_PATH = path.join(ROOT, 'data', 'db.json.bak');

const DEFAULT_DB = {
  admins: [
    {
      id: 'ADM-001',
      name: 'SDO Admin',
      username: 'admin',
      password: 'admin123',
      office: 'ICT Unit'
    }
  ],
  employees: [],
  attendance: []
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function parseJsonSafe(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

let memoryDb = null;

function readDb() {
  if (memoryDb) return memoryDb;

  if (fs.existsSync(DATA_PATH)) {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = parseJsonSafe(raw);
    if (parsed.ok) {
      memoryDb = parsed.value;
      return memoryDb;
    }
  }

  if (fs.existsSync(BACKUP_PATH)) {
    const backupRaw = fs.readFileSync(BACKUP_PATH, 'utf8');
    const backupParsed = parseJsonSafe(backupRaw);
    if (backupParsed.ok) {
      memoryDb = backupParsed.value;
      return memoryDb;
    }
  }

  memoryDb = JSON.parse(JSON.stringify(DEFAULT_DB));
  return memoryDb;
}

function writeDb(db) {
  memoryDb = db;
  try {
    if (fs.existsSync(DATA_PATH)) {
      try {
        fs.copyFileSync(DATA_PATH, BACKUP_PATH);
      } catch (err) {
        // ignore backup errors
      }
    }
    fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    // If filesystem is read-only (Render), keep in-memory only.
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(data);
}

function collectBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        if (body.includes('=')) {
          const params = new URLSearchParams(body);
          return resolve(Object.fromEntries(params.entries()));
        }
        resolve({});
      }
    });
  });
}

function isoToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function computeStatus(timeIn) {
  if (!timeIn) return 'Absent';
  const minutes = timeToMinutes(timeIn);
  return minutes <= 8 * 60 ? 'Present' : 'Late';
}

function attendanceForDate(db, date) {
  return db.attendance.filter((att) => att.date === date);
}

function enrichAttendance(db, list) {
  return list.map((att) => {
    const emp = db.employees.find((e) => e.id === att.employeeId);
    return {
      ...att,
      employeeName: emp ? emp.name : 'Unknown',
      office: emp ? emp.office : 'Unknown',
      position: emp ? emp.position : 'Unknown'
    };
  });
}

function summaryForDate(db, date) {
  const totalEmployees = db.employees.length;
  const todays = attendanceForDate(db, date);
  const present = todays.filter((a) => a.status === 'Present').length;
  const late = todays.filter((a) => a.status === 'Late').length;
  const absent = totalEmployees - todays.length;
  return { totalEmployees, present, late, absent };
}

function handleApi(req, res, pathname) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && pathname === '/api/summary') {
    const db = readDb();
    const date = isoToday();
    const summary = summaryForDate(db, date);
    return sendJson(res, 200, { date, ...summary });
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, time: Date.now() });
  }

  if (req.method === 'GET' && pathname === '/api/employees') {
    const db = readDb();
    return sendJson(res, 200, { employees: db.employees });
  }

  if (req.method === 'POST' && pathname === '/api/employees') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const newEmp = {
        id: body.id || `SDO-${String(db.employees.length + 1).padStart(3, '0')}`,
        name: body.name || 'New Employee',
        position: body.position || 'Staff',
        office: body.office || 'Office',
        email: body.email || '',
        password: body.password || 'password123',
        status: 'Active',
        avatar: body.avatar || 'assets/avatar-generic.png'
      };
      db.employees.push(newEmp);
      writeDb(db);
      return sendJson(res, 201, { employee: newEmp });
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/register') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const name = String(body.name || '').trim();
      const username = String(body.username || '').trim();
      const password = String(body.password || '').trim();
      const office = String(body.office || '').trim();

      if (!name || !username || !password || !office) {
        return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
      }

      const existing = db.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
      if (existing) {
        return sendJson(res, 409, { ok: false, message: 'Username is already taken.' });
      }

      const newAdmin = {
        id: `ADM-${String(db.admins.length + 1).padStart(3, '0')}`,
        name,
        username,
        password,
        office
      };
      db.admins.push(newAdmin);
      writeDb(db);
      return sendJson(res, 201, { ok: true, admin: newAdmin });
    });
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const name = String(body.name || '').trim();
      const position = String(body.position || '').trim();
      const office = String(body.office || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      if (!name || !position || !office || !email || !password) {
        return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
      }

      const existing = db.employees.find((e) => e.email.toLowerCase() === email);
      if (existing) {
        return sendJson(res, 409, { ok: false, message: 'Email is already registered.' });
      }

      const nextId = `SDO-${String(db.employees.length + 1).padStart(3, '0')}`;
      const newEmp = {
        id: nextId,
        name,
        position,
        office,
        email,
        password,
        status: 'Active',
        avatar: 'assets/avatar-generic.svg'
      };
      db.employees.push(newEmp);
      writeDb(db);
      return sendJson(res, 201, { ok: true, employee: newEmp });
    });
  }

  if (req.method === 'POST' && pathname === '/api/password-reset') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const role = String(body.role || '').trim();
      const username = String(body.username || '').trim();
      const newPassword = String(body.newPassword || '').trim();

      if (!role || !username || !newPassword) {
        return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
      }

      if (role === 'admin') {
        const admin = db.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
        if (!admin) return sendJson(res, 404, { ok: false, message: 'Admin not found.' });
        admin.password = newPassword;
        writeDb(db);
        return sendJson(res, 200, { ok: true });
      }

      const lookup = username.toLowerCase();
      const emp = db.employees.find((e) =>
        e.email.toLowerCase() === lookup || e.id.toLowerCase() === lookup
      );
      if (!emp) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      emp.password = newPassword;
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const username = String(body.username || '').trim();
      const password = String(body.password || '').trim();
      if (!username || !password) {
        return sendJson(res, 400, { ok: false, message: 'Missing credentials' });
      }

      const admin = db.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
      if (admin && admin.password === password) {
        return sendJson(res, 200, { ok: true, user: admin, role: 'admin' });
      }

      const lookup = username.toLowerCase();
      const emp = db.employees.find((e) =>
        e.email.toLowerCase() === lookup || e.id.toLowerCase() === lookup
      );
      if (!emp || emp.password !== password) {
        return sendJson(res, 401, { ok: false, message: 'Invalid credentials' });
      }
      return sendJson(res, 200, { ok: true, user: emp, role: 'employee' });
    });
  }

  if (req.method === 'GET' && pathname === '/api/attendance/today') {
    const db = readDb();
    const date = isoToday();
    const todays = enrichAttendance(db, attendanceForDate(db, date));
    return sendJson(res, 200, { date, attendance: todays });
  }

  if (req.method === 'GET' && pathname === '/api/attendance') {
    const db = readDb();
    const query = url.parse(req.url, true).query;
    const from = query.from || '1900-01-01';
    const to = query.to || '2999-12-31';
    const employeeId = query.employeeId;
    let list = db.attendance.filter((a) => a.date >= from && a.date <= to);
    if (employeeId) list = list.filter((a) => a.employeeId === employeeId);
    const enriched = enrichAttendance(db, list);
    return sendJson(res, 200, { attendance: enriched });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timein') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const date = body.date || isoToday();
      const employeeId = body.employeeId;
      const timeIn = body.timeIn;
      const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
      if (existing) {
        existing.timeIn = timeIn;
        existing.location = body.location || existing.location;
        existing.latitude = body.latitude || existing.latitude;
        existing.longitude = body.longitude || existing.longitude;
        existing.photo = body.photo || existing.photo;
        existing.status = computeStatus(existing.timeIn);
        writeDb(db);
        return sendJson(res, 200, { attendance: existing });
      }
      const record = {
        id: `ATT-${date}-${employeeId}`,
        employeeId,
        date,
        timeIn,
        timeOut: '',
        status: computeStatus(timeIn),
        latitude: body.latitude || '',
        longitude: body.longitude || '',
        location: body.location || '',
        photo: body.photo || ''
      };
      db.attendance.push(record);
      writeDb(db);
      return sendJson(res, 201, { attendance: record });
    });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timeout') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const date = body.date || isoToday();
      const employeeId = body.employeeId;
      const timeOut = body.timeOut;
      const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
      if (!existing) {
        return sendJson(res, 404, { message: 'No time in yet' });
      }
      existing.timeOut = timeOut;
      writeDb(db);
      return sendJson(res, 200, { attendance: existing });
    });
  }

  sendJson(res, 404, { message: 'Not found' });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }

  if (pathname === '/') {
    res.writeHead(302, { Location: '/admin/' });
    return res.end();
  }

  if (pathname.startsWith('/admin')) {
    const safePath = pathname.replace('/admin', '').replace(/\/+$/, '');
    const filePath = safePath === '' || safePath === '/' ? 'index.html' : safePath;
    return sendFile(res, path.join(ROOT, 'admin', filePath));
  }

  if (pathname.startsWith('/employee')) {
    const safePath = pathname.replace('/employee', '').replace(/\/+$/, '');
    const filePath = safePath === '' || safePath === '/' ? 'index.html' : safePath;
    return sendFile(res, path.join(ROOT, 'employee', filePath));
  }

  return sendFile(res, path.join(ROOT, pathname));
});

const PORT = process.env.PORT || 5173;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
