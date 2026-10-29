// Fetches İSKİ reservoir data (İBB open data) and the MGM daily forecast, then
// writes public/data/live.json. Run by .github/workflows/update-live-data.yml.
// Exits 1 only when neither source answered, so a failed run shows up in Actions.
import { readFile, writeFile } from 'node:fs/promises';
import { loadLiveReservoir, loadLiveForecast, buildLiveFile, sameLiveContent } from '../live-data.mjs';

const target = new URL('../public/data/live.json', import.meta.url);
const mgmHeaders = { Origin: 'https://www.mgm.gov.tr', Referer: 'https://www.mgm.gov.tr/' };

let previous = null;
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { /* first run */ }

const [reservoir, weather] = await Promise.all([
  loadLiveReservoir({ timeoutMs: 20000 }),
  loadLiveForecast({ timeoutMs: 20000, headers: mgmHeaders })
]);
console.log(`İSKİ/İBB: ${reservoir ? `ok · %${reservoir.latest.occupancy.toFixed(2)} · ${reservoir.latest.date.toISOString().slice(0, 10)}` : 'failed'}`);
console.log(`MGM: ${weather ? `ok · ${weather.forecast.length} days` : 'failed'}`);

const next = buildLiveFile({ reservoir, weather, previous });
if (sameLiveContent(next, previous)) console.log('No change in values; live.json left as is.');
else if (next.reservoir || next.forecast) {
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`);
  console.log('live.json updated.');
}
if (!reservoir && !weather) process.exitCode = 1;
