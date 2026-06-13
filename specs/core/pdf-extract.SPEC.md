# PDF Extract Spec

> **Status**: approved  
> **Version**: 1.0.0  
> **Package**: `@tlush/pdf-extract`  
> **Constitution**: [constitution.md](../constitution.md)

## Purpose

Extract positioned text tokens from a payslip PDF **entirely in the browser** using `pdfjs-dist`. Output is a stable, geometry-aware document for vendor parsers — not reading-order plain text.

This package does **not** detect vendors, map line codes, or repair Hebrew beyond the normalization hooks defined here.

## Inputs

| Input | Type | Required | Constraints |
| ----- | ---- | -------- | ----------- |
| `file` | `File` \| `ArrayBuffer` | yes | MIME `application/pdf`; max 10 MB MVP |
| `options.locale` | `string` | no | Default `he-IL` — affects number parsing hints only |

## Outputs

### `ExtractedPdf`

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `pages` | `ExtractedPage[]` | yes | One entry per PDF page |
| `pageCount` | `number` | yes | Equal to `pages.length` |
| `isScanned` | `boolean` | yes | True when no extractable text layer |
| `metadata` | `object` | no | PDF info dict (title, producer) when available |
| `warnings` | `string[]` | no | Non-fatal extraction issues |

### `ExtractedPage`

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `pageNumber` | `number` | yes | 1-based |
| `width` | `number` | yes | Page width in PDF units |
| `height` | `number` | yes | Page height in PDF units |
| `tokens` | `PositionedToken[]` | yes | All text items with geometry |

### `PositionedToken`

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `text` | `string` | yes | Raw extracted string (may be mojibake or visual-order Hebrew) |
| `x` | `number` | yes | Left edge in page coordinates |
| `y` | `number` | yes | Top edge in page coordinates (pdf.js transform) |
| `width` | `number` | yes | Bounding box width |
| `height` | `number` | yes | Bounding box height |
| `fontName` | `string` | no | pdf.js font id (e.g. `g_d0_f1`, `(cid:NNN)` families) |
| `dir` | `string` | no | Text direction when provided by pdf.js |

## Behavior

### Extraction pipeline

1. WHEN `extractPdf(file)` is called THEN pdf.js loads the document in a Web Worker when available, using the **legacy** `pdfjs-dist` build so document metadata (`Author`, `Subject`, `Producer`) is available in both browser and Node.
2. WHEN each page is processed THEN `getTextContent()` items are converted to `PositionedToken` with transform matrix → `(x, y, width, height)`.
3. WHEN adjacent items share the same baseline (|Δy| ≤ 2 px) THEN parsers may group them into rows — grouping is **not** done in this package (parser responsibility).
4. WHEN total extractable character count across all pages is **< 50** THEN set `isScanned = true`.
5. WHEN `isScanned === true` THEN return document with empty `tokens` per page but valid `pageCount`; downstream registry MUST reject parse.

### Hebrew & encoding (normalization hooks)

Parsers and shared utilities MAY apply these transforms on `token.text`; the extract layer exposes helpers:

| Function | Purpose |
| -------- | ------- |
| `tryCp1255Decode(text)` | Re-encode `latin-1` bytes → Windows-1255 (Hilan mojibake) |
| `reverseVisualHebrew(text)` | Reverse visual-order Hebrew runs to logical order |
| `normalizeDigits(text)` | Map Arabic-Indic digits to ASCII `0-9` |
| `parseNisAmount(text)` | Parse `12,345.67` / `12.345,67` / `₪` suffixed amounts → `number` |
| `decodeGhostscriptCustomFont(text, fontName?)` | Decode Ghostscript David/Miriam subset fonts (`g_d0_f1`–`f4`) |
| `isGhostscriptPdf(metadata?)` | True when PDF `Producer` contains `Ghostscript` |

Rules:

