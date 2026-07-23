export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
};

export function getCurrencySymbol(currencyInput?: string | null): string {
  if (!currencyInput) return "$";
  const trimmed = currencyInput.trim();
  const upper = trimmed.toUpperCase();

  // 1. Direct match in dictionary
  if (CURRENCY_SYMBOLS[upper]) {
    return CURRENCY_SYMBOLS[upper];
  }

  // 2. Check for standard currency symbol characters embedded in string
  for (const sym of ["₹", "€", "£", "$", "¥", "₱", "R$"]) {
    if (trimmed.includes(sym)) return sym;
  }

  // 3. Extract 3-letter ISO code match if input is e.g. "INR - Indian Rupee"
  const isoMatch = upper.match(/\b([A-Z]{3})\b/);
  if (isoMatch && CURRENCY_SYMBOLS[isoMatch[1]]) {
    return CURRENCY_SYMBOLS[isoMatch[1]];
  }

  // 4. Try Intl.NumberFormat fallback
  try {
    const formatter = new Intl.NumberFormat("en", { style: "currency", currency: upper });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((p) => p.type === "currency");
    if (symbolPart) return symbolPart.value;
  } catch {
    // Fallback if Intl fails
  }

  return trimmed;
}

export function formatCurrencyAmount(amount: number | string | null | undefined, symbol = "$"): string {
  const num = Number(amount);
  const val = isNaN(num) ? 0 : num;
  return `${symbol}${val.toFixed(2)}`;
}
