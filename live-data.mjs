// Live city data loaders. scripts/update-live-data.mjs runs them server-side
// (hourly GitHub Action) and writes public/data/live.json, which the page reads.
// Every loader returns null instead of guessing when a source is unreachable or
// its schema changed; the page then keeps the dated 12 October 2026 snapshot.
export const IBB_CKAN_BASE = 'https://data.ibb.gov.tr/api/3/action';
export const MGM_SERVICE_BASE = 'https://servis.mgm.gov.tr/web';
export const MGM_CITY = 'İstanbul';

const DAM_COLUMNS = {
  omerli: 'Ömerli', darlik: 'Darlık', elmali: 'Elmalı', terkos: 'Terkos', alibey: 'Alibey',
  buyukcekmece: 'Büyükçekmece', sazlidere: 'Sazlıdere', istrancalar: 'Istrancalar',
  kazandere: 'Kazandere', pabucdere: 'Pabuçdere'
};

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function fold(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parsePercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).replace('%', '').trim().replace(',', '.'));
  if (!Number.isFinite(number) || number < 0) return null;
  // Some open-data exports store occupancy as a 0–1 ratio.
  const percent = number <= 1 ? number * 100 : number;
  return percent <= 100 ? percent : null;
}

export function parseDate(value) {
  const text = String(value ?? '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (match) return new Date(Date.UTC(+match[3], +match[2] - 1, +match[1]));
  return null;
}

export function shortDateLabel(date) {
  return `${String(date.getUTCDate()).padStart(2, '0')} ${TR_MONTHS[date.getUTCMonth()]}`;
}

export function numericDateLabel(date) {
  return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`;
}

function findField(fieldIds, patterns) {
  return fieldIds.find(id => patterns.some(pattern => pattern.test(fold(id))));
}

// Reads a CKAN datastore page of İSKİ reservoir records. Accepts either a
// general-occupancy column or per-dam columns; returns null if neither exists.
export function parseDamRecords(fields, records, trendLength = 5) {
  const fieldIds = (fields || []).map(field => field.id ?? field).filter(id => id !== '_id');
  const dateField = findField(fieldIds, [/^tarih/, /^date/]);
  if (!dateField || !Array.isArray(records)) return null;
  const generalField = findField(fieldIds, [/genel.*doluluk/, /general.*occupancy/, /^doluluk(orani)?$/]);
  const damFields = fieldIds.filter(id => DAM_COLUMNS[fold(id)]);
  const rows = records
    .map(record => {
      const date = parseDate(record[dateField]);
      const dams = damFields
        .map(id => ({ name: DAM_COLUMNS[fold(id)], occupancy: parsePercent(record[id]) }))
        .filter(dam => dam.occupancy !== null);
      return { date, general: generalField ? parsePercent(record[generalField]) : null, dams };
    })
    .filter(row => row.date)
    .sort((a, b) => a.date - b.date);
  const general = rows.filter(row => row.general !== null);
  const withDams = rows.filter(row => row.dams.length);
  if (!general.length && !withDams.length) return null;
  const latestDams = withDams.at(-1);
  const lowestDam = latestDams ? latestDams.dams.reduce((low, dam) => (dam.occupancy < low.occupancy ? dam : low)) : null;
  return {
    latest: general.length ? { date: general.at(-1).date, occupancy: general.at(-1).general } : null,
    trend: general.slice(-trendLength).map(row => ({ date: shortDateLabel(row.date), value: row.general, isoDate: row.date })),
    criticalDam: lowestDam ? { ...lowestDam, date: latestDams.date } : null
  };
}

// MGM "hadise" codes. Precipitation codes end in Y (yağış/yağmur) or are
// snow/hail. Unknown codes carry rainSignal: null and are not counted as a
// known forecast day, so the critical rule never treats them as "dry".
const HADISE = {
  A: ['Açık', 'clear'], AB: ['Az Bulutlu', 'cloud'], PB: ['Parçalı Bulutlu', 'cloud'], CB: ['Çok Bulutlu', 'cloud'],
  SIS: ['Sisli', 'cloud'], PUS: ['Puslu', 'cloud'], DMN: ['Dumanlı', 'cloud'], KF: ['Toz veya Kum Fırtınası', 'cloud'],
  R: ['Rüzgarlı', 'cloud'], GKR: ['Güneyli Kuvvetli Rüzgar', 'cloud'], KKR: ['Kuzeyli Kuvvetli Rüzgar', 'cloud'],
  SCK: ['Sıcak', 'clear'], SGK: ['Soğuk', 'cloud'],
  HY: ['Hafif Yağmurlu', 'rain'], Y: ['Yağmurlu', 'rain'], KY: ['Kuvvetli Yağmurlu', 'rain'],
  HSY: ['Hafif Sağanak Yağışlı', 'rain'], SY: ['Sağanak Yağışlı', 'rain'], KSY: ['Kuvvetli Sağanak Yağışlı', 'rain'],
  MSY: ['Mevzi Sağanak Yağışlı', 'rain'], GSY: ['Gökgürültülü Sağanak Yağışlı', 'storm'],
  KGSY: ['Kuvvetli Gökgürültülü Sağanak Yağışlı', 'storm'], KKY: ['Karla Karışık Yağmurlu', 'rain'],
  HKY: ['Hafif Kar Yağışlı', 'rain'], K: ['Kar Yağışlı', 'rain'], YKY: ['Yoğun Kar Yağışlı', 'rain'], DY: ['Dolu', 'rain']
};

export function describeHadise(code) {
  const key = String(code || '').trim().toUpperCase();
  const known = HADISE[key];
  if (!known) return { event: key || 'Bilinmiyor', code: 'unknown', rainSignal: null };
  return { event: known[0], code: known[1], rainSignal: known[1] === 'rain' || known[1] === 'storm' };
}

// Parses one record of MGM's daily forecast service (tarihGunN / hadiseGunN /
// enDusukGunN / enYuksekGunN).
export function parseMgmDaily(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const days = [];
  for (let index = 1; index <= 10; index += 1) {
    const date = parseDate(entry[`tarihGun${index}`]);
    if (!date) continue;
    const hadise = describeHadise(entry[`hadiseGun${index}`]);
    days.push({
      date: shortDateLabel(date), isoDate: date, name: TR_DAYS[date.getUTCDay()],
      ...hadise,
      low: Number.isFinite(Number(entry[`enDusukGun${index}`])) ? Math.round(Number(entry[`enDusukGun${index}`])) : null,
      high: Number.isFinite(Number(entry[`enYuksekGun${index}`])) ? Math.round(Number(entry[`enYuksekGun${index}`])) : null
    });
  }
  return days.length ? days : null;
}

// Days after `today` (Istanbul calendar date) whose weather code was understood.
export function knownFutureDays(forecast, today) {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return forecast.filter(day => day.isoDate && day.isoDate.getTime() > start && day.rainSignal !== null).length;
}

export function istanbulToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parseDate(parts);
}

async function fetchJson(fetchImpl, url, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json', ...headers } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Finds İSKİ dam datasets on the İBB open data portal and reads their newest records.
// `log` receives diagnostic lines (resources tried, fields seen, errors).
export async function loadLiveReservoir({ fetchImpl = globalThis.fetch, timeoutMs = 8000, maxResources = 6, log = () => {} } = {}) {
  try {
    const search = await fetchJson(fetchImpl, `${IBB_CKAN_BASE}/package_search?q=${encodeURIComponent('baraj doluluk')}&rows=10`, timeoutMs);
    const packages = search?.result?.results || [];
    log(`package_search: ${packages.length} paket`);
    packages.forEach(pkg => (pkg.resources || []).forEach(resource => log(`  ${pkg.name} / ${resource.name} · ${resource.format} · datastore=${Boolean(resource.datastore_active)} · ${resource.id}`)));
    const resources = packages
      .flatMap(pkg => pkg.resources || [])
      .filter(resource => resource.datastore_active)
      .slice(0, maxResources);
    let latest = null, trend = [], criticalDam = null;
    for (const resource of resources) {
      const id = encodeURIComponent(resource.id);
      const head = await fetchJson(fetchImpl, `${IBB_CKAN_BASE}/datastore_search?resource_id=${id}&limit=0`, timeoutMs);
      const total = Number(head?.result?.total) || 0;
      if (!total) continue;
      // Records are appended chronologically; read the tail and sort by parsed date,
      // because date columns are often stored as text.
      const page = await fetchJson(fetchImpl, `${IBB_CKAN_BASE}/datastore_search?resource_id=${id}&limit=40&offset=${Math.max(0, total - 40)}`, timeoutMs);
      const parsed = parseDamRecords(page?.result?.fields || head?.result?.fields, page?.result?.records);
      log(`  ${resource.id}: ${total} kayıt · alanlar: ${(page?.result?.fields || []).map(field => field.id).join(', ')} · son kayıt: ${JSON.stringify(page?.result?.records?.at(-1) ?? null).slice(0, 300)} · ${parsed ? 'okundu' : 'tanınmadı'}`);
      if (!parsed) continue;
      if (parsed.latest && (!latest || parsed.latest.date > latest.date)) { latest = parsed.latest; trend = parsed.trend; }
      if (parsed.criticalDam && (!criticalDam || parsed.criticalDam.date > criticalDam.date)) criticalDam = parsed.criticalDam;
      if (latest && criticalDam) break;
    }
    return latest ? { latest, trend, criticalDam, source: 'İBB Açık Veri Portalı · İSKİ' } : null;
  } catch (error) {
    log(`hata: ${error?.message || error}`);
    return null;
  }
}

export async function loadLiveForecast({ fetchImpl = globalThis.fetch, timeoutMs = 8000, headers = {} } = {}) {
  try {
    const centres = await fetchJson(fetchImpl, `${MGM_SERVICE_BASE}/merkezler?il=${encodeURIComponent(MGM_CITY)}`, timeoutMs, headers);
    const centre = (Array.isArray(centres) ? centres : []).find(item => item?.gunlukTahminIstNo);
    if (!centre) return null;
    const daily = await fetchJson(fetchImpl, `${MGM_SERVICE_BASE}/tahminler/gunluk?istno=${encodeURIComponent(centre.gunlukTahminIstNo)}`, timeoutMs, headers);
    const forecast = parseMgmDaily(Array.isArray(daily) ? daily[0] : daily);
    return forecast ? { forecast, source: 'MGM servis.mgm.gov.tr' } : null;
  } catch {
    return null;
  }
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

// Shapes freshly loaded data for public/data/live.json. A source that failed
// this run keeps its previous good block, so one outage does not blank the page.
// `via` records how each source was reached ('direct' or 'apify-proxy').
export function buildLiveFile({ reservoir, weather, previous = null, now = new Date(), via = {} }) {
  return {
    version: 1,
    reservoir: reservoir ? {
      source: reservoir.source,
      via: via.reservoir ?? 'direct',
      fetchedAt: now.toISOString(),
      measuredOn: isoDay(reservoir.latest.date),
      occupancy: Number(reservoir.latest.occupancy.toFixed(2)),
      trend: reservoir.trend.map(point => ({ date: isoDay(point.isoDate), value: Number(point.value.toFixed(2)) })),
      criticalDam: reservoir.criticalDam ? { name: reservoir.criticalDam.name, occupancy: Number(reservoir.criticalDam.occupancy.toFixed(2)), measuredOn: isoDay(reservoir.criticalDam.date) } : null
    } : previous?.reservoir ?? null,
    forecast: weather ? {
      source: weather.source,
      via: via.forecast ?? 'direct',
      fetchedAt: now.toISOString(),
      days: weather.forecast.map(day => ({ date: isoDay(day.isoDate), event: day.event, code: day.code, rainSignal: day.rainSignal, low: day.low, high: day.high }))
    } : previous?.forecast ?? null
  };
}

// Content comparison that ignores fetch timestamps, so the hourly job only
// commits when a value actually changed.
export function sameLiveContent(a, b) {
  const strip = file => JSON.stringify(file, (key, value) => (key === 'fetchedAt' ? undefined : value));
  return Boolean(a && b) && strip(a) === strip(b);
}

const FORECAST_MAX_AGE_MS = 36 * 60 * 60 * 1000;
const RESERVOIR_STALE_DAYS = 3;

// Turns live.json back into the shapes app.js renders. Forecast days that are
// already past are dropped, and a forecast older than 36 h is ignored entirely
// rather than feeding an outdated rain signal into the critical-mode rule.
export function readLiveFile(file, now = new Date()) {
  if (!file || file.version !== 1) return { reservoir: null, weather: null };
  const today = istanbulToday(now);
  let reservoir = null;
  const r = file.reservoir;
  const measured = parseDate(r?.measuredOn);
  if (measured && Number.isFinite(r.occupancy)) {
    const trend = (r.trend || [])
      .map(point => ({ isoDate: parseDate(point.date), value: point.value }))
      .filter(point => point.isoDate && Number.isFinite(point.value))
      .map(point => ({ ...point, date: shortDateLabel(point.isoDate) }));
    const damDate = parseDate(r.criticalDam?.measuredOn);
    reservoir = {
      source: r.source,
      fetchedAt: new Date(r.fetchedAt),
      latest: { date: measured, occupancy: r.occupancy },
      trend,
      criticalDam: damDate && Number.isFinite(r.criticalDam.occupancy) ? { name: r.criticalDam.name, occupancy: r.criticalDam.occupancy, date: damDate } : null,
      stale: (today - measured) / 86400000 > RESERVOIR_STALE_DAYS
    };
  }
  let weather = null;
  const f = file.forecast;
  const fetchedAt = new Date(f?.fetchedAt);
  if (f && Number.isFinite(fetchedAt.getTime()) && now - fetchedAt <= FORECAST_MAX_AGE_MS) {
    const forecast = (f.days || [])
      .map(day => ({ ...day, isoDate: parseDate(day.date) }))
      .filter(day => day.isoDate && day.isoDate >= today)
      .map(day => ({ ...day, date: shortDateLabel(day.isoDate), name: TR_DAYS[day.isoDate.getUTCDay()] }));
    if (forecast.length) weather = { source: f.source, fetchedAt, forecast };
  }
  return { reservoir, weather };
}
