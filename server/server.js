const express = require('express');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { Pool } = require('pg');
try {
  require('dotenv').config();
} catch (err) {
  // dotenv is optional; ignore if not installed
}

const DEFAULT_ROOT = path.join(__dirname, '..');
const ROOT = fs.existsSync(path.join(DEFAULT_ROOT, 'admin')) ? DEFAULT_ROOT : process.cwd();
const ENV_DB_PATH = process.env.DB_PATH || process.env.RENDER_DB_PATH || '';
const DATA_PATH = ENV_DB_PATH
  ? path.resolve(ENV_DB_PATH)
  : path.join(ROOT, 'data', 'db.json');
const BACKUP_PATH = `${DATA_PATH}.bak`;
const DATA_DIR = path.dirname(DATA_PATH);

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
  messages: [],
  reports: []
};

const DB_MODE = String(process.env.DB_MODE || '').trim().toLowerCase();
const HAS_DATABASE_URL = !!process.env.DATABASE_URL;
const USE_PG = DB_MODE === 'postgres' || (!DB_MODE && HAS_DATABASE_URL);
const pool = USE_PG
  ? new Pool(
      process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT || 5432),
            user: process.env.PGUSER || 'sdo_user',
            password: process.env.PGPASSWORD || 'sdo_pass',
            database: process.env.PGDATABASE || 'sdo_attendance'
          }
    )
  : null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
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

async function pgQuery(text, params) {
  if (!pool) throw new Error('PostgreSQL not configured.');
  return pool.query(text, params);
}

async function ensureSchema() {
  if (!USE_PG) return;
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      office TEXT NOT NULL
    );`
  );
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position TEXT,
      office TEXT,
      email TEXT,
      username TEXT,
      employee_type TEXT,
      password TEXT,
      status TEXT,
      avatar TEXT,
      verified BOOLEAN DEFAULT false,
      otp TEXT,
      otp_expires_at BIGINT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`
  );
  await pgQuery(`CREATE INDEX IF NOT EXISTS idx_employees_email ON employees (LOWER(email));`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS idx_employees_username ON employees (LOWER(username));`);
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      time_in TEXT,
      time_out TEXT,
      time_in_am TEXT,
      time_out_am TEXT,
      time_in_pm TEXT,
      time_out_pm TEXT,
      photo_in_am TEXT,
      photo_out_am TEXT,
      photo_in_pm TEXT,
      photo_out_pm TEXT,
      location_in_am TEXT,
      location_out_am TEXT,
      location_in_pm TEXT,
      location_out_pm TEXT,
      lat_in_am TEXT,
      lng_in_am TEXT,
      lat_out_am TEXT,
      lng_out_am TEXT,
      lat_in_pm TEXT,
      lng_in_pm TEXT,
      lat_out_pm TEXT,
      lng_out_pm TEXT,
      status TEXT,
      latitude TEXT,
      longitude TEXT,
      location TEXT,
      photo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (employee_id, date)
    );`
  );
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT,
      title TEXT,
      message TEXT,
      employee_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read BOOLEAN DEFAULT false
    );`
  );
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      employee_name TEXT,
      office TEXT,
      subject TEXT,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read BOOLEAN DEFAULT false
    );`
  );
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
      employee_name TEXT,
      office TEXT,
      report_date DATE NOT NULL,
      summary TEXT,
      attachment_name TEXT,
      attachment_data TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`
  );
  await pgQuery(`CREATE INDEX IF NOT EXISTS idx_reports_employee ON reports (employee_id);`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS idx_reports_date ON reports (report_date);`);
  const adminCheck = await pgQuery('SELECT COUNT(*) AS count FROM admins');
  if (Number(adminCheck.rows[0].count) === 0) {
    const admin = DEFAULT_DB.admins[0];
    await pgQuery(
      'INSERT INTO admins (id, name, username, password, office) VALUES ($1, $2, $3, $4, $5)',
      [admin.id, admin.name, admin.username, admin.password, admin.office]
    );
  }
}

function formatDbDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function mapEmployeeRow(row) {
  return {
    id: row.id,
    name: row.name,
    position: row.position || '',
    office: row.office || '',
    email: row.email || '',
    username: row.username || '',
    employeeType: row.employee_type || 'Regular',
    password: row.password || '',
    status: row.status || '',
    avatar: row.avatar || '',
    verified: row.verified === true,
    otp: row.otp || '',
    otpExpiresAt: row.otp_expires_at ? Number(row.otp_expires_at) : 0
  };
}

function mapAdminRow(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    password: row.password,
    office: row.office
  };
}

function mapAttendanceRow(row) {
  const record = {
    id: row.id,
    employeeId: row.employee_id,
    date: formatDbDate(row.date),
    timeIn: row.time_in || '',
    timeOut: row.time_out || '',
    timeInAM: row.time_in_am || '',
    timeOutAM: row.time_out_am || '',
    timeInPM: row.time_in_pm || '',
    timeOutPM: row.time_out_pm || '',
    photoInAM: row.photo_in_am || '',
    photoOutAM: row.photo_out_am || '',
    photoInPM: row.photo_in_pm || '',
    photoOutPM: row.photo_out_pm || '',
    locationInAM: row.location_in_am || '',
    locationOutAM: row.location_out_am || '',
    locationInPM: row.location_in_pm || '',
    locationOutPM: row.location_out_pm || '',
    latInAM: row.lat_in_am || '',
    lngInAM: row.lng_in_am || '',
    latOutAM: row.lat_out_am || '',
    lngOutAM: row.lng_out_am || '',
    latInPM: row.lat_in_pm || '',
    lngInPM: row.lng_in_pm || '',
    latOutPM: row.lat_out_pm || '',
    lngOutPM: row.lng_out_pm || '',
    status: row.status || '',
    latitude: row.latitude || '',
    longitude: row.longitude || '',
    location: row.location || '',
    photo: row.photo || '',
    employeeName: row.employee_name || undefined,
    office: row.office || undefined,
    position: row.position || undefined
  };
  return normalizeAttendanceRecord(record);
}

function mapReportRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || '',
    office: row.office || '',
    reportDate: formatDbDate(row.report_date),
    summary: row.summary || '',
    attachmentName: row.attachment_name || '',
    attachmentData: row.attachment_data || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
  };
}

let memoryDb = null;

function normalizeDb(db) {
  const safe = db && typeof db === 'object' ? db : {};
  if (!Array.isArray(safe.admins)) safe.admins = [];
  if (!Array.isArray(safe.employees)) safe.employees = [];
  if (!Array.isArray(safe.attendance)) safe.attendance = [];
  if (!Array.isArray(safe.notifications)) safe.notifications = [];
  if (!Array.isArray(safe.messages)) safe.messages = [];
  if (!Array.isArray(safe.reports)) safe.reports = [];
  return safe;
}

function readDb() {
  if (memoryDb) return memoryDb;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    // ignore directory errors
  }

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
  writeDb(memoryDb);
  return memoryDb;
}

function writeDb(db) {
  memoryDb = normalizeDb(db);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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
  const headers = { 'Content-Type': contentType };
  if (['.html', '.css', '.js', '.json', '.webmanifest'].includes(ext)) {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
    headers.Pragma = 'no-cache';
    headers.Expires = '0';
  }
  res.writeHead(200, headers);
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

function getPhilippineNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') map[p.type] = p.value;
  });
  const date = `${map.year}-${map.month}-${map.day}`;
  const time = `${map.hour}:${map.minute}`;
  return { date, time };
}

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const AM_IN_START = 6 * 60;
const AM_IN_END = 11 * 60 + 59;
const AM_OUT_START = 12 * 60;
const AM_OUT_END = 12 * 60 + 59;
const PM_IN_START = 13 * 60;
const PM_IN_END = 16 * 60 + 59;
const PM_OUT_START = 17 * 60;

function classifyTimeIn(time) {
  const minutes = timeToMinutes(time);
  if (minutes === null) {
    return { ok: false, message: 'Invalid time.' };
  }
  if (minutes >= AM_IN_START && minutes <= AM_IN_END) {
    return { ok: true, session: 'AM' };
  }
  if (minutes >= PM_IN_START && minutes <= PM_IN_END) {
    return { ok: true, session: 'PM' };
  }
  return {
    ok: false,
    message: 'Time in allowed only 6:00–11:59 AM or 1:00–4:59 PM (PH time).'
  };
}

function classifyTimeOut(time) {
  const minutes = timeToMinutes(time);
  if (minutes === null) {
    return { ok: false, message: 'Invalid time.' };
  }
  if (minutes >= AM_OUT_START && minutes <= AM_OUT_END) {
    return { ok: true, session: 'AM' };
  }
  if (minutes >= PM_OUT_START) {
    return { ok: true, session: 'PM' };
  }
  return {
    ok: false,
    message: 'Time out allowed only 12:00–12:59 PM or 5:00 PM onwards (PH time).'
  };
}

