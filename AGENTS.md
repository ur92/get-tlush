# Agent instructions (tlush)

This repo uses **Spec-Driven Design**. Start here:

1. [specs/constitution.md](specs/constitution.md) — binding decisions
2. [specs/README.md](specs/README.md) — SDD rules, SPEC.md template, validation commands
3. [.cursor/rules/spec-driven-design.mdc](.cursor/rules/spec-driven-design.mdc) — Cursor rule (always on)

## Quick commands

```bash
yarn spec:validate
yarn test:contract
yarn test
yarn build
yarn fixture:from-pdf   # regenerate golden JSON from local PDF — see specs/README.md
yarn workspace @tlush/web dev   # UI only (no Google login)
npx netlify dev                 # auth + functions → http://localhost:8888
```

**Local auth bypass:** set `VITE_DEV_NO_AUTH=true` in `packages/web/.env` and restart the dev server — skips Google login and analytics on localhost only, and auto-loads `public/qa-payslip.pdf` straight to the summary screen. Open **`http://localhost:5173/`** (`yarn workspace @tlush/web dev`). Port **8888** needs `npx netlify dev` separately. See [infra/README.md](infra/README.md).

## Branch model & deploy URLs

| Branch | Netlify deploy | URL |
| ------ | -------------- | --- |
| `main` | Production | `https://gettlush.netlify.app` |
| `next` | Branch deploy (integration) | `https://next--gettlush.netlify.app` |
| PR | Deploy preview | `https://deploy-preview-N--gettlush.netlify.app` |

Day-to-day work targets **`next`**. Release via PR **`next` → `main`**. Analytics ingest is **production-only** (see [infra/README.md](infra/README.md)).

## Layout

| Path | Purpose |
| ---- | ------- |
| `specs/` | Source of truth — do not skip when changing behavior |
| `packages/` | All TypeScript code including `@tlush/web`, `@tlush/ingest` |
| `netlify/` | Netlify Functions (`a` — analytics ingest) |
| `tests/contract/` | Spec compliance tests |
| `infra/` | Netlify + Supabase setup; AWS scripts legacy |

## PR discipline

Spec → fixture → test → code. If you change behavior, update the matching `SPEC.md` and fixtures in the same PR.
