const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'marinduque-barangay-boundaries.json');

const FEATURE_SERVER_QUERY =
  'https://services7.arcgis.com/poQdgvLD6DHnbpsT/ArcGIS/rest/services/Administrative_Boundaries/FeatureServer/3/query';

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\bbrgy\.?\b/g, '')
    .replace(/\bbarangay\b/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function isPointLike(point) {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(parseNumber(point[0])) &&
    Number.isFinite(parseNumber(point[1]))
  );
}

function sanitizeRing(rawRing) {
  if (!Array.isArray(rawRing)) return null;
  const cleaned = rawRing
    .filter(isPointLike)
    .map((point) => [parseNumber(point[0]), parseNumber(point[1])]);
  if (cleaned.length < 3) return null;
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    cleaned.push([first[0], first[1]]);
  }
  return cleaned.length >= 4 ? cleaned : null;
}

function sanitizeRings(rawRings) {
  if (!Array.isArray(rawRings)) return [];
  return rawRings.map(sanitizeRing).filter(Boolean);
}

function getRingsBBox(rings) {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  rings.forEach((ring) => {
    ring.forEach((point) => {
      const lng = parseNumber(point[0]);
      const lat = parseNumber(point[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  });

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }

  return {
    minLat: Number(minLat.toFixed(7)),
    minLng: Number(minLng.toFixed(7)),
    maxLat: Number(maxLat.toFixed(7)),
    maxLng: Number(maxLng.toFixed(7))
  };
}

async function fetchBatch(resultOffset) {
  const params = new URLSearchParams({
    where: "PROVINCE = 'Marinduque'",
    outFields: 'OBJECTID_12,BARANGAY,MUNICIPALI,PROVINCE,GEOCODE',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'pjson',
    orderByFields: 'OBJECTID_12 ASC',
    resultRecordCount: '200',
    resultOffset: String(resultOffset)
  });
  const res = await fetch(`${FEATURE_SERVER_QUERY}?${params.toString()}`, {
    headers: {
      'User-Agent': 'sdo-attendance/1.0 (marinduque-boundary-builder)',
      Accept: 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`FeatureServer HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchAllBoundaries() {
  const all = [];
  let offset = 0;
  let guard = 0;
  while (guard < 20) {
    guard += 1;
    const payload = await fetchBatch(offset);
    const features = Array.isArray(payload?.features) ? payload.features : [];
    if (!features.length) break;
    all.push(...features);
    offset += features.length;
    if (!payload?.exceededTransferLimit) break;
  }
  return all;
}

function buildRecords(features) {
  const merged = new Map();

  features.forEach((feature) => {
    const attr = feature?.attributes || {};
    const geometry = feature?.geometry || {};
    const barangay = String(attr.BARANGAY || '').trim();
    const municipality = String(attr.MUNICIPALI || '').trim();
    const province = String(attr.PROVINCE || 'Marinduque').trim() || 'Marinduque';
    const geocode = String(attr.GEOCODE || '').trim();
    const rings = sanitizeRings(geometry.rings);
    if (!barangay || !municipality || !rings.length) return;

    const key = geocode || `${normalizeName(municipality)}|${normalizeName(barangay)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.rings.push(...rings);
      return;
    }
    merged.set(key, {
      barangay,
      municipality,
      province,
      geocode,
      rings
    });
  });

  const records = [];
  for (const row of merged.values()) {
    const bbox = getRingsBBox(row.rings);
    if (!bbox) continue;
    records.push({
      barangay: row.barangay,
      municipality: row.municipality,
      province: row.province,
      geocode: row.geocode,
      bbox,
      rings: row.rings
    });
  }

  records.sort((a, b) => {
    const mun = a.municipality.localeCompare(b.municipality);
    if (mun !== 0) return mun;
    return a.barangay.localeCompare(b.barangay);
  });
  return records;
}

async function main() {
  const features = await fetchAllBoundaries();
  const records = buildRecords(features);

  const out = {
    generatedAt: new Date().toISOString(),
    source: {
      provider: 'ArcGIS FeatureServer',
      layer:
        'https://services7.arcgis.com/poQdgvLD6DHnbpsT/ArcGIS/rest/services/Administrative_Boundaries/FeatureServer/3',
      query: "PROVINCE = 'Marinduque'"
    },
    province: 'Marinduque',
    count: records.length,
    boundaries: records
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`Saved ${records.length} boundary records to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
