// Reads a water bill from OCR text without relying on one bill layout.
//
// OCR on phone photos garbles labels ("Toplam m³" → "Tup"), so each field is
// collected from several independent clues and the clues vote:
//   consumption (m³) – meter index difference, labelled value, number with an
//                      m³ unit, daily average × days
//   days             – difference of the two reading dates, labelled value,
//                      consumption ÷ daily average
//   period (YYYYMM)  – labelled/standalone YYYYMM, "Ekim 2026", last reading date
// Two agreeing sources give "high" confidence; one source gives "medium" or
// "low" and the page asks the user to check that field.
// Accepts several OCR passes of the same image and merges their clues.

const MONTHS = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];
const DAY_MS = 86400000;

// Lower-case, Turkish letters folded to ASCII, so labels match however OCR spells them.
export function foldText(text) {
  return String(text ?? '')
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[³²]/g, '3').replace(/\bm\s*[3?](?![a-z0-9])/g, 'm3');
}

// Common OCR slips inside numbers: O→0, l/I/|→1 when they sit between digits.
function repairDigits(line) {
  return line
    .replace(/(?<=\d)[oO](?=[\d.,/])|(?<=[\d.,/])[oO](?=\d)/g, '0')
    .replace(/(?<=\d)[lI|](?=\d)/g, '1');
}

export function parseNumber(token) {
  let text = String(token).trim();
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(text)) text = text.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(text)) text = text.replace(/,/g, ''); // 1,234.56
  else text = text.replace(',', '.');
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function makeDate(day, month, year) {
  const y = year < 100 ? 2000 + year : year;
  if (y < 2000 || y > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(y, month - 1, day));
  return date.getUTCMonth() === month - 1 ? date : null;
}

const iso = date => date.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((b - a) / DAY_MS);

const DATE_RE = /(\d{1,2})\s?[./-]\s?(\d{1,2})\s?[./-]\s?(\d{4}|\d{2})(?!\d)/g;

function classifyDateLabel(context) {
  if (/son\s*odeme|odeme\s*tarihi|vade/.test(context)) return 'due';
  if (/fatura\s*tarihi|duzenleme|tanzim/.test(context)) return 'invoice';
  if (/(ilk|onceki|eski|bas\w*)\s*(okuma|endeks|tarih)/.test(context)) return 'first';
  if (/(son|simdiki|yeni|guncel)\s*(okuma|endeks)/.test(context)) return 'last';
  if (/okuma/.test(context)) return 'reading';
  return null;
}

// Column names a bill table may use, in header order.
const COLUMN_PATTERNS = [
  ['first', /(ilk|onceki|eski)\s*(endeks|okuma|sayac)/g],
  ['last', /(son|simdiki|yeni)\s*(endeks|okuma|sayac)/g],
  ['total', /(fark|tuketim|toplam)\s*(\(?m3\)?|miktari)?/g],
  ['days', /gun\s*(sayisi|adedi)?(?!luk)/g],
  ['daily', /gunluk/g]
];

function tableColumns(line) {
  const found = [];
  for (const [field, re] of COLUMN_PATTERNS) {
    for (const match of line.matchAll(re)) {
      if (!found.some(f => f.field === field)) found.push({ field, at: match.index });
    }
  }
  // Header rows carry names, not values.
  if (/\d{2,}/.test(line)) return [];
  return found.sort((a, b) => a.at - b.at).map(f => f.field);
}

