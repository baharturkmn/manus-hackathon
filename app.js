import { sortedBillHistory, resolveBillPair, calculateBillChange, validBill, validPeriod } from './bill-comparison.mjs';
import { couponCopyMarkup, copyCouponCode } from './coupon-copy.mjs';
import { getPartnerOffer, BRAND_DISCOUNTS } from './partner-offers.mjs';
import { initializeWorkspaceTabs } from './workspace-tabs.mjs';
import { initializeDemoProfile } from './demo-profile.mjs';
import { milestoneReached, recommendHabitPartner } from './habit-rewards.mjs';

const liveSnapshot = {
  verifiedAt: '12 Ekim 2026 · 10:00 TSİ',
  occupancy: 38.11,
  threshold: 35,
  criticalDam: { name: 'Pabuçdere', occupancy: 2.50 },
  forecastWindowDays: 5,
  trend: [
    { date: '01 Eki', value: 38.42 },
    { date: '05 Eki', value: 38.93 },
    { date: '08 Eki', value: 38.64 },
    { date: '09 Eki', value: 38.64 },
    { date: '12 Eki', value: 38.11 }
  ],
  forecast: [
    { date: '12 Eki', name: 'Pazartesi', event: 'Çok Bulutlu', code: 'cloud', low: 16, high: 25, rainSignal: false },
    { date: '13 Eki', name: 'Salı', event: 'Gökgürültülü Sağanak', code: 'storm', low: 15, high: 20, rainSignal: true },
    { date: '14 Eki', name: 'Çarşamba', event: 'Kuvvetli Gök Gürültülü Sağanak', code: 'storm', low: 15, high: 21, rainSignal: true },
    { date: '15 Eki', name: 'Perşembe', event: 'Kuvvetli Gök Gürültülü Sağanak', code: 'storm', low: 15, high: 18, rainSignal: true },
    { date: '16 Eki', name: 'Cuma', event: 'Gökgürültülü Sağanak', code: 'storm', low: 13, high: 16, rainSignal: true },
    { date: '17 Eki', name: 'Cumartesi', event: 'Gökgürültülü Sağanak', code: 'storm', low: 13, high: 17, rainSignal: true }
  ],
  tasks: [
    { id: 'brush', icon: 'toothbrush', text: 'Dişlerini fırçalarken musluğu kapat.', points: 20, liters: 8 },
    { id: 'shower', icon: 'shower', text: 'Duşunu kısa tut.', points: 20, liters: 20 },
    { id: 'laundry', icon: 'washing-machine', text: 'Çamaşır makinesini yalnızca tam ve gerekli bir yükte çalıştır.', points: 30, liters: 40 },
    { id: 'dishwasher', icon: 'dishwasher', text: 'Bulaşıkları biriktir; akan suyla elde yıkamak yerine bulaşık makinesinde birlikte yıka.', points: 30, liters: 30 },
    { id: 'leaks', icon: 'leak', text: 'Muslukları ve rezervuarları kaçak için kontrol et — damlayan bir musluk günde onlarca litre harcayabilir.', points: 35, liters: 40 },
    { id: 'greywater', icon: 'greywater', text: 'Sebze veya bulaşık yıkama suyunu bitkiler için yeniden kullan.', points: 25, liters: 10 },
    { id: 'shower-cold', icon: 'cold-water', text: 'Duş ısınana kadar akan soğuk suyu biriktir; bitkilerde veya sifonda kullan.', points: 25, liters: 12 },
    { id: 'watering', icon: 'watering', text: 'Bitkileri sabah erken ya da akşam geç sula; öğle buharlaşmasını azalt.', points: 20, liters: 15 }
  ],
  partners: [
    { kind: 'DİŞ FIRÇALAMA', brand: 'BrightSmile · Daily', icon: 'toothbrush', product: 'Musluk Kapat Hatırlatıcısı', offer: 'Diş fırçalama rutinine musluğu kapatma anını ekleyen paket veya uygulama eşleşmesi.', codePrefix: 'BRIGHTSMILE' },
    { kind: 'DUŞ RUTİNİ', brand: 'PureWave · Studio', icon: 'shower', product: 'Kısa Duş Zamanlayıcısı', offer: 'Duşu gereksiz yere uzatmamak için görünür, sakin ve kolay anlaşılır bir süre hatırlatıcısı.', codePrefix: 'PUREWAVE' },
    { kind: 'ÇAMAŞIR', brand: 'CleanCycle · Lab', icon: 'washing-machine', product: 'Tam Yük Eco Programı', offer: 'Küçük yük yerine gerekli tam yükü beklemeyi hatırlatan ürün etiketi veya makine içi yönlendirme.', codePrefix: 'CLEANCYCLE' },
    { kind: 'BULAŞIK', brand: 'SparkleWash · Works', icon: 'dishwasher', product: 'Biriktir, Birlikte Yıka', offer: 'Akan muslukta elde yıkamak yerine bulaşıkları biriktirip birlikte yıkamayı destekleyen rehber.', codePrefix: 'SPARKLEWASH' }
  ]
};

const taskStorageKey = 'sunobeti-tasks-v3';
const communityStorageKey = 'sunobeti-community-savings-v1';
const verifiedSavingsStorageKey = 'sunobeti-verified-savings-v1';
const verifiedHistoryStorageKey = 'sunobeti-verified-history-v1';
const billHistoryStorageKey = 'sunobeti-bill-history-v1';
const communityBaselineLiters = 12480;
const billState = { previous: {}, current: {} };

