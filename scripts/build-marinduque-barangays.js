const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'marinduque-barangays.json');

const DATASET_URLS = {
  barangays:
    'https://raw.githubusercontent.com/skyvstigreo/philippines-province-city-barangay-database/master/json/table_barangay.json',
  municipalities:
    'https://raw.githubusercontent.com/skyvstigreo/philippines-province-city-barangay-database/master/json/table_municipality.json',
  provinces:
    'https://raw.githubusercontent.com/skyvstigreo/philippines-province-city-barangay-database/master/json/table_province.json'
};

const OSM_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const MANUAL_OVERRIDES = {
  'boac|murallon': { lat: 13.44608, lng: 121.84034, source: 'manual-override' }
};

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\bbrgy\.?\b/g, 'barangay')
    .replace(/\bbarangay\b/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'sdo-attendance/1.0 (barangay-dataset-builder)',
      Accept: 'application/json',
      ...extraHeaders
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

async function fetchOfficialList() {
  const [barangays, municipalities, provinces] = await Promise.all([
    fetchJson(DATASET_URLS.barangays),
    fetchJson(DATASET_URLS.municipalities),
    fetchJson(DATASET_URLS.provinces)
  ]);

  const marinduque = provinces.find((item) => String(item.province_name || '').trim().toLowerCase() === 'marinduque');
  if (!marinduque) throw new Error('Marinduque province not found in source dataset.');

  const municipalityRows = municipalities.filter((item) => Number(item.province_id) === Number(marinduque.province_id));
  const municipalityById = new Map(
    municipalityRows.map((item) => [Number(item.municipality_id), String(item.municipality_name || '').trim()])
  );
  const municipalityIds = new Set([...municipalityById.keys()]);
  const barangayRows = barangays.filter((item) => municipalityIds.has(Number(item.municipality_id)));

  return barangayRows
    .map((item) => ({
      barangay: String(item.barangay_name || '').trim(),
      municipality: municipalityById.get(Number(item.municipality_id)) || '',
      province: 'Marinduque'
    }))
    .filter((item) => item.barangay && item.municipality);
}

async function fetchMarinduqueOsmPlaces() {
  const query = `[out:json][timeout:120];
area(3601506331)->.mar;
(
  node(area.mar)["place"~"village|hamlet|suburb|neighbourhood|quarter|locality"];
  way(area.mar)["place"~"village|hamlet|suburb|neighbourhood|quarter|locality"];
  relation(area.mar)["place"~"village|hamlet|suburb|neighbourhood|quarter|locality"];
);
out center tags;`;
  const res = await fetch(OSM_ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': 'sdo-attendance/1.0 (barangay-dataset-builder)',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: `data=${encodeURIComponent(query)}`
  });
  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data.elements) ? data.elements : [];
}

async function fetchMunicipalityCenters() {
  const query = `[out:json][timeout:60];
rel(id:3591841,3591842,3591843,3591844,3591845,3591846);
out center tags;`;
  const res = await fetch(OSM_ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': 'sdo-attendance/1.0 (barangay-dataset-builder)',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: `data=${encodeURIComponent(query)}`
  });
  if (!res.ok) return new Map();
  const data = await res.json();
  const byMunicipality = new Map();
  (Array.isArray(data.elements) ? data.elements : []).forEach((item) => {
    const name = String(item?.tags?.name || '').trim();
    const lat = Number(item?.center?.lat);
    const lng = Number(item?.center?.lon);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    byMunicipality.set(name.toLowerCase(), { lat, lng });
  });
  return byMunicipality;
}