// Collects every clue from one OCR pass.
function scan(text) {
  const clues = { dates: [], readings: [], labelled: [], unitM3: [], periods: [], amounts: [], pairs: [] };
  const lines = String(text ?? '').split(/\r?\n/).map(line => repairDigits(line)).filter(line => line.trim());
  lines.forEach((raw, index) => {
    const line = foldText(raw);
    const next = foldText(lines[index + 1] || '');
    const prev = foldText(lines[index - 1] || '');
    // OCR in sparse mode often splits "label  value" into two lines, value first or second.
    // A neighbour line counts as a value only if it is just a number (optionally with a unit).
    const alone = (text) => /^\W*\d[\d.,]*\s*(m3|tl|gun)?\W*$/.test(text);
    // Dates, with the label text just before them.
    for (const match of raw.matchAll(DATE_RE)) {
      const date = makeDate(+match[1], +match[2], +match[3]);
      if (!date) continue;
      const before = foldText(raw.slice(0, match.index)).slice(-40);
      const kind = classifyDateLabel(before) || classifyDateLabel(line);
      clues.dates.push({ date, kind, line: index });
      // A reading row: a date followed on the same line by a meter index.
      const after = raw.slice(match.index + match[0].length);
      const indexMatch = after.match(/^[^\d]{0,6}(?:(?:endeks|sayac|index)\w*\W{0,3})?(\d{2,7})(?![\d.,/])/i);
      if (indexMatch) clues.readings.push({ date, value: Number(indexMatch[1]), kind, line: index });
    }
    // Two similar integers side by side ("2210  2221") look like a reading pair
    // in a table whose header OCR lost; kept as a weak clue.
    if (!DATE_RE.test(raw)) {
      const ints = [...raw.matchAll(/(?<![\d.,/])(\d{3,7})(?![\d.,/])/g)].map(m => Number(m[1]));
      for (let i = 0; i + 1 < ints.length; i += 1) {
        const used = ints[i + 1] - ints[i];
        if (used > 0 && used <= 200 && used < ints[i] * 0.2) clues.pairs.push({ first: ints[i], last: ints[i + 1], line: index });
      }
    }
    DATE_RE.lastIndex = 0;
    // Labelled meter indexes without a date on the line ("Son Endeks: 1030").
    const endeks = line.match(/(ilk|onceki|eski|son|simdiki|yeni)\s*(endeks|sayac\s*degeri|okuma\s*degeri)\D{0,12}(\d{2,7})(?![\d.,])/);
    if (endeks) clues.readings.push({ date: null, value: Number(endeks[3]), kind: /ilk|onceki|eski/.test(endeks[1]) ? 'first' : 'last', line: index });
    const endeksLabel = !endeks && line.match(/^\W*(ilk|onceki|eski|son|simdiki|yeni)\s*(endeks|sayac\s*degeri)\W*$/);
    if (endeksLabel) {
      const value = (alone(next) && next.match(/(?<![\d.,/])(\d{2,7})(?![\d.,/])/)) || (alone(prev) && prev.match(/(?<![\d.,/])(\d{2,7})(?![\d.,/])/));
      if (value) clues.readings.push({ date: null, value: Number(value[1]), kind: /ilk|onceki|eski/.test(endeksLabel[1]) ? 'first' : 'last', line: index });
    }
    // Labelled values; the value may sit on the same line or the line below.
    const labelled = (field, labelRe, valueRe) => {
      const hit = line.match(labelRe);
      if (!hit) return;
      const rest = line.slice(hit.index + hit[0].length);
      const value = rest.match(valueRe) || (!/\d/.test(rest) ? (alone(next) && next.match(valueRe)) || (alone(prev) && prev.match(valueRe)) : null);
      if (value) clues.labelled.push({ field, value: parseNumber(value[1]), line: index });
    };
    const NUM = /(\d{1,6}(?:[.,]\d{1,3})*)/;
    labelled('total', /toplam\s*(?:m3|tuketim)|tuketim\s*(?:miktari)?\s*(?:\(?m3\)?)?|su\s*tuketimi|kullanim\s*(?:miktari)?|m3\s*toplam/, NUM);
    labelled('days', /gun\s*sayisi|tuketim\s*gun\w*|gun\s*adedi|\bgun\s*[:=]/, /(\d{1,3})(?![\d.,])/);
    labelled('daily', /gunluk\s*(?:ort\w*\s*)?(?:m3|tuketim)?/, NUM);
    // "33 gün" style day counts.
    for (const match of line.matchAll(/(?<![\d.,])(\d{1,3})\s*gun(?!luk)/g)) clues.labelled.push({ field: 'days', value: Number(match[1]), weight: 1, line: index });
    // Table layout: a header row naming the columns and the values in the row below.
    const columns = tableColumns(line);
    if (columns.length >= 2) {
      const values = [...next.matchAll(/(?<![\d.,/])(\d{1,7}(?:[.,]\d{1,3})?)(?![\d/])/g)].map(m => parseNumber(m[1]));
      // A full row lines up from the right (leading text columns such as a meter
      // number are skipped); a short row, where OCR lost a cell, lines up in order.
      if (values.length >= 2) {
        const row = values.length >= columns.length ? values.slice(values.length - columns.length) : values;
        const byField = Object.fromEntries(columns.slice(0, row.length).map((column, i) => [column, row[i]]));
        if ('first' in byField && 'last' in byField) {
          clues.readings.push({ date: null, value: byField.first, kind: 'first', line: index + 1 });
          clues.readings.push({ date: null, value: byField.last, kind: 'last', line: index + 1 });
        }
        for (const field of ['total', 'days', 'daily']) if (field in byField) clues.labelled.push({ field, value: byField[field], line: index + 1 });
      }
    }
    // Numbers carrying an m³ unit ("12,5 m3").
    for (const match of line.matchAll(/(\d{1,4}(?:[.,]\d{1,3})?)\s*m3(?![a-z])/g)) clues.unitM3.push({ value: parseNumber(match[1]), line: index });
    // Amounts in TL, preferring the payable total.
    for (const match of line.matchAll(/(\d{1,6}(?:[.,]\d{3})*[.,]\d{2})\s*(?:tl|try|₺)/g)) {
      const label = line.slice(0, match.index);
      const weight = /odenecek|genel\s*toplam|toplam\s*tutar|fatura\s*tutari/.test(label) ? 3 : /donem\s*tutari|tutar/.test(label) ? 2 : 0;
      clues.amounts.push({ value: parseNumber(match[1]), weight });
    }
    if (/odenecek\s*tutar|genel\s*toplam/.test(line) && !/\d[.,]\d{2}\s*(tl|try)/.test(line)) {
      const below = next.match(/(\d{1,6}(?:[.,]\d{3})*[.,]\d{2})\s*(?:tl|try|₺)?/);
      if (below) clues.amounts.push({ value: parseNumber(below[1]), weight: 3 });
    }
    // Billing period: 202602, 2026/02, 02/2026, "Şubat 2026".
    for (const match of line.matchAll(/(?<![\d/.])(20\d{2})\s?[/-]?\s?(0[1-9]|1[0-2])(?![\d/.])/g)) {
      clues.periods.push({ value: `${match[1]}${match[2]}`, weight: /donem/.test(line) ? 3 : 1 });
    }
    for (const match of line.matchAll(/(?<![\d/.])(0?[1-9]|1[0-2])\s?\/\s?(20\d{2})(?![\d/.])/g)) {
      clues.periods.push({ value: `${match[2]}${String(match[1]).padStart(2, '0')}`, weight: /donem/.test(line) ? 3 : 1 });
    }
    for (const match of line.matchAll(new RegExp(`(${MONTHS.join('|')})\\s*[/.,-]?\\s*(20\\d{2})`, 'g'))) {
      clues.periods.push({ value: `${match[2]}${String(MONTHS.indexOf(match[1]) + 1).padStart(2, '0')}`, weight: /donem/.test(line) ? 3 : 2 });
    }
  });
  return clues;
}