function hasAnyAttendance(record) {
  return Boolean(
    record &&
    (
      record.timeInAM ||
      record.timeOutAM ||
      record.timeInPM ||
      record.timeOutPM ||
      record.timeIn ||
      record.timeOut
    )
  );
}

function computeStatus(timeIn) {
  if (!timeIn) return 'Absent';
  const minutes = timeToMinutes(timeIn);
  return minutes <= 8 * 60 ? 'Present' : 'Late';
}

function computeDailyStatus(record) {
  if (!hasAnyAttendance(record)) return 'Absent';
  const amIn = record.timeInAM || record.timeIn || '';
  const pmIn = record.timeInPM || '';
  let late = false;
  if (amIn && timeToMinutes(amIn) > 8 * 60) late = true;
  if (pmIn && timeToMinutes(pmIn) > 13 * 60) late = true;
  return late ? 'Late' : 'Present';
}

function normalizeAttendanceRecord(record) {
  if (!record) return record;
  const normalized = { ...record };
  const hasAmIn = !!normalized.timeInAM;
  const hasPmIn = !!normalized.timeInPM;
  if (normalized.timeIn && !hasAmIn && !hasPmIn) {
    const minutes = timeToMinutes(normalized.timeIn);
    if (minutes !== null && minutes >= PM_IN_START) {
      normalized.timeInPM = normalized.timeIn;
    } else {
      normalized.timeInAM = normalized.timeIn;
    }
  }

  const hasAmOut = !!normalized.timeOutAM;
  const hasPmOut = !!normalized.timeOutPM;
  if (normalized.timeOut && !hasAmOut && !hasPmOut) {
    const minutes = timeToMinutes(normalized.timeOut);
    if (minutes !== null && minutes >= PM_OUT_START) {
      normalized.timeOutPM = normalized.timeOut;
    } else if (minutes !== null && minutes >= AM_OUT_START && minutes <= AM_OUT_END) {
      normalized.timeOutAM = normalized.timeOut;
    } else if (minutes !== null && minutes < PM_OUT_START) {
      normalized.timeOutAM = normalized.timeOut;
    }
  }

  const amInMinutes = timeToMinutes(normalized.timeInAM);
  if (amInMinutes !== null && amInMinutes >= PM_IN_START) {
    normalized.timeInPM = normalized.timeInAM;
    normalized.timeInAM = '';
  }

  const pmInMinutes = timeToMinutes(normalized.timeInPM);
  if (pmInMinutes !== null && pmInMinutes < PM_IN_START && !normalized.timeInAM) {
    normalized.timeInAM = normalized.timeInPM;
    normalized.timeInPM = '';
  }

  const amOutMinutes = timeToMinutes(normalized.timeOutAM);
  if (amOutMinutes !== null && amOutMinutes >= PM_IN_START) {
    normalized.timeOutPM = normalized.timeOutAM;
    normalized.timeOutAM = '';
  }

  return normalized;
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

function pickLatestValue(...values) {
  return values.find((val) => val && String(val).trim().length > 0) || '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isDepedEmail(email) {
  return /@deped\.gov\.ph$/i.test(email);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY || '';
  const fromEmail = process.env.BREVO_FROM || '';
  const fromName = process.env.BREVO_FROM_NAME || 'SDO Marinduque Attendance';
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail, fromName };
}

function getGoogleMapsKey() {
  return process.env.GOOGLE_MAPS_KEY || process.env.GMAPS_KEY || '';
}

function pickGoogleResult(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const priorities = [
    'street_address',
    'premise',
    'subpremise',
    'route',
    'intersection',
    'neighborhood',
    'sublocality',
    'sublocality_level_1',
    'locality',
    'administrative_area_level_3',
    'administrative_area_level_2'
  ];
  for (const type of priorities) {
    const found = results.find((result) => Array.isArray(result.types) && result.types.includes(type));
    if (found) return found;
  }
  return results[0];
}

function pickGoogleComponent(components, types) {
  if (!Array.isArray(components)) return '';
  const match = components.find((comp) => types.every((type) => comp.types && comp.types.includes(type)));
  return match ? match.long_name : '';
}

function formatGoogleAddress(result) {
  if (!result || !Array.isArray(result.address_components)) return { address: '', score: 0 };
  const comps = result.address_components;
  const streetNumber = pickGoogleComponent(comps, ['street_number']);
  const route = pickGoogleComponent(comps, ['route']);
  const roadLine = [streetNumber, route].filter(Boolean).join(' ');
  const place =
    pickGoogleComponent(comps, ['neighborhood']) ||
    pickGoogleComponent(comps, ['sublocality_level_2']) ||
    pickGoogleComponent(comps, ['sublocality_level_1']) ||
    pickGoogleComponent(comps, ['sublocality']) ||
    pickGoogleComponent(comps, ['administrative_area_level_4']) ||
    pickGoogleComponent(comps, ['administrative_area_level_3']) ||
    pickGoogleComponent(comps, ['locality']);
  const municipality =
    pickGoogleComponent(comps, ['locality']) ||
    pickGoogleComponent(comps, ['administrative_area_level_3']) ||
    pickGoogleComponent(comps, ['administrative_area_level_2']);
  const province =
    pickGoogleComponent(comps, ['administrative_area_level_2']) ||
    pickGoogleComponent(comps, ['administrative_area_level_1']);
  const parts = {
    roadLine,
    place,
    municipality,
    province,
    postcode: pickGoogleComponent(comps, ['postal_code']),
    country: pickGoogleComponent(comps, ['country'])
  };
  const address = formatAddressParts(parts);
  return { address, score: scoreAddressParts(parts) };
}

function scoreAddressParts(parts) {
  if (!parts) return 0;
  let score = 0;
  if (parts.roadLine) score += 3;
  if (parts.place) score += 3;
  if (parts.municipality) score += 2;
  if (parts.province) score += 1.5;
  if (parts.postcode) score += 0.5;
  if (parts.country) score += 0.5;
  return score;
}

function formatAddressParts(parts) {
  if (!parts) return '';
  const list = [];
  if (parts.roadLine) list.push(parts.roadLine);
  if (parts.place && !list.includes(parts.place)) list.push(parts.place);
  if (parts.municipality && !list.includes(parts.municipality)) list.push(parts.municipality);
  if (parts.province && !list.includes(parts.province)) list.push(parts.province);
  if (parts.postcode) list.push(parts.postcode);
  if (parts.country) list.push(parts.country);
  return list.join(', ');
}

function formatOsmAddress(osmData) {
  if (!osmData) return { address: '', score: 0 };
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
  const parts = {
    roadLine,
    place,
    municipality,
    province,
    postcode: addr.postcode || '',
    country: addr.country || ''
  };
  const address = formatAddressParts(parts) || osmData.display_name || '';
  return { address, score: scoreAddressParts(parts) };
}

function formatPhotonFeature(feature) {
  if (!feature || !feature.properties) return { address: '', score: 0 };
  const props = feature.properties;
  const roadLine = [props.housenumber, props.street].filter(Boolean).join(' ');
  const place =
    props.neighbourhood ||
    props.suburb ||
    props.district ||
    props.locality ||
    props.name ||
    props.city;
  const municipality = props.city || props.county;
  const province = props.state || props.region;
  const parts = {
    roadLine,
    place,
    municipality,
    province,
    postcode: props.postcode || '',
    country: props.country || ''
  };
  const address = formatAddressParts(parts);
  return { address, score: scoreAddressParts(parts) };
}

function formatBigDataCloud(data) {
  if (!data) return { address: '', score: 0 };
  const admin = Array.isArray(data.localityInfo && data.localityInfo.administrative)
    ? data.localityInfo.administrative
    : [];
  const filteredAdmin = admin.filter((entry) => entry && entry.name && !/philippines/i.test(entry.name));
  filteredAdmin.sort((a, b) => {
    const aLevel = Number(a.adminLevel || a.adminLevelCode || 0);
    const bLevel = Number(b.adminLevel || b.adminLevelCode || 0);
    return bLevel - aLevel;
  });
  const mostSpecific = filteredAdmin[0] ? filteredAdmin[0].name : '';
  const roadLine = [data.streetNumber, data.street].filter(Boolean).join(' ');
  const place = data.locality || data.city || mostSpecific || '';
  const municipality = data.city || data.locality || data.principalSubdivision || '';
  const province = data.principalSubdivision || '';
  const parts = {
    roadLine,
    place,
    municipality,
    province,
    postcode: data.postcode || '',
    country: data.countryName || data.countryCode || ''
  };
  const address = formatAddressParts(parts);
  return { address, score: scoreAddressParts(parts) };
}

function canSeed() {
  return String(process.env.ALLOW_SEED || '').toLowerCase() === 'true';
}

