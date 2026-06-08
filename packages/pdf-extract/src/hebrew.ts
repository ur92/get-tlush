const HEBREW_RUN = /[\u0590-\u05FF\uFB1D-\uFB4F]+/g;

const ARABIC_INDIC_DIGITS: Record<string, string> = {
  "\u0660": "0",
  "\u0661": "1",
  "\u0662": "2",
  "\u0663": "3",
  "\u0664": "4",
  "\u0665": "5",
  "\u0666": "6",
  "\u0667": "7",
  "\u0668": "8",
  "\u0669": "9",
  "\u06F0": "0",
  "\u06F1": "1",
  "\u06F2": "2",
  "\u06F3": "3",
  "\u06F4": "4",
  "\u06F5": "5",
  "\u06F6": "6",
  "\u06F7": "7",
  "\u06F8": "8",
  "\u06F9": "9",
};

/** Re-encode latin-1 byte values as Windows-1255 (Hilan mojibake recovery). */
export function tryCp1255Decode(text: string): string {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) {
      return text;
    }
    bytes[i] = code;
  }

  try {
    return new TextDecoder("windows-1255").decode(bytes);
  } catch {
    return text;
  }
}

/** Reverse visual-order Hebrew runs to logical order. */
export function reverseVisualHebrew(text: string): string {
  return text.replace(HEBREW_RUN, (run) => [...run].reverse().join(""));
}

/** Map Arabic-Indic digits to ASCII 0-9. */
export function normalizeDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => ARABIC_INDIC_DIGITS[ch] ?? ch);
}

/**
 * Parse NIS amounts such as `12,345.67`, `12.345,67`, or `₪`-suffixed values.
 * Parenthesized amounts are treated as negative.
 */
export function parseNisAmount(text: string, locale = "he-IL"): number | null {
  let value = normalizeDigits(text.trim());
  if (!value) {
    return null;
  }

  value = value.replace(/₪/g, "").replace(/\s+/g, "");

  let negative = false;
  const parenMatch = value.match(/^\((.+)\)$/);
  if (parenMatch) {
    negative = true;
    value = parenMatch[1];
  } else if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  }

  if (!value || !/[\d]/.test(value)) {
    return null;
  }

  const lastComma = value.lastIndexOf(",");
  const lastPeriod = value.lastIndexOf(".");
  const useEuropean =
    locale === "he-IL"
      ? lastComma > lastPeriod && lastComma >= 0
      : lastComma > lastPeriod;

  const normalized = useEuropean
    ? value.replace(/\./g, "").replace(",", ".")
    : value.replace(/,/g, "");

  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return negative ? -amount : amount;
}
