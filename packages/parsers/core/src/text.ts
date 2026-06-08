import type { ExtractedPdf } from "@tlush/pdf-extract";

export function getFullText(doc: ExtractedPdf): string {
  return doc.pages
    .flatMap((page) => page.tokens.map((token) => token.text))
    .join(" ");
}

export function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}
