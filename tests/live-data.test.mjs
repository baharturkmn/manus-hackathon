import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePercent, parseDate, parseDamRecords, parseMgmDaily, describeHadise, knownFutureDays, loadLiveReservoir, loadLiveForecast } from '../live-data.mjs';

test('percent parser accepts Turkish decimals and 0–1 ratios, rejects junk', () => {
  assert.equal(parsePercent('38,11'), 38.11);
  assert.equal(parsePercent('%38.11'), 38.11);
  assert.ok(Math.abs(parsePercent(0.3811) - 38.11) < 1e-9);
  assert.equal(parsePercent(''), null);
  assert.equal(parsePercent('abc'), null);
  assert.equal(parsePercent(140), null);
});

test('date parser reads ISO and Turkish day-first dates', () => {
  assert.equal(parseDate('2026-10-29T00:00:00').toISOString().slice(0, 10), '2026-10-29');
  assert.equal(parseDate('29.10.2026').toISOString().slice(0, 10), '2026-10-29');
  assert.equal(parseDate('dün'), null);
});

test('dam records are sorted by date, give latest general value, trend and lowest dam', () => {
  const fields = [{ id: '_id' }, { id: 'Tarih' }, { id: 'Genel Doluluk Oranı' }, { id: 'Ömerli' }, { id: 'Pabuçdere' }];
  const records = [
    { Tarih: '29.10.2026', 'Genel Doluluk Oranı': '36,40', 'Ömerli': '40,1', 'Pabuçdere': '1,9' },
    { Tarih: '27.10.2026', 'Genel Doluluk Oranı': '36,80', 'Ömerli': '40,5', 'Pabuçdere': '2,1' },
    { Tarih: '28.10.2026', 'Genel Doluluk Oranı': '36,60', 'Ömerli': '40,3', 'Pabuçdere': '2,0' }
  ];
  const parsed = parseDamRecords(fields, records);
  assert.equal(parsed.latest.occupancy, 36.4);
  assert.equal(parsed.latest.date.toISOString().slice(0, 10), '2026-10-29');
  assert.deepEqual(parsed.trend.map(point => point.date), ['27 Eki', '28 Eki', '29 Eki']);
  assert.equal(parsed.criticalDam.name, 'Pabuçdere');
  assert.equal(parsed.criticalDam.occupancy, 1.9);
});

test('English column names and ratio values are understood', () => {
  const parsed = parseDamRecords(['DATE', 'GENERAL_DAM_OCCUPANCY_RATE'], [{ DATE: '2026-10-29', GENERAL_DAM_OCCUPANCY_RATE: 0.364 }]);
  assert.ok(Math.abs(parsed.latest.occupancy - 36.4) < 1e-9);
  assert.equal(parsed.criticalDam, null);
});

test('unrecognised datasets return null instead of an invented value', () => {
  assert.equal(parseDamRecords(['Tarih', 'Nufus'], [{ Tarih: '29.10.2026', Nufus: '15' }]), null);
  assert.equal(parseDamRecords(['Deger'], [{ Deger: '38' }]), null);
});

test('MGM daily record becomes forecast days with rain signals', () => {
  const days = parseMgmDaily({
    tarihGun1: '2026-10-30T00:00:00.000Z', hadiseGun1: 'PB', enDusukGun1: 12, enYuksekGun1: 19,
    tarihGun2: '2026-10-31T00:00:00.000Z', hadiseGun2: 'GSY', enDusukGun2: 11, enYuksekGun2: 16,
    tarihGun3: '2026-11-01T00:00:00.000Z', hadiseGun3: 'XYZ', enDusukGun3: 10, enYuksekGun3: 15
  });
  assert.equal(days.length, 3);
  assert.equal(days[0].name, 'Cuma');
  assert.equal(days[0].rainSignal, false);
  assert.equal(days[1].code, 'storm');
  assert.equal(days[1].rainSignal, true);
  assert.equal(days[2].rainSignal, null);
  // Unknown weather codes are not counted as known dry days for the 7-day rule.
  assert.equal(knownFutureDays(days, parseDate('2026-10-30')), 1);
  assert.equal(describeHadise('KGSY').rainSignal, true);
  assert.equal(describeHadise('A').rainSignal, false);
});

function fakeFetch(routes) {
  return async url => {
    const hit = Object.entries(routes).find(([fragment]) => url.includes(fragment));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => hit[1] };
  };
}

test('reservoir loader discovers a datastore resource and reads its tail', async () => {
  const fields = [{ id: 'Tarih' }, { id: 'Genel Doluluk Oranı' }];
  const result = await loadLiveReservoir({ fetchImpl: fakeFetch({
    package_search: { result: { results: [{ resources: [{ id: 'r1', datastore_active: true }, { id: 'r2', datastore_active: false }] }] } },
    'limit=0': { result: { total: 2, fields } },
    'limit=40': { result: { fields, records: [{ Tarih: '28.10.2026', 'Genel Doluluk Oranı': '36,6' }, { Tarih: '29.10.2026', 'Genel Doluluk Oranı': '36,4' }] } }
  }) });
  assert.equal(result.latest.occupancy, 36.4);
  assert.equal(result.trend.length, 2);
});

test('loaders return null when the source is unreachable', async () => {
  const failing = async () => { throw new TypeError('Failed to fetch'); };
  assert.equal(await loadLiveReservoir({ fetchImpl: failing }), null);
  assert.equal(await loadLiveForecast({ fetchImpl: failing }), null);
  assert.equal(await loadLiveForecast({ fetchImpl: fakeFetch({ merkezler: [] }) }), null);
});

test('forecast loader resolves the Istanbul station then reads daily forecast', async () => {
  const result = await loadLiveForecast({ fetchImpl: fakeFetch({
    merkezler: [{ merkezId: 1, gunlukTahminIstNo: 17060 }],
    'tahminler/gunluk?istno=17060': [{ tarihGun1: '2026-10-30T00:00:00.000Z', hadiseGun1: 'Y', enDusukGun1: 12, enYuksekGun1: 18 }]
  }) });
  assert.equal(result.forecast[0].rainSignal, true);
});
