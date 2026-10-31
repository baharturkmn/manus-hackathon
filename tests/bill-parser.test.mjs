import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBill, foldText, parseNumber } from '../bill-parser.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/bills/${name}.json`, import.meta.url), 'utf8'));
const values = result => ({ total: result.total?.value, days: result.days?.value, period: result.period?.value });

test('İSKİ phone photo: consumption from meter indexes, days from reading dates despite garbled labels', () => {
  const result = parseBill(fixture('iski-photo-ocr'));
  assert.deepEqual(values(result), { total: 8, days: 33, period: '202002' });
  assert.deepEqual(result.readings, { first: { date: '2020-01-18', index: 1022 }, last: { date: '2020-02-20', index: 1030 } });
  assert.ok(result.total.sources.includes('endeks farkı'));
});

test('other layouts are read without layout-specific rules', () => {
  assert.deepEqual(values(parseBill(fixture('synthetic-a-ocr'))), { total: 15, days: 32, period: '202609' }); // labelled list
  assert.deepEqual(values(parseBill(fixture('synthetic-b-ocr'))), { total: 11, days: 29, period: '202609' }); // table, one cell lost by OCR
  assert.deepEqual(values(parseBill(fixture('synthetic-c-ocr'))), { total: 13, days: 33, period: '202609' }); // short lines
});

test('agreeing sources give high confidence; a single source asks for a check', () => {
  const text = 'Son Okuma Tarihi 15.09.2026\nİlk Okuma Tarihi 14.08.2026\nTüketim Miktarı 15 m3\nTüketim Günü 32';
  const result = parseBill(text);
  assert.equal(result.days.value, 32);
  assert.equal(result.days.confidence, 'high'); // dates and label agree
  assert.equal(result.total.confidence, 'high'); // label and m³ unit agree
  const lone = parseBill('Tüketim Miktarı 15');
  assert.equal(lone.total.value, 15);
  assert.notEqual(lone.total.confidence, 'high');
});

test('meter indexes outweigh a misread label, and conflicts are reported', () => {
  const text = 'İlk Okuma 18/01/2020 1022\nSon Okuma 20/02/2020 1030\nToplam m3 5';
  const result = parseBill(text);
  assert.equal(result.total.value, 8);
  assert.deepEqual(result.total.alternatives, [5]);
});

test('payment and invoice dates are not mistaken for reading dates', () => {
  const text = 'Fatura Tarihi 01.10.2026\nSon Ödeme Tarihi 20.10.2026\nOkuma Tarihleri 03/09/2026 - 02/10/2026';
  const result = parseBill(text);
  assert.equal(result.days.value, 29);
  assert.equal(result.dueDate, '2026-10-20');
});

test('periods in several spellings', () => {
  assert.equal(parseBill('Dönem: 202602').period.value, '202602');
  assert.equal(parseBill('Dönem 2026/02').period.value, '202602');
  assert.equal(parseBill('Fatura Dönemi Şubat 2026').period.value, '202602');
  assert.equal(parseBill('Dönem: 02/2026').period.value, '202602');
});

test('amounts prefer the payable total', () => {
  const result = parseBill('Su Bedeli 312,50 TL\nAtıksu Bedeli 140,10 TL\nGenel Toplam 488,90 TL');
  assert.equal(result.amount.value, 488.9);
  assert.equal(parseBill('ÖDENECEK TUTAR\n36.00 TL').amount.value, 36);
});

test('nothing recognisable gives empty fields, not guesses', () => {
  const result = parseBill('Sayın abonemiz, bu ay bakım çalışması vardır.');
  assert.equal(result.total, null);
  assert.equal(result.days, null);
  assert.equal(result.readings, null);
});

test('helpers fold Turkish labels and read number formats', () => {
  assert.equal(foldText('Günlük Tüketim m³'), 'gunluk tuketim m3');
  assert.equal(foldText('TOPLAM M3'), 'toplam m3');
  assert.equal(parseNumber('1.234,56'), 1234.56);
  assert.equal(parseNumber('0,469'), 0.469);
  assert.equal(parseNumber('12.5'), 12.5);
});

test('"GÜN: 30" and "Ekim/2026" spellings', () => {
  assert.equal(parseBill('TÜKETİM: 19 M3   GÜN: 30').days.value, 30);
  assert.equal(parseBill('Günlük: 0,63').days, null); // the daily average is not a day count
  assert.equal(parseBill('E-Fatura · Dönem Ekim/2026').period.value, '202610');
});

test('a table whose header OCR lost: two similar integers are a weak reading pair', () => {
  const result = parseBill(JSON.parse(readFileSync(new URL('./fixtures/bills/synthetic-b-browser-ocr.json', import.meta.url), 'utf8')));
  assert.equal(result.total.value, 11);
  assert.notEqual(result.total.confidence, 'high'); // shown for checking
  assert.equal(result.days.value, 29);
});

test('unreadable digits are rejected instead of guessed', () => {
  const garbled = 'OKUMA: 05.00.2026 / 06.10.2026\nTUK ENDEKS: 00671\nSON ENDEKS: 00000\nYÜKEYİM: 210 W3';
  const result = parseBill(garbled);
  assert.equal(result.readings, null); // last index below first
  assert.equal(result.total, null);
});

test('layouts written after the rules (checked blind)', () => {
  const read = name => values(parseBill(fixture(name)));
  assert.deepEqual(read('holdout-d-browser-ocr'), { total: 16, days: 31, period: '202610' });
  assert.deepEqual(read('holdout-e-browser-ocr'), { total: 19, days: 30, period: '202610' });
  const blurry = parseBill(fixture('holdout-e-blurry-browser-ocr'));
  assert.equal(blurry.total, null); // too blurred: nothing invented
  assert.notEqual(blurry.days?.confidence, 'high');
});
