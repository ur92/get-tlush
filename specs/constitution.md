# tlush Constitution

Fixed architectural and product decisions for the payslip explainer. These are **binding** unless explicitly revised via spec review and changelog entry here.

**Repository**: [ur92/get-tlush](https://github.com/ur92/get-tlush)

---

## 1. Language & UI

| Decision | Rule |
| -------- | ---- |
| Primary language | **Hebrew** — all MVP user-facing copy |
| Layout | **RTL** (`dir="rtl"`, logical CSS properties) |
| i18n | Strings in `locales/he.json`; no hard-coded Hebrew in logic |
| Future locales | Architecture supports `en.json` etc.; not MVP scope |

## 2. Privacy & PDF Processing

| Decision | Rule |
| -------- | ---- |
| PDF location | **Client-side only** — PDF bytes never uploaded to tlush servers |
| Extraction | In-browser via `pdf.js`; no server OCR |
| Storage | No payslip persistence in MVP; no user history |
| PII in analytics | Employee block from `CanonicalPayslip` is **never** sent to analytics ingest |

## 3. Determinism — No AI at Runtime

| Decision | Rule |
| -------- | ---- |
| Parsing | Rules, dictionaries, coordinate geometry — **zero LLM/API calls** during parse or explain |
| Explanations | Template + lookup from `knowledge/` JSON; deterministic for same input |
| Validation | Calculator uses fixed 2026 rates and formulas (ported from payroll skill) |
| Out of scope | Scanned/image PDFs, runtime AI, server-side inference |

## 4. Spec-Driven Development

| Decision | Rule |
| -------- | ---- |
| Source of truth | `specs/` directory |
| Change order | Spec → fixture → test → implementation |
| Contracts | JSON Schema in `specs/schemas/`; TypeScript types generated from schemas |
| Plugins | Each vendor = independent spec + package; no cross-vendor imports |

## 5. Monorepo & Tooling

| Decision | Rule |
| -------- | ---- |
| Package manager | **Yarn workspaces** (not pnpm/npm at root) |
| App | `apps/web` — Vite + React + TypeScript |
| Packages | `packages/pdf-extract`, `packages/parsers/*`, `packages/calculator`, `packages/explain`, `packages/knowledge` |
| Tests | Vitest; contract tests read `specs/plugins/*/manifest.json` |
| CI | `spec:validate` → `test:contract` → `build` → deploy |

## 6. Authentication (Optional — Post-MVP Features)

| Decision | Rule |
| -------- | ---- |
| Provider | **Google OIDC direct** — no custom auth server in MVP |
| Flow | Authorization Code with PKCE from static SPA where needed |
| Scope | Auth is **optional**; core payslip explain flow works without login |
| Tokens | Stored in memory or secure browser storage; never sent with PDF bytes |

## 7. Analytics (Optional — Privacy-Preserving)

| Decision | Rule |
| -------- | ---- |
| Store | **Amazon DynamoDB** for anonymized usage records |
| Ingest shape | `anonymized-record.schema.json` only — no employee PII, no raw labels with names |
| Opt-in | User must consent before any analytics event is sent |
| Client | Aggregated events from browser after parse; PDF content never included |
| Fields allowed | vendor id, period month/year, totals buckets, category histograms, flags, app version, session hash |

## 8. Hosting & Cost

| Decision | Rule |
| -------- | ---- |
| Frontend | Static site — S3 + CloudFront (AWS free tier target) |
| Backend | None required for MVP parse/explain |
| Analytics API | Minimal serverless ingest (future); separate from PDF pipeline |

## 9. Supported Vendors (MVP)

| Vendor | Package | Spec path |
| ------ | ------- | --------- |
| Hilan | `@tlush/parser-hilan` | `specs/plugins/hilan/` |
| Merkava (education) | `@tlush/parser-merkava` | `specs/plugins/merkava/` |

Adding a vendor does not change core contracts — only new plugin spec + registration.

## 10. Disclaimer

All UI surfaces include a non-binding disclaimer (i18n key `disclaimer.estimate`): explanations are for understanding only; consult payroll or a certified accountant for tax decisions.

---

## Amendment Process

1. Propose change in PR with rationale.
2. Update affected `SPEC.md` files and schemas.
3. Add row to changelog below.
4. Require human approval for constitution changes.

### Changelog

| Date | Change |
| ---- | ------ |
| 2026-06-08 | Initial constitution — Phase 0 foundation |
