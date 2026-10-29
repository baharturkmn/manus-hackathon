// Fetches the İSKİ reservoir figures (via dolulukorani.com) and the MGM daily
// forecast, then writes public/data/live.json. Run hourly by
// .github/workflows/update-live-data.yml; `npm run update-data` runs it by hand.
// Exits 1 only when every source failed, so a broken run shows up in Actions.
import { readFile, writeFile } from 'node:fs/promises';
import { loadLiveReservoir, loadLiveForecast, buildLiveFile, sameLiveContent } from '../live-data.mjs';

const target = new URL('../public/data/live.json', import.meta.url);
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

const next = buildLiveFile({ reservoir, weather, previous });
if (sameLiveContent(next, previous)) console.log('No change in values; live.json left as is.');
else if (next.reservoir || next.forecast) {
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`);
  console.log('live.json updated.');
}
if (!reservoir && !weather) process.exitCode = 1;
