# Infrastructure

Deployment target: **AWS free tier** — static site (Phase 4), optional analytics backend (Phase 5).

Full plan: [composer.md § AWS Deployment](../composer.md#aws-deployment-free-tier) and the canonical project plan AWS Setup Guide (Phase A/B checklists, OIDC, ingest API).

## Before you start

1. [AWS account](https://aws.amazon.com/) with MFA on root
2. IAM admin user (not root) + access keys
3. `brew install awscli` → `aws configure` (region: `il-central-1` recommended)
4. Verify: `aws sts get-caller-identity`

## Phase A — Static site (week 4)

| Step | What | How |
| ---- | ---- | --- |
| A1 | Private S3 bucket | `BUCKET_NAME=... ./infra/setup/01-static-site.sh setup` |
| A2 | CloudFront + OAC | **AWS Console** (easiest first time) — note `CLOUDFRONT_DOMAIN` + `DISTRIBUTION_ID` |
| A3 | Test deploy | `yarn build` then `BUCKET_NAME=... ./infra/setup/01-static-site.sh deploy` |
| A4 | Google OAuth | Add CloudFront URL + `http://localhost:5173` to authorized origins/redirects |
| A5 | GitHub OIDC | Create role from `infra/iam/github-oidc-*.json` — see [GitHub secrets](#github-secrets) |

```bash
export AWS_REGION=il-central-1
export BUCKET_NAME=get-tlush-web-YOUR-SUFFIX   # globally unique
./infra/setup/01-static-site.sh setup

cd packages/web && yarn build
BUCKET_NAME=$BUCKET_NAME ./infra/setup/01-static-site.sh deploy
DISTRIBUTION_ID=... ./infra/setup/01-static-site.sh invalidate
```

## Phase B — Analytics (week 5)

Concealed ingest API → DynamoDB. No payslip/PII in logs. See [specs/analytics/SPEC.md](../specs/analytics/SPEC.md).

```bash
./infra/setup/02-analytics.sh setup-core
# After apps/ingest exists:
KMS_KEY_ID=... LAMBDA_ROLE_ARN=... ./infra/setup/02-analytics.sh deploy-lambda
INGEST_PATH_SEGMENT=<random-32-chars> LAMBDA_FUNCTION_ARN=... ./infra/setup/02-analytics.sh create-api
```

| Component | Service |
| --------- | ------- |
| Encrypt at rest | KMS (`alias/get-tlush-analytics`) |
| Storage | DynamoDB `salary_observations` |
| Ingest | Lambda `get-tlush-ingest` |
| API | API Gateway HTTP API (secret path, throttling — no WAF in MVP) |

## IAM stubs (`infra/iam/`)

| File | Purpose |
| ---- | ------- |
| `lambda-trust.json` | Lambda execution role trust |
| `lambda-ingest-policy.json` | DynamoDB write + KMS for ingest Lambda |
| `github-oidc-trust.json` | GitHub Actions OIDC assume-role (replace `ACCOUNT_ID`) |
| `github-oidc-deploy-policy.json` | S3 sync + CloudFront invalidation (replace placeholders) |

**OIDC one-time setup:** IAM → Identity providers → Add GitHub → create role `github-actions-get-tlush` with trust + deploy policy.

## GitHub secrets

| Secret | Phase | Value |
| ------ | ----- | ----- |
| `AWS_ROLE_ARN` | A | `arn:aws:iam::…:role/github-actions-get-tlush` |
| `AWS_REGION` | A | `il-central-1` |
| `S3_BUCKET` | A | Static bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | A | For cache invalidation |
| `VITE_GOOGLE_CLIENT_ID` | A | Google OAuth client ID |
| `VITE_OIDC_REDIRECT_URI` | A | `https://YOUR_CLOUDFRONT_DOMAIN/callback` |
| `VITE_ANALYTICS_INGEST_URL` | B | Full ingest URL — **do not commit** |

## CI/CD workflows

| Workflow | Trigger | Steps |
| -------- | ------- | ----- |
| `.github/workflows/ci.yml` | push/PR → `main` | `yarn install` → `spec:validate` → `test` → `build` |
| `.github/workflows/deploy.yml` | push → `main` | build with Vite env → S3 sync → CloudFront invalidation |

PRs are blocked when `spec:validate` or contract tests fail.

## Stack summary

| Component | Service | Cost (MVP) |
| --------- | ------- | ---------- |
| Hosting | S3 (private) + CloudFront OAC | ~$0 free tier |
| CI/CD | GitHub Actions | Free |
| Analytics | KMS + DynamoDB + Lambda + API GW | ~$1+/mo when enabled |
| Backend (MVP app) | None | $0 |
