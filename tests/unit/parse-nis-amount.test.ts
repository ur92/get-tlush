import { describe, expect, it } from "vitest";
import {
  normalizeDigits,
  parseNisAmount,
  reverseVisualHebrew,
  tryCp1255Decode,
} from "@tlush/pdf-extract";

describe("parseNisAmount", () => {
  it("parses comma-separated thousands with decimal period", () => {
    expect(parseNisAmount("26,730.51")).toBe(26730.51);
  });

  it("parses parenthesized amounts as negative", () => {
    expect(parseNisAmount("(316,000.00)")).toBe(-316000);
  });

  it("parses European-style separators", () => {
    expect(parseNisAmount("12.345,67")).toBe(12345.67);
  });

  it("strips shekel symbol and whitespace", () => {
    expect(parseNisAmount(" 1,234.50 ₪ ")).toBe(1234.5);
  });

  it("returns null for non-numeric input", () => {
    expect(parseNisAmount("abc")).toBeNull();
  });
});

describe("normalizeDigits", () => {
  it("maps Arabic-Indic digits to ASCII", () => {
    expect(normalizeDigits("١٢٣")).toBe("123");
  });
});

describe("tryCp1255Decode", () => {
  it("decodes latin-1 mojibake to Hebrew", () => {
    const decoded = tryCp1255Decode("ðàîï ì÷ååø");
    expect(decoded).toContain("נ");
  });

  it("returns original text when input is not latin-1", () => {
    expect(tryCp1255Decode("שכר")).toBe("שכר");
  });
});

describe("reverseVisualHebrew", () => {
  it("reverses Hebrew runs to logical order", () => {
    expect(reverseVisualHebrew("םולש")).toBe("שלום");
  });

  it("leaves non-Hebrew segments unchanged", () => {
    expect(reverseVisualHebrew("001-םולש")).toBe("001-שלום");
  });
});
