# Hilan Parser Spec

> **Status**: draft  
> **Version**: 1.0.0  
> **Constitution**: See [constitution.md](../../constitution.md) — client-side only, deterministic, no AI at runtime.

## Purpose

Parse payslips produced by **Hilan** (חילן) payroll for Israeli employers — especially tech-sector layouts with numeric line codes, two-page PDFs, equity (RSU/ESPP) zkifot, and cumulative YTD tables. This spec does **not** cover Merkava/education formats.

## Detection

### Signatures (any match increases score)

| Signal | Pattern / anchor | Weight |
| ------ | ---------------- | ------ |
| Vendor name | `/חילן\|Hilan/i` | 0.35 |
| Layout anchor | `עובד ומעביד`, `פרוט התשלומים`, `תלוש שכר לחודש` | 0.25 |
| Summary labels | `סך-כל התשלומים`, `נטו לתשלום`, `שכר נטו` | 0.20 |
| Line codes | Numeric codes `001`, `002`, `100`, `107`, `111`, `1160`, `1660`, `202`, `203` in earnings/deductions tables | 0.20 |

### Thresholds

- **Min confidence to parse**: `0.80`
- **Negative detection**: Merkava PDF (`DB-`, `edu.gov.il`, `אופק`) → confidence **< 0.30**

### Encoding note

Raw `pdf.js` / `pdftotext` extraction often returns Hebrew as **Windows-1255 bytes in visual (reversed) order**. Detection MUST run after `latin-1 → cp1255` recovery and per-token visual→logical reversal (see `specs/core/pdf-extract.SPEC.md`).

## Parse Behavior

### Table extraction

1. Group positioned tokens into rows by `y` tolerance (~3pt).
2. Split rows into columns using x-clusters: code | label | rate | quantity | amount.
3. Map rows in regions anchored by `פרוט התשלומים`, `זקיפות שכר`, `ניכויי חובה`, `קופות גמל בהסכם`, `ניכויי התחייבות`.
4. Page 2: credit points, leave balances, YTD fund totals, obligatory deduction detail (codes 602, 607, 1660).

### Amount rules

- **Tolerance**: ±₪0.01 vs fixture/manifest `amountTolerance`.
- **Sign**: Deductions stored as **positive** amounts in `deductions[]`; negative **earnings** lines (corrections) keep negative `amount`.
- **Totals reconciliation**: `totals.netPay` MUST match printed `נטו לתשלום`; `totals.totalEarnings` MUST match `סך-כל התשלומים` when present.

### Required totals

| Field | Hilan source label |
| ----- | ------------------ |
| `totals.totalEarnings` | סך-כל התשלומים |
| `totals.netPay` | נטו לתשלום |
| `totals.incomeTax` | מס הכנסה (monthly column, not YTD) |
| `totals.ni` | ביטוח לאומי |
| `totals.healthTax` | ביטוח בריאות / דמי בריאות |
| `totals.grossCash` | Sum of cash earnings lines (excludes imputed zkifot) |
| `totals.taxableGross` | Cash gross + סה"כ זקיפות שכר (imputed taxable base) |

### RTL

- Normalize reversed Hebrew labels before `codes.json` lookup.
- Numbers are LTR; do not reverse digit strings.

### Line code mapping

See `codes.json`. Unknown codes → `category: "unknown"`, include in output, set `flags` to include `unknown_line_items` when any unknown remains.

## Acceptance Criteria

