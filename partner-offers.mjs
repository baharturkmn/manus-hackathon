// Fictional demo offers: each brand has its own rates, still gated by
// the verified reduction in m³ per 30 days. Not a real promotion.
export const BRAND_DISCOUNTS = Object.freeze({
  BRIGHTSMILE: { verified: 10, top: 20 },
  PUREWAVE: { verified: 12, top: 22 },
  CLEANCYCLE: { verified: 15, top: 25 },
  SPARKLEWASH: { verified: 8, top: 18 }
});

export function discountForReduction(reduction, codePrefix = 'BRIGHTSMILE') {
  const value = Number(reduction);
  const rates = BRAND_DISCOUNTS[codePrefix];
  if (!rates || !Number.isFinite(value) || value < 5 - 1e-9) return 0;
  return value + 1e-9 >= 10 ? rates.top : rates.verified;
}

export function getPartnerOffer(partner, reward) {
  if (!reward?.eligible) return null;
  const discount = discountForReduction(reward.reduction, partner?.codePrefix);
  if (!discount) return null;
  const savingsPercent = Math.max(1, Math.round(Number(reward.reduction)));
  return { code: `SAVE${savingsPercent}-${partner.codePrefix}`, discount };
}
