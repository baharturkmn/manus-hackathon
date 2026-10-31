// Task catalog: which water-saving tasks a household sees today.
//
// Sections
//   daily     – the same few habits every day (filtered by the household answers)
//   rotating  – one simple "günün görevi" per day, chosen from this list by date
//   dikkat    – extra tasks while the city level is Dikkat or Kritik
//   kritik    – extra tasks only while the city level is Kritik
//   seasonal  – tasks shown in certain months
//   oneTime   – done once, kept as a badge in the household record
//
// `requires` names a household answer that must be true for the task to show.
// `liters` is a rough, symbolic estimate used only by the community counter;
// tasks without a sourced or agreed estimate carry null.
export const HOUSEHOLD_QUESTIONS = Object.freeze([
  { id: 'shower', text: 'Duş kullanıyorum', short: 'duş', default: true },
  { id: 'dualFlush', text: 'Sifonum çift kademeli (iki tuşlu)', short: 'çift tuşlu sifon', default: true },
  { id: 'dishwasher', text: 'Bulaşık makinem var', short: 'bulaşık makinesi', default: true },
  { id: 'washer', text: 'Çamaşır makinem var', short: 'çamaşır makinesi', default: true },
  { id: 'garden', text: 'Bitkim ya da bahçem var', short: 'bitki/bahçe', default: false },
  { id: 'balcony', text: 'Balkonum ya da terasım var', short: 'balkon/teras', default: false },
  { id: 'car', text: 'Arabam var', short: 'araba', default: false }
]);

export const TASKS = Object.freeze([
  // Daily habits
  { id: 'brush', section: 'daily', icon: 'toothbrush', text: 'Dişlerini fırçalarken musluğu kapat.', points: 20, liters: 8 },
  { id: 'shower', section: 'daily', icon: 'shower', text: 'Duşunu 5 dakikada bitir.', points: 20, liters: 20, requires: 'shower' },
  { id: 'flush', section: 'daily', icon: 'toilet', text: 'Sifonda küçük tuşu kullan.', points: 20, liters: null, requires: 'dualFlush' },
  { id: 'dishes', section: 'daily', icon: 'dishwasher', text: 'Bulaşığı tam dolu makinede yıka.', textWithout: { dishwasher: 'Bulaşığı akan suyun altında değil, leğende yıka.' }, points: 20, liters: 30 },
  { id: 'laundry', section: 'daily', icon: 'washing-machine', text: 'Çamaşır yıkadıysan tam yükte yıka.', points: 20, liters: 40, requires: 'washer', optional: true },
  // Günün görevi (one per day)
  { id: 'hands', section: 'rotating', icon: 'tap', text: 'Ellerini sabunlarken musluğu kapat.', points: 15, liters: null },
  { id: 'half-tap', section: 'rotating', icon: 'tap', text: 'Musluğu sonuna kadar değil, yarıya kadar aç.', points: 15, liters: null },
  { id: 'veg-bowl', section: 'rotating', icon: 'bowl', text: 'Meyve ve sebzeyi akan suda değil, bir kapta yıka.', points: 15, liters: null },
  { id: 'thaw', section: 'rotating', icon: 'bowl', text: 'Dondurulmuş yiyeceği akan suyla değil, buzdolabında çöz.', points: 15, liters: null },
  { id: 'scrape', section: 'rotating', icon: 'dishwasher', text: 'Bulaşığı makineye koymadan durulama, sadece artıkları sıyır.', points: 15, liters: null, requires: 'dishwasher' },
  { id: 'no-trash-flush', section: 'rotating', icon: 'toilet', text: 'Sifona mendil, pamuk gibi çöp atma.', points: 15, liters: null },
  { id: 'shave', section: 'rotating', icon: 'tap', text: 'Tıraş olurken musluğu açık bırakma.', points: 15, liters: null },
  { id: 'eco-program', section: 'rotating', icon: 'washing-machine', text: 'Çamaşırda eko programı seç.', points: 15, liters: null, requires: 'washer' },
  // Extra tasks while the city is in Dikkat or Kritik
  { id: 'car-wash', section: 'dikkat', icon: 'car', text: 'Araba yıkamayı ertele.', points: 25, liters: null, requires: 'car' },
  { id: 'balcony-bucket', section: 'dikkat', icon: 'bucket', text: 'Balkonu hortumla değil, kovayla temizle.', points: 25, liters: null, requires: 'balcony' },
  // Extra tasks only in Kritik
  { id: 'soap-off', section: 'kritik', icon: 'shower', text: 'Sabunlanırken suyu kapat.', points: 25, liters: null, requires: 'shower' },
  { id: 'saved-water-plants', section: 'kritik', icon: 'watering', text: 'Bitkileri yalnızca biriktirilmiş suyla sula.', points: 25, liters: null, requires: 'garden' },
  { id: 'water-jug', section: 'kritik', icon: 'jug', text: 'Olası bir kesintiye karşı dolu bir su bidonu hazırla.', points: 25, liters: null },
  // Seasonal
  { id: 'watering-time', section: 'seasonal', icon: 'watering', text: 'Bitkileri sabah erken ya da akşam sula.', points: 20, liters: 15, requires: 'garden', months: [5, 6, 7, 8, 9] },
  // One-time improvements
  { id: 'leak-test', section: 'oneTime', icon: 'toilet', text: 'Sifonda kaçak testi yap: rezervuara gıda boyası damlat, 15 dakika sonra klozete bak.', points: 50 },
  { id: 'aerator', section: 'oneTime', icon: 'tap', text: 'Musluklara perlatör (havalandırıcı) tak.', points: 50 },
  { id: 'shower-head', section: 'oneTime', icon: 'shower', text: 'Tasarruflu duş başlığı tak.', points: 50, requires: 'shower' },
  { id: 'fix-drip', section: 'oneTime', icon: 'leak', text: 'Damlayan musluğu tamir ettir.', points: 50 }
]);