1. WHEN parsing fixture `april-2026` THEN `totals.netPay` = `26730.51` (±0.01).
2. WHEN parsing fixture `april-2026` THEN `totals.totalEarnings` = `60716.31` (±0.01).
3. WHEN parsing fixture `may-2026` THEN `totals.netPay` = `57226.20` (±0.01).
4. WHEN parsing fixture `may-2026` THEN printed net salary (`שכר נטו`) is negative (`-316654.80` ±0.01) AND `flags` contains `negative_gross` and `equity_vesting`.
5. WHEN line code `107` is present THEN `category` = `equity.rsu_vesting` AND `explanationKey` is set (employer may label as miluim — code wins).
6. WHEN line code `111` is present with equity context THEN `category` = `equity.rsu_vesting` OR `earnings.reserve_duty` based on label; May fixture uses `equity.rsu_vesting` for RSU sale tax base lines.
7. WHEN line codes `1160` / `1660` present THEN `flags` contains `equity_espp` and ESPP lines mapped per `codes.json`.
8. WHEN line codes `202` / `203` present (May) THEN imputed `equity.capital_gain_value` / `equity.ordinary_income_value` populated in `context.equity`.
9. WHEN unknown line code THEN item included with `category: "unknown"`.
10. WHEN output produced THEN document validates against `schemas/canonical-payslip.schema.json`.

## Edge Cases

### Negative gross / net salary (May 2026)

- RSU vesting correction month: printed `שכר נטו` = **-316,654.80** while `נטו לתשלום` stays **positive** (57,226.20).
- Large imputed zkifot: `202` שווי מס הוני (805,762.01), `203` שווי מס פרותי (289,674.93), total zkifa ≈ 1,097,584.71.
- Obligatory correction `602` מקדמה/מפרעה: **-381,531.42** on page 2.
- UI MUST explain via `negative_gross` + `equity_vesting` flags — not a bank deposit of -316K.

### RSU vesting codes 107 / 111

- **107** — employer label may read `השלמת מילואים הפרש` (reserve delta) or RSU vesting; map by code to `equity.rsu_vesting` for tech employers.
- **111** — `עבודה במילואים` or RSU-related; April fixture treats as `earnings.reserve_duty`; May ties to equity sale tax workflow.

### ESPP 1160 / 1660

- **1160** — `אחוז espp` (contribution rate, often 0.15).
- **1660** — `ניכוי espp` (purchase deduction, e.g. 7,500.00).
- Rate line may appear in earnings with near-zero amount; deduction is cash outflow in `deductions[]`.

### RSU sale tax (TBD)

- Withholding on RSU liquidity events is **not fully specified** in sample PDFs.
- Parser MUST capture imputed `202`/`203` and flag `equity_vesting`; dedicated `rsu_sale_tax` category deferred until a fixture with explicit withholding code is added.
- Until then: emit `parseMeta.warnings` entry `rsu_sale_tax_mapping_tbd` when `202`+`203` present without matching tax line.

### Cumulative YTD (page 2)

- Fund bases, credit-point breakdown, leave balances — populate `context.ytd` and `context.leave` when extractable; flag `multi_page_ytd`.

### PII

- Fixtures redact employee name/ID; parser MAY populate `employee` locally but analytics ingest strips it.

## Non-Goals

- Scanned/image Hilan PDFs.
- Non-Hilan vendors sharing similar codes.
- Computing net pay from scratch (calculator spec handles validation).

## Fixtures

| ID | Source PDF (gitignored) | Expected JSON | Notes |
| -- | ----------------------- | ------------- | ----- |
| `april-2026` | `tests/fixtures/pdf/hilan-april-2026.pdf` | `fixtures/april-2026.json` | FileDownload (8).pdf — net 26,730.51 |
| `may-2026` | `tests/fixtures/pdf/hilan-may-2026.pdf` | `fixtures/may-2026.json` | FileDownload (7).pdf — negative net salary, equity zkifot |

## Dependencies

- `specs/schemas/canonical-payslip.schema.json`
- `specs/schemas/line-item.schema.json`
- `specs/core/pdf-extract.SPEC.md`
- `specs/core/parser-registry.SPEC.md`

## Changelog

| Version | Date | Change |
| ------- | ---- | ------ |
| 1.0.0 | 2026-06-08 | Initial spec from FileDownload (7/8).pdf samples |
