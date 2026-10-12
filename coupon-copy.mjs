export function couponCopyMarkup(code) {
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code)) throw new Error('Geçersiz kupon kodu');
  return `<span class="coupon-copy-control"><span class="coupon-copy-row"><code>${code}</code><button type="button" class="coupon-copy-button" data-copy-coupon="${code}" aria-label="${code} kupon kodunu kopyala">KOPYALA</button></span><span class="coupon-copy-status" role="status" aria-live="polite"></span></span>`;
}

export async function copyCouponCode(code, environment = {}) {
  const nav = environment.navigator ?? globalThis.navigator;
  const doc = environment.document ?? globalThis.document;
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(code);
      return;
    } catch {
      // Embedded previews and some mobile browsers may deny Clipboard API access.
    }
  }
  const previousFocus = doc.activeElement;
  const field = doc.createElement('textarea');
  field.value = code;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;top:0;left:-9999px;font-size:16px;';
  doc.body.appendChild(field);
  let copied = false;
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, code.length);
    copied = Boolean(doc.execCommand?.('copy'));
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll: true });
  }
  if (!copied) throw new Error('Panoya erişim engellendi');
}
