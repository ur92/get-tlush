# Calculator Spec

Israeli payroll validation engine — direct port of `calculate_payroll.py` (2026 rates).

## Purpose

Recompute standard statutory deductions from parsed payslip inputs and **verify** that payslip totals are within tolerance. The calculator does **not** replace the payslip as source of truth; it flags mismatches for user review.

## Inputs

| Field | Type | Default | Notes |
| ----- | ---- | ------- | ----- |
| `grossSalary` | number | required | Monthly cash gross (NIS) |
| `creditPoints` | number | `2.25` | Nekudot zikui |
| `hasPension` | boolean | `true` | Employee 6% pension deduction |
| `shoviRechev` | number | `0` | Company-car imputed income — taxable, not cash |
| `calcEmployer` | boolean | `false` | Include employer cost fields |

## Formulas

### Taxable gross

```
taxable_gross = grossSalary + shoviRechev
```

Pension base uses `grossSalary` only (excludes shovi rechev).

### Income tax (progressive brackets)

Apply brackets from `tax-rates-2026.json` → `incomeTax.brackets` to `taxable_gross`.

```
tax = bracketed_tax(taxable_gross)
tax = max(0, tax - creditPoints × 242 - pensionCredit)
```

Tax cannot go negative (no payroll refund).

### Pension tax credit (Section 45a, zikui gemel)

```
cappedSalary = min(grossSalary, 9700)
maxQualifying = cappedSalary × 0.07
eligible = min(pensionEmployee, maxQualifying)
pensionCredit = round(eligible × 0.35, 2)
```

Max credit: **237.65 NIS/month** (when contribution ≥ 679).

### Bituach Leumi + health tax

Apply to `min(taxable_gross, 51910)`:

- First **7,703 NIS**: 1.04% NI + 3.23% health
- Remainder up to ceiling: 7.0% NI + 5.17% health

### Pension (employee)

```
pensionEmployee = hasPension ? round(grossSalary × 0.06, 2) : 0
```

### Net salary (cash)

```
netSalary = grossSalary - incomeTax - bituachLeumi - healthTax - pensionEmployee
```

Shovi rechev is **not** added to net — employee never receives it as cash.

### Employer cost (optional)

```
employerNi = NI on taxable_gross (4.51% reduced / 7.6% full)
employerPension = grossSalary × 0.065
employerSeverance = grossSalary × 0.06
totalEmployerCost = grossSalary + employerNi + employerPension + employerSeverance
```

## Rates file

All constants and test vectors live in [`tax-rates-2026.json`](tax-rates-2026.json). Implementation MUST load rates from this file — no hardcoded brackets in code.

## Validation usage (payslip reconciliation)

When comparing to parsed `CanonicalPayslip` totals:

| Parsed field | Calculator output | Tolerance |
| ------------ | ----------------- | --------- |
| `incomeTax` | `incomeTax` | ±₪5 |
| `ni` | `bituachLeumi` | ±₪5 |
| `healthTax` | `healthTax` | ±₪5 |
| `pensionEmployee` | `pensionEmployee` | ±₪5 |

Mismatch beyond tolerance → set flag `tax_mismatch` and surface UI banner.

Inputs for reconciliation: `totals.grossCash`, `context.creditPoints`, imputed income sum (shovi rechev, keren hishtalmut taxable value, etc.).

## Acceptance criteria

1. WHEN `calculatePayroll(input)` runs for each `testVectors[]` entry in `tax-rates-2026.json` THEN every `expected` field matches within `tolerance` (±₪0.01).
2. WHEN `shoviRechev > 0` THEN `taxableGross = grossSalary + shoviRechev` AND `pensionEmployee` is based on `grossSalary` only.
3. WHEN `hasPension = false` THEN `pensionCredit = 0` AND `pensionEmployee = 0`.
4. WHEN `taxable_gross > 51910` THEN NI and health tax use ceiling **51,910** as insurable base.
5. WHEN `grossSalary = 9700` with pension THEN `pensionCredit = 203.70` (7% × 9,700 = 679 qualifying cap not reached by 6% contribution).
6. WHEN `grossSalary = 8000` with pension THEN `pensionCredit = 168.00` (actual contribution 480 < 7% × 8,000 cap).
7. WHEN `calcEmployer = true` THEN `totalEmployerCost` includes gross + employer NI + pension + severance.

## Edge cases

- **Shovi rechev**: increases tax/NI base; never increases net cash.
- **High earners**: income tax uses full brackets; NI/health capped at 51,910.
- **Low earners**: credit points may reduce tax to near zero; pension credit stacks with credit points.
- **No pension**: common in some contracts — tax is higher (no zikui gemel).

## Contract tests

```
tests/contract/calculator.test.ts
  → load tax-rates-2026.json
  → for each testVectors[i]: assert calculatePayroll(input) ≈ expected (±0.01)
```

## References

- Source: `.agents/skills/israeli-payroll-calculator/scripts/calculate_payroll.py`
- Amendment 288 (tax brackets), Amendment 252 (NI rates), Section 45a (pension credit)
