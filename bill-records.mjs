// Saved bills (the user's `billHistory` field), newest first. Each record keeps
// what was read from the photo; the photo itself, when the user chose to keep
// it, lives in a separate Firestore document users/{uid}/billImages/{id}
// (`hasImage: true` on the record).
export const MAX_BILLS = 24;

export function newBillId() {
  return globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 20)
    || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// Records saved before ids existed are identified by their contents.
export function billKey(bill) {
  return bill.id || `${bill.savedAt || ''}|${bill.total}|${bill.days}|${bill.period || ''}`;
}

export function isDuplicateBill(history, record) {
  return history.some(item => item.total === record.total && item.days === record.days && item.period === record.period);
}

// Returns the new history and the bills pushed out by the size limit (their photos must go too).
export function addBill(history, record) {
  if (isDuplicateBill(history, record)) return { history, dropped: [] };
  const next = [record, ...history];
  return { history: next.slice(0, MAX_BILLS), dropped: next.slice(MAX_BILLS) };
}

export function findBill(history, key) {
  return history.find(bill => billKey(bill) === key) || null;
}

export function removeBill(history, key) {
  return history.filter(bill => billKey(bill) !== key);
}

export function withoutImage(history, key) {
  return history.map(bill => {
    if (billKey(bill) !== key) return bill;
    const { hasImage, ...rest } = bill;
    return rest;
  });
}
