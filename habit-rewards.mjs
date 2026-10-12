export function milestoneReached(taskIds) {
  return Array.isArray(taskIds) && new Set(taskIds).size >= 5;
}

const CATEGORIES = [
  { codePrefix: 'CLEANCYCLE', label: 'Çamaşır alışkanlığı', tasks: ['laundry'] },
  { codePrefix: 'PUREWAVE', label: 'Duş alışkanlıkları', tasks: ['shower', 'shower-cold'] },
  { codePrefix: 'SPARKLEWASH', label: 'Bulaşık ve yeniden kullanım', tasks: ['dishwasher', 'greywater'] }
];

// Bills verify only the TOTAL reduction. Category matching is a self-reported
// checklist proxy, not evidence of appliance-level consumption or attribution.
export function recommendHabitPartner(selectedIds = [], fingerprint = '') {
  const ids = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const scored = CATEGORIES.map(category => ({ ...category, score: category.tasks.filter(id => ids.has(id)).length }));
  const highest = Math.max(...scored.map(category => category.score));
  const candidates = scored.filter(category => category.score === highest);
  const seed = [...String(fingerprint)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const chosen = candidates[seed % candidates.length];
  return { codePrefix: chosen.codePrefix, label: chosen.label, reportedHabits: chosen.score, hasHabitSignal: highest > 0 };
}
