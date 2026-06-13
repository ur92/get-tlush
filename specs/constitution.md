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
| Layout | **All code under `packages/`** — no top-level `apps/` |
| Web SPA | `packages/web` (`@tlush/web`) — Vite + React + TypeScript |
| Libraries | `packages/pdf-extract`, `packages/parsers/*`, `packages/calculator`, `packages/explain`, `packages/knowledge`, `packages/auth`, `packages/analytics` |
| Repo root (not packages) | `specs/`, `infra/`, `scripts/`, `tests/`, `.github/` |
| Tests | Vitest; contract tests read `specs/plugins/*/manifest.json` |
| CI | `spec:validate` → `test:contract` → `build` (GitHub Actions); deploy via Netlify Git |
| Agent rules | `.cursor/rules/spec-driven-design.mdc`, [AGENTS.md](../AGENTS.md) |

## 6. Authentication

| Decision | Rule |
| -------- | ---- |
| Provider | **Google OIDC direct** — no Cognito, no passwords |
| Flow | Authorization Code + PKCE from static SPA |
| Scope | `/app/*` routes **require** valid OIDC session per `specs/auth/SPEC.md` |
| Tokens | Browser session via `react-oidc-context`; never sent with PDF bytes |

## 7. Analytics (Privacy-Preserving)

| Decision | Rule |
| -------- | ---- |
| Store | **Supabase Postgres** table `salary_observations` (production ingest only) |
| Client payload | `specs/schemas/anonymized-record.schema.json` only |
| Consent | **Terms checkbox at upload** (default checked); parse blocked if unchecked; analytics sent only if terms accepted for that session |
| Client | `packages/analytics/anonymize()` before any network call; PDF never included |
| PII | Never employee name, ID, employer, raw labels, Google `sub`/email in payload |

## 8. Hosting & Cost

| Decision | Rule |
| -------- | ---- |
| Frontend | **Netlify** static hosting — production on `main`, integration on `next` branch deploy |
| Backend | None required for MVP parse/explain |
| Analytics API | **Netlify Function** ingest → Supabase Postgres — **production (`main`) only** for MVP |
| Deploy | Netlify Git integration; GitHub Actions validation only (no AWS deploy) |
| Release model | Day-to-day work on `next` → `next--gettlush.netlify.app`; release PR `next` → `main` → `gettlush.netlify.app` |

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
| 2026-06-08 | packages-only layout; auth required for /app/*; terms-at-upload analytics; AGENTS.md + Cursor SDD rule |
| 2026-06-10 | MVP hosting pivot: Netlify (main/next/PR previews); analytics ingest via Netlify Function + Supabase; AWS account closed — legacy scripts in `infra/setup/` |