function merge(passes) {
  const all = { dates: [], readings: [], labelled: [], unitM3: [], periods: [], amounts: [], pairs: [] };
  for (const clues of passes) for (const key of Object.keys(all)) all[key].push(...clues[key]);
  return all;
}

// Picks the two meter readings: dated rows first (oldest → newest), else labelled indexes.
function pickReadings(readings) {
  const dated = new Map();
  for (const reading of readings.filter(r => r.date)) {
    const key = iso(reading.date);
    const list = dated.get(key) || [];
    list.push(reading.value);
    dated.set(key, list);
  }
  const mostCommon = values => [...values.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0][0];
  const rows = [...dated].map(([day, values]) => ({ date: new Date(`${day}T00:00:00Z`), value: mostCommon(values) })).sort((a, b) => a.date - b.date);
  for (let i = rows.length - 1; i > 0; i -= 1) {
    for (let j = i - 1; j >= 0; j -= 1) {
      const gap = daysBetween(rows[j].date, rows[i].date);
      const used = rows[i].value - rows[j].value;
      if (gap >= 7 && gap <= 120 && used >= 0 && used <= 1000) return { first: rows[j], last: rows[i] };
    }
  }
  const first = readings.find(r => !r.date && r.kind === 'first');
  const last = readings.find(r => !r.date && r.kind === 'last');
  if (first && last && last.value >= first.value && last.value - first.value <= 1000) return { first: { date: null, value: first.value }, last: { date: null, value: last.value } };
  return null;
}

