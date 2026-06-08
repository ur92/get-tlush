import { PasswordProtectedPdfError, PdfLoadError } from "./errors.js";
import type { ExtractedPage, ExtractedPdf, ExtractOptions, PositionedToken } from "./types.js";

const SCANNED_CHAR_THRESHOLD = 50;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

async function loadPdfJs() {
  if (typeof globalThis.window === "undefined") {
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  }

  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }
  return pdfjs;
}

async function toArrayBuffer(input: File | ArrayBuffer): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  if (input.type && input.type !== "application/pdf") {
    throw new PdfLoadError("Invalid PDF file type");
  }
  if (input.size > MAX_FILE_SIZE_BYTES) {
    throw new PdfLoadError("PDF exceeds maximum size");
  }
  return input.arrayBuffer();
}

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
  dir?: string;
};

function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === "object" && item !== null && "str" in item;
}

function toPositionedToken(item: PdfTextItem): PositionedToken {
  const [, , , , x, y] = item.transform;
  return {
    text: item.str,
    x,
    y,
    width: item.width,
    height: item.height,
    ...(item.fontName ? { fontName: item.fontName } : {}),
    ...(item.dir ? { dir: item.dir } : {}),
  };
}

function countExtractableChars(pages: ExtractedPage[]): number {
  return pages.reduce(
    (total, page) =>
      total + page.tokens.reduce((pageTotal, token) => pageTotal + token.text.length, 0),
    0
  );
}

function isPasswordError(error: unknown): boolean {
  return error instanceof Error && error.name === "PasswordException";
}

export async function extractPdf(
  input: File | ArrayBuffer,
  _options?: ExtractOptions
): Promise<ExtractedPdf> {
  const data = await toArrayBuffer(input);
  const warnings: string[] = [];
  const pdfjs = await loadPdfJs();

  let pdf;
  try {
    pdf = await pdfjs.getDocument({
      data,
      useSystemFonts: true,
    }).promise;
  } catch (error) {
    if (isPasswordError(error)) {
      throw new PasswordProtectedPdfError();
    }
    if (error instanceof pdfjs.InvalidPDFException) {
      throw new PdfLoadError();
    }
    throw new PdfLoadError();
  }

  const metadata: Record<string, unknown> = {};
  try {
    const info = await pdf.getMetadata();
    if (info.info && typeof info.info === "object") {
      Object.assign(metadata, info.info);
    }
  } catch {
    warnings.push("metadata_unavailable");
  }

  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const tokens: PositionedToken[] = [];
    for (const item of textContent.items) {
      if (!isTextItem(item) || item.str.length === 0) {
        continue;
      }
      tokens.push(toPositionedToken(item));
    }

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      tokens,
    });
  }

  await pdf.destroy();

  const isScanned = countExtractableChars(pages) < SCANNED_CHAR_THRESHOLD;
  if (isScanned) {
    warnings.push("low_text_content");
    for (const page of pages) {
      page.tokens = [];
    }
  }

  return {
    pages,
    pageCount: pages.length,
    isScanned,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
