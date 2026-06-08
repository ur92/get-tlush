# UI Spec

Hebrew RTL web interface for tlush. All user-facing strings in `locales/he.json`.

## Global requirements

| Requirement | Implementation |
| ----------- | -------------- |
| Language | Hebrew (`lang="he"`, `dir="rtl"`) |
| Layout | RTL — mirrors, right-aligned text, tab order logical for RTL |
| Typography | System font stack or Hebrew-friendly web font |
| Currency | `₪` suffix, `he-IL` number formatting |
| i18n | No hardcoded Hebrew in components — `t('key')` only |
| Auth | Protected `/app/*` per `specs/auth/SPEC.md` |
| Disclaimer | Fixed footer on app screens: `disclaimer.not_tax_advice` |

## Route map

| Route | Screen | Auth |
| ----- | ------ | ---- |
| `/login` | Login | public |
| `/callback` | OIDC callback | public |
| `/terms` | Terms & Privacy | public |
| `/app/upload` | Upload + consent | protected |
| `/app/summary` | Payslip summary | protected |
| `/app/breakdown` | Waterfall + tabs | protected |

Default post-login redirect: `/app/upload`.

## Screen: Login (`/login`)

**Purpose**: Google OIDC sign-in entry.

**Layout** (RTL):

```
┌─────────────────────────────────────┐
│           [tlush logo]              │
│     הסבר תלוש השכר שלך              │
│                                     │
│   [ G  התחברות עם Google ]          │
│                                     │
│   קישור: תנאי שימוש ופרטיות        │
└─────────────────────────────────────┘
```

**Elements**:

| Element | i18n key | Behavior |
| ------- | -------- | -------- |
| Title | `login.title` | |
| Google button | `login.sign_in_google` | `auth.signinRedirect()` |
| Terms link | `login.terms_link` | opens `/terms` |
| Loading | `login.loading` | while `auth.isLoading` |

**Acceptance**:

1. WHEN unauthenticated THEN Google button visible.
2. WHEN authenticated THEN redirect to `/app/upload`.
3. WHEN click Google THEN OIDC redirect starts.

---

## Screen: Upload + consent (`/app/upload`)

**Purpose**: Accept PDF, enforce terms, trigger parse + optional analytics.

**Layout**:

```
┌─────────────────────────────────────┐
│  [←]  העלאת תלוש                    │
│                                     │
│  ℹ️ הקובץ נשאר במכשיר שלך — לא      │
│     מועלה לשרת                      │
│                                     │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐       │
│  │  גרור PDF או לחץ לבחירה  │       │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘       │
│                                     │
│  ☑ אני מסכים/ה לתנאי השימוש        │
│    (קישור לתנאים)                   │
│                                     │
│  [ נתח תלוש ]  (disabled if ☐)      │
└─────────────────────────────────────┘
```

**Elements**:

| Element | i18n key | Behavior |
| ------- | -------- | -------- |
| Privacy notice | `upload.privacy_notice` | Always visible |
| Drop zone | `upload.drop_zone` | PDF only; max size per constitution |
| Terms checkbox | `upload.terms_checkbox` | **Default: checked** |
| Terms link | `upload.terms_link` | `/terms` or modal with `TERMS.md` content |
| Analyze button | `upload.analyze` | **Disabled when checkbox unchecked** |
| Error states | `upload.error.*` | wrong type, too large, parse fail |

**Consent flow**:

1. Checkbox default **checked** (`termsAccepted = true` on mount).
2. User may uncheck — button disabled, no parse.
3. On analyze: store `termsAccepted` in session state for this upload.
4. After successful parse:
   - Navigate to `/app/summary`
   - IF `termsAccepted` THEN call `submitObservation()` (analytics)
   - IF NOT accepted THEN zero analytics network call

**Acceptance**:

1. WHEN page loads THEN terms checkbox is checked.
2. WHEN checkbox unchecked THEN analyze button disabled.
3. WHEN PDF selected AND terms checked THEN parse runs client-side only.
4. WHEN parse completes AND terms were checked THEN analytics may fire.
5. WHEN parse completes AND terms unchecked THEN no analytics call.

---

## Screen: Summary (`/app/summary`)

**Purpose**: Hero net-pay card + key totals.

**Layout**:

```
┌─────────────────────────────────────┐
│  תלוש: אפריל 2026 · חילן            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  נטו לחשבון                  │    │
│  │  ₪ 26,730.51                 │    │
│  │  מברוטו ₪ 50,600             │    │
│  └─────────────────────────────┘    │
│                                     │
│  [ המשך לפירוט → ]                  │
│                                     │
│  ⚠️ [flags banners if any]          │
│                                     │
│  disclaimer...                      │
└─────────────────────────────────────┘
```