const byId = Object.fromEntries(TASKS.map(task => [task.id, task]));
export const taskById = id => byId[id] || null;

// Household record: { answers: {questionId: bool}, people: 1–12 | null, setupDone: bool, oneTime: {taskId: 'YYYY-MM-DD'} }
export const MAX_PEOPLE = 12;
const validPeople = value => Number.isInteger(value) && value >= 1 && value <= MAX_PEOPLE;
export function normalizeHousehold(raw) {
  const answers = {};
  for (const q of HOUSEHOLD_QUESTIONS) {
    const value = raw?.answers?.[q.id];
    answers[q.id] = typeof value === 'boolean' ? value : q.default;
  }
  const oneTime = {};
  for (const [id, day] of Object.entries(raw?.oneTime || {})) {
    if (byId[id]?.section === 'oneTime' && /^\d{4}-\d{2}-\d{2}$/.test(day)) oneTime[id] = day;
  }
  return { answers, people: validPeople(raw?.people) ? raw.people : null, setupDone: raw?.setupDone === true, oneTime };
}

export function isHousehold(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const { answers = {}, oneTime = {}, setupDone = false, people = null } = value;
  return typeof setupDone === 'boolean'
    && (people === null || validPeople(people))
    && answers !== null && typeof answers === 'object' && !Array.isArray(answers)
    && Object.values(answers).every(v => typeof v === 'boolean')
    && oneTime !== null && typeof oneTime === 'object' && !Array.isArray(oneTime)
    && Object.values(oneTime).every(v => typeof v === 'string');
}

const applies = (task, answers) => !task.requires || answers[task.requires] === true;

function withText(task, answers) {
  const alt = Object.entries(task.textWithout || {}).find(([answer]) => answers[answer] === false);
  return { ...task, text: alt ? alt[1] : task.text };
}

// The day's rotating task, the same for everyone with the same answers on that day.
export function rotatingTaskFor(day, answers) {
  const options = TASKS.filter(task => task.section === 'rotating' && applies(task, answers));
  if (!options.length) return null;
  const daysSinceEpoch = Math.floor(Date.parse(`${day}T00:00:00Z`) / 864e5);
  return options[((daysSinceEpoch % options.length) + options.length) % options.length];
}

// Today's list, in display order. `level` is the city level from live.json
// ('normal' | 'dikkat' | 'kritik' | 'acil'); 'acil' counts as kritik here.
export function tasksForToday({ day, answers, level = 'normal' }) {
  const month = Number(day.slice(5, 7));
  const critical = level === 'kritik' || level === 'acil';
  const watch = critical || level === 'dikkat';
  const levelTasks = TASKS.filter(task => applies(task, answers)
    && ((task.section === 'kritik' && critical) || (task.section === 'dikkat' && watch)))
    .map(task => ({ ...task, levelTag: critical ? 'Kritik mod' : 'Dikkat' }));
  const daily = TASKS.filter(task => task.section === 'daily' && applies(task, answers));
  const rotating = rotatingTaskFor(day, answers);
  const seasonal = TASKS.filter(task => task.section === 'seasonal' && applies(task, answers) && task.months.includes(month));
  return [...levelTasks, ...daily, ...(rotating ? [{ ...rotating, dayTag: 'Günün görevi' }] : []), ...seasonal]
    .map(task => withText(task, answers));
}

// Required tasks decide "complete"; optional ones (laundry) only add points.
export function dayProgress(tasks, doneIds) {
  const done = new Set(doneIds);
  const required = tasks.filter(task => !task.optional);
  const doneRequired = required.filter(task => done.has(task.id)).length;
  const doneAll = tasks.filter(task => done.has(task.id));
  return {
    required: required.length,
    doneRequired,
    complete: required.length > 0 && doneRequired === required.length,
    points: doneAll.reduce((sum, task) => sum + task.points, 0),
    liters: doneAll.reduce((sum, task) => sum + (task.liters || 0), 0)
  };
}

export function oneTimeTasks(answers) {
  return TASKS.filter(task => task.section === 'oneTime' && applies(task, answers));
}
