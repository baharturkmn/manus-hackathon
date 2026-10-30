// Critical-mode rule for SuNöbeti.
//
// Every run replays the whole daily occupancy history (public/data/history.json)
// from its first day, so the 2-day entry confirmation and the 7-day exit delay
// work without storing any state: the same history always gives the same level.
//
// Thresholds were calibrated on İSKİ daily data, October 2000 – February 2024
// (İBB Açık Veri). On that history the rule reaches KRİTİK before all five
// drops below 25 % (42–302 days ahead) and never in a year whose minimum stayed
// above 40 %. Change a threshold here only together with a new backtest.
export const RULE = Object.freeze({
  kritikFloor: 25,         // KRİTİK: occupancy below this, whatever the trend
  kritikDaysTo20: 60,      // KRİTİK: at the 28-day pace, 20 % is this many days away or fewer
  kritikSeasonalOcc: 35,   // KRİTİK: occupancy below this AND …
  kritikSeasonalDiff: -20, // … at least 20 points below the seasonal normal
  dikkatOcc: 40,           // DİKKAT: occupancy below this
  dikkatSeasonalDiff: -20, // DİKKAT: at least 20 points below the seasonal normal
  exitKritikOcc: 40,       // leave KRİTİK only at or above this …
  exitDikkatOcc: 45,       // … DİKKAT only at or above this …
  exitDays: 7,             // … after this many consecutive days without a condition
  confirmDays: 2,          // a condition must hold this many consecutive days to enter
  crisisLevel: 20,         // the level "days to" counts towards
  paceWindow: 28,          // days used for the pace
  paceMinReadings: 20,     // readings needed in that window for the pace to count
  normalHalfWindow: 7,     // seasonal normal: ± this many days around the date
  normalMinYears: 5,       // seasonal normal needs at least this many earlier years
  maxDailyDrop: 2,         // a fall larger than this waits for the next reading
  staleAfterDays: 3,       // older data freezes the level and blocks notifications
  resetAfterGapDays: 180   // after a longer gap in the data the replay starts afresh
});

export const LEVELS = ['normal', 'dikkat', 'kritik'];
const DAY = 864e5;