function decideMode(data) {
  const rainfallAhead = data.forecast.some(day => day.rainSignal);
  const sevenDayWindowComplete = data.forecastWindowDays >= 7;
  const critical = data.occupancy < data.threshold && sevenDayWindowComplete && !rainfallAhead;
  return { critical, rainfallAhead, sevenDayWindowComplete };
}

function applyMode(mode) {
  const pill = document.getElementById('mode-pill');
  const title = document.getElementById('mode-title');
  const description = document.getElementById('mode-description');
  const outcome = document.getElementById('logic-outcome');
  const result = document.getElementById('logic-result');
  const thresholdCheck = document.getElementById('threshold-check');
  const thresholdExpression = document.getElementById('threshold-expression');
  const thresholdResult = document.getElementById('threshold-result');
  const rainCheck = document.getElementById('rain-check');
  const reserveMeterFill = document.getElementById('reserve-meter-fill');
  reserveMeterFill.style.width = `${liveSnapshot.occupancy}%`;

  if (mode.critical) {
    document.body.classList.add('critical-mode');
    pill.className = 'mode-pill critical';
    title.textContent = 'Kritik Tasarruf Modu Aktif';
    description.textContent = 'Eşik altında rezerv, yağış sinyali yok.';
    outcome.className = 'logic-outcome critical';
    outcome.innerHTML = '<span>BUGÜNÜN ÇIKTISI</span><b>KRİTİK MOD AKTİF</b><small>Su kullanımını azaltma zamanı</small>';
    result.textContent = 'Rezerv eşik altında ve yağış görünmüyor; bu nedenle acil tasarruf tonu etkin.';
    thresholdCheck.textContent = '✓'; thresholdCheck.className = 'check-pass';
    thresholdExpression.textContent = `${liveSnapshot.occupancy.toFixed(2)}% < ${liveSnapshot.threshold}%`;
    thresholdResult.textContent = 'Evet · eşik aşılmış durumda';
    rainCheck.textContent = '✓'; rainCheck.className = 'check-pass';
  } else {
    title.textContent = 'Dikkatli Kal';
    description.textContent = 'Bugün kritik eşik aşılmadı.';
    result.textContent = `Bugün kritik eşik aşılmadığı${mode.rainfallAhead ? ' ve yağış sinyali görüldüğü' : ''} için sakin ama dikkatli kalma mesajı gösteriliyor.${!mode.sevenDayWindowComplete ? ' MGM şehir sayfası şu an 5 gün gösterdiğinden, eksik 6–7. gün için sistem varsayım yapmaz.' : ''}`;
    thresholdCheck.textContent = '×'; thresholdCheck.className = 'check-fail';
    thresholdExpression.textContent = `${liveSnapshot.occupancy.toFixed(2)}% > ${liveSnapshot.threshold}%`;
    thresholdResult.textContent = 'Hayır · eşik aşılmadı';
    rainCheck.textContent = mode.rainfallAhead ? '↗' : '✓'; rainCheck.className = mode.rainfallAhead ? 'check-warn' : 'check-pass';
  }
}

function renderChart(data) {
  const svg = document.getElementById('trend-chart');
  const width = 600, height = 200, left = 15, right = 16, top = 18, bottom = 33;
  const values = data.map(p => p.value);
  const max = Math.max(...values) + .14, min = Math.min(...values) - .16;
  const x = i => left + i * ((width - left - right) / (data.length - 1));
  const y = value => top + ((max - value) / (max - min)) * (height - top - bottom);
  const points = data.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const area = `${left},${height-bottom} ${points} ${x(data.length-1)},${height-bottom}`;
  const grid = [0, .5, 1].map(n => `<line x1="${left}" y1="${top + n*(height-top-bottom)}" x2="${width-right}" y2="${top + n*(height-top-bottom)}" stroke="rgba(12,40,51,.12)" stroke-dasharray="3 5"/>`).join('');
  const labels = data.map((p, i) => `<text x="${x(i)}" y="${height-7}" text-anchor="${i === 0 ? 'start' : i === data.length-1 ? 'end' : 'middle'}" fill="#54717a" font-family="DM Mono, monospace" font-size="10">${p.date}</text>`).join('');
  const circles = data.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="${i === data.length-1 ? 6 : 4}" fill="#087fa1" stroke="#fcfdf9" stroke-width="3"><title>${p.date}: %${p.value.toFixed(2)}</title></circle>`).join('');
  const latest = data[data.length - 1];
  svg.innerHTML = `<defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#83dcd6" stop-opacity=".52"/><stop offset="100%" stop-color="#83dcd6" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" fill="url(#areaFill)"/><polyline points="${points}" fill="none" stroke="#087fa1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${circles}<text x="${x(data.length-1)}" y="${y(latest.value)-13}" text-anchor="end" fill="#07536d" font-family="DM Mono, monospace" font-size="11" font-weight="500">%${latest.value.toFixed(2)}</text>${labels}`;
}

function renderForecast(forecast) {
  const icons = { cloud: '☁', storm: 'ϟ' };
  document.getElementById('forecast-strip').innerHTML = forecast.map((day, index) => `
    <article class="forecast-day ${index === 0 ? 'today' : ''} ${day.code === 'storm' ? 'storm' : ''}">
      <p>${day.date} · ${day.name}</p>
      <h3>${day.event}</h3>
      <div class="weather-symbol" aria-hidden="true">${icons[day.code]}</div>
      <div class="temps">${day.high}° <span>/ ${day.low}°</span></div>
    </article>`).join('');
}

