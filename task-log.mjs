// Daily task log: { 'YYYY-MM-DD': ['brush', 'shower'], ... } keyed by the
// Istanbul calendar day. Each day starts empty, earlier days stay recorded.
// Stored in the user's `tasks` field; older records kept a bare array of ids
// without a date, which is read as today's selection.
export const TASK_LOG_DAYS = 90;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export function istanbulDayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function shiftDay(day, offset) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function isTaskLog(value) {
  if (Array.isArray(value)) return value.every(id => typeof id === 'string');
  return value !== null && typeof value === 'object'
    && Object.entries(value).every(([day, ids]) => DAY.test(day) && Array.isArray(ids) && ids.every(id => typeof id === 'string'));
}

// Keeps the newest TASK_LOG_DAYS days and drops empty days.
export function normalizeTaskLog(raw, today) {
  if (Array.isArray(raw)) return raw.length ? { [today]: [...new Set(raw)] } : {};
  if (!isTaskLog(raw)) return {};
  const oldest = shiftDay(today, -(TASK_LOG_DAYS - 1));
  return Object.fromEntries(Object.entries(raw)
    .filter(([day, ids]) => ids.length && day >= oldest && day <= today)
    .map(([day, ids]) => [day, [...new Set(ids)]]));
}

export function tasksForDay(log, day) {
  return Array.isArray(log?.[day]) ? [...log[day]] : [];
}

export function withDayTasks(log, day, ids) {
  const next = normalizeTaskLog(log, day);
  if (ids.length) next[day] = [...new Set(ids)];
  else delete next[day];
  return next;
}

// The last `count` days ending today, oldest first, with how many tasks were done.
export function recentDays(log, today, count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const day = shiftDay(today, index - count + 1);
    const date = new Date(`${day}T00:00:00Z`);
    return {
      day,
      done: tasksForDay(log, day).length,
      label: `${date.getUTCDate()} ${TR_MONTHS[date.getUTCMonth()]}`,
      weekday: day === today ? 'Bugün' : TR_DAYS[date.getUTCDay()]
    };
  });
}

// Consecutive days with at least one task, counting back from today
// (or from yesterday when nothing is ticked yet today).
export function currentStreak(log, today) {
  let day = tasksForDay(log, today).length ? today : shiftDay(today, -1);
  let streak = 0;
  while (tasksForDay(log, day).length) {
    streak += 1;
    day = shiftDay(day, -1);
  }
  return streak;
}