export function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function utcDay(text) {
  const ms = Date.parse(`${String(text).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

// history.json → [{date, ms, occ}] for every calendar day (occ null when missing).
export function historyDays(history) {
  const start = utcDay(history?.start);
  if (start === null || !Array.isArray(history.values)) return [];
  return history.values.map((value, i) => {
    const ms = start + i * DAY;
    const occ = value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
    return { date: isoDay(ms), ms, occ };
  });
}

// Writes measurements ({date, value}) into the history, extending it with
// nulls up to the newest date. Returns {history, changed}.
export function appendToHistory(history, points) {
  const start = utcDay(history.start);
  const values = [...history.values];
  let changed = false;
  for (const point of points) {
    const ms = utcDay(point.date);
    const value = Number(point.value);
    if (ms === null || ms < start || !Number.isFinite(value) || value < 0 || value > 100) continue;
    const index = Math.round((ms - start) / DAY);
    while (values.length <= index) { values.push(null); changed = true; }
    const rounded = Math.round(value * 100) / 100;
    if (values[index] !== rounded) { values[index] = rounded; changed = true; }
  }
  return { history: { ...history, values }, changed };
}

// Day of year 1–365; in leap years days after 28 February shift back one so
// the same calendar day lines up across years.
function dayOfYear(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  let doy = Math.floor((ms - Date.UTC(y, 0, 1)) / DAY) + 1;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (leap && d.getUTCMonth() > 1) doy -= 1;
  return doy;
}

// Seasonal normal for every day: the mean, over EARLIER years only, of each
// year's ±7-day average around the same day of year.
export function seasonalNormals(days, rule = RULE) {
  const byYear = new Map();
  for (const day of days) {
    if (day.occ === null) continue;
    const y = new Date(day.ms).getUTCFullYear();
    if (!byYear.has(y)) byYear.set(y, new Array(366).fill(null));
    byYear.get(y)[dayOfYear(day.ms)] = day.occ;
  }
  const smooth = new Map();
  for (const [y, raw] of byYear) {
    const out = new Array(366).fill(null);
    for (let d = 1; d <= 365; d += 1) {
      let sum = 0, n = 0;
      for (let k = -rule.normalHalfWindow; k <= rule.normalHalfWindow; k += 1) {
        const v = raw.at(((d - 1 + k + 365) % 365) + 1);
        if (v !== null) { sum += v; n += 1; }
      }
      out[d] = n >= 5 ? sum / n : null;
    }
    smooth.set(y, out);
  }
  const years = [...smooth.keys()].sort((a, b) => a - b);
  const normalFor = new Map();
  for (const y of new Set(days.map(day => new Date(day.ms).getUTCFullYear()))) {
    const earlier = years.filter(year => year < y);
    const table = new Array(366).fill(null);
    for (let d = 1; d <= 365; d += 1) {
      const vals = earlier.map(year => smooth.get(year).at(d)).filter(v => v !== null);
      table[d] = vals.length >= rule.normalMinYears ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    normalFor.set(y, table);
  }
  return days.map(day => normalFor.get(new Date(day.ms).getUTCFullYear()).at(dayOfYear(day.ms)));
}

// A fall larger than maxDailyDrop counts only once the next reading (within
// 3 days) confirms it; until then that day is treated as missing.
export function confirmedReadings(days, rule = RULE) {
  const occ = days.map(day => day.occ);
  let previous = null;
  return occ.map((value, i) => {
    if (value === null) return null;
    const drop = previous !== null ? previous - value : 0;
    if (drop > rule.maxDailyDrop) {
      const next = occ.slice(i + 1, i + 4).find(v => v !== null);
      if (next === undefined || Math.abs(next - value) > 1) return null;
    }
    previous = value;
    return value;
  });
}

// Indicators for every day.
export function indicators(days, rule = RULE) {
  const occ = confirmedReadings(days, rule);
  const normals = seasonalNormals(days, rule);
  return days.map((day, i) => {
    const value = occ.at(i);
    const before = i >= rule.paceWindow ? occ.at(i - rule.paceWindow) : null;
    const readings = occ.slice(Math.max(0, i - rule.paceWindow + 1), i + 1).filter(v => v !== null).length;
    const pace = value !== null && before !== null ? (value - before) / rule.paceWindow : null;
    const paceUsable = value !== null && readings >= rule.paceMinReadings && pace !== null;
    let daysTo20 = null;
    if (value !== null && value <= rule.crisisLevel) daysTo20 = 0;
    else if (paceUsable && pace < 0) daysTo20 = (value - rule.crisisLevel) / -pace;
    const normal = normals.at(i);
    return {
      date: day.date, occ: value, normal,
      diff: value !== null && normal !== null ? value - normal : null,
      pace, readings, daysTo20: paceUsable || daysTo20 === 0 ? daysTo20 : null
    };
  });
}

export function conditions(ind, rule = RULE) {
  const diff = ind.diff ?? 0;
  const kritik = [];
  const dikkat = [];
  if (ind.occ === null) return { kritik, dikkat };
  if (ind.occ < rule.kritikFloor) kritik.push('floor');
  if (ind.daysTo20 !== null && ind.daysTo20 <= rule.kritikDaysTo20) kritik.push('pace');
  if (ind.occ < rule.kritikSeasonalOcc && diff <= rule.kritikSeasonalDiff) kritik.push('seasonal');
  if (ind.occ < rule.dikkatOcc) dikkat.push('below');
  if (diff <= rule.dikkatSeasonalDiff) dikkat.push('seasonal');
  return { kritik, dikkat };
}

// Replays the level day by day. Returns one level index (0 normal, 1 dikkat,
// 2 kritik) per day.
export function replayLevels(inds, rule = RULE) {
  const levels = [];
  let cur = 0, kStreak = 0, dStreak = 0, calmK = 0, calmD = 0, gap = 0;
  for (const ind of inds) {
    if (ind.occ === null) { gap += 1; levels.push(cur); continue; }
    // A level from before a long gap says nothing about today.
    if (gap > rule.resetAfterGapDays) { cur = 0; kStreak = 0; dStreak = 0; calmK = 0; calmD = 0; }
    gap = 0;
    const { kritik, dikkat } = conditions(ind, rule);
    const k = kritik.length > 0, d = dikkat.length > 0;
    kStreak = k ? kStreak + 1 : 0;
    dStreak = d || k ? dStreak + 1 : 0;
    if (cur < 2 && kStreak >= rule.confirmDays) { cur = 2; calmK = 0; }
    else if (cur < 1 && dStreak >= rule.confirmDays) { cur = 1; calmD = 0; }
    if (cur === 2) {
      calmK = !k && ind.occ >= rule.exitKritikOcc ? calmK + 1 : 0;
      if (calmK >= rule.exitDays) { cur = d ? 1 : 0; calmD = 0; }
    } else if (cur === 1) {
      calmD = !d && !k && ind.occ >= rule.exitDikkatOcc ? calmD + 1 : 0;
      if (calmD >= rule.exitDays) cur = 0;
    }
    levels.push(cur);
  }
  return levels;
}

const round = (v, digits) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** digits) / 10 ** digits);

// The current mode for live.json. `official` = {active, note, url} from
// public/data/official-status.json (an İSKİ cut or restriction, entered by hand).
export function currentMode(history, { now = new Date(), official = null, rule = RULE } = {}) {
  const days = historyDays(history);
  const inds = indicators(days, rule);
  const levels = replayLevels(inds, rule);
  let last = -1;
  for (let i = inds.length - 1; i >= 0; i -= 1) if (inds.at(i).occ !== null) { last = i; break; }
  if (last < 0) return null;
  const ind = inds.at(last);
  const level = levels.at(last);
  // First day of the current level, not reaching back across a stale gap.
  let since = last, prev = last - 1, missing = 0;
  while (prev >= 0) {
    if (inds.at(prev).occ === null) { missing += 1; if (missing > rule.staleAfterDays) break; prev -= 1; continue; }
    if (levels.at(prev) !== level) break;
    since = prev; missing = 0; prev -= 1;
  }
  const todayMs = utcDay(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now));
  const ageDays = Math.round((todayMs - Date.parse(`${ind.date}T00:00:00Z`)) / DAY);
  const { kritik, dikkat } = conditions(ind, rule);
  const active = level === 2 ? kritik : level === 1 ? dikkat : [];
  return {
    level: official?.active ? 'acil' : LEVELS.at(level),
    computedLevel: LEVELS.at(level),
    since: inds.at(since).date,
    measuredOn: ind.date,
    stale: ageDays > rule.staleAfterDays,
    // Conditions true on the last measured day. Empty while a level is held
    // by the exit delay ("held": true).
    reasons: active,
    held: level > 0 && active.length === 0,
    official: official?.active ? { note: String(official.note || ''), url: String(official.url || '') } : null,
    indicators: {
      occupancy: round(ind.occ, 2),
      normal: round(ind.normal, 1),
      diff: round(ind.diff, 1),
      pace28: round(ind.pace === null ? null : ind.pace * rule.paceWindow, 2),
      readings28: ind.readings,
      daysTo20: ind.daysTo20 === null ? null : Math.round(ind.daysTo20)
    },
    rule: {
      kritikFloor: rule.kritikFloor, kritikDaysTo20: rule.kritikDaysTo20, kritikSeasonalOcc: rule.kritikSeasonalOcc,
      seasonalDiff: rule.kritikSeasonalDiff, dikkatOcc: rule.dikkatOcc, crisisLevel: rule.crisisLevel, paceWindow: rule.paceWindow
    }
  };
}
