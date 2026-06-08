# Explanation Engine Spec

Deterministic Hebrew explanations for payslip line items and summary insights. Zero LLM at runtime.

## Purpose

Map parsed `CanonicalPayslip` → structured explanations for UI. Every classified `LineItem` receives an `explanationKey`. Text comes from `locales/he.json` templates — no hardcoded Hebrew in logic.

## Architecture

```
CanonicalPayslip
  → explain/engine.ts
    → resolve explanationKey per LineItem (codes.json + knowledge/)
    → build insights: waterfall, taxes, variable items, equity, flags
  → locales/he.json (templates)
  → UI components
```

Knowledge sources:

- `packages/knowledge/shared/taxes.json` — universal items (income tax, NI, pension, imputed income)
- `packages/knowledge/vendors/{vendor}.json` — vendor-specific code/label → `explanationKey`

## explanationKey contract

Every `LineItem` with `category !== 'unknown'` MUST have:

```typescript
interface LineItem {
  code?: string;
  rawLabel?: string;
  amount: number;
  category: string;           // e.g. earnings.base, equity.rsu_sale_tax
  explanationKey: string;     // i18n key, e.g. items.equity.rsu_vesting
}
```

Resolution order:

1. Vendor `codes.json` match (code or label pattern)
2. Vendor `knowledge/vendors/{vendor}.json`
3. Shared `knowledge/shared/` by category
4. Fallback: `items.unknown` + flag `unclassified_item`

## Explanation rules

### R1 — Net waterfall

Produce ordered steps for UI waterfall (`NetBreakdown`):

| Step | Source | explanationKey |
| ---- | ------ | -------------- |
| Gross cash | `totals.grossCash` | `waterfall.gross_cash` |
| Imputed income (if any) | sum imputed[] | `waterfall.imputed_income` |
| Taxable gross | `totals.taxableGross` | `waterfall.taxable_gross` |
| Income tax | `totals.incomeTax` | `waterfall.income_tax` |
| Bituach Leumi | `totals.ni` | `waterfall.ni` |
| Health tax | `totals.healthTax` | `waterfall.health_tax` |
| Pension (employee) | context or deductions | `waterfall.pension_employee` |
| Other deductions | voluntary sums | `waterfall.other_deductions` |
| Net to pay | `totals.netPay` | `waterfall.net_pay` |

Template variables: `{{amount}}`, `{{period}}`.

### R2 — Imputed income (shovi rechev, keren hishtalmut value, equity zkifot)

WHEN line `category` starts with `imputed.` OR `equity.` (vesting/capital/ordinary value):

- `explanationKey`: `items.imputed.taxable_not_cash`
- Message (he.json): amount is **not paid in cash** but increases income tax and NI base, reducing net.

Applies to: shovi rechev, `שווי קה"ש לצורך מס`, RSU vesting value (202/203), keren hishtalmut imputed.

### R3 — Taxes and credits

WHEN explaining statutory deductions:

| Topic | explanationKey | Trigger |
| ----- | -------------- | ------- |
| Income tax | `taxes.income_tax` | always if > 0 |
| Credit points | `taxes.credit_points` | `context.creditPoints` set |
| Zikui gemel | `taxes.pension_credit` | pension + credit applied |
| Bituach Leumi | `taxes.ni` | always if > 0 |
| Health tax | `taxes.health` | always if > 0 |
| NI adjustment | `taxes.ni_adjustment` | flag `ni_adjustment` or matching line |
| Tax mismatch | `taxes.mismatch` | calculator flag `tax_mismatch` |

Include calculator estimate vs parsed when mismatch flagged.

### R4 — Pension and keren hishtalmut

| Category | explanationKey |
| -------- | -------------- |
| `deductions.pension` | `items.pension.employee` |
| `employer.pension` | `items.pension.employer` |
| `deductions.keren_hishtalmut` | `items.keren_hishtalmut` |
| Imputed keren value | `items.keren_hishtalmut.imputed` |

Note mandatory rates (6% employee pension) in template footnote.

### R5 — Equity

