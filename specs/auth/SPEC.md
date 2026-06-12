# Authentication Spec

Direct Google OIDC for SPA — Authorization Code + PKCE. No Cognito, no custom password auth.

## Purpose

Gate access to `/app/*` routes. Payslip PDFs and parsed data remain client-side only; auth does not upload payslip content.

## Stack

| Component | Choice |
| --------- | ------ |
| Protocol | OpenID Connect (OIDC) |
| Flow | Authorization Code + PKCE (public client) |
| IdP | Google (`https://accounts.google.com`) |
| SPA library | [`react-oidc-context`](https://github.com/authts/react-oidc-context) + `oidc-client-ts` |
| Package | `packages/auth/` — `OidcProvider`, `useAuth`, config |

## Environment variables

| Variable | Required | Example |
| -------- | -------- | ------- |
| `VITE_GOOGLE_CLIENT_ID` | yes | `123456789.apps.googleusercontent.com` |
| `VITE_OIDC_REDIRECT_URI` | yes | `https://gettlush.netlify.app/callback` |
| `VITE_DEV_NO_AUTH` | no (local dev only) | `true` — see [Local dev bypass](#local-dev-bypass) |

No client secret in the browser (public SPA client). Token exchange uses Netlify Function `google-token` with `GOOGLE_CLIENT_SECRET` (server-only).

## Local dev bypass

**Local development only.** Off by default; never enabled in production or branch deploys.

| Condition | Effect |
| --------- | ------ |
| `VITE_DEV_NO_AUTH=true` in `packages/web/.env` | Opt-in flag |
| `import.meta.env.DEV === true` (Vite dev server) | Required second guard — production builds compile `DEV` to `false` |

When both are true:

- `/app/*` routes render without Google OIDC; `useAuth()` reports authenticated with a fixed dev user and placeholder `id_token`.
- `/` and `/login` redirect to `/app/upload`.
- OIDC env vars may be omitted (dummy config used for `AuthProvider` shell only).
- Analytics ingest is disabled — `getAnalyticsIngestUrl()` returns `undefined` regardless of `VITE_ANALYTICS_INGEST_URL`.

Restart the Vite dev server after changing `VITE_*` env vars.

## Google Cloud setup

OAuth 2.0 Client ID (Web application):

- **Authorized JavaScript origins**: production, `next`, `http://localhost:8888` (Netlify Dev), `http://localhost:5173` (optional)
- **Authorized redirect URIs**: `{origin}/callback` for each origin above
- Scopes: `openid email profile`

## OIDC configuration

```typescript
// packages/auth/src/oidc-config.ts
import type { AuthProviderProps } from 'react-oidc-context';

export const oidcConfig: AuthProviderProps = {
  authority: 'https://accounts.google.com',
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URI,
  response_type: 'code',
  scope: 'openid email profile',
  automaticSilentRenew: false,
  monitorSession: false,
};
```

## Auth flow

```mermaid
sequenceDiagram
  participant User
  participant SPA as Vite SPA
  participant Google as accounts.google.com

  User->>SPA: Visit /app/*
  SPA->>SPA: No session → redirect /login
  User->>SPA: Click "Sign in with Google"
  SPA->>Google: authorize + PKCE code_challenge
  Google-->>User: Google consent
  Google-->>SPA: Redirect /callback?code=...
  SPA->>Fn: POST /.netlify/functions/google-token (code + code_verifier)
  Fn->>Google: token exchange + client_secret
  Google-->>Fn: id_token + access_token
  Fn-->>SPA: id_token + access_token
  SPA->>SPA: Store session (oidc-client-ts)
  User->>SPA: Access /app/* (protected)
```

## Routes

| Path | Access | Behavior |
| ---- | ------ | -------- |
| `/` | public | Marketing / redirect to login or app |
| `/login` | public | "Sign in with Google" button |
| `/callback` | public | OIDC redirect handler; completes sign-in |
| `/app/*` | **protected** | Requires valid OIDC session; else redirect `/login` |
| `/terms` | public | Terms & Privacy (`specs/legal/TERMS.md`) |

## Protected route guard

```typescript
// Pseudocode — packages/web/src/routes/ProtectedRoute.tsx
function ProtectedRoute({ children }) {
  const auth = useAuth();
  if (auth.isLoading) return <Loading />;
  if (!auth.isAuthenticated) return <Navigate to="/login" />;
  return children;
}
```

Wrap all `/app/*` routes (upload, summary, waterfall, breakdown).

## Session management

- Tokens stored by `oidc-client-ts` (sessionStorage or configured store)
- `automaticSilentRenew: false` for Google SPA (silent renew unreliable without refresh token)
- Sign out: `auth.removeUser()` + redirect `/login`
- User identity: Google `sub` from `id_token` (stable; used only client-side for analytics Bearer token — never stored server-side)

## Privacy boundary

| Data | Location |
| ---- | -------- |
| Credentials | Google only |
| OIDC tokens | Browser session |
| Payslip PDF | Browser only — never uploaded |
| Parsed payslip | Browser only |
| Analytics | Anonymized metrics only (`specs/analytics/SPEC.md`) |

## Acceptance criteria

1. WHEN unauthenticated user visits `/app/upload` THEN redirect to `/login`.
2. WHEN user completes Google OIDC flow THEN `/callback` establishes session and redirects to `/app/upload`.
3. WHEN authenticated user visits `/app/*` THEN page renders without redirect.
4. WHEN user signs out THEN session cleared and `/app/*` redirects to `/login`.
5. WHEN `VITE_GOOGLE_CLIENT_ID` or `VITE_OIDC_REDIRECT_URI` is missing THEN build fails or app shows configuration error (no silent fallback).
6. WHEN token expires AND silent renew fails THEN redirect to `/login`.
7. WHEN `id_token` is sent to analytics ingest THEN used only as Bearer for JWT validation; ingest handler discards `sub` after deriving `contributor_token`.

### Local dev bypass (acceptance)

8. WHEN `VITE_DEV_NO_AUTH=true` AND Vite `DEV` is true THEN unauthenticated user can access `/app/upload` without redirect to `/login`.
9. WHEN local dev bypass active THEN `useAuth().isAuthenticated` is true and `idToken` is a non-empty placeholder (not a real Google JWT).
10. WHEN local dev bypass active AND user visits `/login` THEN redirect to `/app/upload`.
11. WHEN production build (`DEV=false`) THEN local dev bypass is inactive regardless of `VITE_DEV_NO_AUTH` value.

## Future: additional IdP (Phase 5+)

Not MVP. When needed, choose one path and document in this spec:

1. **Multi-IdP in app** — separate OIDC config per provider + provider picker UI
2. **Broker** — migrate to Cognito/Auth0 for single issuer URL

## Implementation packages

- `packages/auth/` — config, `AuthProvider` wrapper, `useAuth` hook
- `packages/web/src/routes/` — `LoginPage`, `CallbackPage`, `ProtectedRoute`
- No `infra/cognito/` — Google OAuth client only