function taskIcon(type) {
  const icons = {
    toothbrush: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 34 34 11"/><path d="m30 8 5 5M34 5l5 5M38 11l5 5"/><path d="M9 37c-1 3 2 6 5 5l5-5"/></svg>',
    shower: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 24h20a9 9 0 0 0-9-9v-4"/><path d="M24 11V8h8"/><path d="M13 24h22"/><path d="M19 30v3M26 30v5M33 30v3"/></svg>',
    'washing-machine': '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="7" width="30" height="34" rx="3"/><path d="M9 16h30"/><circle cx="24" cy="29" r="7"/><path d="M14 12h2M20 12h2"/></svg>',
    dishwasher: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="9" width="32" height="30" rx="3"/><path d="M8 17h32M14 23h20M14 29h20M14 35h20"/></svg>',
    leak: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 17h18v8h8"/><path d="M29 17V9h8"/><path d="M37 25c0 5-3 8-7 8s-7-3-7-8c0-3 4-8 7-12 3 4 7 9 7 12Z"/></svg>',
    greywater: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 9c0 7-5 9-5 16a9 9 0 0 0 18 0c0-7-5-9-5-16"/><path d="M30 29c5-4 9-1 10 3"/><path d="m37 28 3 4-5 1"/></svg>',
    'cold-water': '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 10h17v9h7"/><path d="M29 10V6h6"/><path d="M36 26c0 5-3 8-7 8s-7-3-7-8c0-3 4-8 7-12 3 4 7 9 7 12Z"/><path d="M12 39h25"/></svg>',
    watering: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 31h28v8H10z"/><path d="M14 31c2-9 7-13 15-13"/><path d="M29 18h7l3 5"/><path d="M18 10v5M25 8v7M32 10v5"/></svg>'
  };
  return icons[type] || icons.dishwasher;
}

function formatLiters(value) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function animateCommunityCounter(nextValue) {
  const valueEl = document.getElementById('community-liters');
  if (!valueEl) return;
  const startValue = Number(valueEl.dataset.value || communityBaselineLiters);
  const startTime = performance.now();
  const duration = 520;
  const frame = now => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startValue + (nextValue - startValue) * eased);
    valueEl.textContent = formatLiters(current);
    valueEl.dataset.value = String(current);
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  valueEl.closest('.community-counter')?.classList.remove('counter-pulse');
  requestAnimationFrame(() => valueEl.closest('.community-counter')?.classList.add('counter-pulse'));
}

function updateCommunityCounter(tasks, selected) {
  const taskLiters = tasks.filter(task => selected.includes(task.id)).reduce((sum, task) => sum + task.liters, 0);
  const total = communityBaselineLiters + taskLiters;
  localStorage.setItem(communityStorageKey, String(total));
  animateCommunityCounter(total);
  const contribution = document.getElementById('community-contribution');
  if (contribution) contribution.textContent = selected.length ? `Bu ziyarette seçtiğin görevler: +${formatLiters(taskLiters)} L` : 'Bu ziyaretteki seçimlerinle artar.';
}

function renderTasks(tasks) {
  const saved = JSON.parse(localStorage.getItem(taskStorageKey) || '[]');
  const container = document.getElementById('task-list');
  container.innerHTML = tasks.map(task => `
    <label class="task"><input type="checkbox" data-id="${task.id}" ${saved.includes(task.id) ? 'checked' : ''}><span class="task-check">✓</span><span class="task-visual">${taskIcon(task.icon)}</span><span class="task-text">${task.text}</span></label>`).join('');
  container.addEventListener('change', () => updateTaskScore(tasks));
  updateTaskScore(tasks);
}

function updateTaskScore(tasks) {
  const selected = [...document.querySelectorAll('.task input:checked')].map(input => input.dataset.id);
  localStorage.setItem(taskStorageKey, JSON.stringify(selected));
  const points = tasks.filter(task => selected.includes(task.id)).reduce((total, task) => total + task.points, 0);
  document.getElementById('task-count').textContent = selected.length;
  document.getElementById('points-value').textContent = points;
  const complete = selected.length === tasks.length;
  document.getElementById('badge-title').textContent = complete ? 'Bugünün Su Nöbetçisi' : 'Su Nöbetine Katıl';
  document.getElementById('badge-copy').textContent = complete ? 'Rozet açıldı · paylaşım kartı hazır · topluluk katkın kaydedildi.' : `${tasks.length - selected.length} görev daha · 8/8 olunca rozet ve paylaşım kartı açılır.`;
  updateCommunityCounter(tasks, selected);
  updateBadgeCard(tasks, selected);
  document.getElementById('milestone-reward').hidden = !milestoneReached(selected);
  const milestoneCoupon = document.getElementById('milestone-coupon');
  if (milestoneReached(selected) && !milestoneCoupon.hasChildNodes()) {
    milestoneCoupon.innerHTML = `<div><span>KATILIM ÖDÜLÜ · DEMO KUPONU</span><strong>PureWave</strong><small>%5 indirim · 5 tamamlanan görevle kazanıldı. Fatura gerekmez.</small></div>${couponCopyMarkup('SAVE5-PUREWAVE')}`;
  }
}

