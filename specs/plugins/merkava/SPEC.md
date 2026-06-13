# Merkava Parser Spec

> **Status**: draft  
> **Version**: 1.0.0  
> **Constitution**: See [constitution.md](../../constitution.md) — client-side only, deterministic, no AI at runtime.

## Purpose

Parse payslips from **Merkava** (מרכבה) — the Israeli public-sector payroll system used by the Ministry of Education and other government employers. Layouts use **Hebrew text labels** (not Hilan-style numeric codes), multi-column RTL tables, and **Ofek Chadash** (אופק חדש) salary components. This spec does **not** cover Hilan private-sector formats.

## Detection

### Signatures

| Signal | Pattern / anchor | Weight |
| ------ | ---------------- | ------ |
| Payslip ID | `/DB-\d+-\d+/` (e.g. `DB-105292-073997`) | 0.35 |
| Employer domain | `/edu\.gov\.il/i` | 0.25 |
| Ofek markers | `אופק`, `משולב אופק חדש`, `דרגה באופק`, `ותק בהוראה` | 0.20 |
| Header | `תלוש משכורת לחודש`, `משרד החינוך` | 0.15 |
| Role context | `מחנכת`, `סגנית`, `שעות הוראה`, `מקדם משרה` | 0.05 |

### Thresholds

- **Min confidence to parse**: `0.75`
- **Negative detection**: Hilan PDF (`חילן`, codes `001`/`1160` in table) → confidence **< 0.30**

### Extraction challenges

- Body Hebrew and numbers extract as **clean Unicode**, but **reading order is jumbled** (multi-column RTL).
- Some header glyphs use **CID font** (`(cid:NNN)`) — detection may use coordinates; labels fall back to `rawLabel` from adjacent numeric rows.
- Parser MUST use **(x, y) geometry** to rebuild rows, not raw text stream order.

## Parse Behavior

### Regions

1. **Header** — payslip ID (`DB-*`), period (`MM/YYYY`, Hebrew month name + year e.g. `מרץ 2026`, or numeric month + year on the `תלוש משכורת לחודש` row), employee roles, hours, seniority (`ותק`), Ofek grade (`דרגה`).
2. **Earnings** — label-driven lines: Ofek combined pay, supplements, economic-law adjustment.
3. **Imputed** — `שווי קה"ש לצורך מס`, keren hishtalmut imputed value.
4. **Statutory deductions** — income tax, Bituach Leumi, health tax; watch for **הפרשי** adjustment lines.
5. **Funds** — pension (e.g. `הראל מנוף`), keren hishtalmut (`ק.השת)הסת( בינ"ל`), gemel (`גל גמל`).
6. **Page 2 YTD** — cumulative bases and deductions.

### Mapping strategy

- **Label-first** via `codes.json` `labelPatterns` (normalized Hebrew, collapsed whitespace).
- Synthetic codes prefixed `DB-` when no vendor code exists (e.g. `DB-SALARY-OFEX`).
- Unknown labels → `category: "unknown"`.

### Amount rules

- **Tolerance**: ±₪0.01
- Deductions stored as **positive** amounts in `deductions[]`
- NI/health **הפרשי** lines set flags `ni_adjustment` / `health_adjustment`

### Required totals

| Field | Typical source label |
| ----- | -------------------- |
| `totals.grossCash` | סה"כ תשלומים / שכר ברוטו / page-1 `נקודות זיכוי` summary row (largest amount) |
| `totals.netPay` | נטו לתשלום / נטו לחשבון / page-1 header summary (gross − deductions, label often absent) |
| `totals.incomeTax` | page-1 combined statutory row (`מס הכנסה` column); cap to `grossCash − netPay` when credits reduce withholding |
| `totals.ni` | page-1 combined statutory row (`ביטוח לאומי` column) — not page-2 YTD `ניכוי` rows |
| `totals.healthTax` | page-1 combined statutory row (`ביטוח בריאות` column) |
| `totals.taxableGross` | שכר חייב במס / ברוטו לצורך מס |

## Acceptance Criteria

1. WHEN parsing fixture `march-2026-education` THEN `vendor.id` = `merkava`.
2. WHEN parsing fixture `march-2026-education` THEN `totals.netPay` = `18693.73` (±0.01) AND `totals.grossCash` = `19836.64` (±0.01).
3. WHEN payslip ID matches `DB-\d+-\d+` THEN detection confidence ≥ `0.75`.
4. WHEN label `משולב אופק חדש` present THEN mapped to `earnings.base_salary` with `explanationKey`.
5. WHEN label `הפרשי ביטוח לאומי` present THEN `category` = `deduction.ni_adjustment` AND flag `ni_adjustment`.
6. WHEN label `שווי קה"ש לצורך מס` present THEN `isImputed: true` AND flag `imputed_income_present`.
7. WHEN Hilan PDF submitted THEN `detect()` confidence < `0.30`.
8. WHEN output produced THEN document validates against `schemas/canonical-payslip.schema.json`.

## Edge Cases

- **CID headers**: employer name line may not decode — use `employer.name` from fixture anchor or `parseMeta.warnings`.
- **Multiple roles**: homeroom + vice-principal hours — store in `employee.roles` and `employee.hours`.
- **High credit points** (e.g. 9.25 for teachers) — `context.creditPoints` from `פרוט נקודות זיכוי`.
- **NI/health deltas**: prior-period corrections common in education payroll.
- **YTD page 2**: populate `context.ytd`, flag `multi_page_ytd`.

## Non-Goals

- Private-sector Merkava variants outside education.
- OCR for scanned payslips.

## Fixtures

| ID | Source PDF (gitignored) | Expected JSON | Notes |
| -- | ----------------------- | ------------- | ----- |
| `march-2026-education` | `tests/fixtures/pdf/merkava-march-2026.pdf` | `fixtures/march-2026-education.json` | Synthetic realistic structure — no sample PDF in repo |

## Dependencies

- `specs/schemas/canonical-payslip.schema.json`
- `specs/schemas/line-item.schema.json`
- `specs/core/pdf-extract.SPEC.md`
- `specs/core/parser-registry.SPEC.md`

## Changelog

| Version | Date | Change |
| ------- | ---- | ------ |
| 1.0.1 | 2026-06-13 | Fix gross/tax totals: credit-points gross row, page-1 statutory band, skip YTD fund rows |
| 1.0.0 | 2026-06-08 | Initial spec — education/public-sector format |
