// Fetches İSKİ reservoir data (İBB open data) and the MGM daily forecast, then
// writes public/data/live.json. Run by .github/workflows/update-live-data.yml.
// Each source is tried directly first; if that fails and APIFY_PROXY_PASSWORD is
// set, the same requests are repeated through Apify Proxy (Turkish exit by
// default), for sources that refuse requests from GitHub's foreign runners.
// Exits 1 only when neither source answered, so a failed run shows up in Actions.
import { readFile, writeFile } from 'node:fs/promises';
import { fetch as proxiedFetch, ProxyAgent } from 'undici';
import { loadLiveReservoir, loadLiveForecast, buildLiveFile, sameLiveContent } from '../live-data.mjs';

const target = new URL('../public/data/live.json', import.meta.url);
const mgmHeaders = { Origin: 'https://www.mgm.gov.tr', Referer: 'https://www.mgm.gov.tr/' };
const timeoutMs = 20000;

function apifyFetch() {
  const password = process.env.APIFY_PROXY_PASSWORD;
  if (!password) return null;
  // Username selects proxy group/country, e.g. "groups-RESIDENTIAL,country-TR" or "auto".
  const username = process.env.APIFY_PROXY_USERNAME || 'groups-RESIDENTIAL,country-TR';
  const dispatcher = new ProxyAgent(`http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@proxy.apify.com:8000`);
  return (url, init = {}) => proxiedFetch(url, { ...init, dispatcher });
}

async function load(name, loader) {
  const direct = await loader(globalThis.fetch);
  if (direct) return { data: direct, via: 'direct' };
  const viaApify = apifyFetch();
  if (!viaApify) {
    console.log(`${name}: direct request failed; APIFY_PROXY_PASSWORD not set, no Apify retry.`);
    return { data: null };
  }
  const proxied = await loader(viaApify);
  if (!proxied) console.log(`${name}: direct and Apify Proxy requests failed.`);
  return proxied ? { data: proxied, via: 'apify-proxy' } : { data: null };
}

let previous = null;
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { /* first run */ }

const [reservoir, weather] = await Promise.all([
  load('İSKİ/İBB', fetchImpl => loadLiveReservoir({ fetchImpl, timeoutMs })),
  load('MGM', fetchImpl => loadLiveForecast({ fetchImpl, timeoutMs, headers: mgmHeaders }))
]);
console.log(`İSKİ/İBB: ${reservoir.data ? `ok (${reservoir.via}) · %${reservoir.data.latest.occupancy.toFixed(2)} · ${reservoir.data.latest.date.toISOString().slice(0, 10)}` : 'failed'}`);
console.log(`MGM: ${weather.data ? `ok (${weather.via}) · ${weather.data.forecast.length} days` : 'failed'}`);

const next = buildLiveFile({
  reservoir: reservoir.data, weather: weather.data, previous,
  via: { reservoir: reservoir.via, forecast: weather.via }
});
if (sameLiveContent(next, previous)) console.log('No change in values; live.json left as is.');
else if (next.reservoir || next.forecast) {
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`);
  console.log('live.json updated.');
}
if (!reservoir.data && !weather.data) process.exitCode = 1;
