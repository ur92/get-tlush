export {
  normalizeDigits,
  parseNisAmount,
  reverseVisualHebrew,
  tryCp1255Decode,
} from "./hebrew.js";
export { PasswordProtectedPdfError, PdfLoadError } from "./errors.js";
export type {
  ExtractedPage,
  ExtractedPdf,
  ExtractOptions,
  PositionedToken,
} from "./types.js";
export type { ExtractOptions as ExtractPdfOptions } from "./types.js";

import type { ExtractedPdf, ExtractOptions } from "./types.js";

export async function extractPdf(
  input: File | ArrayBuffer,
  options?: ExtractOptions
): Promise<ExtractedPdf> {
  const { extractPdf: extract } = await import("./extract.js");
  return extract(input, options);
}

/** @deprecated Use extractPdf instead. */
export async function extractTextFromPdf(file: File) {
  const doc = await extractPdf(file);
  const text = doc.pages.flatMap((page) => page.tokens.map((token) => token.text)).join(" ");
  return { text, pageCount: doc.pageCount };
}
