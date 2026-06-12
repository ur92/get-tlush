# UI Spec

Hebrew RTL web interface for tlush. All user-facing strings in `locales/he.json`.

## Global requirements

| Requirement | Implementation |
| ----------- | -------------- |
| Language | Hebrew (`lang="he"`, `dir="rtl"`) |
| Layout | RTL — mirrors, right-aligned text, tab order logical for RTL |
| Typography | Heebo web font (Hebrew-friendly); CSS design tokens in `packages/web/src/index.css` |
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
| Privacy notice | `upload.trust_title` + `upload.trust_body` | Trust banner — file stays on device |
| Page intro | `upload.intro` | Welcoming one-liner under title |
| Drop zone | `upload.drop_zone` + `upload.drop_hint` | PDF only; max size per constitution |
| Terms checkbox | `upload.terms_checkbox` | **Default: checked** |
| Terms link | `upload.terms_link` | `/terms` or modal with `TERMS.md` content |
| Analyze button | `upload.analyze` | **Disabled when checkbox unchecked** |
| Error states | `upload.error.*` | Plain Hebrew — no technical jargon |

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

**Purpose**: Jargon-free payslip story — how much was earned, what was taken for taxes and savings, and what reached the bank account. Full line-item breakdown stays behind a CTA to `/app/breakdown`.

**Layout**:

```
┌─────────────────────────────────────┐
│  תלוש: אפריל 2026 · חילן            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  מה שנכנס לחשבון             │    │
│  │  ₪ 26,730.51                 │    │
│  └─────────────────────────────┘    │
│                                     │
│  [ flow diagram: gross → net + out ]│
│                                     │
│  בוא נראה מאיפה הגיע הסכום...       │
│                                     │
│  ▶ כמה הרווחת          ₪ 60,716    │
│  ▶ מיסים וביטוח        ₪ 23,065    │
│  ▶ חיסכון לפנסיה       ₪ 4,428     │
│  ▶ ניכויים נוספים      ₪ 6,492     │  (only if > 0)
│                                     │
│  מה שנשאר לך ביד        ₪ 26,730    │
│                                     │
│  [ רוצה לראות את כל הפרטים? ]       │
│                                     │
│  ⚠️ [flags banners if any]          │
│                                     │
│  disclaimer...                      │
└─────────────────────────────────────┘
```

**Data**: `buildSimpleSummary(payslip, explanation)` in `packages/web/src/lib/simple-groups.ts` groups totals and `ExplanationResult.lineItems` into earned / taxes / savings / other buckets.

**Elements**:

| Element | i18n key | Component |
| ------- | -------- | --------- |
| Period + vendor | `summary.period_vendor` | `PayslipSummary` |
| Net hero | `summary.net_to_account` | `PayslipSummary` |
| Flow diagram | `summary.flow.*`, `summary.group.*` | `PayslipFlow` |
| Story intro | `summary.intro` | `PayslipSummary` |
| Expandable groups | `summary.you_earned`, `summary.group.*` | `ExplainCard` |
| Group intros | `summary.explain.*` | `ExplainCard` |
| Tax sub-rows | `summary.tax.*` | `simple-groups` detail rows |
| Per-line prose | `AnnotatedLineItem.text` from `@tlush/knowledge` | `ExplainCard` details |
| Result line | `summary.result` | `PayslipSummary` |
| Full-details CTA | `summary.continue_breakdown` | navigates `/app/breakdown` |
| Flag banners | `ExplanationResult.flags[].text` | `FlagBanner` |

**Flow diagram** (`PayslipFlow` + `buildFlowLayout` in `packages/web/src/lib/flow-layout.ts`):

- Custom inline SVG Sankey-style diagram — no chart library dependency.
- RTL orientation: earnings source nodes on the **right**, gross trunk in the **center**, outflow nodes (net, taxes, savings, other) on the **left**.
- Earnings `details` from the earnings group become one source node each (height ∝ amount); if none, a single source node uses `summary.earned`.
- Gross node value = `summary.earned`; outflow nodes use `summary.proportions` (net / taxes / savings / other), each omitted when amount ≤ 0.
- Color mapping (CSS tokens): net → `--color-success`, taxes → `--color-tax`, savings → `--color-savings`, other → `--color-other`; source/gross → `--color-success` (inflow).
- Links are filled ribbon paths (cubic-bezier) colored by destination tone at reduced opacity.
- `role="img"` + `summary.flow.aria`; expandable `ExplainCard` groups below remain the accessible detail view for screen readers.
- Responsive via SVG `viewBox`; wrapper allows horizontal scroll on very narrow viewports.

