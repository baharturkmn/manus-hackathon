export function validPeriod(value) {
  return /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])$/.test(String(value || ''));
}

export function validBill(bill) {
  return bill && Number.isFinite(Number(bill.total)) && Number(bill.total) >= 0
    && Number.isFinite(Number(bill.days)) && Number(bill.days) > 0
    && Number.isInteger(Number(bill.days));
}

export function sameBill(a, b) {
  return Number(a.total) === Number(b.total) && Number(a.days) === Number(b.days)
    && String(a.period || '') === String(b.period || '');
}

export function sortedBillHistory(records) {
  if (!Array.isArray(records)) return [];
  const bills = records.filter(validBill).map(bill => ({
    ...bill, total: Number(bill.total), days: Number(bill.days), period: String(bill.period || '')
  }));
  const allDated = bills.every(bill => validPeriod(bill.period));
  // Periods take precedence over upload order when all dates are known.
  // Otherwise retain the existing newest-first storage order.
  return allDated ? bills.sort((a, b) => Number(b.period) - Number(a.period)) : bills;
}

export function resolveBillPair(records, draft = null) {
  const history = sortedBillHistory(records);
  if (draft?.hasInput) {
    if (!validBill(draft) || !draft.totalEntered || !draft.daysEntered) {
      return { error: 'Güncel faturanın Toplam m³ ve Gün Sayısı alanlarını tamamla. Gün sayısı pozitif bir tam sayı olmalı.' };
    }
    if (draft.period && !validPeriod(draft.period)) {
      return { error: 'Dönemi YYYYMM biçiminde kontrol et (örneğin 202610); ay 01–12 arasında olmalı.' };
    }
    let candidates = history.filter(bill => !sameBill(bill, draft));
    if (validPeriod(draft.period)) {
      candidates = candidates.filter(bill => !validPeriod(bill.period) || bill.period < draft.period);
    }
    if (!candidates.length) {
      return { error: history.length
        ? 'Bu faturadan daha eski, farklı bir referans bulunamadı. Tarihi kontrol et veya alanları boşaltarak kayıtlı son iki faturayı karşılaştır.'
        : 'Bu ilk faturanın. Kaydedince referans olur; ikinci faturayla karşılaştırma yapılabilir.' };
    }
    if (candidates[0].total === 0) return { error: 'Önceki tüketim sıfır olduğundan yüzde değişim hesaplanamaz. Kayıtları kontrol et.' };
    return { previous: candidates[0], current: draft, source: 'draft' };
  }
  if (history.length < 2) {
    return { error: history.length
      ? 'Bir kayıt var. Karşılaştırma için yeni bir fatura yükle veya tüketim ve gün sayısını gir.'
      : 'Henüz karşılaştırılacak fatura yok. İlk faturayı kaydet veya demo referansı ekle.' };
  }
  if (history[0].period && history[0].period === history[1].period) {
    return { error: 'Son iki kayıt aynı döneme ait. İki farklı dönem faturasıyla karşılaştırma yapabilirsin.' };
  }
  if (history[1].total === 0) return { error: 'Önceki tüketim sıfır olduğundan yüzde değişim hesaplanamaz. Kayıtları kontrol et.' };
  return { previous: history[1], current: history[0], source: 'history' };
}

export function calculateBillChange(previous, current) {
  const previousMonthly = previous.total / previous.days * 30;
  const currentMonthly = current.total / current.days * 30;
  const change = (currentMonthly / previousMonthly - 1) * 100;
  const reduction = Math.max(0, -change);
  const tier = reduction + 1e-9 >= 10 ? 'top' : reduction + 1e-9 >= 5 ? 'verified' : 'none';
  return {
    previousMonthly, currentMonthly, change, reduction, tier,
    eligible: tier !== 'none', discount: tier === 'top' ? 20 : tier === 'verified' ? 10 : 0
  };
}
