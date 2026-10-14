// Shared by the POS screen and the sell API so the cart total the cashier sees is the amount that gets billed.

/** Flat tax applied to every POS sale. */
export const POS_TAX_RATE = 0.05;

/** Round to cents. Everything money-related goes through this to avoid 0.1 + 0.2 style float noise. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Amount for one cart line after its own % discount. */
export function lineAmount(price: number, qty: number, discountPct: number): number {
  return round2(price * qty * (1 - discountPct / 100));
}

export interface PosTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/** Bill totals from line amounts and an absolute bill discount. The sell API bills exactly this. */
export function totalsFromDiscount(lineAmounts: number[], discountAmount: number): PosTotals {
  const subtotal = round2(lineAmounts.reduce((sum, a) => sum + a, 0));
  const discount = round2(discountAmount);
  // Round the taxable amount before applying tax, otherwise float noise (e.g. 1448.56 - 144.86) can shift the tax by a cent
  const afterDiscount = round2(subtotal - discount);
  const tax = round2(afterDiscount * POS_TAX_RATE);
  return { subtotal, discount, tax, total: round2(afterDiscount + tax) };
}

export function computeTotals(lineAmounts: number[], billDiscountPct: number): PosTotals {
  const subtotal = round2(lineAmounts.reduce((sum, a) => sum + a, 0));
  return totalsFromDiscount(lineAmounts, subtotal * (billDiscountPct / 100));
}
