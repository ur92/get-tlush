import type { ExtractedPdf } from "@tlush/pdf-extract";
import {
  createParserRegistry,
  ParseError,
  ScannedPdfError,
  UnrecognizedPayslipError,
  type CanonicalPayslip,
  type PayslipParserPlugin,
} from "@tlush/parser-core";
import { describe, expect, it } from "vitest";

function makeDoc(overrides: Partial<ExtractedPdf> = {}): ExtractedPdf {
  return {
    pages: [
      {
        pageNumber: 1,
        width: 595,
        height: 842,
        tokens: [{ text: "sample", x: 0, y: 0, width: 10, height: 10 }],
      },
    ],
    pageCount: 1,
    isScanned: false,
    ...overrides,
  };
}

function makePayslip(plugin: PayslipParserPlugin): CanonicalPayslip {
  return {
    vendor: { id: plugin.id, parserVersion: plugin.version, displayNameKey: plugin.displayNameKey },
    period: { month: 4, year: 2026 },
    earnings: [
      {
        code: "001",
        rawLabel: "שכר יסוד",
        amount: 10000,
        category: "earnings.base_salary",
      },
    ],
    deductions: [
      {
        code: "TAX",
        rawLabel: "מס הכנסה",
        amount: 2000,
        category: "deduction.income_tax",
      },
    ],
    totals: {
      grossCash: 10000,
      taxableGross: 10000,
      netPay: 7000,
      incomeTax: 2000,
      ni: 800,
      healthTax: 200,
    },
    context: { creditPoints: 2.25 },
    flags: [],
  };
}

function makePlugin(
  id: PayslipParserPlugin["id"],
  confidence: number,
  version = "1.0.0"
): PayslipParserPlugin {
  const plugin: PayslipParserPlugin = {
    id,
    version,
    displayNameKey: `vendors.${id}`,
    detect: () => ({ confidence, signals: [`${id}-signal`] }),
    parse: () => makePayslip(plugin),
  };
  return plugin;
}

describe("ParserRegistry", () => {
  it("registers plugins and lists them in order", () => {
    const registry = createParserRegistry();
    const hilan = makePlugin("hilan", 0.9);
    const merkava = makePlugin("merkava", 0.85);

    registry.register(hilan);
    registry.register(merkava);

    expect(registry.list()).toEqual([hilan, merkava]);
  });

  it("replaces a plugin when the same id is registered with equal or higher version", () => {
    const registry = createParserRegistry();
    const v1 = makePlugin("hilan", 0.9, "1.0.0");
    const v2 = makePlugin("hilan", 0.95, "1.1.0");

    registry.register(v1);
    registry.register(v2);

    expect(registry.list()).toEqual([v2]);
  });

  it("keeps the earlier plugin when a lower version is registered again", () => {
    const registry = createParserRegistry();
    const v2 = makePlugin("hilan", 0.9, "2.0.0");
    const v1 = makePlugin("hilan", 0.99, "1.0.0");

    registry.register(v2);
    registry.register(v1);

    expect(registry.list()).toEqual([v2]);
  });

  it("returns the highest-confidence plugin when confidence is at least 0.8", () => {
    const registry = createParserRegistry();
    registry.register(makePlugin("hilan", 0.7));
    registry.register(makePlugin("merkava", 0.85));

    expect(registry.detect(makeDoc())?.plugin.id).toBe("merkava");
    expect(registry.detect(makeDoc())?.confidence).toBe(0.85);
  });

  it("returns null when the highest confidence is below 0.8", () => {
    const registry = createParserRegistry();
    registry.register(makePlugin("hilan", 0.79));

    expect(registry.detect(makeDoc())).toBeNull();
  });

  it("prefers the first registered plugin on confidence ties", () => {
    const registry = createParserRegistry();
    const hilan = makePlugin("hilan", 0.9);
    const merkava = makePlugin("merkava", 0.9);

    registry.register(hilan);
    registry.register(merkava);

    expect(registry.detect(makeDoc())?.plugin.id).toBe("hilan");
  });

  it("throws ScannedPdfError before detection when the document is scanned", () => {
    const registry = createParserRegistry();
    registry.register(makePlugin("hilan", 0.95));

    expect(() => registry.parse(makeDoc({ isScanned: true }))).toThrow(ScannedPdfError);
  });

  it("throws UnrecognizedPayslipError when no plugin matches", () => {
    const registry = createParserRegistry();
    registry.register(makePlugin("hilan", 0.2));

    try {
      registry.parse(makeDoc());
      expect.fail("expected UnrecognizedPayslipError");
    } catch (error) {
      expect(error).toBeInstanceOf(UnrecognizedPayslipError);
      expect((error as UnrecognizedPayslipError).supportedVendors).toEqual(["vendors.hilan"]);
    }
  });

  it("parses with vendor metadata from the winning plugin", () => {
    const registry = createParserRegistry();
    const plugin = makePlugin("merkava", 0.92, "1.2.3");
    registry.register(plugin);

    const result = registry.parse(makeDoc());

    expect(result.vendor).toEqual({
      id: "merkava",
      parserVersion: "1.2.3",
      displayNameKey: "vendors.merkava",
      detectionConfidence: 0.92,
    });
  });

  it("rethrows ParseError from plugins", () => {
    const registry = createParserRegistry();
    registry.register({
      ...makePlugin("hilan", 0.95),
      parse: () => {
        throw new ParseError("unsupported layout");
      },
    });

    expect(() => registry.parse(makeDoc())).toThrow(ParseError);
  });
});