1. WHEN token contains only Latin-1 mojibake matching Hilan pattern THEN `tryCp1255Decode` + `reverseVisualHebrew` SHOULD be applied by the Hilan parser, not globally on all tokens.
2. WHEN token matches `(cid:\d+)` THEN leave unchanged; Merkava parser maps header labels separately.
3. WHEN `metadata.Producer` matches `/ghostscript/i` OR `fontName` ends with `_f1`–`_f4` THEN `decodeGhostscriptCustomFont` MUST run while building `PositionedToken.text`:
   - IPA range `U+02A0`–`U+02BF` maps to Hebrew via David byte offset (`byte - 0xA0` → alphabet index)
   - Control chars `U+0014`–`U+001D` map to digits `0`–`9`; `U+0011`/`12`/`13`/`10` → `/` `,` `.` `-`
   - Apply `reverseVisualHebrew` after glyph substitution
4. Normalization MUST be deterministic — same token text always yields same output.

### Number and currency

1. WHEN parsing amounts THEN treat comma as thousands separator and period as decimal for standard Hilan numeric cells unless locale hints say otherwise.
2. WHEN amount is parenthesized `(1,234.56)` THEN interpret as negative.

### Performance & privacy

1. PDF bytes MUST remain in memory only; no network requests during extraction.
2. WHEN extraction completes THEN no copy of the PDF is retained on the `ExtractedPdf` object.
3. Target: 2-page payslip extracts in < 3 s on mid-range mobile (non-binding performance note).

## Acceptance Criteria

1. WHEN a digital Hilan PDF is extracted THEN `isScanned === false` and `pageCount >= 1`.
2. WHEN a digital Hilan PDF is extracted THEN at least one token matches `/\d{3}/` (line codes) after extraction.
3. WHEN a digital Merkava PDF is extracted THEN `isScanned === false` and tokens include Unicode Hebrew or `(cid:` markers.
4. WHEN a scanned image-only PDF is uploaded THEN `isScanned === true`.
5. WHEN `parseNisAmount('26,730.51')` THEN result is `26730.51`.
6. WHEN `parseNisAmount('(316,000.00)')` THEN result is `-316000`.
7. WHEN extraction runs THEN zero outbound HTTP requests (enforced in contract test mock).

## Edge Cases

- **Password-protected PDF**: throw `PasswordProtectedPdfError`.
- **Corrupt PDF**: throw `PdfLoadError` with generic message; no stack to UI.
- **Multi-page YTD on page 2**: all pages extracted; parsers use `pageNumber` filter.
- **Rotated pages**: use pdf.js transform as-is; parsers use coordinates not reading order.

## Non-Goals

- OCR / Tesseract
- Server-side extraction
- Table structure inference (done in parsers via geometry)
- Embedding full PDF or images in `ExtractedPdf`

## Public API (target)

```typescript
export function extractPdf(
  input: File | ArrayBuffer,
  options?: ExtractOptions
): Promise<ExtractedPdf>;

export function tryCp1255Decode(text: string): string;
export function reverseVisualHebrew(text: string): string;
export function normalizeDigits(text: string): string;
export function parseNisAmount(text: string): number | null;
export function decodeGhostscriptCustomFont(text: string, fontName?: string): string;
export function isGhostscriptPdf(metadata?: Record<string, unknown>): boolean;

export class PdfLoadError extends Error {}
export class PasswordProtectedPdfError extends Error {}
```

## Dependencies

- `pdfjs-dist` (bundled worker in `packages/web`)
- No dependency on parser packages

## Fixtures

Golden PDFs live in `tests/fixtures/pdf/` (gitignored). Redacted token snapshots may be committed as `tests/fixtures/extracted/{vendor}-{period}.json` in Phase 1.

Committed snapshot: `tests/fixtures/extracted/hilan-shiklolit-tokens.json` — summary-region tokens from the Ghostscript shiklolit payslip; used by unit tests for `decodeGhostscriptCustomFont` without the PDF.

## Changelog

| Version | Date | Change |
| ------- | ---- | ------ |
| 1.0.2 | 2026-06-13 | Browser uses legacy pdf.js build for reliable metadata extraction |
| 1.0.1 | 2026-06-13 | Ghostscript custom-font decode hook + `isGhostscriptPdf` |
| 1.0.0 | 2026-06-08 | Initial spec — client-side pdf.js only |