| Category | explanationKey | Notes |
| -------- | -------------- | ----- |
| `equity.rsu_vesting` | `items.equity.rsu_vesting` | Taxable at vest; NI + income tax |
| `equity.rsu_sale` | `items.equity.rsu_sale` | Proceeds to account |
| `equity.rsu_sale_tax` | `items.equity.rsu_sale_tax` | **Tax withheld after sell** |
| `equity.espp_purchase` | `items.equity.espp` | Discounted purchase deduction |
| `equity.correction` | `items.equity.correction` | Negative gross / prior-period fix |
| `equity.capital_value` | `items.equity.capital_value` | שווי הוני |
| `equity.ordinary_value` | `items.equity.ordinary_value` | שווי פירותי |

RSU sale explanation MUST clarify: proceeds deposited minus tax withheld on sale (separate from vesting tax).

### R6 — Variable / one-time items

WHEN `category` in `earnings.bonus`, `earnings.adjustment`, `earnings.retroactive`, `deductions.advance`:

- `explanationKey`: `items.variable.{subtype}`
- Add to "what changed" insight list for session

WHEN two payslips in same session: diff amounts → `insights.month_over_month` with `explanationKey` per changed line.

### R7 — Flags and anomalies

| Flag | explanationKey | UI |
| ---- | -------------- | -- |
| `negative_gross` | `flags.negative_gross` | banner |
| `equity_vesting` | `flags.equity_vesting` | banner |
| `equity_sale` | `flags.equity_sale` | banner |
| `tax_mismatch` | `flags.tax_mismatch` | banner |
| `ni_adjustment` | `flags.ni_adjustment` | banner |
| `unclassified_item` | `flags.unclassified` | inline per row |

### R8 — Disclaimer

Always append `disclaimer.not_tax_advice` on summary screen (from he.json).

## Output shape

```typescript
interface ExplanationResult {
  waterfall: WaterfallStep[];       // each step has explanationKey + amount
  lineItems: AnnotatedLineItem[];   // original LineItem + explanationKey + rendered text
  insights: Insight[];              // summary bullets (taxes, equity, variable)
  flags: FlagExplanation[];         // flag + explanationKey + severity
}
```

Rendering: `t(explanationKey, { amount, creditPoints, ... })` via i18next.

## Vendor code → explanationKey (examples)

From `specs/plugins/hilan/codes.json` / knowledge:

| Code | category | explanationKey |
| ---- | -------- | -------------- |
| `001` | `earnings.base` | `items.earnings.base_salary` |
| `100` | `earnings.travel` | `items.earnings.travel` |
| `107` | `equity.rsu_vesting` | `items.equity.rsu_vesting` |
| `1160` | `equity.espp` | `items.equity.espp` |
| `1660` | `equity.espp` | `items.equity.espp` |
| `202` | `equity.capital_value` | `items.equity.capital_value` |
| `203` | `equity.ordinary_value` | `items.equity.ordinary_value` |
| `012` | `deductions.pension` | `items.pension.employee` |
| `205` | `deductions.keren_hishtalmut` | `items.keren_hishtalmut` |
| TBD | `equity.rsu_sale` | `items.equity.rsu_sale` |
| TBD | `equity.rsu_sale_tax` | `items.equity.rsu_sale_tax` |

Merkava: label-pattern matching → same shared keys where category aligns.

## Acceptance criteria

1. WHEN fixture payslip parsed THEN every non-`unknown` `LineItem` has non-empty `explanationKey`.
2. WHEN line code `107` present THEN `explanationKey = items.equity.rsu_vesting`.
3. WHEN imputed income present THEN waterfall includes imputed step AND line uses `items.imputed.taxable_not_cash`.
4. WHEN RSU sale tax line parsed THEN `explanationKey = items.equity.rsu_sale_tax` AND insight mentions post-sale withholding.
5. WHEN `tax_mismatch` flag set THEN `flags.tax_mismatch` insight rendered with calculator delta.
6. WHEN `negative_gross` flag (may-2026 fixture) THEN `flags.negative_gross` banner shown.
7. WHEN explanation rendered THEN text comes from `he.json` — grep `packages/explain/` finds no Hebrew string literals.
8. WHEN unknown line code THEN `category = unknown`, `explanationKey = items.unknown`.

## Contract tests

```
tests/contract/explain.test.ts
  → for each plugin fixture: explain(engine, payslip)
  → assert all classified lines have explanationKey
  → assert required keys exist in locales/he.json
  → snapshot insight count for golden fixtures
```

## Non-goals

- No LLM / ChatGPT at runtime
- No personalized tax advice
- No English UI in MVP (keys ready for `en.json` later)
