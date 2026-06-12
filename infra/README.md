# Infrastructure

Deployment target: **Netlify** — static SPA + Functions (MVP). AWS scripts retained as **legacy** (account closed).

**Netlify project:** [gettlush](https://app.netlify.com/projects/gettlush/overview)

## Deploy model

| Deploy type | Branch / trigger | URL |
| ----------- | ---------------- | --- |
| **Production** | `main` | `https://gettlush.netlify.app` |
| **Integration** | `next` (branch deploy) | `https://next--gettlush.netlify.app` |
| **PR preview** | PR to `main` or `next` | `https://deploy-preview-N--gettlush.netlify.app` |

### Git workflow

1. **Day-to-day work:** push to `next` → Netlify branch deploy (non-metered).
2. **Release:** PR `next` → `main` → deploy preview for review → merge → production.

Branch deploys and deploy previews are **non-metered** on Netlify.

## Netlify configuration

| File | Purpose |
| ---- | ------- |
| [`netlify.toml`](../netlify.toml) | Build command, functions dir, SPA catch-all |
| [`netlify/functions/a.ts`](../netlify/functions/a.ts) | Netlify Function adapter |

Build command (Netlify):

```bash
corepack enable && yarn install --immutable && yarn spec:validate && yarn build
```

Publish directory: `packages/web/dist`

Production ingest URL: `https://gettlush.netlify.app/.netlify/functions/a`.

### Netlify UI settings

| Setting | Value |
| ------- | ----- |
| Git repo | `ur92/get-tlush` |
| Production branch | `main` |
| Branch deploys | **On** |
| Deploy previews | **On** |

### Environment variables (by deploy context)

Set in Netlify dashboard per context — no build scripts generate env at deploy time.

| Variable | Production (`main`) | Branch deploys (`next`) | Deploy previews |
| -------- | ------------------- | ----------------------- | --------------- |
| `VITE_GOOGLE_CLIENT_ID` | ✓ | ✓ | ✓ |
| `VITE_OIDC_REDIRECT_URI` | `https://gettlush.netlify.app/callback` | `https://next--gettlush.netlify.app/callback` | omit |
| `CONTRIBUTOR_TOKEN_SECRET` | ✓ | — | — |
| `SUPABASE_URL` | ✓ | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | — | — |
| `GOOGLE_CLIENT_ID` | ✓ (Function JWT + token exchange) | — | — |
| `GOOGLE_CLIENT_SECRET` | ✓ (token exchange only) | — | — |

Analytics ingest is **production-only** for MVP — the client sends observations only on `gettlush.netlify.app` (hardcoded URL); branch deploys, previews, and localhost skip analytics silently.

### Google OAuth origins

Register in Google Cloud Console:

| Field | Values |
| ----- | ------ |
| JavaScript origins | `https://gettlush.netlify.app`, `https://next--gettlush.netlify.app`, `http://localhost:5173` |
| Redirect URIs | `…/callback` for each origin |

## Supabase (analytics storage)

1. Create Supabase project.
2. Run migration: [`infra/supabase/001_salary_observations.sql`](supabase/001_salary_observations.sql)
3. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Netlify **production** context only.

See [specs/analytics/SPEC.md](../specs/analytics/SPEC.md) for schema and ingest contract.

## CI (GitHub Actions)

| Workflow | Trigger | Steps |
| -------- | ------- | ----- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | push/PR → `main`, `next` | `spec:validate` → `test` → `build` |

No deploy in CI — Netlify Git integration handles deploys.

## Local development

| Task | Command |
| ---- | ------- |
| **Full local (auth + functions)** | `npx netlify dev` → open **http://localhost:8888** |
| Frontend only (no login) | `yarn workspace @tlush/web dev` → http://localhost:5173 |

### Local auth bypass (development only)

Set in **`packages/web/.env`** (gitignored):

```bash
VITE_DEV_NO_AUTH=true
```

When enabled **and** the app runs under Vite's dev server (`import.meta.env.DEV`), Google OIDC is skipped: `/app/*` routes are accessible without sign-in, and analytics ingest is disabled (no POST). Default is **off**. Production and branch deploy builds set `DEV=false` at compile time, so this flag cannot activate outside local dev even if set in Netlify env.

Restart the dev server after changing `VITE_*` variables.

Google login requires the Netlify Function `google-token` (client secret stays server-side).

**Root `.env`** (for `netlify dev`, gitignored):

| Variable | Purpose |
| -------- | ------- |
| `GOOGLE_CLIENT_ID` | Same as `VITE_GOOGLE_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET` | Token exchange only — never in Vite env |

**`packages/web/.env`:** set `VITE_OIDC_REDIRECT_URI=http://localhost:8888/callback` when using `netlify dev`.

Add `http://localhost:8888` + `/callback` to Google OAuth client.

## Legacy — AWS (closed account)

The following scripts are **not used** for MVP deploy. Kept for reference only.

| Path | Former purpose |
| ---- | -------------- |
| `infra/setup/01-static-site.sh` | S3 + CloudFront static site |
| `infra/setup/02-analytics.sh` | Lambda + API Gateway + DynamoDB ingest |
| `infra/iam/*.json` | IAM policies for Lambda / GitHub OIDC |

Previous plan: [composer.md § AWS Deployment](../composer.md#aws-deployment-free-tier)