**Elements**:

| Element | i18n key |
| ------- | -------- |
| Period + vendor | `summary.period_vendor` |
| Net hero | `summary.net_to_account` |
| Gross subtext | `summary.from_gross` |
| CTA | `summary.continue_breakdown` |
| Flag banners | `flags.*` |

**Acceptance**:

1. WHEN parse result loaded THEN net and gross displayed with ₪ formatting.
2. WHEN flags present THEN banners above disclaimer.
3. WHEN CTA clicked THEN navigate `/app/breakdown`.

---

## Screen: Breakdown — waterfall + tabs (`/app/breakdown`)

**Purpose**: Visual net waterfall and categorized line-item tables.

### Waterfall section

Vertical RTL waterfall (top = gross, bottom = net):

```
ברוטו מזומן          ₪ 50,000
  − מס הכנסה         ₪ 12,000
  − ביטוח לאומי      ₪  1,200
  − מס בריאות        ₪    900
  − פנסיה (6%)       ₪  3,000
─────────────────────────────
נטו לתשלום           ₪ 26,730
```

Each row: amount + optional `?` tooltip with `explanationKey` text.

Component: `NetBreakdown` — data from `ExplanationResult.waterfall`.

### Tabs / accordion

| Tab | i18n key | Content |
| --- | -------- | ------- |
| Fixed vs variable | `tabs.fixed_variable` | Earnings split by category |
| Taxes & credits | `tabs.taxes` | Statutory + credit points + zikui gemel |
| Pension & keren | `tabs.pension` | Pension, keren hishtalmut, imputed |
| Equity | `tabs.equity` | RSU, ESPP, sale, sale tax — **only if `has_equity`** |

Component: `SectionTable` per tab — columns: תיאור, סכום, הסבר (tooltip).

Equity tab MUST show separate rows for:

- RSU vesting
- RSU sale proceeds
- RSU sale tax (מס לאחר מכירה)

### Flags section

Persistent banners (same as summary) for active flags:

| Flag | Severity | Color |
| ---- | -------- | ----- |
| `negative_gross` | warning | amber |
| `tax_mismatch` | warning | amber |
| `ni_adjustment` | info | blue |
| `equity_vesting` | info | blue |
| `unclassified_item` | info | inline per row |

Component: `FlagBanner`.

**Acceptance**:

1. WHEN breakdown loads THEN waterfall steps match `ExplanationResult.waterfall` order.
2. WHEN equity items exist THEN equity tab visible with sale tax row if parsed.
3. WHEN line item clicked THEN tooltip shows Hebrew explanation from `explanationKey`.
4. WHEN `unknown` items exist THEN listed with `items.unknown` text + HR hint.

---

## Screen: Terms (`/terms`)

Render content from `specs/legal/TERMS.md` (Hebrew). Accessible from login and upload.

---

## Components (implementation map)

| Component | Spec section |
| --------- | ------------ |
| `LoginPage` | Login |
| `UploadPage` | Upload + consent |
| `TermsCheckbox` | Upload — default checked |
| `PayslipSummary` | Summary |
| `NetBreakdown` | Waterfall |
| `SectionTable` | Tabs |
| `EquityCard` | Equity tab highlight |
| `FlagBanner` | Flags |
| `ProtectedRoute` | Auth guard |

## Session state

```typescript
interface UploadSession {
  termsAccepted: boolean;      // from checkbox at analyze time
  payslip: CanonicalPayslip | null;
  explanation: ExplanationResult | null;
  previousPayslip?: CanonicalPayslip;  // optional same-session compare
}
```

No persistence across browser sessions in MVP.

## Accessibility

- Checkbox: associated `<label>`, keyboard toggle
- Buttons: min 44×44px touch target
- Tooltips: keyboard accessible (`aria-describedby`)
- Flag banners: `role="alert"` for warnings

## Acceptance criteria (summary)

1. WHEN app renders THEN `dir="rtl"` and `lang="he"` on root.
2. WHEN upload screen loads THEN terms checkbox checked by default.
3. WHEN terms unchecked THEN analyze disabled.
4. WHEN authenticated flow complete THEN summary → breakdown navigation works.
5. WHEN equity present THEN equity tab shows RSU sale tax explanation.
6. WHEN all strings rendered THEN keys resolve from `locales/he.json`.
7. WHEN `/app/*` without auth THEN redirect login.

## Non-goals (MVP UI)

- English UI
- Dark mode
- Payslip history across sessions
- Side-by-side PDF viewer