function drawBadgeCard() {
  const canvas = document.getElementById('badge-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#f4f3ec'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d5ded8'; ctx.lineWidth = 4; ctx.strokeRect(34, 34, w - 68, h - 68);
  ctx.fillStyle = '#087fa1'; ctx.beginPath(); ctx.arc(155, 160, 76, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#bff3e9'; ctx.beginPath(); ctx.moveTo(155, 100); ctx.bezierCurveTo(130, 135, 112, 149, 112, 174); ctx.arc(155, 174, 43, Math.PI, 0, true); ctx.bezierCurveTo(198, 149, 180, 135, 155, 100); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(125, 177); ctx.quadraticCurveTo(155, 155, 185, 177); ctx.stroke();
  ctx.fillStyle = '#54717a'; ctx.font = '500 26px "DM Mono", monospace'; ctx.fillText('SU NÖBETİ · İSTANBUL', 104, 340);
  ctx.fillStyle = '#0c2833'; ctx.font = '800 68px "Manrope", sans-serif'; ctx.fillText("I'm part of", 104, 500);
  ctx.fillText('SuNöbeti today', 104, 580);
  ctx.fillStyle = '#087fa1'; ctx.font = '500 28px "DM Mono", monospace'; ctx.fillText('TODAY’S RESERVOIR', 104, 735);
  ctx.fillStyle = '#0c2833'; ctx.font = '800 116px "Manrope", sans-serif'; ctx.fillText(`${liveSnapshot.occupancy.toFixed(2)}%`, 100, 875);
  ctx.fillStyle = '#54717a'; ctx.font = '400 24px "DM Mono", monospace'; ctx.fillText('İSKİ · 12.10.2026 · SU NÖBETİ', 104, 965);
}

function updateBadgeCard(tasks, selected) {
  const panel = document.getElementById('badge-panel');
  if (!panel) return;
  const complete = selected.length === tasks.length;
  panel.hidden = !complete;
  if (complete) drawBadgeCard();
}

function normalizeBillText(rawText) {
  return rawText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/³/g, '3').replace(/m\s*3/gi, 'm3').replace(/\s+/g, ' ').toLowerCase();
}

function numberAfterBillLabel(text, labelPattern, maxChars = 64) {
  const match = text.match(labelPattern);
  if (!match) return null;
  const slice = text.slice(match.index + match[0].length, match.index + match[0].length + maxChars);
  const number = slice.match(/(?:^|[^\d])([0-9]{1,5}(?:[.,][0-9]{1,2})?)/);
  return number ? Number(number[1].replace(',', '.')) : null;
}

function extractBillFields(rawText, confidence = 0) {
  const text = normalizeBillText(rawText);
  const periodMatch = text.match(/donem\s*(?:[:=])?\s*(20\d{4})/) || text.match(/\b20\d{4}\b/);
  let total = numberAfterBillLabel(text, /toplam\s*m3/i);
  let daily = numberAfterBillLabel(text, /gunluk\s*m3/i);
  let days = numberAfterBillLabel(text, /gun\s*sayisi/i);
  const amount = numberAfterBillLabel(text, /(?:donem\s*tutari|odenecek\s*tutar)/i);
  let fallbackUsed = false;
  if (total == null) {
    const totalCandidates = [...text.matchAll(/(?:tl|t)\s*(\d{1,3}(?:[.,]\d{1,2})?)/gi)]
      .map(match => Number(match[1].replace(',', '.')))
      .filter(value => value > 0 && value < 100 && Number.isFinite(value));
    total = totalCandidates.at(-1) ?? null;
    fallbackUsed = total != null;
  }
  if (daily == null) {
    const dailyToken = text.match(/\b0?24(?:4)?\b/);
    daily = dailyToken ? 0.24 : null;
    fallbackUsed = fallbackUsed || daily != null;
  }
  if (days == null) {
    const dates = [...text.matchAll(/(\d{2})[./](\d{2})[./](\d{4})/g)].map(match => new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00Z`)).filter(date => !Number.isNaN(date.getTime()));
    if (dates.length >= 2) days = Math.round(Math.abs(dates[1] - dates[0]) / 86400000);
    if (days == null && total && daily) days = Math.round(total / daily);
    fallbackUsed = fallbackUsed || days != null;
  }
  return { total, daily, period: periodMatch ? (periodMatch[1] || periodMatch[0]) : '', days, amount, confidence, fallbackUsed, rawText };
}

function formatM3(value) {
  return `${Number(value).toFixed(2).replace('.', ',')} m³`;
}

function billTips(category) {
  const labels = Object.fromEntries(liveSnapshot.tasks.map(task => [task.id, task.text]));
  const priorities = category === 'above'
    ? ['shower', 'leaks', 'laundry']
    : category === 'below'
      ? ['leaks', 'greywater', 'watering']
      : ['dishwasher', 'shower-cold', 'brush'];
  return priorities.map(id => labels[id]).filter(Boolean);
}

function billInputId(period, field) {
  return `bill-${period}-${field}`;
}

function readBillPeriod(period) {
  const totalText = document.getElementById(billInputId(period, 'total')).value.trim();
  const daysText = document.getElementById(billInputId(period, 'days')).value.trim();
  const periodText = document.getElementById(billInputId(period, 'period')).value.trim();
  return {
    total: Number(totalText), days: Number(daysText), period: periodText,
    totalEntered: totalText !== '', daysEntered: daysText !== '',
    hasInput: Boolean(totalText || daysText || periodText)
  };
}

function monthKey() {
  return '2026-10';
}

function loadStoredJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function formatPercent(value) {
  return `${Number(value).toFixed(1).replace('.', ',')}%`;
}

function saveVerifiedSavings(result) {
  localStorage.setItem(verifiedSavingsStorageKey, JSON.stringify(result));
  if (!result.eligible) return;
  const history = loadStoredJson(verifiedHistoryStorageKey, []);
  const exists = history.some(item => item.fingerprint === result.fingerprint && item.month === result.month);
  if (!exists) {
    history.push({ fingerprint: result.fingerprint, reduction: result.reduction, month: result.month });
    localStorage.setItem(verifiedHistoryStorageKey, JSON.stringify(history));
  }
}

function renderPartnerRewards() {
  const history = loadStoredJson(verifiedHistoryStorageKey, []).filter(item => item.month === monthKey());
  const users = document.getElementById('verified-users');
  const average = document.getElementById('verified-average');
  const summary = document.getElementById('verified-summary');
  const averageSavings = history.length ? history.reduce((sum, item) => sum + Number(item.reduction), 0) / history.length : 0;
  const userLabel = `${history.length} ${history.length === 1 ? 'user' : 'users'}`;
  if (users) users.textContent = userLabel;
  if (average) average.textContent = formatPercent(averageSavings);
  if (summary) summary.textContent = `Verified reductions this month: ${userLabel} · average savings: ${formatPercent(averageSavings)}.`;

}

function loadBillHistory() {
  return sortedBillHistory(loadStoredJson(billHistoryStorageKey, []));
}

function renderBillHistory() {
  const history = loadBillHistory();
  const count = document.getElementById('bill-history-count');
  const list = document.getElementById('bill-history-list');
  if (count) count.textContent = `${history.length} kayıt`;
  if (!list) return;
  list.innerHTML = history.length ? history.map((bill, index) => `
    <div class="history-item ${index === 0 ? 'latest' : ''}">
      <div><span>${index === 0 ? 'SON REFERANS' : 'GEÇMİŞ KAYIT'}</span><strong>${bill.period && /^\d{6}$/.test(bill.period) ? `${bill.period.slice(0, 4)} / ${bill.period.slice(4)}` : 'Dönem belirtilmedi'}</strong></div>
      <div><b>${formatM3(bill.total)}</b><small>${bill.days} gün · ${formatM3(bill.total / bill.days * 30)}/ay</small></div>
    </div>`).join('') : '<p class="history-empty">Henüz kayıt yok. Demo referansı ekleyebilir veya ilk faturayı kaydedebilirsin.</p>';
}

function saveBillToHistory(fields) {
  const history = loadBillHistory();
  const record = { total: Number(fields.total), days: Number(fields.days), period: fields.period || '', savedAt: new Date().toISOString() };
  const duplicate = history.some(item => item.total === record.total && item.days === record.days && item.period === record.period);
  const next = duplicate ? history : [record, ...history].slice(0, 6);
  localStorage.setItem(billHistoryStorageKey, JSON.stringify(next));
  renderBillHistory();
}

function resetCurrentBill() {
  const input = document.getElementById('bill-current-input');
  const label = document.querySelector('[data-period="current"] .bill-drop-label');
  const preview = document.getElementById('bill-current-preview');
  const status = document.getElementById('bill-current-status');
  const badge = document.getElementById('bill-current-badge');
  input.value = '';
  input.disabled = false;
  label.hidden = false;
  preview.hidden = true;
  status.textContent = 'Toplam m³ ve Gün Sayısı okunur.';
  badge.textContent = 'MANUEL GİRİŞ HAZIR';
  badge.className = 'extraction-badge';
  ['total', 'days', 'period'].forEach(field => { document.getElementById(billInputId('current', field)).value = ''; });
  document.getElementById('bill-comparison-feedback').hidden = true;
  document.getElementById('save-current-bill').hidden = true;
}

function renderBillComparison() {
  const draft = readBillPeriod('current');
  const pair = resolveBillPair(loadBillHistory(), draft);
  const feedback = document.getElementById('bill-comparison-feedback');
  const error = document.getElementById('bill-comparison-error');
  const saveButton = document.getElementById('save-current-bill');
  saveButton.hidden = !draft.hasInput || !draft.totalEntered || !draft.daysEntered || !validBill(draft);
  if (pair.error) {
    feedback.hidden = true;
    error.hidden = false;
    error.textContent = pair.error;
    localStorage.removeItem(verifiedSavingsStorageKey);
    renderPartnerRewards();
    return false;
  }
  const { previous, current, source } = pair;
  error.hidden = true;
  const { previousMonthly, currentMonthly, change, reduction, tier, eligible } = calculateBillChange(previous, current);
  const fingerprint = `${previous.total}/${previous.days}/${previous.period}-${current.total}/${current.days}/${current.period}`;
  saveVerifiedSavings({ eligible, tier, reduction, previousMonthly, currentMonthly, fingerprint, month: monthKey() });
  const category = currentMonthly > 12 ? 'above' : currentMonthly < 10 ? 'below' : 'around';
  const tips = billTips(category);
  const targetRate = currentMonthly > 12 ? 0.10 : 0.05;
  const nextTarget = currentMonthly * (1 - targetRate);
  const sourceLabel = source === 'history' ? 'Geçmişteki son iki fatura karşılaştırıldı.' : 'Yeni giriş, daha eski son referansla karşılaştırıldı.';
  const guidanceBlock = `<div class="comparison-guidance"><h4>Gelecek ay için küçük adımlar</h4><p>Aylık tüketimin ${formatM3(currentMonthly)}. Hane başına yaklaşık 10–12 m³/ay yalnızca genel bir tahmindir; hane büyüklüğü karşılaştırmayı etkiler.</p><p class="next-month-target"><b>Gelecek ay hedefin: ${formatM3(nextTarget)}/30 gün</b> · mevcut tüketimden %${targetRate * 100} daha düşük.</p><ul>${tips.map(tip => `<li>${tip}</li>`).join('')}</ul></div>`;
  const previousPeriod = /^\d{6}$/.test(previous.period) ? `${previous.period.slice(0, 4)} / ${previous.period.slice(4)}` : 'dönem belirtilmedi';
  const currentPeriod = /^\d{6}$/.test(current.period) ? `${current.period.slice(0, 4)} / ${current.period.slice(4)}` : 'dönem belirtilmedi';
  const changeLabel = change < 0 ? `−${formatPercent(reduction)}` : change > 0 ? `+${formatPercent(change)}` : '0%';
  let rewardBlock = '';
  if (eligible) {
    rewardBlock = `<div class="verified-reward ${tier === 'top' ? 'top' : ''}"><span class="reward-badge">${tier === 'top' ? 'TOP SAVER' : 'VERIFIED SAVINGS'}</span><strong>Doğrulanan tasarruf: ${formatPercent(reduction)}</strong><p>Ödülün, iki faturanın 30 güne normalize edilmiş tüketim düşüşüne göre hesaplandı; marka kartlarında hazır indirim gösterilmez.</p><button type="button" class="personal-reward-toggle" data-reward-toggle aria-expanded="false" aria-controls="personal-reward-panel">ÖDÜLÜMÜ GÖR</button><div class="personal-reward-panel" id="personal-reward-panel" hidden><label class="reward-brand-label" for="reward-brand">Alışkanlıklarına göre önerilen marka · değiştirebilirsin<select id="reward-brand">${liveSnapshot.partners.map(partner => `<option value="${partner.codePrefix}">${partner.brand.split(' · ')[0]}</option>`).join('')}</select></label><p class="reward-category-note" id="reward-category-note"></p><div id="personal-coupon-content"></div><p class="personal-reward-policy">İndirim, seçilen marka ve faturadaki doğrulanmış tüketim düşüşüne göre belirlenir. Gerçek kampanya değildir.</p></div></div>`;
  } else {
    const intro = reduction > 0 ? `Küçük bir düşüş var: ${formatPercent(reduction)}; kupon eşiği 5%.` : 'Henüz tüketim düşüşü görülmedi.';
    rewardBlock = `<div class="verified-reward support"><span class="reward-badge">HENÜZ ÖDÜL YOK</span><strong>${intro}</strong><p>Bu karşılaştırmada kupon açılmadı. Gelecek ay için aşağıdaki küçük adımlardan birini deneyebilirsin.</p></div>`;
  }
  feedback.innerHTML = `<div class="comparison-result-head"><div><p class="micro-label">PERSONAL, VERIFIED-SAVINGS LAYER</p><h3>${eligible ? 'Son faturaya göre düşüşün ödüle dönüştü.' : 'Son kayıtla arandaki fark'}</h3></div><span class="comparison-change ${tier}">${changeLabel}</span></div><p class="comparison-source">${sourceLabel} Dönem bilgisi varsa tarih sırası; yoksa kayıt sırası esas alınır.</p><p class="comparison-plain-line">Önceki kayıt: ${formatM3(previousMonthly)}/ay → Güncel fatura: ${formatM3(currentMonthly)}/ay → Değişim: ${changeLabel}</p><div class="verified-before-after"><div class="usage-panel previous"><span>ÖNCEKİ KAYIT · 30 GÜN</span><strong>${formatM3(previousMonthly)}</strong><small>${formatM3(previous.total)} · ${previous.days} gün · ${previousPeriod}</small></div><div class="verified-arrow">→</div><div class="usage-panel current"><span>GÜNCEL FATURA · 30 GÜN</span><strong>${formatM3(currentMonthly)}</strong><small>${formatM3(current.total)} · ${current.days} gün · ${currentPeriod}</small></div></div>${rewardBlock}${guidanceBlock}<p class="comparison-disclaimer">Bu kupon şehir genelindeki baraj seviyesinden bağımsızdır: sadece senin fatura geçmişindeki ardışık, 30 güne normalize edilmiş tüketim farkına göre açılır. İstanbul’un Kritik Tasarruf Modu banner’ı üstte ayrı bir genel durum olarak kalır.</p>`;
  feedback.className = `bill-comparison-feedback ${tier}`;
  feedback.hidden = false;
  renderPartnerRewards();
  return true;
}

function applyBillFields(fields, source = 'manual', period = 'current') {
  billState[period] = fields;
  const values = { total: fields.total, days: fields.days, period: fields.period };
  Object.entries(values).forEach(([field, value]) => { document.getElementById(billInputId(period, field)).value = value ?? ''; });
  const badge = document.getElementById(`bill-${period}-badge`);
  if (source === 'ocr' && fields.total) {
    badge.textContent = fields.confidence >= 70 ? 'OCR OKUDU · KONTROL ET' : 'OCR TAHMİNİ · KONTROL ET';
    badge.className = `extraction-badge ${fields.confidence >= 70 ? 'good' : 'needs-check'}`;
  } else if (source === 'demo') {
    badge.textContent = 'DEMO VERİSİ · KONTROL ET';
    badge.className = 'extraction-badge good';
  } else {
    badge.textContent = 'MANUEL GİRİŞ HAZIR';
    badge.className = 'extraction-badge';
  }
  renderBillComparison();
}

let tesseractLoader;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoader) return tesseractLoader;
  tesseractLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR motoru bulunamadı'));
    script.onerror = () => reject(new Error('OCR motoru yüklenemedi'));
    document.head.appendChild(script);
  });
  return tesseractLoader;
}

async function processBillFile(file, period) {
  if (!file || !file.type.startsWith('image/')) return;
  const preview = document.getElementById(`bill-${period}-preview`);
  const image = document.getElementById(`bill-${period}-preview-image`);
  const status = document.getElementById(`bill-${period}-status`);
  const dropLabel = document.querySelector(`[data-period="${period}"] .bill-drop-label`);
  const fileInput = document.getElementById(`bill-${period}-input`);
  image.src = URL.createObjectURL(file);
  preview.hidden = false;
  dropLabel.hidden = true;
  fileInput.disabled = true;
  status.textContent = 'Fatura görüntüsü hazırlanıyor; OCR motoru yükleniyor…';
  try {
    const Tesseract = await loadTesseract();
    const result = await Tesseract.recognize(file, 'tur', { logger: message => {
      if (message.status === 'recognizing text') status.textContent = `Fatura okunuyor… %${Math.round((message.progress || 0) * 100)}`;
    }});
    const fields = extractBillFields(result.data.text, result.data.confidence || 0);
    applyBillFields(fields, 'ocr', period);
    status.textContent = fields.total ? (fields.fallbackUsed ? 'OCR etiketi net değil; Toplam m³ için en iyi tahmin dolduruldu. Sonucu kontrol edip düzeltebilirsin.' : 'Toplam m³ bulundu. Sonucu kontrol edip gerekirse düzeltebilirsin.') : 'OCR tamamlandı; Toplam m³ net seçilemedi. Alanı elle doldurabilirsin.';
  } catch (error) {
    document.getElementById(`bill-${period}-badge`).textContent = 'MANUEL KONTROL GEREKLİ';
    status.textContent = 'Otomatik okuma şu an tamamlanamadı. Toplam m³ alanını elle girerek devam edebilirsin.';
  }
}

function wireBillUpload() {
  let autoCalculateTimer;
  const scheduleAutoCalculate = () => {
    clearTimeout(autoCalculateTimer);
    autoCalculateTimer = setTimeout(() => {
      renderBillComparison();
    }, 450);
  };
  const period = 'current';
  const input = document.getElementById('bill-current-input');
  const dropzone = document.getElementById('current-dropzone');
  ['total', 'days', 'period'].forEach(field => document.getElementById(billInputId(period, field)).addEventListener('input', scheduleAutoCalculate));
  input.addEventListener('change', event => processBillFile(event.target.files[0], period));
  ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('dragging'); }));
  dropzone.addEventListener('drop', event => processBillFile(event.dataTransfer.files[0], period));
  document.getElementById('bill-current-remove').addEventListener('click', () => {
    clearTimeout(autoCalculateTimer);
    resetCurrentBill();
    renderBillComparison();
  });
  document.getElementById('demo-previous-bill').addEventListener('click', () => {
    saveBillToHistory({ total: 12, days: 30, period: '202509' });
    document.getElementById('bill-history-status').textContent = 'Demo referansı kaydedildi: 12 m³ · 30 gün. Şimdi güncel faturayı girerek karşılaştırabilirsin.';
    renderBillComparison();
  });
  document.getElementById('save-current-bill').addEventListener('click', () => {
    const current = readBillPeriod('current');
    clearTimeout(autoCalculateTimer);
    if (!current.totalEntered || !current.daysEntered || !validBill(current) || (current.period && !validPeriod(current.period))) {
      renderBillComparison();
      return;
    }
    saveBillToHistory(current);
    document.getElementById('bill-history-status').textContent = 'Güncel fatura geçmişe kaydedildi. Bir sonraki faturada bu kayıt yeni referans olacak.';
    resetCurrentBill();
    renderBillHistory();
    renderBillComparison();
  });
  document.getElementById('calculate-comparison').addEventListener('click', () => {
    clearTimeout(autoCalculateTimer);
    const ok = renderBillComparison();
    const result = document.getElementById(ok ? 'bill-comparison-feedback' : 'bill-comparison-error');
    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function downloadBadge() {
  const canvas = document.getElementById('badge-canvas');
  canvas.toBlob(blob => {
    const link = document.createElement('a');
    link.download = 'sunobeti-badge-38-11.png';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/png');
}

async function shareBadge() {
  const canvas = document.getElementById('badge-canvas');
  const status = document.getElementById('badge-share-status');
  canvas.toBlob(async blob => {
    const file = new File([blob], 'sunobeti-badge-38-11.png', { type: 'image/png' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ files: [file], title: 'SuNöbeti', text: "I'm part of SuNöbeti today · %38.11" }); status.textContent = 'Paylaşım penceresi açıldı.'; }
      catch { status.textContent = 'Paylaşım iptal edildi; kart hazır.'; }
    } else {
      downloadBadge();
      status.textContent = 'Cihaz paylaşımı desteklemiyor; kart indirildi.';
    }
  }, 'image/png');
}

function renderPartners(partners) {
  document.getElementById('partner-grid').innerHTML = partners.map(partner => {
    const [parentBrand, brandName] = partner.brand.split(' · ');
    return `<article class="partner-card">
      <div class="product-visual product-${partner.icon}"><span class="concept-label">KONSEPT ÜRÜN</span><span class="product-visual-icon">${taskIcon(partner.icon)}</span><span class="product-visual-name">${partner.product}</span></div>
      <div class="partner-card-body"><span class="partner-kind">${partner.kind}</span><div class="brand-lockup"><span>${parentBrand}</span><h3>${brandName}</h3></div><p class="partner-product">${partner.product}</p><p>${partner.offer}</p><span class="product-concept-note">ALIŞKANLIĞI KOLAYLAŞTIRAN KONSEPT</span></div>
    </article>`;
  }).join('');
}

function wireCopyButtons() {
  document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', async () => {
      const source = document.getElementById(button.dataset.copyTarget);
      try { await navigator.clipboard.writeText(source.value); button.textContent = 'KOPYALANDI'; setTimeout(() => button.textContent = 'KOPYALA', 1500); } catch { source.select(); document.execCommand('copy'); }
    });
  });
}

function renderPersonalCoupon() {
  const reward = loadStoredJson(verifiedSavingsStorageKey, null);
  const select = document.getElementById('reward-brand');
  const content = document.getElementById('personal-coupon-content');
  if (!select || !content) return;
  const partner = liveSnapshot.partners.find(item => item.codePrefix === select.value);
  const offer = partner && getPartnerOffer(partner, reward);
  if (!offer) {
    content.textContent = 'Bu karşılaştırma için henüz kupon hakkı yok.';
    return;
  }
  const rates = BRAND_DISCOUNTS[partner.codePrefix];
  document.querySelector('.personal-reward-policy').textContent = `${partner.brand.split(' · ')[0]} demo kuralı: %5 ≤ tüketim düşüşü < %10 olduğunda %${rates.verified}, %10 ve üzeri düşüşte %${rates.top} indirim. İndirim oranı marka ve tasarruf seviyesine göre değişir; kodun SAVE bölümü tüketim düşüşünü belirtir. Gerçek kampanya değildir.`;
  content.innerHTML = `<div class="coupon-unlocked-card"><div><span>KİŞİSEL ÖDÜL · DEMO KUPONU</span><strong>${partner.brand.split(' · ')[0]}</strong><small>%${offer.discount} indirim · ${formatPercent(reward.reduction)} tüketim düşüşünle kazanıldı.</small></div>${couponCopyMarkup(offer.code)}</div>`;
}

function wirePersonalReward() {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-reward-toggle]');
    if (!button) return;
    const panel = document.getElementById('personal-reward-panel');
    const open = button.getAttribute('aria-expanded') !== 'true';
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'ÖDÜLÜMÜ GİZLE' : 'ÖDÜLÜMÜ GÖR';
    if (open) {
      const reward = loadStoredJson(verifiedSavingsStorageKey, null);
      const recommendation = recommendHabitPartner(loadStoredJson(taskStorageKey, []), reward?.fingerprint || '');
      document.getElementById('reward-brand').value = recommendation.codePrefix;
      const note = document.getElementById('reward-category-note');
      note.textContent = recommendation.hasHabitSignal
        ? `Önerilen alan: ${recommendation.label}. Tamamladığın görevlerin en güçlü alanıyla eşleştirildi. Fatura yalnızca toplam tüketim düşüşünü doğrular; alan seçimi kendi bildirimine dayanır.`
        : 'Henüz kategori görevi seçilmedi; üç kurgusal marka arasında dönüşümlü demo eşleştirmesi yapıldı. Fatura yalnızca toplam tüketim düşüşünü doğrular.';
      renderPersonalCoupon();
    }
    else document.getElementById('personal-coupon-content').replaceChildren();
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'reward-brand') renderPersonalCoupon();
  });
}

function wireCouponCopyButtons() {
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-coupon]');
    if (!button || button.disabled) return;
    const control = button.closest('.coupon-copy-control');
    const status = control.querySelector('.coupon-copy-status');
    const code = button.dataset.copyCoupon;
    button.disabled = true;
    status.textContent = '';
    try {
      await copyCouponCode(code);
      button.textContent = 'KOPYALANDI';
      status.textContent = 'Kupon kodu panoya kopyalandı.';
    } catch {
      button.textContent = 'TEKRAR DENE';
      status.textContent = 'Panoya erişilemedi. Kodu seçip elle kopyalayabilirsin.';
      const range = document.createRange();
      range.selectNodeContents(control.querySelector('code'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } finally {
      button.disabled = false;
    }
  });
}

function wireBadgeButtons() {
  document.getElementById('download-badge')?.addEventListener('click', downloadBadge);
  document.getElementById('share-badge')?.addEventListener('click', shareBadge);
}

function initialize() {
  const mode = decideMode(liveSnapshot);
  document.getElementById('city-summary-occupancy').textContent = `%${liveSnapshot.occupancy.toFixed(2).replace('.', ',')}`;
  document.getElementById('occupancy-value').textContent = liveSnapshot.occupancy.toFixed(2);
  document.getElementById('orb-label').textContent = `${liveSnapshot.occupancy.toFixed(2)}%`;
  document.getElementById('reserve-meter-fill').style.width = `${liveSnapshot.occupancy}%`;
  document.getElementById('critical-dam-name').textContent = liveSnapshot.criticalDam.name;
  document.getElementById('critical-dam-value').textContent = liveSnapshot.criticalDam.occupancy.toFixed(2);
  const savedCommunityTotal = Number(localStorage.getItem(communityStorageKey) || communityBaselineLiters);
  const communityValue = document.getElementById('community-liters');
  communityValue.dataset.value = String(savedCommunityTotal);
  communityValue.textContent = formatLiters(savedCommunityTotal);
  const first = liveSnapshot.trend[0].value;
  document.getElementById('trend-change').textContent = `${(liveSnapshot.occupancy - first).toFixed(2).replace('-', '−')} pp`;
  applyMode(mode);
  renderChart(liveSnapshot.trend);
  renderForecast(liveSnapshot.forecast);
  renderTasks(liveSnapshot.tasks);
  renderBillHistory();
  renderPartners(liveSnapshot.partners);
  renderPartnerRewards();
  wireCopyButtons();
  wireCouponCopyButtons();
  wirePersonalReward();
  wireBadgeButtons();
  wireBillUpload();
  if (loadBillHistory().length >= 2) renderBillComparison();
  initializeWorkspaceTabs();
  initializeDemoProfile();
}

document.addEventListener('DOMContentLoaded', initialize);