// Reading dates when there are no reading rows: labelled first/last, else the
// pair of non-payment dates whose gap looks like a billing period.
function pickReadingDates(dates) {
  const unique = (list) => [...new Map(list.map(d => [iso(d.date), d])).values()].sort((a, b) => a.date - b.date);
  const first = unique(dates.filter(d => d.kind === 'first'));
  const last = unique(dates.filter(d => d.kind === 'last'));
  if (first.length && last.length) {
    const gap = daysBetween(first[0].date, last.at(-1).date);
    if (gap >= 7 && gap <= 120) return { first: first[0].date, last: last.at(-1).date };
  }
  const candidates = unique(dates.filter(d => d.kind !== 'due' && d.kind !== 'invoice'));
  let best = null;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const gap = daysBetween(candidates[i].date, candidates[j].date);
      if (gap < 20 || gap > 70) continue;
      const labelled = (candidates[i].kind ? 1 : 0) + (candidates[j].kind ? 1 : 0);
      const score = labelled * 10 - Math.abs(gap - 30);
      if (!best || score > best.score) best = { first: candidates[i].date, last: candidates[j].date, score };
    }
  }
  return best;
}

function uniquePairs(pairs) {
  return [...new Map(pairs.map(p => [`${p.first}-${p.last}`, p])).values()];
}

// Groups numeric votes (values within `tolerance` agree) and returns the winner.
function vote(votes, tolerance) {
  const groups = [];
  for (const v of votes.filter(v => v.value !== null && Number.isFinite(v.value))) {
    const group = groups.find(g => Math.abs(g.value - v.value) <= tolerance(g.value));
    if (group) { group.weight += v.weight; group.sources.add(v.source); } else groups.push({ value: v.value, weight: v.weight, sources: new Set([v.source]) });
  }
  groups.sort((a, b) => b.weight - a.weight);
  const winner = groups[0];
  if (!winner) return null;
  const conflict = groups.length > 1 && groups[1].weight >= winner.weight * 0.75;
  const confidence = winner.sources.size >= 2 && !conflict ? 'high' : winner.weight >= 3 && !conflict ? 'medium' : 'low';
  return { value: winner.value, confidence, sources: [...winner.sources], alternatives: groups.slice(1).map(g => g.value) };
}

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