function getSeedEmployees() {
  return [
    {
      id: 'SDO-001',
      name: 'Juan Dela Cruz',
      position: 'IT Officer',
      office: 'ICT Unit',
      email: 'juan.delacruz@example.com',
      username: 'juan.delacruz@example.com',
      employeeType: 'Regular',
      password: 'password123',
      status: 'Active',
      avatar: 'assets/avatar-generic.svg',
      verified: true,
      otp: '',
      otpExpiresAt: 0
    },
    {
      id: 'SDO-002',
      name: 'Joji Ama',
      position: 'Registrar',
      office: 'Records Unit',
      email: 'joji.ama@example.com',
      username: 'joji.ama@example.com',
      employeeType: 'COS',
      password: 'password123',
      status: 'Active',
      avatar: 'assets/avatar-generic.svg',
      verified: true,
      otp: '',
      otpExpiresAt: 0
    }
  ];
}

function getSeedAttendance(date) {
  return [
    {
      id: `ATT-${date}-SDO-001`,
      employeeId: 'SDO-001',
      date,
      timeIn: '08:05',
      timeOut: '17:02',
      timeInAM: '08:05',
      timeOutAM: '12:01',
      timeInPM: '13:02',
      timeOutPM: '17:02',
      photoInAM: '',
      photoOutAM: '',
      photoInPM: '',
      photoOutPM: '',
      locationInAM: '',
      locationOutAM: '',
      locationInPM: '',
      locationOutPM: '',
      latInAM: '',
      lngInAM: '',
      latOutAM: '',
      lngOutAM: '',
      latInPM: '',
      lngInPM: '',
      latOutPM: '',
      lngOutPM: '',
      status: 'Late',
      latitude: '',
      longitude: '',
      location: '',
      photo: ''
    },
    {
      id: `ATT-${date}-SDO-002`,
      employeeId: 'SDO-002',
      date,
      timeIn: '07:55',
      timeOut: '17:00',
      timeInAM: '07:55',
      timeOutAM: '12:00',
      timeInPM: '13:00',
      timeOutPM: '17:00',
      photoInAM: '',
      photoOutAM: '',
      photoInPM: '',
      photoOutPM: '',
      locationInAM: '',
      locationOutAM: '',
      locationInPM: '',
      locationOutPM: '',
      latInAM: '',
      lngInAM: '',
      latOutAM: '',
      lngOutAM: '',
      latInPM: '',
      lngInPM: '',
      latOutPM: '',
      lngOutPM: '',
      status: 'Present',
      latitude: '',
      longitude: '',
      location: '',
      photo: ''
    }
  ];
}

async function sendOtpEmail(to, code) {
  const config = getBrevoConfig();
  if (!config) {
    return { ok: false, reason: 'Brevo not configured (missing BREVO_API_KEY or BREVO_FROM)' };
  }
  const payload = {
    sender: { name: config.fromName, email: config.fromEmail },
    to: [{ email: to }],
    subject: 'SDO Attendance OTP Verification',
    textContent: `Your OTP code is ${code}. It expires in 10 minutes.`,
    htmlContent: `<p>Your OTP code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
  };
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const responseText = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      reason: `Brevo ${res.status}: ${responseText.slice(0, 200)}`
    };
  }
  return { ok: true, info: responseText };
}

function attendanceForDate(db, date) {
  return db.attendance.filter((att) => att.date === date);
}

function enrichAttendance(db, list) {
  return list.map((att) => {
    const emp = db.employees.find((e) => e.id === att.employeeId);
    const normalized = normalizeAttendanceRecord(att);
    const status = computeDailyStatus(normalized);
    return {
      ...normalized,
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
    if (!hasAnyAttendance(att)) return;
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

function pushReport(db, data) {
  const report = {
    id: makeId('RPT'),
    employeeId: data.employeeId || '',
    employeeName: data.employeeName || '',
    office: data.office || '',
    reportDate: data.reportDate || isoToday(),
    summary: data.summary || '',
    attachmentName: data.attachmentName || '',
    attachmentData: data.attachmentData || '',
    createdAt: new Date().toISOString()
  };
  db.reports.unshift(report);
  if (db.reports.length > 500) db.reports = db.reports.slice(0, 500);
  return report;
}

async function insertNotificationPg(data) {
  const note = {
    id: makeId('NTF'),
    type: data.type || 'info',
    title: data.title || 'Notification',
    message: data.message || '',
    employeeId: data.employeeId || '',
    createdAt: new Date().toISOString(),
    read: false
  };
  await pgQuery(
    'INSERT INTO notifications (id, type, title, message, employee_id, created_at, read) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [note.id, note.type, note.title, note.message, note.employeeId, note.createdAt, note.read]
  );
  return note;
}

async function insertMessagePg(data) {
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
  await pgQuery(
    'INSERT INTO messages (id, employee_id, employee_name, office, subject, message, created_at, read) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [msg.id, msg.employeeId, msg.employeeName, msg.office, msg.subject, msg.message, msg.createdAt, msg.read]
  );
  return msg;
}

async function insertReportPg(data) {
  const report = {
    id: makeId('RPT'),
    employeeId: data.employeeId || '',
    employeeName: data.employeeName || '',
    office: data.office || '',
    reportDate: data.reportDate || isoToday(),
    summary: data.summary || '',
    attachmentName: data.attachmentName || '',
    attachmentData: data.attachmentData || '',
    createdAt: new Date().toISOString()
  };
  await pgQuery(
    `INSERT INTO reports (id, employee_id, employee_name, office, report_date, summary, attachment_name, attachment_data, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      report.id,
      report.employeeId,
      report.employeeName,
      report.office,
      report.reportDate,
      report.summary,
      report.attachmentName,
      report.attachmentData,
      report.createdAt
    ]
  );
  return report;
}

async function upsertAttendancePg(record) {
  const cols = [
    'id',
    'employee_id',
    'date',
    'time_in',
    'time_out',
    'time_in_am',
    'time_out_am',
    'time_in_pm',
    'time_out_pm',
    'photo_in_am',
    'photo_out_am',
    'photo_in_pm',
    'photo_out_pm',
    'location_in_am',
    'location_out_am',
    'location_in_pm',
    'location_out_pm',
    'lat_in_am',
    'lng_in_am',
    'lat_out_am',
    'lng_out_am',
    'lat_in_pm',
    'lng_in_pm',
    'lat_out_pm',
    'lng_out_pm',
    'status',
    'latitude',
    'longitude',
    'location',
    'photo',
    'updated_at'
  ];
  const values = [
    record.id,
    record.employeeId,
    record.date,
    record.timeIn,
    record.timeOut,
    record.timeInAM,
    record.timeOutAM,
    record.timeInPM,
    record.timeOutPM,
    record.photoInAM,
    record.photoOutAM,
    record.photoInPM,
    record.photoOutPM,
    record.locationInAM,
    record.locationOutAM,
    record.locationInPM,
    record.locationOutPM,
    record.latInAM,
    record.lngInAM,
    record.latOutAM,
    record.lngOutAM,
    record.latInPM,
    record.lngInPM,
    record.latOutPM,
    record.lngOutPM,
    record.status,
    record.latitude,
    record.longitude,
    record.location,
    record.photo,
    new Date().toISOString()
  ];
  const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
  const updates = cols
    .filter((col) => !['id', 'employee_id', 'date'].includes(col))
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(', ');
  await pgQuery(
    `INSERT INTO attendance (${cols.join(', ')}) VALUES (${placeholders})
     ON CONFLICT (employee_id, date) DO UPDATE SET ${updates}`,
    values
  );
}