function getElementLatLng(element) {
  const lat = Number(element?.lat ?? element?.center?.lat);
  const lng = Number(element?.lon ?? element?.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function scoreOsmNameMatch(targetName, candidateName) {
  const a = normalizeName(targetName);
  const b = normalizeName(candidateName);
  if (!a || !b) return -1;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 70;
  if (a.replace(/\s/g, '') === b.replace(/\s/g, '')) return 60;
  return -1;
}

function buildOsmIndex(elements) {
  const byNorm = new Map();
  elements.forEach((element) => {
    const name = String(element?.tags?.name || '').trim();
    const placeType = String(element?.tags?.place || '').trim().toLowerCase();
    const coords = getElementLatLng(element);
    if (!name || !coords) return;
    const key = normalizeName(name);
    if (!key) return;
    const entry = {
      name,
      placeType,
      lat: coords.lat,
      lng: coords.lng
    };
    if (!byNorm.has(key)) byNorm.set(key, []);
    byNorm.get(key).push(entry);
  });
  return byNorm;
}

function pickFromOsmIndex(barangayName, osmIndex) {
  const targetNorm = normalizeName(barangayName);
  if (!targetNorm) return null;

  let best = null;
  let bestScore = -1;
  for (const [normName, rows] of osmIndex.entries()) {
    const score = scoreOsmNameMatch(targetNorm, normName);
    if (score < 0) continue;
    const first = rows[0];
    if (!first) continue;
    const placeBonus =
      first.placeType === 'village'
        ? 8
        : first.placeType === 'hamlet'
          ? 6
          : first.placeType === 'suburb'
            ? 5
            : 2;
    const total = score + placeBonus;
    if (total > bestScore) {
      bestScore = total;
      best = first;
    }
  }
  return best;
}

async function geocodeBarangay(barangay, municipality) {
  const queryList = [
    `${barangay}, ${municipality}, Marinduque, Philippines`,
    `Barangay ${barangay}, ${municipality}, Marinduque, Philippines`
  ];

  for (const query of queryList) {
    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '5',
      addressdetails: '1',
      'accept-language': 'en',
      q: query
    });
    const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: { 'User-Agent': 'sdo-attendance/1.0 (barangay-dataset-builder)' }
    });
    if (!res.ok) continue;
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) continue;
    const picked = list.find((item) => {
      const state = String(item?.address?.state || '').toLowerCase();
      const county = String(item?.address?.county || '').toLowerCase();
      const city = String(item?.address?.city || item?.address?.town || item?.address?.municipality || '').toLowerCase();
      return state.includes('marinduque') || county.includes('marinduque') || city.includes(String(municipality).toLowerCase());
    }) || list[0];
    const lat = Number(picked?.lat);
    const lng = Number(picked?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, source: 'nominatim-search' };
    }
    await sleep(350);
  }
  return null;
}

async function buildDataset() {
  const officialList = await fetchOfficialList();
  const osmPlaces = await fetchMarinduqueOsmPlaces();
  const municipalityCenters = await fetchMunicipalityCenters();
  const osmIndex = buildOsmIndex(osmPlaces);

  const rows = [];
  let fromOsm = 0;
  let fromNominatim = 0;
  let fromManual = 0;
  let fromMunicipality = 0;

  for (let i = 0; i < officialList.length; i += 1) {
    const item = officialList[i];
    const municipality = item.municipality;
    const barangay = item.barangay;

    const overrideKey = `${municipality.toLowerCase()}|${normalizeName(barangay)}`;
    const manual = MANUAL_OVERRIDES[overrideKey];
    if (manual) {
      rows.push({
        barangay,
        municipality,
        province: 'Marinduque',
        lat: Number(manual.lat.toFixed(6)),
        lng: Number(manual.lng.toFixed(6)),
        source: manual.source
      });
      fromManual += 1;
      continue;
    }

    const match = pickFromOsmIndex(barangay, osmIndex);
    if (match) {
      rows.push({
        barangay,
        municipality,
        province: 'Marinduque',
        lat: Number(match.lat.toFixed(6)),
        lng: Number(match.lng.toFixed(6)),
        source: 'osm-place'
      });
      fromOsm += 1;
      continue;
    }

    const geocoded = await geocodeBarangay(barangay, municipality);
    if (geocoded) {
      rows.push({
        barangay,
        municipality,
        province: 'Marinduque',
        lat: Number(geocoded.lat.toFixed(6)),
        lng: Number(geocoded.lng.toFixed(6)),
        source: geocoded.source
      });
      fromNominatim += 1;
      await sleep(1100);
      continue;
    }

    const municipalityCenter = municipalityCenters.get(String(municipality).toLowerCase());
    if (municipalityCenter) {
      rows.push({
        barangay,
        municipality,
        province: 'Marinduque',
        lat: Number(municipalityCenter.lat.toFixed(6)),
        lng: Number(municipalityCenter.lng.toFixed(6)),
        source: 'municipality-centroid'
      });
      fromMunicipality += 1;
      continue;
    }

    rows.push({
      barangay,
      municipality,
      province: 'Marinduque',
      lat: null,
      lng: null,
      source: 'unresolved'
    });
  }

  rows.sort((a, b) => {
    const mun = a.municipality.localeCompare(b.municipality);
    if (mun !== 0) return mun;
    return a.barangay.localeCompare(b.barangay);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceNotes: [
      'Official barangay list from skyvstigreo/philippines-province-city-barangay-database',
      'Coordinates matched from OSM place data first, then Nominatim search fallback.'
    ],
    province: 'Marinduque',
    municipalities: [...new Set(rows.map((r) => r.municipality))],
    counts: {
      total: rows.length,
      osmPlace: fromOsm,
      nominatim: fromNominatim,
      manualOverride: fromManual,
      municipalityCentroid: fromMunicipality,
      unresolved: rows.filter((r) => !Number.isFinite(r.lat) || !Number.isFinite(r.lng)).length
    },
    barangays: rows
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

buildDataset()
  .then((payload) => {
    console.log(`Generated ${OUT_PATH}`);
    console.log(JSON.stringify(payload.counts, null, 2));
  })
  .catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exitCode = 1;
  });
