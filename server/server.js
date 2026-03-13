const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

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
  attendance: [],
  notifications: [],
  messages: []
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
const pendingChallenges = {
  register: new Map(),
  auth: new Map()
};

function normalizeDb(db) {
  const safe = db && typeof db === 'object' ? db : {};
  if (!Array.isArray(safe.admins)) safe.admins = [];
  if (!Array.isArray(safe.employees)) safe.employees = [];
  if (!Array.isArray(safe.attendance)) safe.attendance = [];
  if (!Array.isArray(safe.notifications)) safe.notifications = [];
  if (!Array.isArray(safe.messages)) safe.messages = [];
  safe.employees = safe.employees.map((emp) => {
    if (!emp || typeof emp !== 'object') return emp;
    if (!Array.isArray(emp.webauthn)) emp.webauthn = [];
    return emp;
  });
  return safe;
}

function readDb() {
  if (memoryDb) return memoryDb;

  if (fs.existsSync(DATA_PATH)) {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = parseJsonSafe(raw);
    if (parsed.ok) {
      memoryDb = normalizeDb(parsed.value);
      return memoryDb;
    }
  }

  if (fs.existsSync(BACKUP_PATH)) {
    const backupRaw = fs.readFileSync(BACKUP_PATH, 'utf8');
    const backupParsed = parseJsonSafe(backupRaw);
    if (backupParsed.ok) {
      memoryDb = normalizeDb(backupParsed.value);
      return memoryDb;
    }
  }

  memoryDb = normalizeDb(JSON.parse(JSON.stringify(DEFAULT_DB)));
  return memoryDb;
}

