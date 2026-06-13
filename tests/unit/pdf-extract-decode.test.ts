import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  decodeGhostscriptCustomFont,
  isGhostscriptPdf,
} from "@tlush/pdf-extract";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const snapshot = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/extracted/hilan-shiklolit-tokens.json"), "utf8")
) as {
  tokens: Array<{ text: string; fontName?: string }>;
};

describe("pdf-extract Ghostscript decode", () => {
  it("detects Ghostscript producer metadata", () => {
    expect(isGhostscriptPdf({ Producer: "GPL Ghostscript 9.56.1" })).toBe(true);
    expect(isGhostscriptPdf({ Producer: "Synactis PDF In-The-Box" })).toBe(false);
  });

  it("maps control-char digits and punctuation from g_d0_f3", () => {
    expect(decodeGhostscriptCustomFont("\u0014\u0015\u0016", "g_d0_f3")).toBe("012");
    expect(decodeGhostscriptCustomFont("\u0011\u0012\u0013", "g_d0_f3")).toBe("/,.");
  });

  it("shiklolit snapshot contains decoded statutory labels", () => {
    expect(snapshot.tokens.some((token) => token.text.includes("לאוםי"))).toBe(true);
    expect(snapshot.tokens.some((token) => token.text.includes("הךןסה"))).toBe(true);
  });

  it("decodes net-pay amount token from snapshot", () => {
    const netToken = snapshot.tokens.find((token) => token.fontName === "g_d0_f4");
    expect(netToken).toBeTruthy();
    const decoded = decodeGhostscriptCustomFont(netToken!.text, netToken!.fontName);
    expect(decoded.replace(/,/g, "")).toContain("7011");
  });
});