async function handleApiPg(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/db-health') {
    const [admins, employees, attendance, notifications, messages, reports] = await Promise.all([
      pgQuery('SELECT COUNT(*) AS count FROM admins'),
      pgQuery('SELECT COUNT(*) AS count FROM employees'),
      pgQuery('SELECT COUNT(*) AS count FROM attendance'),
      pgQuery('SELECT COUNT(*) AS count FROM notifications'),
      pgQuery('SELECT COUNT(*) AS count FROM messages'),
      pgQuery('SELECT COUNT(*) AS count FROM reports')
    ]);
    return sendJson(res, 200, {
      ok: true,
      mode: 'postgres',
      counts: {
        admins: Number(admins.rows[0].count),
        employees: Number(employees.rows[0].count),
        attendance: Number(attendance.rows[0].count),
        notifications: Number(notifications.rows[0].count),
        messages: Number(messages.rows[0].count),
        reports: Number(reports.rows[0].count)
      },
      time: Date.now()
    });
  }

  if (req.method === 'POST' && pathname === '/api/dev/seed') {
    if (!canSeed()) {
      return sendJson(res, 403, { ok: false, message: 'Seeding disabled. Set ALLOW_SEED=true in .env.' });
    }
    const existing = await pgQuery('SELECT COUNT(*) AS count FROM employees');
    if (Number(existing.rows[0].count) > 0) {
      return sendJson(res, 409, { ok: false, message: 'Employees already exist. Seed skipped.' });
    }
    const seedEmployees = getSeedEmployees();
    for (const emp of seedEmployees) {
      await pgQuery(
        `INSERT INTO employees (id, name, position, office, email, username, employee_type, password, status, avatar, verified, otp, otp_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          emp.id,
          emp.name,
          emp.position,
          emp.office,
          emp.email,
          emp.username,
          emp.employeeType,
          emp.password,
          emp.status,
          emp.avatar,
          emp.verified,
          emp.otp,
          emp.otpExpiresAt
        ]
      );
    }
    const today = isoToday();
    const seedAttendance = getSeedAttendance(today);
    for (const record of seedAttendance) {
      await upsertAttendancePg(record);
    }
    return sendJson(res, 200, { ok: true, employees: seedEmployees.length, attendance: seedAttendance.length });
  }

  if (req.method === 'GET' && pathname === '/api/summary') {
    const query = url.parse(req.url, true).query;
    const date = String(query.date || isoToday());
    const totalRes = await pgQuery('SELECT COUNT(*) AS count FROM employees');
    const totalEmployees = Number(totalRes.rows[0].count);
    const attendanceRes = await pgQuery('SELECT * FROM attendance WHERE date = $1', [date]);
    const todays = attendanceRes.rows.map(mapAttendanceRow);
    const attendedIds = new Set();
    let present = 0;
    let late = 0;
    todays.forEach((att) => {
      if (!hasAnyAttendance(att)) return;
      attendedIds.add(att.employeeId);
      const status = computeDailyStatus(att);
      if (status === 'Late') late += 1;
      if (status === 'Present') present += 1;
    });
    const absent = totalEmployees - attendedIds.size;
    return sendJson(res, 200, { date, totalEmployees, present, late, absent });
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, time: Date.now() });
  }

  if (req.method === 'GET' && pathname === '/api/employees') {
    const result = await pgQuery('SELECT * FROM employees ORDER BY id');
    return sendJson(res, 200, { employees: result.rows.map(mapEmployeeRow) });
  }

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const result = await pgQuery('SELECT * FROM notifications ORDER BY created_at DESC');
    const notifications = result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      employeeId: row.employee_id || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      read: row.read === true
    }));
    return sendJson(res, 200, { notifications });
  }

  if (req.method === 'POST' && pathname === '/api/notifications/read') {
    const body = await collectBody(req);
    if (body && body.all) {
      await pgQuery('UPDATE notifications SET read = true');
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await pgQuery('UPDATE notifications SET read = true WHERE id = ANY($1::text[])', [body.ids]);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/messages') {
    const result = await pgQuery('SELECT * FROM messages ORDER BY created_at DESC');
    const messages = result.rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id || '',
      employeeName: row.employee_name || '',
      office: row.office || '',
      subject: row.subject || '',
      message: row.message || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      read: row.read === true
    }));
    return sendJson(res, 200, { messages });
  }

  if (req.method === 'POST' && pathname === '/api/messages') {
    const body = await collectBody(req);
    const employeeId = String(body.employeeId || '').trim();
    const message = String(body.message || '').trim();
    const subject = String(body.subject || 'Concern').trim();
    if (!employeeId || !message) {
      return sendJson(res, 400, { ok: false, message: 'Employee and message are required.' });
    }
    const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
    const empRow = empRes.rows[0];
    const newMsg = await insertMessagePg({
      employeeId,
      employeeName: empRow ? empRow.name : String(body.employeeName || 'Unknown'),
      office: empRow ? empRow.office : String(body.office || ''),
      subject,
      message
    });
    return sendJson(res, 201, { ok: true, message: newMsg });
  }

  if (req.method === 'POST' && pathname === '/api/messages/read') {
    const body = await collectBody(req);
    if (body && body.all) {
      await pgQuery('UPDATE messages SET read = true');
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await pgQuery('UPDATE messages SET read = true WHERE id = ANY($1::text[])', [body.ids]);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/reports') {
    const query = url.parse(req.url, true).query;
    const from = query.from || '1900-01-01';
    const to = query.to || '2999-12-31';
    const employeeId = query.employeeId;
    const params = [from, to];
    let sql =
      `SELECT * FROM reports
       WHERE report_date >= $1 AND report_date <= $2`;
    if (employeeId) {
      sql += ' AND employee_id = $3';
      params.push(employeeId);
    }
    sql += ' ORDER BY report_date DESC, created_at DESC';
    const result = await pgQuery(sql, params);
    return sendJson(res, 200, { reports: result.rows.map(mapReportRow) });
  }

  if (req.method === 'POST' && pathname === '/api/reports') {
    const body = await collectBody(req);
    const employeeId = String(body.employeeId || '').trim();
    const summary = String(body.summary || '').trim();
    const reportDate = String(body.reportDate || body.date || isoToday());
    const attachmentData = String(body.attachment || body.attachmentData || '');
    const attachmentName = String(body.attachmentName || '');

    if (!employeeId || !summary) {
      return sendJson(res, 400, { ok: false, message: 'Employee and summary are required.' });
    }

    const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
    const empRow = empRes.rows[0];
    const report = await insertReportPg({
      employeeId,
      employeeName: empRow ? empRow.name : String(body.employeeName || 'Unknown'),
      office: empRow ? empRow.office : String(body.office || ''),
      reportDate,
      summary,
      attachmentName,
      attachmentData
    });
    await insertNotificationPg({
      type: 'report',
      title: 'New Daily Report',
      message: `${report.employeeName || 'Employee'} submitted a report for ${reportDate}.`,
      employeeId
    });
    return sendJson(res, 201, { ok: true, report });
  }

  if (req.method === 'POST' && pathname === '/api/employees') {
    const body = await collectBody(req);
    const email = normalizeEmail(body.email || '');
    const countRes = await pgQuery('SELECT COUNT(*) AS count FROM employees');
    const nextId = body.id || `SDO-${String(Number(countRes.rows[0].count) + 1).padStart(3, '0')}`;
    const newEmp = {
      id: nextId,
      name: body.name || 'New Employee',
      position: body.position || 'Staff',
      office: body.office || 'Office',
      email,
      username: email || body.username || '',
      employeeType: body.employeeType || 'Regular',
      password: body.password || 'password123',
      status: 'Active',
      avatar: body.avatar || 'assets/avatar-generic.png',
      verified: true,
      otp: '',
      otpExpiresAt: 0
    };
    await pgQuery(
      `INSERT INTO employees (id, name, position, office, email, username, employee_type, password, status, avatar, verified, otp, otp_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        newEmp.id,
        newEmp.name,
        newEmp.position,
        newEmp.office,
        newEmp.email,
        newEmp.username,
        newEmp.employeeType,
        newEmp.password,
        newEmp.status,
        newEmp.avatar,
        newEmp.verified,
        newEmp.otp,
        newEmp.otpExpiresAt
      ]
    );
    return sendJson(res, 201, { employee: newEmp });
  }

  if (req.method === 'POST' && pathname === '/api/admin/register') {
    const body = await collectBody(req);
    const name = String(body.name || '').trim();
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const office = String(body.office || '').trim();

    if (!name || !username || !password || !office) {
      return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
    }

    const existing = await pgQuery('SELECT 1 FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
    if (existing.rows.length) {
      return sendJson(res, 409, { ok: false, message: 'Username is already taken.' });
    }

    const countRes = await pgQuery('SELECT COUNT(*) AS count FROM admins');
    const newAdmin = {
      id: `ADM-${String(Number(countRes.rows[0].count) + 1).padStart(3, '0')}`,
      name,
      username,
      password,
      office
    };
    await pgQuery(
      'INSERT INTO admins (id, name, username, password, office) VALUES ($1, $2, $3, $4, $5)',
      [newAdmin.id, newAdmin.name, newAdmin.username, newAdmin.password, newAdmin.office]
    );
    return sendJson(res, 201, { ok: true, admin: newAdmin });
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    const body = await collectBody(req);
    const name = String(body.name || '').trim();
    const office = String(body.office || '').trim();
    const employeeType = String(body.employeeType || '').trim();
    const position = String(body.position || 'Staff').trim();
    const email = normalizeEmail(body.email || '');
    const password = String(body.password || '').trim();

    if (!name || !office || !employeeType || !email || !password) {
      return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
    }

    if (employeeType === 'Regular' && !isDepedEmail(email)) {
      return sendJson(res, 400, { ok: false, message: 'Regular employees must use a DepEd email.' });
    }

    const existingRes = await pgQuery(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
      [email]
    );

    if (existingRes.rows.length) {
      const existing = mapEmployeeRow(existingRes.rows[0]);
      const otp = generateOtp();
      existing.name = name;
      existing.office = office;
      existing.employeeType = employeeType;
      existing.position = position || existing.position;
      existing.email = email;
      existing.username = email;
      existing.password = password;
      existing.verified = false;
      existing.otp = otp;
      existing.otpExpiresAt = Date.now() + 10 * 60 * 1000;

      await pgQuery(
        `UPDATE employees SET name=$1, position=$2, office=$3, email=$4, username=$5, employee_type=$6, password=$7, verified=$8, otp=$9, otp_expires_at=$10 WHERE id=$11`,
        [
          existing.name,
          existing.position,
          existing.office,
          existing.email,
          existing.username,
          existing.employeeType,
          existing.password,
          existing.verified,
          existing.otp,
          existing.otpExpiresAt,
          existing.id
        ]
      );

      let devOtp = '';
      let emailError = '';
      try {
        const mailResult = await sendOtpEmail(email, otp);
        if (!mailResult.ok) {
          devOtp = otp;
          emailError = mailResult.reason || 'Brevo request failed';
        }
      } catch (err) {
        devOtp = otp;
        emailError = err.message || 'Brevo request failed';
      }
      return sendJson(res, 200, {
        ok: true,
        employee: existing,
        devOtp,
        emailSent: !emailError,
        emailError,
        message: 'Account updated. OTP sent to your email.'
      });
    }

    const countRes = await pgQuery('SELECT COUNT(*) AS count FROM employees');
    const nextId = `SDO-${String(Number(countRes.rows[0].count) + 1).padStart(3, '0')}`;
    const otp = generateOtp();
    const newEmp = {
      id: nextId,
      name,
      position,
      office,
      email,
      username: email,
      employeeType,
      password,
      status: 'Active',
      avatar: 'assets/avatar-generic.svg',
      verified: false,
      otp,
      otpExpiresAt: Date.now() + 10 * 60 * 1000
    };

    await pgQuery(
      `INSERT INTO employees (id, name, position, office, email, username, employee_type, password, status, avatar, verified, otp, otp_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        newEmp.id,
        newEmp.name,
        newEmp.position,
        newEmp.office,
        newEmp.email,
        newEmp.username,
        newEmp.employeeType,
        newEmp.password,
        newEmp.status,
        newEmp.avatar,
        newEmp.verified,
        newEmp.otp,
        newEmp.otpExpiresAt
      ]
    );

    let devOtp = '';
    let emailError = '';
    try {
      const mailResult = await sendOtpEmail(email, otp);
      if (!mailResult.ok) {
        devOtp = otp;
        emailError = mailResult.reason || 'Brevo request failed';
      }
    } catch (err) {
      devOtp = otp;
      emailError = err.message || 'Brevo request failed';
    }

    return sendJson(res, 201, {
      ok: true,
      employee: newEmp,
      devOtp,
      emailSent: !emailError,
      emailError
    });
  }

  if (req.method === 'POST' && pathname === '/api/register/verify') {
    const body = await collectBody(req);
    const email = normalizeEmail(body.email || '');
    const otp = String(body.otp || '').trim();
    if (!email || !otp) {
      return sendJson(res, 400, { ok: false, message: 'Email and OTP are required.' });
    }
    const employeeRes = await pgQuery('SELECT * FROM employees WHERE LOWER(email) = LOWER($1)', [email]);
    if (!employeeRes.rows.length) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
    const employee = mapEmployeeRow(employeeRes.rows[0]);
    if (!employee.otp || employee.otp !== otp) {
      return sendJson(res, 400, { ok: false, message: 'Invalid OTP.' });
    }
    if (employee.otpExpiresAt && Date.now() > employee.otpExpiresAt) {
      return sendJson(res, 400, { ok: false, message: 'OTP expired. Please resend.' });
    }
    await pgQuery('UPDATE employees SET verified = true, otp = $1, otp_expires_at = $2 WHERE id = $3', ['', 0, employee.id]);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/register/resend') {
    const body = await collectBody(req);
    const email = normalizeEmail(body.email || '');
    if (!email) return sendJson(res, 400, { ok: false, message: 'Email is required.' });
    const employeeRes = await pgQuery('SELECT * FROM employees WHERE LOWER(email) = LOWER($1)', [email]);
    if (!employeeRes.rows.length) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
    const employee = mapEmployeeRow(employeeRes.rows[0]);
    const otp = generateOtp();
    const expires = Date.now() + 10 * 60 * 1000;
    await pgQuery('UPDATE employees SET otp = $1, otp_expires_at = $2 WHERE id = $3', [otp, expires, employee.id]);
    let devOtp = '';
    let emailError = '';
    try {
      const mailResult = await sendOtpEmail(email, otp);
      if (!mailResult.ok) {
        devOtp = otp;
        emailError = mailResult.reason || 'Brevo request failed';
      }
    } catch (err) {
      devOtp = otp;
      emailError = err.message || 'Brevo request failed';
    }
    return sendJson(res, 200, {
      ok: true,
      devOtp,
      emailSent: !emailError,
      emailError
    });
  }

  if (req.method === 'POST' && pathname === '/api/password-reset') {
    const body = await collectBody(req);
    const role = String(body.role || '').trim();
    const username = String(body.username || '').trim();
    const newPassword = String(body.newPassword || '').trim();

    if (!role || !username || !newPassword) {
      return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
    }

    if (role === 'admin') {
      const adminRes = await pgQuery('SELECT * FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
      if (!adminRes.rows.length) return sendJson(res, 404, { ok: false, message: 'Admin not found.' });
      await pgQuery('UPDATE admins SET password = $1 WHERE id = $2', [newPassword, adminRes.rows[0].id]);
      return sendJson(res, 200, { ok: true });
    }

    const lookup = username.toLowerCase();
    const empRes = await pgQuery(
      'SELECT * FROM employees WHERE LOWER(username) = $1 OR LOWER(email) = $1 OR LOWER(id) = $1 OR LOWER(name) = $1',
      [lookup]
    );
    if (!empRes.rows.length) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
    await pgQuery('UPDATE employees SET password = $1 WHERE id = $2', [newPassword, empRes.rows[0].id]);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await collectBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    if (!username || !password) {
      return sendJson(res, 400, { ok: false, message: 'Missing credentials' });
    }

    const adminRes = await pgQuery('SELECT * FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
    if (adminRes.rows.length) {
      const admin = mapAdminRow(adminRes.rows[0]);
      if (admin.password === password) {
        return sendJson(res, 200, { ok: true, user: admin, role: 'admin' });
      }
    }

    const lookup = username.toLowerCase();
    const empRes = await pgQuery(
      'SELECT * FROM employees WHERE LOWER(username) = $1 OR LOWER(email) = $1 OR LOWER(id) = $1 OR LOWER(name) = $1',
      [lookup]
    );
    if (!empRes.rows.length) {
      return sendJson(res, 401, { ok: false, message: 'Invalid credentials' });
    }
    const emp = mapEmployeeRow(empRes.rows[0]);
    if (emp.password !== password) {
      return sendJson(res, 401, { ok: false, message: 'Invalid credentials' });
    }
    if (emp.verified === false) {
      return sendJson(res, 403, { ok: false, message: 'Email not verified. Please enter the OTP sent to your email.' });
    }
    return sendJson(res, 200, { ok: true, user: emp, role: 'employee' });
  }

  if (req.method === 'GET' && pathname === '/api/attendance/today') {
    const query = url.parse(req.url, true).query;
    const date = String(query.date || isoToday());
    const result = await pgQuery(
      `SELECT a.*, e.name AS employee_name, e.office, e.position
       FROM attendance a
       LEFT JOIN employees e ON e.id = a.employee_id
       WHERE a.date = $1
       ORDER BY a.date DESC`,
      [date]
    );
    const attendance = result.rows.map((row) => {
      const rec = mapAttendanceRow(row);
      rec.employeeName = row.employee_name || 'Unknown';
      rec.office = row.office || 'Unknown';
      rec.position = row.position || 'Unknown';
      rec.status = computeDailyStatus(rec);
      return rec;
    });
    return sendJson(res, 200, { date, attendance });
  }

  if (req.method === 'GET' && pathname === '/api/attendance') {
    const query = url.parse(req.url, true).query;
    const from = query.from || '1900-01-01';
    const to = query.to || '2999-12-31';
    const employeeId = query.employeeId;
    const params = [from, to];
    let sql =
      `SELECT a.*, e.name AS employee_name, e.office, e.position
       FROM attendance a
       LEFT JOIN employees e ON e.id = a.employee_id
       WHERE a.date >= $1 AND a.date <= $2`;
    if (employeeId) {
      sql += ' AND a.employee_id = $3';
      params.push(employeeId);
    }
    sql += ' ORDER BY a.date DESC';
    const result = await pgQuery(sql, params);
    const attendance = result.rows.map((row) => {
      const rec = mapAttendanceRow(row);
      rec.employeeName = row.employee_name || 'Unknown';
      rec.office = row.office || 'Unknown';
      rec.position = row.position || 'Unknown';
      rec.status = computeDailyStatus(rec);
      return rec;
    });
    return sendJson(res, 200, { attendance });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timein') {
    const body = await collectBody(req);
    const nowPH = getPhilippineNow();
    const useServerTime = body.useServerTime !== false;
    const date = useServerTime ? nowPH.date : (body.date || nowPH.date);
    const employeeId = body.employeeId;
    const rawTime = String(body.timeIn || '').trim();
    const timeIn = useServerTime ? nowPH.time : (rawTime || nowPH.time);
    const timeWindow = classifyTimeIn(timeIn);
    if (!timeWindow.ok) {
      return sendJson(res, 400, { message: timeWindow.message });
    }
    const session = timeWindow.session;
    const photo = body.photo || '';
    const location = body.location || '';
    const latitude = body.latitude || '';
    const longitude = body.longitude || '';
    const existingRes = await pgQuery(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, date]
    );
    if (existingRes.rows.length) {
      const existing = mapAttendanceRow(existingRes.rows[0]);
      if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
      if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
      if (session === 'AM') {
        if (existing.timeInAM) return sendJson(res, 409, { message: 'Time in already recorded.' });
        existing.timeInAM = timeIn;
        existing.photoInAM = photo || existing.photoInAM;
        existing.locationInAM = location || existing.locationInAM;
        existing.latInAM = latitude || existing.latInAM;
        existing.lngInAM = longitude || existing.lngInAM;
      } else {
        if (existing.timeInPM) return sendJson(res, 409, { message: 'Time in already recorded.' });
        existing.timeInPM = timeIn;
        existing.photoInPM = photo || existing.photoInPM;
        existing.locationInPM = location || existing.locationInPM;
        existing.latInPM = latitude || existing.latInPM;
        existing.lngInPM = longitude || existing.lngInPM;
      }
      if (session === 'AM' && !existing.timeIn) existing.timeIn = timeIn;
      existing.photo = pickLatestValue(photo, existing.photo);
      existing.location = pickLatestValue(location, existing.location);
      existing.latitude = pickLatestValue(latitude, existing.latitude);
      existing.longitude = pickLatestValue(longitude, existing.longitude);
      existing.status = computeDailyStatus(existing);
      await upsertAttendancePg(existing);
      return sendJson(res, 200, { attendance: existing, slot: session });
    }
    const record = {
      id: `ATT-${date}-${employeeId}`,
      employeeId,
      date,
      timeIn,
      timeOut: '',
      timeInAM: session === 'AM' ? timeIn : '',
      timeOutAM: '',
      timeInPM: session === 'PM' ? timeIn : '',
      timeOutPM: '',
      photoInAM: session === 'AM' ? photo : '',
      photoOutAM: '',
      photoInPM: session === 'PM' ? photo : '',
      photoOutPM: '',
      locationInAM: session === 'AM' ? location : '',
      locationOutAM: '',
      locationInPM: session === 'PM' ? location : '',
      locationOutPM: '',
      latInAM: session === 'AM' ? latitude : '',
      lngInAM: session === 'AM' ? longitude : '',
      latOutAM: '',
      lngOutAM: '',
      latInPM: session === 'PM' ? latitude : '',
      lngInPM: session === 'PM' ? longitude : '',
      latOutPM: '',
      lngOutPM: '',
      status: computeDailyStatus({
        timeInAM: session === 'AM' ? timeIn : '',
        timeInPM: session === 'PM' ? timeIn : '',
        timeOutAM: '',
        timeOutPM: '',
        timeIn
      }),
      latitude,
      longitude,
      location,
      photo
    };
    await upsertAttendancePg(record);
    const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
    const empRow = empRes.rows[0];
    await insertNotificationPg({
      type: 'attendance',
      employeeId,
      title: 'New Time In',
      message: `${empRow ? empRow.name : employeeId} (${empRow ? empRow.office : 'Office'}) timed in at ${timeIn}.`
    });
    return sendJson(res, 201, { attendance: record, slot: session });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timeout') {
    const body = await collectBody(req);
    const nowPH = getPhilippineNow();
    const useServerTime = body.useServerTime !== false;
    const date = useServerTime ? nowPH.date : (body.date || nowPH.date);
    const employeeId = body.employeeId;
    const rawTime = String(body.timeOut || '').trim();
    const timeOut = useServerTime ? nowPH.time : (rawTime || nowPH.time);
    const timeWindow = classifyTimeOut(timeOut);
    if (!timeWindow.ok) {
      return sendJson(res, 400, { message: timeWindow.message });
    }
    const session = timeWindow.session;
    const photo = body.photo || '';
    const location = body.location || '';
    const latitude = body.latitude || '';
    const longitude = body.longitude || '';
    const existingRes = await pgQuery(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, date]
    );
    if (!existingRes.rows.length) {
      const record = {
        id: `ATT-${date}-${employeeId}`,
        employeeId,
        date,
        timeIn: '',
        timeOut: session === 'PM' ? timeOut : '',
        timeInAM: '',
        timeOutAM: session === 'AM' ? timeOut : '',
        timeInPM: '',
        timeOutPM: session === 'PM' ? timeOut : '',
        photoInAM: '',
        photoOutAM: session === 'AM' ? photo : '',
        photoInPM: '',
        photoOutPM: session === 'PM' ? photo : '',
        locationInAM: '',
        locationOutAM: session === 'AM' ? location : '',
        locationInPM: '',
        locationOutPM: session === 'PM' ? location : '',
        latInAM: '',
        lngInAM: '',
        latOutAM: session === 'AM' ? latitude : '',
        lngOutAM: session === 'AM' ? longitude : '',
        latInPM: '',
        lngInPM: '',
        latOutPM: session === 'PM' ? latitude : '',
        lngOutPM: session === 'PM' ? longitude : '',
        status: computeDailyStatus({
          timeInAM: '',
          timeOutAM: session === 'AM' ? timeOut : '',
          timeInPM: '',
          timeOutPM: session === 'PM' ? timeOut : '',
          timeOut: session === 'PM' ? timeOut : ''
        }),
        latitude,
        longitude,
        location,
        photo
      };
      await upsertAttendancePg(record);
      if (timeOut) {
        const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
        const empRow = empRes.rows[0];
        await insertNotificationPg({
          type: 'attendance',
          employeeId,
          title: 'New Time Out',
          message: `${empRow ? empRow.name : employeeId} (${empRow ? empRow.office : 'Office'}) timed out at ${timeOut}.`
        });
      }
      return sendJson(res, 201, { attendance: record, slot: session });
    }
    const existing = mapAttendanceRow(existingRes.rows[0]);
    if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
    if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
    if (session === 'AM') {
      if (existing.timeOutAM) return sendJson(res, 409, { message: 'Time out already recorded.' });
      existing.timeOutAM = timeOut;
      existing.photoOutAM = photo || existing.photoOutAM;
      existing.locationOutAM = location || existing.locationOutAM;
      existing.latOutAM = latitude || existing.latOutAM;
      existing.lngOutAM = longitude || existing.lngOutAM;
    } else {
      if (existing.timeOutPM) return sendJson(res, 409, { message: 'Time out already recorded.' });
      existing.timeOutPM = timeOut;
      existing.photoOutPM = photo || existing.photoOutPM;
      existing.locationOutPM = location || existing.locationOutPM;
      existing.latOutPM = latitude || existing.latOutPM;
      existing.lngOutPM = longitude || existing.lngOutPM;
    }
    if (session === 'PM' && !existing.timeOut) existing.timeOut = timeOut;
    existing.photo = pickLatestValue(photo, existing.photo);
    existing.location = pickLatestValue(location, existing.location);
    existing.latitude = pickLatestValue(latitude, existing.latitude);
    existing.longitude = pickLatestValue(longitude, existing.longitude);
    existing.status = computeDailyStatus(existing);
    await upsertAttendancePg(existing);
    if (timeOut) {
      const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
      const empRow = empRes.rows[0];
      await insertNotificationPg({
        type: 'attendance',
        employeeId,
        title: 'New Time Out',
        message: `${empRow ? empRow.name : employeeId} (${empRow ? empRow.office : 'Office'}) timed out at ${timeOut}.`
      });
    }
    return sendJson(res, 200, { attendance: existing, slot: session });
  }

  return sendJson(res, 404, { message: 'Not found' });
}

async function handleApi(req, res, pathname) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && pathname === '/api/reverse-geocode') {
    const query = url.parse(req.url, true).query;
    const lat = parseFloat(query.lat);
    const lng = parseFloat(query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return sendJson(res, 400, { ok: false, message: 'Latitude and longitude are required.' });
    }
    const apiKey = getGoogleMapsKey();
    try {
      if (apiKey) {
        const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en&region=PH`;
        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.results && gData.results.length) {
            const picked = pickGoogleResult(gData.results);
            if (picked) {
              const formatted = formatGoogleAddress(picked);
              if (formatted.address) {
                return sendJson(res, 200, { ok: true, address: formatted.address });
              }
              if (picked.formatted_address) {
                return sendJson(res, 200, { ok: true, address: picked.formatted_address });
              }
            }
          }
        }
      }
      let best = { address: '', score: 0 };
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1`;
      const osmRes = await fetch(osmUrl, { headers: { 'Accept-Language': 'en,fil;q=0.9' } });
      if (osmRes.ok) {
        const osmData = await osmRes.json();
        const formatted = formatOsmAddress(osmData);
        if (formatted.address && formatted.score > best.score) {
          best = formatted;
        }
      }

      const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en&limit=5`;
      const photonRes = await fetch(photonUrl);
      if (photonRes.ok) {
        const photonData = await photonRes.json();
        const features = Array.isArray(photonData.features) ? photonData.features : [];
        features.forEach((feature) => {
          const formatted = formatPhotonFeature(feature);
          if (formatted.address && formatted.score > best.score) {
            best = formatted;
          }
        });
      }

      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const bdcRes = await fetch(bdcUrl);
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        const formatted = formatBigDataCloud(bdcData);
        if (formatted.address && formatted.score > best.score) {
          best = formatted;
        }
      }

      if (best.address) {
        return sendJson(res, 200, { ok: true, address: best.address });
      }

      return sendJson(res, 200, { ok: false, address: '', message: 'Address unavailable.' });
    } catch (err) {
      return sendJson(res, 500, { ok: false, message: 'Unable to fetch address.' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/map') {
    const query = url.parse(req.url, true).query;
    const lat = parseFloat(query.lat);
    const lng = parseFloat(query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Latitude and longitude are required.');
    }
    const apiKey = getGoogleMapsKey();
    try {
      if (!apiKey) {
        const osmParams = new URLSearchParams({
          center: `${lat},${lng}`,
          zoom: '17',
          size: '600x320',
          markers: `${lat},${lng},red-pushpin`
        });
        res.writeHead(302, { Location: `https://staticmap.openstreetmap.de/staticmap.php?${osmParams.toString()}` });
        return res.end();
      }
      const gParams = new URLSearchParams({
        center: `${lat},${lng}`,
        zoom: '17',
        size: '600x320',
        scale: '2',
        maptype: 'roadmap',
        markers: `color:red|label:A|${lat},${lng}`,
        key: apiKey
      });
      const gRes = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${gParams.toString()}`);
      if (!gRes.ok) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Unable to fetch map image.');
      }
      const buffer = Buffer.from(await gRes.arrayBuffer());
      res.writeHead(200, {
        'Content-Type': gRes.headers.get('content-type') || 'image/png',
        'Cache-Control': 'no-store'
      });
      return res.end(buffer);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Map error.');
    }
  }

  if (USE_PG) {
    return handleApiPg(req, res, pathname);
  }

  if (req.method === 'GET' && pathname === '/api/db-health') {
    const db = readDb();
    return sendJson(res, 200, {
      ok: true,
      mode: 'json',
      counts: {
        admins: db.admins.length,
        employees: db.employees.length,
        attendance: db.attendance.length,
        notifications: (db.notifications || []).length,
        messages: (db.messages || []).length,
        reports: (db.reports || []).length
      },
      time: Date.now()
    });
  }

  if (req.method === 'POST' && pathname === '/api/dev/seed') {
    if (!canSeed()) {
      return sendJson(res, 403, { ok: false, message: 'Seeding disabled. Set ALLOW_SEED=true in .env.' });
    }
    const db = readDb();
    if (db.employees.length > 0) {
      return sendJson(res, 409, { ok: false, message: 'Employees already exist. Seed skipped.' });
    }
    const seedEmployees = getSeedEmployees();
    const today = isoToday();
    const seedAttendance = getSeedAttendance(today);
    db.employees.push(...seedEmployees);
    db.attendance.push(...seedAttendance);
    writeDb(db);
    return sendJson(res, 200, { ok: true, employees: seedEmployees.length, attendance: seedAttendance.length });
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

  if (req.method === 'GET' && pathname === '/api/reports') {
    const db = readDb();
    const query = url.parse(req.url, true).query;
    const from = query.from || '1900-01-01';
    const to = query.to || '2999-12-31';
    const employeeId = query.employeeId;
    let list = db.reports || [];
    list = list.filter((r) => r.reportDate >= from && r.reportDate <= to);
    if (employeeId) list = list.filter((r) => r.employeeId === employeeId);
    list.sort((a, b) => {
      if (a.reportDate === b.reportDate) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      }
      return String(b.reportDate).localeCompare(String(a.reportDate));
    });
    return sendJson(res, 200, { reports: list });
  }

  if (req.method === 'POST' && pathname === '/api/reports') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const employeeId = String(body.employeeId || '').trim();
      const summary = String(body.summary || '').trim();
      const reportDate = String(body.reportDate || body.date || isoToday());
      const attachmentData = String(body.attachment || body.attachmentData || '');
      const attachmentName = String(body.attachmentName || '');
      if (!employeeId || !summary) {
        return sendJson(res, 400, { ok: false, message: 'Employee and summary are required.' });
      }
      const emp = db.employees.find((e) => e.id === employeeId);
      const report = pushReport(db, {
        employeeId,
        employeeName: emp ? emp.name : String(body.employeeName || 'Unknown'),
        office: emp ? emp.office : String(body.office || ''),
        reportDate,
        summary,
        attachmentName,
        attachmentData
      });
      pushNotification(db, {
        type: 'report',
        title: 'New Daily Report',
        message: `${report.employeeName || 'Employee'} submitted a report for ${reportDate}.`,
        employeeId
      });
      writeDb(db);
      return sendJson(res, 201, { ok: true, report });
    });
  }

  if (req.method === 'POST' && pathname === '/api/employees') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const email = normalizeEmail(body.email || '');
      const newEmp = {
        id: body.id || `SDO-${String(db.employees.length + 1).padStart(3, '0')}`,
        name: body.name || 'New Employee',
        position: body.position || 'Staff',
        office: body.office || 'Office',
        email,
        username: email || body.username || '',
        employeeType: body.employeeType || 'Regular',
        password: body.password || 'password123',
        status: 'Active',
        avatar: body.avatar || 'assets/avatar-generic.png',
        verified: true,
        otp: '',
        otpExpiresAt: 0
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
    return collectBody(req).then(async (body) => {
      const db = readDb();
      const name = String(body.name || '').trim();
      const office = String(body.office || '').trim();
      const employeeType = String(body.employeeType || '').trim();
      const position = String(body.position || 'Staff').trim();
      const email = normalizeEmail(body.email || '');
      const password = String(body.password || '').trim();

      if (!name || !office || !employeeType || !email || !password) {
        return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
      }

      if (employeeType === 'Regular' && !isDepedEmail(email)) {
        return sendJson(res, 400, { ok: false, message: 'Regular employees must use a DepEd email.' });
      }

      const existing = db.employees.find((e) =>
        (e.email && e.email.toLowerCase() === email) ||
        (e.username && e.username.toLowerCase() === email)
      );
      if (existing) {
        const otp = generateOtp();
        existing.name = name;
        existing.office = office;
        existing.employeeType = employeeType;
        existing.position = position || existing.position;
        existing.email = email;
        existing.username = email;
        existing.password = password;
        existing.verified = false;
        existing.otp = otp;
        existing.otpExpiresAt = Date.now() + 10 * 60 * 1000;
        writeDb(db);
        let devOtp = '';
        let emailError = '';
        try {
          const mailResult = await sendOtpEmail(email, otp);
          if (!mailResult.ok) {
            devOtp = otp;
            emailError = mailResult.reason || 'Brevo request failed';
          }
        } catch (err) {
          devOtp = otp;
          emailError = err.message || 'Brevo request failed';
        }
        return sendJson(res, 200, {
          ok: true,
          employee: existing,
          devOtp,
          emailSent: !emailError,
          emailError,
          message: 'Account updated. OTP sent to your email.'
        });
      }

      const nextId = `SDO-${String(db.employees.length + 1).padStart(3, '0')}`;
      const otp = generateOtp();
      const newEmp = {
        id: nextId,
        name,
        position,
        office,
        email,
        username: email,
        employeeType,
        password,
        status: 'Active',
        avatar: 'assets/avatar-generic.svg',
        verified: false,
        otp,
        otpExpiresAt: Date.now() + 10 * 60 * 1000
      };
      db.employees.push(newEmp);
      writeDb(db);

      let devOtp = '';
      let emailError = '';
      try {
        const mailResult = await sendOtpEmail(email, otp);
        if (!mailResult.ok) {
          devOtp = otp;
          emailError = mailResult.reason || 'Brevo request failed';
        }
      } catch (err) {
        devOtp = otp;
        emailError = err.message || 'Brevo request failed';
      }

      return sendJson(res, 201, {
        ok: true,
        employee: newEmp,
        devOtp,
        emailSent: !emailError,
        emailError
      });
    });
  }

  if (req.method === 'POST' && pathname === '/api/register/verify') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const email = normalizeEmail(body.email || '');
      const otp = String(body.otp || '').trim();
      if (!email || !otp) {
        return sendJson(res, 400, { ok: false, message: 'Email and OTP are required.' });
      }
      const employee = db.employees.find((e) => e.email && e.email.toLowerCase() === email);
      if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      if (!employee.otp || employee.otp !== otp) {
        return sendJson(res, 400, { ok: false, message: 'Invalid OTP.' });
      }
      if (employee.otpExpiresAt && Date.now() > employee.otpExpiresAt) {
        return sendJson(res, 400, { ok: false, message: 'OTP expired. Please resend.' });
      }
      employee.verified = true;
      employee.otp = '';
      employee.otpExpiresAt = 0;
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && pathname === '/api/register/resend') {
    return collectBody(req).then(async (body) => {
      const db = readDb();
      const email = normalizeEmail(body.email || '');
      if (!email) return sendJson(res, 400, { ok: false, message: 'Email is required.' });
      const employee = db.employees.find((e) => e.email && e.email.toLowerCase() === email);
      if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      const otp = generateOtp();
      employee.otp = otp;
      employee.otpExpiresAt = Date.now() + 10 * 60 * 1000;
      writeDb(db);
      let devOtp = '';
      let emailError = '';
      try {
        const mailResult = await sendOtpEmail(email, otp);
        if (!mailResult.ok) {
          devOtp = otp;
          emailError = mailResult.reason || 'Brevo request failed';
        }
      } catch (err) {
        devOtp = otp;
        emailError = err.message || 'Brevo request failed';
      }
      return sendJson(res, 200, {
        ok: true,
        devOtp,
        emailSent: !emailError,
        emailError
      });
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
        (e.email && e.email.toLowerCase() === lookup) ||
        (e.id && e.id.toLowerCase() === lookup) ||
        (e.name && e.name.toLowerCase() === lookup)
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
        (e.email && e.email.toLowerCase() === lookup) ||
        (e.id && e.id.toLowerCase() === lookup) ||
        (e.name && e.name.toLowerCase() === lookup)
      );
      if (!emp || emp.password !== password) {
        return sendJson(res, 401, { ok: false, message: 'Invalid credentials' });
      }
      if (emp.verified === false) {
        return sendJson(res, 403, { ok: false, message: 'Email not verified. Please enter the OTP sent to your email.' });
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
      const nowPH = getPhilippineNow();
      const useServerTime = body.useServerTime !== false;
      const date = useServerTime ? nowPH.date : (body.date || nowPH.date);
      const employeeId = body.employeeId;
      const rawTime = String(body.timeIn || '').trim();
      const timeIn = useServerTime ? nowPH.time : (rawTime || nowPH.time);
      const timeWindow = classifyTimeIn(timeIn);
      if (!timeWindow.ok) {
        return sendJson(res, 400, { message: timeWindow.message });
      }
      const session = timeWindow.session;
      const photo = body.photo || '';
      const location = body.location || '';
      const latitude = body.latitude || '';
      const longitude = body.longitude || '';
      const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
      if (existing) {
        if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
        if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
        if (session === 'AM') {
          if (existing.timeInAM) return sendJson(res, 409, { message: 'Time in already recorded.' });
          existing.timeInAM = timeIn;
          existing.photoInAM = photo || existing.photoInAM;
          existing.locationInAM = location || existing.locationInAM;
          existing.latInAM = latitude || existing.latInAM;
          existing.lngInAM = longitude || existing.lngInAM;
        } else {
          if (existing.timeInPM) return sendJson(res, 409, { message: 'Time in already recorded.' });
          existing.timeInPM = timeIn;
          existing.photoInPM = photo || existing.photoInPM;
          existing.locationInPM = location || existing.locationInPM;
          existing.latInPM = latitude || existing.latInPM;
          existing.lngInPM = longitude || existing.lngInPM;
        }
        if (session === 'AM' && !existing.timeIn) existing.timeIn = timeIn;
        existing.photo = pickLatestValue(photo, existing.photo);
        existing.location = pickLatestValue(location, existing.location);
        existing.latitude = pickLatestValue(latitude, existing.latitude);
        existing.longitude = pickLatestValue(longitude, existing.longitude);
        existing.status = computeDailyStatus(existing);
        writeDb(db);
        return sendJson(res, 200, { attendance: existing, slot: session });
      }
      const record = {
        id: `ATT-${date}-${employeeId}`,
        employeeId,
        date,
        timeIn: session === 'AM' ? timeIn : '',
        timeOut: '',
        timeInAM: session === 'AM' ? timeIn : '',
        timeOutAM: '',
        timeInPM: session === 'PM' ? timeIn : '',
        timeOutPM: '',
        photoInAM: session === 'AM' ? photo : '',
        photoOutAM: '',
        photoInPM: session === 'PM' ? photo : '',
        photoOutPM: '',
        locationInAM: session === 'AM' ? location : '',
        locationOutAM: '',
        locationInPM: session === 'PM' ? location : '',
        locationOutPM: '',
        latInAM: session === 'AM' ? latitude : '',
        lngInAM: session === 'AM' ? longitude : '',
        latOutAM: '',
        lngOutAM: '',
        latInPM: session === 'PM' ? latitude : '',
        lngInPM: session === 'PM' ? longitude : '',
        latOutPM: '',
        lngOutPM: '',
        status: computeDailyStatus({
          timeInAM: session === 'AM' ? timeIn : '',
          timeInPM: session === 'PM' ? timeIn : '',
          timeOutAM: '',
          timeOutPM: '',
          timeIn
        }),
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
      return sendJson(res, 201, { attendance: record, slot: session });
    });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timeout') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const nowPH = getPhilippineNow();
      const useServerTime = body.useServerTime !== false;
      const date = useServerTime ? nowPH.date : (body.date || nowPH.date);
      const employeeId = body.employeeId;
      const rawTime = String(body.timeOut || '').trim();
      const timeOut = useServerTime ? nowPH.time : (rawTime || nowPH.time);
      const timeWindow = classifyTimeOut(timeOut);
      if (!timeWindow.ok) {
        return sendJson(res, 400, { message: timeWindow.message });
      }
      const session = timeWindow.session;
      const photo = body.photo || '';
      const location = body.location || '';
      const latitude = body.latitude || '';
      const longitude = body.longitude || '';
      const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
      if (!existing) {
        const record = {
          id: `ATT-${date}-${employeeId}`,
          employeeId,
          date,
          timeIn: '',
          timeOut: session === 'PM' ? timeOut : '',
          timeInAM: '',
          timeOutAM: session === 'AM' ? timeOut : '',
          timeInPM: '',
          timeOutPM: session === 'PM' ? timeOut : '',
          photoInAM: '',
          photoOutAM: session === 'AM' ? photo : '',
          photoInPM: '',
          photoOutPM: session === 'PM' ? photo : '',
          locationInAM: '',
          locationOutAM: session === 'AM' ? location : '',
          locationInPM: '',
          locationOutPM: session === 'PM' ? location : '',
          latInAM: '',
          lngInAM: '',
          latOutAM: session === 'AM' ? latitude : '',
          lngOutAM: session === 'AM' ? longitude : '',
          latInPM: '',
          lngInPM: '',
          latOutPM: session === 'PM' ? latitude : '',
          lngOutPM: session === 'PM' ? longitude : '',
          status: computeDailyStatus({
            timeInAM: '',
            timeOutAM: session === 'AM' ? timeOut : '',
            timeInPM: '',
            timeOutPM: session === 'PM' ? timeOut : '',
            timeOut: session === 'PM' ? timeOut : ''
          }),
          latitude,
          longitude,
          location,
          photo
        };
        db.attendance.push(record);
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
        return sendJson(res, 201, { attendance: record, slot: session });
      }
      if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
      if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
      if (session === 'AM') {
        if (existing.timeOutAM) return sendJson(res, 409, { message: 'Time out already recorded.' });
        existing.timeOutAM = timeOut;
        existing.photoOutAM = photo || existing.photoOutAM;
        existing.locationOutAM = location || existing.locationOutAM;
        existing.latOutAM = latitude || existing.latOutAM;
        existing.lngOutAM = longitude || existing.lngOutAM;
      } else {
        if (existing.timeOutPM) return sendJson(res, 409, { message: 'Time out already recorded.' });
        existing.timeOutPM = timeOut;
        existing.photoOutPM = photo || existing.photoOutPM;
        existing.locationOutPM = location || existing.locationOutPM;
        existing.latOutPM = latitude || existing.latOutPM;
        existing.lngOutPM = longitude || existing.lngOutPM;
      }
      if (session === 'PM' && !existing.timeOut) existing.timeOut = timeOut;
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
      return sendJson(res, 200, { attendance: existing, slot: session });
    });
  }

  sendJson(res, 404, { message: 'Not found' });
}

function routeRequest(req, res) {
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
}

const app = express();
app.disable('x-powered-by');
app.use((req, res) => {
  routeRequest(req, res);
});

const PORT = process.env.PORT || 5173;
(async () => {
  try {
    await ensureSchema();
  } catch (err) {
    console.error('Database initialization failed:', err.message || err);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();