function writeDb(db) {
  memoryDb = normalizeDb(db);
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

function computeDailyStatus(record) {
  if (!record) return 'Absent';
  const amIn = record.timeInAM || record.timeIn || '';
  const pmIn = record.timeInPM || '';
  if (!amIn && !pmIn) return 'Absent';
  let late = false;
  if (amIn && timeToMinutes(amIn) > 8 * 60) late = true;
  if (pmIn && timeToMinutes(pmIn) > 13 * 60) late = true;
  return late ? 'Late' : 'Present';
}

function base64urlToBuffer(value) {
  if (!value) return Buffer.alloc(0);
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
  return Buffer.from(base64 + pad, 'base64');
}

function bufferToBase64url(buffer) {
  return Buffer.from(buffer).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function findEmployeeByLogin(db, value) {
  const lookup = String(value || '').trim().toLowerCase();
  if (!lookup) return null;
  return db.employees.find((e) =>
    (e.username && e.username.toLowerCase() === lookup) ||
    (e.email && e.email.toLowerCase() === lookup) ||
    (e.id && e.id.toLowerCase() === lookup) ||
    (e.name && e.name.toLowerCase() === lookup)
  );
}

function getRpInfo(req) {
  const host = String(req.headers.host || '').split(':')[0] || 'localhost';
  const proto = String(req.headers['x-forwarded-proto'] || 'http');
  const rpID = process.env.RP_ID || host;
  const origin = process.env.RP_ORIGIN || `${proto}://${rpID}`;
  return { rpID, origin };
}

function pickLatestValue(...values) {
  return values.find((val) => val && String(val).trim().length > 0) || '';
}

function attendanceForDate(db, date) {
  return db.attendance.filter((att) => att.date === date);
}

function enrichAttendance(db, list) {
  return list.map((att) => {
    const emp = db.employees.find((e) => e.id === att.employeeId);
    const status = computeDailyStatus(att);
    return {
      ...att,
      employeeName: emp ? emp.name : 'Unknown',
      office: emp ? emp.office : 'Unknown',
      position: emp ? emp.position : 'Unknown',
      status
    };
  });
}

function summaryForDate(db, date) {
  const totalEmployees = db.employees.length;
  const todays = attendanceForDate(db, date);
  const attendedIds = new Set();
  let present = 0;
  let late = 0;
  todays.forEach((att) => {
    const hasAttendance = (att.timeInAM || att.timeInPM || att.timeIn);
    if (!hasAttendance) return;
    attendedIds.add(att.employeeId);
    const status = computeDailyStatus(att);
    if (status === 'Late') late += 1;
    if (status === 'Present') present += 1;
  });
  const absent = totalEmployees - attendedIds.size;
  return { totalEmployees, present, late, absent };
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function pushNotification(db, data) {
  const note = {
    id: makeId('NTF'),
    type: data.type || 'info',
    title: data.title || 'Notification',
    message: data.message || '',
    employeeId: data.employeeId || '',
    createdAt: new Date().toISOString(),
    read: false
  };
  db.notifications.unshift(note);
  if (db.notifications.length > 200) db.notifications = db.notifications.slice(0, 200);
  return note;
}

function pushMessage(db, data) {
  const msg = {
    id: makeId('MSG'),
    employeeId: data.employeeId || '',
    employeeName: data.employeeName || 'Unknown',
    office: data.office || '',
    subject: data.subject || 'Concern',
    message: data.message || '',
    createdAt: new Date().toISOString(),
    read: false
  };
  db.messages.unshift(msg);
  if (db.messages.length > 200) db.messages = db.messages.slice(0, 200);
  return msg;
}

function handleApi(req, res, pathname) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && pathname === '/api/summary') {
    const db = readDb();
    const query = url.parse(req.url, true).query;
    const date = String(query.date || isoToday());
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

  if (req.method === 'POST' && pathname === '/api/webauthn/status') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const employee = findEmployeeByLogin(db, body.username);
      if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      const registered = Array.isArray(employee.webauthn) && employee.webauthn.length > 0;
      return sendJson(res, 200, { ok: true, registered });
    });
  }

  if (req.method === 'POST' && pathname === '/api/webauthn/register/options') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const employee = findEmployeeByLogin(db, body.username);
      if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      const { rpID } = getRpInfo(req);
      const options = generateRegistrationOptions({
        rpName: 'SDO Marinduque Attendance',
        rpID,
        userID: employee.id,
        userName: employee.username || employee.id,
        userDisplayName: employee.name || employee.id,
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'preferred'
        },
        excludeCredentials: (employee.webauthn || []).map((cred) => ({
          id: base64urlToBuffer(cred.credentialID),
          type: 'public-key',
          transports: cred.transports || ['internal']
        }))
      });
      pendingChallenges.register.set(employee.id, options.challenge);
      return sendJson(res, 200, { ok: true, options });
    });
  }

  if (req.method === 'POST' && pathname === '/api/webauthn/register/verify') {
    return collectBody(req).then(async (body) => {
      const db = readDb();
      const employee = findEmployeeByLogin(db, body.username);
      if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      const expectedChallenge = pendingChallenges.register.get(employee.id);
      if (!expectedChallenge) return sendJson(res, 400, { ok: false, message: 'No pending challenge.' });
      const { rpID, origin } = getRpInfo(req);
      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: body.credential,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID
        });
      } catch (err) {
        return sendJson(res, 400, { ok: false, message: 'Registration failed.' });
      }
      const { verified, registrationInfo } = verification;
      if (!verified || !registrationInfo) {
        return sendJson(res, 400, { ok: false, message: 'Registration not verified.' });
      }
      const credentialID = bufferToBase64url(registrationInfo.credentialID);
      const publicKey = bufferToBase64url(registrationInfo.credentialPublicKey);
      const exists = (employee.webauthn || []).some((cred) => cred.credentialID === credentialID);
      if (!exists) {
        employee.webauthn = employee.webauthn || [];
        employee.webauthn.push({
          credentialID,
          publicKey,
          counter: registrationInfo.counter,
          transports: body.credential?.transports || ['internal']
        });
        writeDb(db);
      }
      pendingChallenges.register.delete(employee.id);
      return sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && pathname === '/api/webauthn/auth/options') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const { rpID } = getRpInfo(req);
      let allowCredentials = [];
      let employee = null;
      if (body.username) {
        employee = findEmployeeByLogin(db, body.username);
        if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
        allowCredentials = (employee.webauthn || []).map((cred) => ({
          id: isoBase64URL.toBuffer(cred.credentialID),
          type: 'public-key',
          transports: cred.transports || ['internal']
        }));
      }
      const options = generateAuthenticationOptions({
        rpID,
        userVerification: 'preferred',
        allowCredentials
      });
      const key = employee ? employee.id : '_userless';
      pendingChallenges.auth.set(key, options.challenge);
      return sendJson(res, 200, { ok: true, options });
    });
  }

  if (req.method === 'POST' && pathname === '/api/webauthn/auth/verify') {
    return collectBody(req).then(async (body) => {
      const db = readDb();
      const { rpID, origin } = getRpInfo(req);
      let employee = null;
      if (body.username) {
        employee = findEmployeeByLogin(db, body.username);
      } else if (body.credential && body.credential.id) {
        const credentialId = body.credential.id;
        employee = db.employees.find((emp) =>
          (emp.webauthn || []).some((cred) => cred.credentialID === credentialId)
        );
      }
      if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });

      const authKey = body.username ? employee.id : '_userless';
      const expectedChallenge = pendingChallenges.auth.get(authKey);
      if (!expectedChallenge) return sendJson(res, 400, { ok: false, message: 'No pending challenge.' });

      const authenticatorRecord = (employee.webauthn || []).find((cred) => cred.credentialID === body.credential.id);
      if (!authenticatorRecord) {
        return sendJson(res, 400, { ok: false, message: 'Biometric not registered.' });
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: body.credential,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          authenticator: {
            credentialID: base64urlToBuffer(authenticatorRecord.credentialID),
            credentialPublicKey: base64urlToBuffer(authenticatorRecord.publicKey),
            counter: authenticatorRecord.counter
          }
        });
      } catch (err) {
        return sendJson(res, 400, { ok: false, message: 'Authentication failed.' });
      }
      const { verified, authenticationInfo } = verification;
      if (!verified || !authenticationInfo) {
        return sendJson(res, 400, { ok: false, message: 'Authentication not verified.' });
      }
      authenticatorRecord.counter = authenticationInfo.newCounter;
      writeDb(db);
      pendingChallenges.auth.delete(authKey);
      return sendJson(res, 200, { ok: true, user: employee });
    });
  }

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const db = readDb();
    return sendJson(res, 200, { notifications: db.notifications || [] });
  }

  if (req.method === 'POST' && pathname === '/api/notifications/read') {
    return collectBody(req).then((body) => {
      const db = readDb();
      if (body && body.all) {
        db.notifications.forEach((n) => { n.read = true; });
      } else if (Array.isArray(body.ids)) {
        const set = new Set(body.ids);
        db.notifications.forEach((n) => { if (set.has(n.id)) n.read = true; });
      }
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'GET' && pathname === '/api/messages') {
    const db = readDb();
    return sendJson(res, 200, { messages: db.messages || [] });
  }

  if (req.method === 'POST' && pathname === '/api/messages') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const employeeId = String(body.employeeId || '').trim();
      const message = String(body.message || '').trim();
      const subject = String(body.subject || 'Concern').trim();
      if (!employeeId || !message) {
        return sendJson(res, 400, { ok: false, message: 'Employee and message are required.' });
      }
      const emp = db.employees.find((e) => e.id === employeeId);
      const newMsg = pushMessage(db, {
        employeeId,
        employeeName: emp ? emp.name : String(body.employeeName || 'Unknown'),
        office: emp ? emp.office : String(body.office || ''),
        subject,
        message
      });
      writeDb(db);
      return sendJson(res, 201, { ok: true, message: newMsg });
    });
  }

  if (req.method === 'POST' && pathname === '/api/messages/read') {
    return collectBody(req).then((body) => {
      const db = readDb();
      if (body && body.all) {
        db.messages.forEach((m) => { m.read = true; });
      } else if (Array.isArray(body.ids)) {
        const set = new Set(body.ids);
        db.messages.forEach((m) => { if (set.has(m.id)) m.read = true; });
      }
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    });
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
        avatar: body.avatar || 'assets/avatar-generic.png',
        webauthn: []
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
      const office = String(body.office || '').trim();
      const username = String(body.username || body.email || '').trim();
      const position = String(body.position || 'Staff').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      if (!name || !office || !username || !password) {
        return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
      }

      const existing = db.employees.find((e) =>
        (e.username && e.username.toLowerCase() === username.toLowerCase()) ||
        (email && e.email.toLowerCase() === email)
      );
      if (existing) {
        return sendJson(res, 409, { ok: false, message: 'Username or email is already registered.' });
      }

      const nextId = `SDO-${String(db.employees.length + 1).padStart(3, '0')}`;
      const newEmp = {
        id: nextId,
        name,
        position,
        office,
        email,
        username,
        password,
        status: 'Active',
        avatar: 'assets/avatar-generic.svg',
        webauthn: []
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
        (e.username && e.username.toLowerCase() === lookup) ||
        e.email.toLowerCase() === lookup ||
        e.id.toLowerCase() === lookup ||
        e.name.toLowerCase() === lookup
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
        (e.username && e.username.toLowerCase() === lookup) ||
        e.email.toLowerCase() === lookup ||
        e.id.toLowerCase() === lookup ||
        e.name.toLowerCase() === lookup
      );
      if (!emp || emp.password !== password) {
        return sendJson(res, 401, { ok: false, message: 'Invalid credentials' });
      }
      return sendJson(res, 200, { ok: true, user: emp, role: 'employee' });
    });
  }

  if (req.method === 'GET' && pathname === '/api/attendance/today') {
    const db = readDb();
    const query = url.parse(req.url, true).query;
    const date = String(query.date || isoToday());
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
      const photo = body.photo || '';
      const location = body.location || '';
      const latitude = body.latitude || '';
      const longitude = body.longitude || '';
      const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
      if (existing) {
        if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
        if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
        let slot = '';
        if (!existing.timeInAM) {
          existing.timeInAM = timeIn;
          existing.timeIn = timeIn;
          existing.photoInAM = photo || existing.photoInAM;
          existing.locationInAM = location || existing.locationInAM;
          existing.latInAM = latitude || existing.latInAM;
          existing.lngInAM = longitude || existing.lngInAM;
          slot = 'AM';
        } else if (!existing.timeInPM) {
          existing.timeInPM = timeIn;
          existing.photoInPM = photo || existing.photoInPM;
          existing.locationInPM = location || existing.locationInPM;
          existing.latInPM = latitude || existing.latInPM;
          existing.lngInPM = longitude || existing.lngInPM;
          slot = 'PM';
        } else {
          return sendJson(res, 409, { message: 'Time in already recorded.' });
        }
        existing.photo = pickLatestValue(photo, existing.photo);
        existing.location = pickLatestValue(location, existing.location);
        existing.latitude = pickLatestValue(latitude, existing.latitude);
        existing.longitude = pickLatestValue(longitude, existing.longitude);
        existing.status = computeDailyStatus(existing);
        writeDb(db);
        return sendJson(res, 200, { attendance: existing, slot });
      }
      const record = {
        id: `ATT-${date}-${employeeId}`,
        employeeId,
        date,
        timeIn,
        timeOut: '',
        timeInAM: timeIn,
        timeOutAM: '',
        timeInPM: '',
        timeOutPM: '',
        photoInAM: photo,
        photoOutAM: '',
        photoInPM: '',
        photoOutPM: '',
        locationInAM: location,
        locationOutAM: '',
        locationInPM: '',
        locationOutPM: '',
        latInAM: latitude,
        lngInAM: longitude,
        latOutAM: '',
        lngOutAM: '',
        latInPM: '',
        lngInPM: '',
        latOutPM: '',
        lngOutPM: '',
        status: computeDailyStatus({ timeInAM: timeIn, timeInPM: '', timeIn }),
        latitude,
        longitude,
        location,
        photo
      };
      db.attendance.push(record);
      const emp = db.employees.find((e) => e.id === employeeId);
      const empName = emp ? emp.name : employeeId;
      const office = emp ? emp.office : 'Office';
      pushNotification(db, {
        type: 'attendance',
        employeeId,
        title: 'New Time In',
        message: `${empName} (${office}) timed in at ${timeIn}.`
      });
      writeDb(db);
      return sendJson(res, 201, { attendance: record, slot: 'AM' });
    });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timeout') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const date = body.date || isoToday();
      const employeeId = body.employeeId;
      const timeOut = body.timeOut;
      const photo = body.photo || '';
      const location = body.location || '';
      const latitude = body.latitude || '';
      const longitude = body.longitude || '';
      const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
      if (!existing) {
        return sendJson(res, 404, { message: 'No time in yet' });
      }
      if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
      if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
      let slot = '';
      if (!existing.timeOutAM && existing.timeInAM) {
        existing.timeOutAM = timeOut;
        existing.timeOut = timeOut;
        existing.photoOutAM = photo || existing.photoOutAM;
        existing.locationOutAM = location || existing.locationOutAM;
        existing.latOutAM = latitude || existing.latOutAM;
        existing.lngOutAM = longitude || existing.lngOutAM;
        slot = 'AM';
      } else if (existing.timeInPM && !existing.timeOutPM) {
        existing.timeOutPM = timeOut;
        existing.timeOut = timeOut;
        existing.photoOutPM = photo || existing.photoOutPM;
        existing.locationOutPM = location || existing.locationOutPM;
        existing.latOutPM = latitude || existing.latOutPM;
        existing.lngOutPM = longitude || existing.lngOutPM;
        slot = 'PM';
      } else {
        return sendJson(res, 409, { message: 'Time out already recorded.' });
      }
      existing.photo = pickLatestValue(photo, existing.photo);
      existing.location = pickLatestValue(location, existing.location);
      existing.latitude = pickLatestValue(latitude, existing.latitude);
      existing.longitude = pickLatestValue(longitude, existing.longitude);
      existing.status = computeDailyStatus(existing);
      if (timeOut) {
        const emp = db.employees.find((e) => e.id === employeeId);
        const empName = emp ? emp.name : employeeId;
        const office = emp ? emp.office : 'Office';
        pushNotification(db, {
          type: 'attendance',
          employeeId,
          title: 'New Time Out',
          message: `${empName} (${office}) timed out at ${timeOut}.`
        });
      }
      writeDb(db);
      return sendJson(res, 200, { attendance: existing, slot });
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