export function parseBill(ocrTexts) {
  const texts = Array.isArray(ocrTexts) ? ocrTexts : [ocrTexts];
  const clues = merge(texts.map(scan));
  const readings = pickReadings(clues.readings);
  const readingDates = readings?.first.date && readings?.last.date
    ? { first: readings.first.date, last: readings.last.date }
    : pickReadingDates(clues.dates);
  const labelled = field => clues.labelled.filter(l => l.field === field && l.value !== null);
  const dailyVotes = labelled('daily').filter(l => l.value > 0 && l.value < 10).map(l => ({ value: l.value, weight: 2, source: 'etiket' }));
  const daily = vote(dailyVotes, () => 0.005);

  const dayVotes = [];
  if (readingDates) dayVotes.push({ value: daysBetween(readingDates.first, readingDates.last), weight: 3, source: 'okuma tarihleri' });
  for (const l of labelled('days')) if (Number.isInteger(l.value) && l.value >= 7 && l.value <= 120) dayVotes.push({ value: l.value, weight: l.weight ?? 2, source: l.weight === 1 ? '"gün" yazımı' : 'etiket' });
  const totalVotes = [];
  if (readings) totalVotes.push({ value: readings.last.value - readings.first.value, weight: 3, source: 'endeks farkı' });
  else for (const pair of uniquePairs(clues.pairs)) totalVotes.push({ value: pair.last - pair.first, weight: 2, source: 'olası endeks çifti' });
  for (const l of labelled('total')) if (l.value >= 0 && l.value <= 1000) totalVotes.push({ value: l.value, weight: 2, source: 'etiket' });
  for (const u of clues.unitM3) if (u.value > 0 && u.value <= 1000 && !(daily && Math.abs(u.value - daily.value) < 0.005)) totalVotes.push({ value: u.value, weight: 1, source: 'm³ birimi' });
  // Cross-checks through the daily average.
  const firstDays = vote(dayVotes, () => 1);
  const firstTotal = vote(totalVotes, v => Math.max(0.05, v * 0.02));
  if (daily && firstDays) totalVotes.push({ value: round(daily.value * firstDays.value, 1), weight: 1, source: 'günlük ortalama × gün' });
  if (daily && firstTotal && !firstDays) dayVotes.push({ value: Math.round(firstTotal.value / daily.value), weight: 1, source: 'toplam ÷ günlük ortalama' });
  const total = vote(totalVotes, v => Math.max(0.6, v * 0.06));
  const days = vote(dayVotes, () => 1);

  const periodVotes = clues.periods.map(p => ({ value: Number(p.value), weight: p.weight, source: p.weight >= 3 ? 'etiket' : 'tarih biçimi' }));
  if (readingDates) periodVotes.push({ value: Number(iso(readingDates.last).slice(0, 7).replace('-', '')), weight: 1, source: 'son okuma tarihi' });
  const period = vote(periodVotes, () => 0);
  const amountVotes = clues.amounts.filter(a => a.value > 0 && a.weight > 0).map(a => ({ value: a.value, weight: a.weight, source: 'etiket' }));
  const amount = vote(amountVotes, () => 0.001);
  const due = clues.dates.find(d => d.kind === 'due')?.date || null;

  // A labelled value that agrees with the index difference (or dates) to
  // within OCR rounding is replaced by the exact structural value.
  const field = (result, digits) => result && { value: round(result.value, digits), confidence: result.confidence, sources: result.sources, alternatives: result.alternatives };
  return {
    total: field(total, 2),
    days: days && { ...field(days, 0), value: Math.round(days.value) },
    period: period && { ...field(period, 0), value: String(period.value) },
    daily: field(daily, 3),
    amount: field(amount, 2),
    readings: readings && {
      first: { date: readings.first.date ? iso(readings.first.date) : (readingDates ? iso(readingDates.first) : null), index: readings.first.value },
      last: { date: readings.last.date ? iso(readings.last.date) : (readingDates ? iso(readingDates.last) : null), index: readings.last.value }
    },
    readingDates: readingDates && { first: iso(readingDates.first), last: iso(readingDates.last) },
    dueDate: due ? iso(due) : null
  };
}
