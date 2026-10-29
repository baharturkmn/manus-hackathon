// Fetches İSKİ reservoir data (İBB open data) and the MGM daily forecast, then
// writes public/data/live.json. Run by .github/workflows/update-live-data.yml.
// Each source is tried directly first; if that fails and APIFY_PROXY_PASSWORD is
// set, the same requests are repeated through Apify Proxy (Turkish exit by
// default), for sources that refuse requests from GitHub's foreign runners.
// Exits 1 only when neither source answered, so a failed run shows up in Actions.
import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { fetch as proxiedFetch, ProxyAgent } from 'undici';
import { loadLiveReservoir, loadLiveForecast, buildLiveFile, sameLiveContent } from '../live-data.mjs';

const target = new URL('../public/data/live.json', import.meta.url);
const mgmHeaders = { Origin: 'https://www.mgm.gov.tr', Referer: 'https://www.mgm.gov.tr/' };
const timeoutMs = 20000;

// Proxy usernames tried in order: an explicit APIFY_PROXY_USERNAME, else Turkish
// residential IPs and then the plan's datacenter pool ("auto").
const apifyUsernames = process.env.APIFY_PROXY_USERNAME
  ? [process.env.APIFY_PROXY_USERNAME]
  : ['groups-RESIDENTIAL,country-TR', 'auto'];

// undici reports a refused proxy tunnel only as "Request was cancelled"; this
// asks Apify Proxy directly so the log shows its status code and reason.
function probeApifyProxy(username, host) {
  const auth = Buffer.from(`${username}:${process.env.APIFY_PROXY_PASSWORD}`).toString('base64');
  return new Promise(resolve => {
    const request = http.request({ host: 'proxy.apify.com', port: 8000, method: 'CONNECT', path: `${host}:443`, headers: { 'Proxy-Authorization': `Basic ${auth}` }, timeout: 20000 });
    request.on('connect', (response, socket) => { socket.destroy(); resolve(`${response.statusCode} ${response.statusMessage}`); });
    request.on('timeout', () => { request.destroy(); resolve('timeout'); });
    request.on('error', error => resolve(`error ${error.code || error.message}`));
    request.end();
  });
}

function apifyFetch(username) {
  const dispatcher = new ProxyAgent(`http://${encodeURIComponent(username)}:${encodeURIComponent(process.env.APIFY_PROXY_PASSWORD)}@proxy.apify.com:8000`);
  return (url, init = {}) => proxiedFetch(url, { ...init, dispatcher });
}

async function load(name, loader, host) {
  const direct = await loader(globalThis.fetch);
  if (direct) return { data: direct, via: 'direct' };
  if (!process.env.APIFY_PROXY_PASSWORD) {
    console.log(`${name}: direct request failed; APIFY_PROXY_PASSWORD not set, no Apify retry.`);
    return { data: null };
  }
  for (const username of apifyUsernames) {
    const proxied = await loader(apifyFetch(username));
    if (proxied) return { data: proxied, via: 'apify-proxy' };
    console.log(`${name}: Apify Proxy (${username}) failed; CONNECT ${host}: ${await probeApifyProxy(username, host)}`);
  }
  return { data: null };
}

// Temporary: inspect dolulukorani.com as an alternative reservoir source.
if (process.env.LIVE_SOURCES === 'forecast') {
  for (const url of ['https://www.dolulukorani.com/il/istanbul']) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 SuNobeti/1.0', Accept: 'text/html' } });
      const html = await response.text();
      console.log(`probe ${url}: ${response.status} ${response.headers.get('content-type')} · ${html.length} bytes`);
      const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
      tables.forEach((table, i) => console.log(`  table${i} ${table.replace(/\s+/g, ' ').slice(0, i >= 2 ? 6000 : 400)}`));
      const schedule = html.match(/schedule<\/span>([\s\S]{0,300})/);
      console.log(`  schedule ${schedule ? schedule[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : 'none'}`);
    } catch (error) {
      console.log(`probe ${url}: ${error.message} ${error.cause?.code || ''}`);
    }
  }
}

let previous = null;
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { /* first run */ }

// LIVE_SOURCES picks what this run fetches: "forecast" (GitHub-hosted job),
// "reservoir" (self-hosted job on a Turkish IP; İSKİ/İBB refuse foreign IPs) or
// "all" (default, e.g. a manual run on a machine in Turkey). A source that is
// not fetched keeps its previous block in live.json.
const sources = (process.env.LIVE_SOURCES || 'all').split(',').map(item => item.trim());
const wants = name => sources.includes('all') || sources.includes(name);
const skipped = { data: null, skipped: true };

const [reservoir, weather] = await Promise.all([
  wants('reservoir')
    ? load('İSKİ/İBB', fetchImpl => loadLiveReservoir({ fetchImpl, timeoutMs, log: line => console.log(`  [İBB] ${line}`) }), 'data.ibb.gov.tr')
    : skipped,
  wants('forecast')
    ? load('MGM', fetchImpl => loadLiveForecast({ fetchImpl, timeoutMs, headers: mgmHeaders }), 'servis.mgm.gov.tr')
    : skipped
]);
const status = (result, ok) => (result.skipped ? 'skipped' : result.data ? ok : 'failed');
console.log(`İSKİ/İBB: ${status(reservoir, reservoir.data && `ok (${reservoir.via}) · %${reservoir.data.latest.occupancy.toFixed(2)} · ${reservoir.data.latest.date.toISOString().slice(0, 10)}`)}`);
console.log(`MGM: ${status(weather, weather.data && `ok (${weather.via}) · ${weather.data.forecast.length} days`)}`);

const next = buildLiveFile({
  reservoir: reservoir.data, weather: weather.data, previous,
  via: { reservoir: reservoir.via, forecast: weather.via }
});
if (sameLiveContent(next, previous)) console.log('No change in values; live.json left as is.');
else if (next.reservoir || next.forecast) {
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`);
  console.log('live.json updated.');
}
const attempted = [reservoir, weather].filter(result => !result.skipped);
if (attempted.length && attempted.every(result => !result.data)) process.exitCode = 1;