**Acceptance**:

1. WHEN summary loads THEN net pay, earned amount, and grouped taxes/savings are shown without payroll jargon (no ברוטו/נטו/הכנסה חייבת in summary copy except the flow diagram gross label `summary.flow.gross`).
2. WHEN summary loads THEN the flow diagram renders source → gross → outflow ribbons with amounts conserved (gross = net + taxes + savings + other; sum of sources = gross).
3. WHEN earned ≤ 0 THEN the flow diagram renders nothing (no NaN / negative geometry).
4. WHEN a group card is activated THEN detail rows expand with plain explanations from `AnnotatedLineItem.text` and the control is keyboard accessible (`aria-expanded`, Enter/Space toggle).
5. WHEN remaining deductions after taxes and savings are zero THEN the "other" group card is hidden.
6. WHEN flags present THEN banners render below the summary story.
7. WHEN CTA clicked THEN navigate `/app/breakdown`.

---

## Screen: Breakdown — waterfall + tabs (`/app/breakdown`)

**Purpose**: Guided net waterfall and categorized line-item cards with human-readable explanations.

Data source: `explainPayslip()` from `@tlush/explain` (not the web stub). Prose strings come from `@tlush/knowledge` locales.

### Waterfall section

Vertical RTL waterfall (top = gross, bottom = net). Each step shows:

1. Short label (from `locales/he.json` `waterfall.*` keys)
2. Formatted amount (`₪`, `he-IL`)
3. Inline explanation paragraph (`WaterfallStep.text` from explain engine)

Component: `NetBreakdown` — data from `ExplanationResult.waterfall`.

Deduction steps are visually indented; net pay step uses hero styling.

### Tabs — card list (not spreadsheet table)

| Tab | i18n key | Content |
| --- | -------- | ------- |
| Fixed vs variable | `breakdown.tabs.fixed_variable` | Earnings + one-time items; tab intro `breakdown.tab_intro.fixed_variable` |
| Taxes & credits | `breakdown.tabs.taxes` | Statutory deductions + tax insights |
| Pension & keren | `breakdown.tabs.pension` | Pension, keren hishtalmut, gemel |
| Equity | `breakdown.tabs.equity` | RSU, ESPP, sale — **only if equity line items or `context.equity.hasEquity`** |

Component: `LineItemList` per tab — each row is a card: label, amount, explanation paragraph (`AnnotatedLineItem.text`). Tax/equity insights render as `.insight` cards above line items.

Tab filtering: `packages/web/src/lib/breakdown-tabs.ts`.

Equity tab MUST show separate rows for RSU vesting, sale proceeds, and sale tax when parsed.

### Flags section

Persistent insight cards (same as summary) using `FlagExplanation.text` from explain engine.

Component: `FlagBanner` (renders `.insight` card).

**Acceptance**:

1. WHEN breakdown loads THEN waterfall steps match `ExplanationResult.waterfall` order with inline `text` under each step.
2. WHEN equity items exist THEN equity tab visible with sale tax row if parsed.
3. WHEN tab selected THEN `LineItemList` shows filtered line items with Hebrew explanation prose (not empty placeholder).
4. WHEN `unknown` items exist THEN listed with explain-engine text from `explain.unknown`.

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
| `PayslipSummary` | Summary (hero + flow diagram + explainer cards) |
| `PayslipFlow` | Summary — gross → net Sankey-style SVG flow |
| `ExplainCard` | Summary — expandable group accordion |
| `NetBreakdown` | Waterfall |
| `LineItemList` | Tab line items (card rows) |
| `FlagBanner` | Flags / insights |
| `ProtectedRoute` | Auth guard |

## Disclaimer

On `/app/*` screens, footer text uses `ExplanationResult.disclaimer.text` from `@tlush/knowledge` when a session exists; otherwise falls back to `disclaimer.not_tax_advice` in `locales/he.json`.

## Session state

```typescript
interface UploadSession {
  termsAccepted: boolean;      // from checkbox at analyze time
  payslip: CanonicalPayslip | null;
  explanation: ExplanationResult | null;  // from @tlush/explain
  previousPayslip?: CanonicalPayslip;  // optional same-session compare
}
```

No persistence across browser sessions in MVP.

## Accessibility

- Checkbox: associated `<label>`, keyboard toggle
- Buttons: min 44×44px touch target
- Flag banners: `role="alert"` for warnings
- Waterfall and line items: explanation prose visible inline (no tooltip-only MVP)

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
