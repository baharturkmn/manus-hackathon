// Live city data loaders. scripts/update-live-data.mjs runs them server-side
// (hourly GitHub Action) and writes public/data/live.json, which the page reads.
// Every loader returns null instead of guessing when a source is unreachable or
// its markup changed; the page then keeps the last good values (or the dated
// 12 October 2026 snapshot) and says so.
//
// Reservoir data: İSKİ and İBB only answer Turkish IPs, so İSKİ's published
// figures are read from dolulukorani.com, which republishes them daily.
export const DOLULUK_URL = 'https://www.dolulukorani.com/il/istanbul';
export const DOLULUK_SOURCE = 'dolulukorani.com · İSKİ verisi';
export const MGM_SERVICE_BASE = 'https://servis.mgm.gov.tr/web';
export const MGM_CITY = 'İstanbul';

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

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

const TR_MONTHS_LONG = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];

// "29 Ekim 2026" → Date (UTC midnight).
export function parseTurkishDate(text) {
  const match = String(text ?? '').trim().toLocaleLowerCase('tr').match(/^(\d{1,2})\s+(\p{L}+)\s+(\d{4})/u);
  const month = match ? TR_MONTHS_LONG.indexOf(match[2]) : -1;
  return month >= 0 ? new Date(Date.UTC(+match[3], month, +match[1])) : null;
}

function cellText(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function readTables(html) {
  return (String(html).match(/<table[\s\S]*?<\/table>/g) || []).map(table => ({
    headers: [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(match => cellText(match[1]).toLocaleLowerCase('tr')),
    rows: [...table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)].map(([, attrs, body]) => ({
      group: /dam-group-row/.test(attrs) ? cellText(body).toLocaleLowerCase('tr') : null,
      cells: [...body.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(match => cellText(match[1]))
    }))
  }));
}

// Reads the Istanbul page of dolulukorani.com: the "Tarih / Doluluk / Günlük
// değişim" table gives the latest İSKİ measurement and recent trend, the
// "Baraj Adı … Doluluk Oranı" table the single dams (only the measured group,
// which the city rate is computed from). Returns null when the tables are gone.
export function parseDolulukPage(html, trendLength = 5) {
  const tables = readTables(html);
  const daily = tables.find(table => table.headers[0] === 'tarih' && table.headers[1] === 'doluluk' && table.headers.some(h => h.includes('günlük')));
  const series = (daily?.rows || [])
    .map(row => ({ date: parseTurkishDate(row.cells[0]), value: parsePercent(row.cells[1]) }))
    .filter(point => point.date && point.value !== null)
    .sort((a, b) => a.date - b.date);
  if (!series.length) return null;
  const latest = series.at(-1);

  const damTable = tables.find(table => table.headers.includes('baraj adı') && table.headers.some(h => h.includes('doluluk')));
  const rateColumn = damTable ? damTable.headers.findIndex(h => h.includes('doluluk')) : -1;
  let inMeasuredGroup = true;
  const dams = [];
  for (const row of damTable?.rows || []) {
    if (row.group !== null) { inMeasuredGroup = row.group.startsWith('ölçülen'); continue; }
    const occupancy = parsePercent(row.cells[rateColumn]);
    if (inMeasuredGroup && row.cells[0] && occupancy !== null) dams.push({ name: row.cells[0].replace(/\s+Barajı$/u, ''), occupancy });
  }
  const lowest = dams.length ? dams.reduce((low, dam) => (dam.occupancy < low.occupancy ? dam : low)) : null;
  return {
    latest: { date: latest.date, occupancy: latest.value },
    trend: series.slice(-trendLength).map(point => ({ date: shortDateLabel(point.date), value: point.value, isoDate: point.date })),
    criticalDam: lowest ? { ...lowest, date: latest.date } : null
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

export async function loadLiveReservoir({ fetchImpl = globalThis.fetch, timeoutMs = 8000, log = () => {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(DOLULUK_URL, { signal: controller.signal, headers: { Accept: 'text/html', 'User-Agent': 'SuNobeti/1.0 (+https://github.com/baharturkmn/manus-hackathon)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseDolulukPage(await response.text());
    if (!parsed) log('sayfadaki doluluk tablosu tanınmadı');
    return parsed ? { ...parsed, source: DOLULUK_SOURCE } : null;
  } catch (error) {
    log(`hata: ${error?.message || error}${error?.cause ? ` · neden: ${error.cause.code || ''} ${error.cause.message || error.cause}` : ''}`);
    return null;
  } finally {
    clearTimeout(timer);
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
export function buildLiveFile({ reservoir, weather, previous = null, now = new Date() }) {
  return {
    version: 1,
    reservoir: reservoir ? {
      source: reservoir.source,
      fetchedAt: now.toISOString(),
      measuredOn: isoDay(reservoir.latest.date),
      occupancy: Number(reservoir.latest.occupancy.toFixed(2)),
      trend: reservoir.trend.map(point => ({ date: isoDay(point.isoDate), value: Number(point.value.toFixed(2)) })),
      criticalDam: reservoir.criticalDam ? { name: reservoir.criticalDam.name, occupancy: Number(reservoir.criticalDam.occupancy.toFixed(2)), measuredOn: isoDay(reservoir.criticalDam.date) } : null
    } : previous?.reservoir ?? null,
    forecast: weather ? {
      source: weather.source,
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
