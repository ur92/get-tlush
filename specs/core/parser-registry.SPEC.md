# Parser Registry Spec

> **Status**: approved  
> **Version**: 1.0.0  
> **Package**: `@tlush/parsers-core`  
> **Constitution**: [constitution.md](../constitution.md)

## Purpose

The Parser Registry discovers which payroll vendor produced a payslip PDF and dispatches parsing to the correct plugin. It is the single entry point between PDF extraction and `CanonicalPayslip` output.

The registry does **not** parse PDF bytes, explain payslips, or call external APIs.

## Inputs

| Input | Type | Required | Source |
| ----- | ---- | -------- | ------ |
| `doc` | `ExtractedPdf` | yes | `@tlush/pdf-extract` per [pdf-extract.SPEC.md](./pdf-extract.SPEC.md) |
| Registered plugins | `PayslipParserPlugin[]` | yes | `apps/web/src/parsers/index.ts` explicit registration |

## Outputs

| Output | Type | Contract |
| ------ | ---- | -------- |
| Detection result | `{ plugin, confidence } \| null` | confidence ∈ [0, 1] |
| Parse result | `CanonicalPayslip` | [canonical-payslip.schema.json](../schemas/canonical-payslip.schema.json) |
| List plugins | `PayslipParserPlugin[]` | ordered by registration |

## Plugin Interface

Every parser plugin MUST implement:

```typescript
interface PayslipParserPlugin {
  readonly id: VendorId;           // 'hilan' | 'merkava' | ...
  readonly version: string;        // semver — matches vendor.parserVersion in output
  readonly displayNameKey: string;  // i18n key, e.g. 'vendors.hilan'

  /** Score 0–1: does this PDF belong to this vendor? */
  detect(doc: ExtractedPdf): DetectionResult;

  /** Parse to CanonicalPayslip; throws ParseError if structure unsupported */
  parse(doc: ExtractedPdf): CanonicalPayslip;
}

interface DetectionResult {
  confidence: number;   // 0..1
  signals: string[];  // matched signature ids for debugging
}

interface ParserRegistry {
  register(plugin: PayslipParserPlugin): void;
  list(): PayslipParserPlugin[];
  detect(doc: ExtractedPdf): { plugin: PayslipParserPlugin; confidence: number } | null;
  parse(doc: ExtractedPdf): CanonicalPayslip;
}
```

## Behavior

### Registration

1. WHEN `register(plugin)` is called THEN the plugin is appended to the internal list.
2. WHEN the same `plugin.id` is registered twice THEN the later registration replaces the earlier (same id + higher or equal version).
3. Plugins MUST NOT import other vendor parser packages.

### Detection

1. WHEN `detect(doc)` is called THEN each registered plugin's `detect(doc)` runs independently.
2. WHEN multiple plugins return confidence > 0 THEN the plugin with the **highest** confidence wins.
3. WHEN the highest confidence is **≥ 0.8** THEN `detect` returns `{ plugin, confidence }`.
4. WHEN the highest confidence is **< 0.8** THEN `detect` returns `null`.
5. WHEN two plugins tie on confidence THEN prefer the plugin registered **first** (stable ordering).
6. Each vendor spec (`specs/plugins/{vendor}/SPEC.md`) defines signatures and negative signals (e.g. Hilan on Merkava PDF → confidence < 0.3).

### Parse

1. WHEN `parse(doc)` is called THEN `detect(doc)` runs first.
2. WHEN detection returns a plugin THEN `plugin.parse(doc)` is invoked.
3. WHEN detection returns `null` THEN throw `UnrecognizedPayslipError` with `supportedVendors` = registered plugin display keys.
4. WHEN `parse` completes THEN output MUST validate against `canonical-payslip.schema.json`.
5. WHEN `parse` completes THEN `output.vendor.id` MUST equal `plugin.id` and `output.vendor.parserVersion` MUST equal `plugin.version`.
6. WHEN `parse` completes THEN `output.vendor.detectionConfidence` MUST equal the detection confidence used.

### Error Types

| Error | When |
| ----- | ---- |
| `UnrecognizedPayslipError` | No plugin ≥ 0.8 confidence |
| `ParseError` | Plugin detected but structure unsupported or totals reconciliation failed beyond tolerance |
| `ScannedPdfError` | Upstream extraction marked `doc.isScanned === true` |

## Acceptance Criteria

1. WHEN a Hilan golden PDF is passed THEN `detect` returns `hilan` with confidence ≥ 0.8.
2. WHEN a Merkava golden PDF is passed THEN `detect` returns `merkava` with confidence ≥ 0.8.
3. WHEN a Hilan PDF is passed to Merkava-only detection THEN Merkava confidence < 0.3.
4. WHEN a Merkava PDF is passed to Hilan-only detection THEN Hilan confidence < 0.3.
5. WHEN `parse` succeeds THEN returned JSON passes ajv validation against `canonical-payslip.schema.json`.
6. WHEN no plugin matches THEN `parse` throws `UnrecognizedPayslipError` and never invokes `plugin.parse`.
7. WHEN `doc.isScanned === true` THEN `parse` throws `ScannedPdfError` before detection (MVP: no OCR).

## Edge Cases

- **Format variants within vendor**: handled by plugin version + fixtures; registry does not branch on version.
- **Unknown vendor with readable totals**: detection fails; UI shows supported formats list — no generic parser in MVP registry path.
- **Empty registration**: `detect` and `parse` always fail gracefully.

## Non-Goals

- Dynamic plugin loading from URL
- Runtime plugin discovery from filesystem
- Parallel parse of multiple plugins (detect only runs all; parse runs one)

## Dependencies

- [pdf-extract.SPEC.md](./pdf-extract.SPEC.md)
- `specs/plugins/{vendor}/SPEC.md` per registered vendor

## Fixtures

Contract tests use per-vendor `manifest.json` entries; registry tests live in `tests/contract/registry.test.ts` (Phase 1).

## Changelog

| Version | Date | Change |
| ------- | ---- | ------ |
| 1.0.0 | 2026-06-08 | Initial spec — MVP Hilan + Merkava |
