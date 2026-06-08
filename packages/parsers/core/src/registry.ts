import type { ExtractedPdf } from "@tlush/pdf-extract";
import { ParseError, ScannedPdfError, UnrecognizedPayslipError } from "./errors.js";
import type {
  CanonicalPayslip,
  ParserRegistry,
  PayslipParserPlugin,
} from "./types.js";

const DETECTION_THRESHOLD = 0.8;

function compareVersions(a: string, b: string): number {
  const parse = (version: string) =>
    version
      .split(/[.-]/)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export class DefaultParserRegistry implements ParserRegistry {
  private plugins: PayslipParserPlugin[] = [];

  register(plugin: PayslipParserPlugin): void {
    const existingIndex = this.plugins.findIndex((entry) => entry.id === plugin.id);
    if (existingIndex === -1) {
      this.plugins.push(plugin);
      return;
    }

    const existing = this.plugins[existingIndex];
    if (compareVersions(plugin.version, existing.version) >= 0) {
      this.plugins[existingIndex] = plugin;
    }
  }

  list(): PayslipParserPlugin[] {
    return [...this.plugins];
  }

  detect(doc: ExtractedPdf): { plugin: PayslipParserPlugin; confidence: number } | null {
    let best: { plugin: PayslipParserPlugin; confidence: number } | null = null;

    for (const plugin of this.plugins) {
      const result = plugin.detect(doc);
      if (result.confidence <= 0) {
        continue;
      }

      if (
        !best ||
        result.confidence > best.confidence ||
        (result.confidence === best.confidence &&
          this.plugins.indexOf(plugin) < this.plugins.indexOf(best.plugin))
      ) {
        best = { plugin, confidence: result.confidence };
      }
    }

    if (!best || best.confidence < DETECTION_THRESHOLD) {
      return null;
    }

    return best;
  }

  parse(doc: ExtractedPdf): CanonicalPayslip {
    if (doc.isScanned) {
      throw new ScannedPdfError();
    }

    const match = this.detect(doc);
    if (!match) {
      throw new UnrecognizedPayslipError(this.plugins.map((plugin) => plugin.displayNameKey));
    }

    let payslip: CanonicalPayslip;
    try {
      payslip = match.plugin.parse(doc);
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      throw new ParseError(error instanceof Error ? error.message : "Parse failed");
    }

    return {
      ...payslip,
      vendor: {
        ...payslip.vendor,
        id: match.plugin.id,
        parserVersion: match.plugin.version,
        displayNameKey: match.plugin.displayNameKey,
        detectionConfidence: match.confidence,
      },
    };
  }
}

export function createParserRegistry(): ParserRegistry {
  return new DefaultParserRegistry();
}
