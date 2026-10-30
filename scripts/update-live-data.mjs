// Fetches the İSKİ reservoir figures (via dolulukorani.com) and the MGM daily
// forecast, then writes public/data/live.json. Run hourly by
// .github/workflows/update-live-data.yml; `npm run update-data` runs it by hand.
// It also appends each new İSKİ reading to public/data/history.json and
// recomputes the critical mode from that history (critical-mode.mjs).
// Exits 1 only when every source failed, so a broken run shows up in Actions.
import { readFile, writeFile } from 'node:fs/promises';
import { loadLiveReservoir, loadLiveForecast, buildLiveFile, sameLiveContent } from '../live-data.mjs';
import { appendToHistory, currentMode } from '../critical-mode.mjs';

const target = new URL('../public/data/live.json', import.meta.url);
const historyTarget = new URL('../public/data/history.json', import.meta.url);
const officialTarget = new URL('../public/data/official-status.json', import.meta.url);
const mgmHeaders = { Origin: 'https://www.mgm.gov.tr', Referer: 'https://www.mgm.gov.tr/' };
const timeoutMs = 20000;

let previous = null;
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { /* first run */ }

const [reservoir, weather] = await Promise.all([
  loadLiveReservoir({ timeoutMs, log: line => console.log(`  [baraj] ${line}`) }),
  loadLiveForecast({ timeoutMs, headers: mgmHeaders })
]);
console.log(`Baraj: ${reservoir ? `ok · %${reservoir.latest.occupancy.toFixed(2)} · ${reservoir.latest.date.toISOString().slice(0, 10)} · en düşük ${reservoir.criticalDam?.name ?? '—'} %${reservoir.criticalDam?.occupancy ?? '—'}` : 'failed'}`);
console.log(`MGM: ${weather ? `ok · ${weather.forecast.length} days` : 'failed'}`);

let history = JSON.parse(await readFile(historyTarget, 'utf8'));
if (reservoir?.readings?.length) {
  const appended = appendToHistory(history, reservoir.readings);
  if (appended.changed) {
    history = appended.history;
    await writeFile(historyTarget, `${JSON.stringify(history)}\n`);
    console.log(`history.json: ${reservoir.readings.length} ölçüm işlendi, son gün ${reservoir.readings.at(-1).date}.`);
  }
}
let official = null;
try { official = JSON.parse(await readFile(officialTarget, 'utf8')); } catch { /* optional */ }
const criticalMode = currentMode(history, { official });
console.log(`Kritik mod: ${criticalMode ? `${criticalMode.level} (${criticalMode.since} itibarıyla) · doluluk %${criticalMode.indicators.occupancy} · normal %${criticalMode.indicators.normal ?? '—'} · kalan gün ${criticalMode.indicators.daysTo20 ?? '—'}${criticalMode.stale ? ' · VERİ ESKİ' : ''}` : 'hesaplanamadı'}`);

const next = buildLiveFile({ reservoir, weather, criticalMode, previous });
if (sameLiveContent(next, previous)) console.log('No change in values; live.json left as is.');
else if (next.reservoir || next.forecast) {
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`);
  console.log('live.json updated.');
}
if (!reservoir && !weather) process.exitCode = 1;
