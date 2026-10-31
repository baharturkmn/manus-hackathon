// Bill commentary: per-person use and the seasonal effect.
//
// SEASONAL_INDEX is Istanbul's average daily water supply per calendar month
// relative to that year's mean (=100), averaged over 2011–2023. Source: İBB
// Açık Veri Portalı, "İstanbul barajlarında yağış ve günlük tüketim verileri"
// (İSKİ). Year-to-year spread is 1–2.5 points, so the pattern is stable. It is
// the city total (homes, businesses, losses), used here only for its shape.
export const SEASONAL_INDEX = Object.freeze([93.8, 93.4, 93.9, 95.4, 100.6, 105.3, 107.7, 107.9, 105.8, 100.4, 98.6, 97.2]);
export const SEASONAL_SOURCE = 'İBB Açık Veri, İSKİ günlük tüketim 2011–2023';

const DAY = 864e5;
const TR_MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];

// The day a bill's consumption window ends: the last meter reading when it was
// read from the photo, otherwise the middle of the billing period (YYYYMM).
export function billEnd(bill) {
  const read = bill?.readings?.last?.date;
  if (read && Number.isFinite(Date.parse(`${read}T00:00:00Z`))) return Date.parse(`${read}T00:00:00Z`);
  const period = String(bill?.period || '');
  if (!/^\d{6}$/.test(period)) return null;
  return Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4)) - 1, 15);
}

// Average seasonal index over the bill's days.
export function billSeasonFactor(bill) {
  const end = billEnd(bill);
  const days = Number(bill?.days);
  if (end === null || !Number.isInteger(days) || days <= 0) return null;
  let sum = 0;
  for (let i = 0; i < days; i += 1) sum += SEASONAL_INDEX.at(new Date(end - i * DAY).getUTCMonth());
  return sum / days;
}

// The month a person would call the bill by: its billing period when known
// (what they typed or what is printed), else the middle of the read dates.
export function billMonthName(bill) {
  const period = String(bill?.period || '');
  if (/^\d{6}$/.test(period)) return `${TR_MONTHS.at(Number(period.slice(4)) - 1)} ${period.slice(0, 4)}`;
  const end = billEnd(bill);
  if (end === null) return null;
  const mid = new Date(end - (Number(bill.days) || 30) / 2 * DAY);
  return `${TR_MONTHS.at(mid.getUTCMonth())} ${mid.getUTCFullYear()}`;
}

const capitalize = text => text.charAt(0).toLocaleUpperCase('tr') + text.slice(1);

export function litresPerPersonDay(bill, people) {
  const n = Number(people);
  if (!Number.isInteger(n) || n < 1 || !(bill?.days > 0)) return null;
  return bill.total * 1000 / bill.days / n;
}

// The saved bill closest to one year before `current` (330–400 days), if any.
export function sameTimeLastYear(history, current) {
  const end = billEnd(current);
  if (end === null) return null;
  let best = null;
  for (const bill of history || []) {
    const e = billEnd(bill);
    if (e === null || bill === current) continue;
    const gap = (end - e) / DAY;
    if (gap >= 330 && gap <= 400 && (!best || Math.abs(gap - 365) < Math.abs((end - billEnd(best)) / DAY - 365))) best = bill;
  }
  return best;
}

const pct = v => `%${Math.abs(v * 100).toFixed(1).replace('.', ',')}`;
const litres = v => Math.round(v).toLocaleString('tr-TR');
const perDay = bill => bill.total / bill.days;

// Builds the commentary for a comparison. Each line is plain text.
// Returns { lines, perPerson, seasonal: {expected, actual, adjusted} | null, lastYear: {...} | null, needs: [] }.
export function billInsights({ previous, current, people = null, history = [] }) {
  const lines = [];
  const needs = [];
  const actual = perDay(current) / perDay(previous) - 1;

  const perPerson = litresPerPersonDay(current, people);
  const perPersonBefore = litresPerPersonDay(previous, people);
  if (perPerson !== null) {
    lines.push(`Evinde kişi başı günde yaklaşık ${litres(perPerson)} litre su kullanılıyor (önceki faturada ${litres(perPersonBefore)} litre).`);
  } else {
    needs.push('people');
  }

  const lastYearBill = sameTimeLastYear(history, current);
  // When the previous bill is itself a year earlier, one sentence covers both.
  const previousIsLastYear = lastYearBill === previous || (lastYearBill && billEnd(lastYearBill) === billEnd(previous) && lastYearBill.total === previous.total);
  let lastYear = null;
  if (lastYearBill && !previousIsLastYear) {
    const change = perDay(current) / perDay(lastYearBill) - 1;
    lastYear = { bill: lastYearBill, change };
    lines.push(`Geçen yılın aynı dönemine (${billMonthName(lastYearBill)}) göre günlük tüketimin ${pct(change)} ${change <= 0 ? 'daha az' : 'daha fazla'}. Mevsim aynı olduğu için en adil karşılaştırma bu.`);
  }

  const fPrev = billSeasonFactor(previous);
  const fCur = billSeasonFactor(current);
  let seasonal = null;
  if (fPrev !== null && fCur !== null) {
    const expected = fCur / fPrev - 1;
    const adjusted = (1 + actual) / (1 + expected) - 1;
    seasonal = { expected, actual, adjusted };
    if (previousIsLastYear) {
      lastYear = { bill: previous, change: actual };
      lines.push(`Önceki faturan yaklaşık bir yıl önceye (${billMonthName(previous)}) ait; mevsim aynı olduğu için bu en adil karşılaştırma. Günlük tüketimin ${pct(actual)} ${actual <= 0 ? 'daha az' : 'daha fazla'}.`);
    } else if (Math.abs(expected) < 0.01) {
      lines.push(`İki fatura da benzer mevsime denk geliyor; değişimi mevsim açıklamıyor.`);
    } else {
      const season = expected > 0 ? 'artar' : 'azalır';
      const verdict = Math.abs(adjusted) < 0.01
        ? 'Mevsime göre düzeltilince tüketimin aşağı yukarı aynı.'
        : `Mevsime göre düzeltilince ${pct(adjusted)} ${adjusted < 0 ? 'daha az' : 'daha fazla'} kullanmışsın.`;
      lines.push(`${capitalize(billMonthName(previous))} ile ${billMonthName(current)} arasında İstanbul'da su tüketimi normalde ${pct(expected)} ${season}. Seninki ${pct(actual)} ${actual <= 0 ? 'azaldı' : 'arttı'}. ${verdict}`);
    }
  } else {
    needs.push('period');
  }
  return { lines, perPerson, seasonal, lastYear, needs };
}
