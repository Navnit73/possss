export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "AED", symbol: "AED", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal", flag: "🇸🇦" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", flag: "🇳🇿" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", flag: "🇨🇭" },
  { code: "ZAR", symbol: "R", name: "South African Rand", flag: "🇿🇦" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", flag: "🇰🇪" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", flag: "🇳🇬" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "🇧🇷" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", flag: "🇲🇽" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", flag: "🇵🇭" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee", flag: "🇵🇰" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", flag: "🇧🇩" },
  { code: "ETB", symbol: "Br", name: "Ethiopian Birr", flag: "🇪🇹" },
];

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.symbol])
);

export function getCurrencySymbol(currencyInput?: string | null): string {
  if (!currencyInput) return "$";
  const trimmed = currencyInput.trim();
  const upper = trimmed.toUpperCase();

  // 1. Direct match in dictionary
  if (CURRENCY_SYMBOLS[upper]) {
    return CURRENCY_SYMBOLS[upper];
  }

  // 2. Check for standard currency symbol characters embedded in string
  for (const sym of ["₹", "€", "£", "$", "¥", "₱", "R$", "₦", "৳", "₨", "KSh", "AED", "SAR", "CHF", "Br"]) {
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
  const needsSpace = symbol.length > 1 && !symbol.includes("$");
  return `${symbol}${needsSpace ? " " : ""}${val.toFixed(2)}`;
}
