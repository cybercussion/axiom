# Auth (`src/core/auth.js`)

OAuth2 authorization-code flow + PKCE, two providers: **Direct Google** (a worker you run
holds the client secret and brokers exchange/refresh) or **legacy Cognito** (hosted UI,
PKCE straight to the token endpoint). The showcase does not use auth; this file is the
template every Axiom project inherits. Pure logic is in `auth-helpers.js` and is
node-tested (`npm run test:tools`).

## Runtime config (`window.AXIOM_CONFIG.AUTH`)

| Key | Direct Google | Cognito |
|---|---|---|
| `GOOGLE_CLIENT_ID` | required | — |
| `USER_POOL_DOMAIN`, `CLIENT_ID` | — | required |
| `REDIRECT_URI` | registered callback (defaults to `location.origin`) | same |
| `LOCAL_REDIRECT_URI` | dev override (defaults to `https://localhost:3000`) | same |

`NEXUS_URL` (top-level) is the worker base for `/tool/exchange_google_code` and
`/tool/refresh_google_token`. Never put a client secret in `AXIOM_CONFIG`; the worker owns it.

## Worker contract (Direct Google)

Both tool endpoints answer `{ ok: true, data: { access_token, id_token, refresh_token?,
expires_in, admin?, role?, tier? } }`. A refresh response may omit `refresh_token`; the
client carries the previous one forward.

**Refresh rejection is explicit, or it is not a rejection.** The client clears the session
only when the refresh call returns **HTTP 401** or a body whose `error` is
**`invalid_grant`** (`{ ok:false, error:'invalid_grant' }` or an OAuth error body). Map
Google's own `invalid_grant` to that; map Google 5xx / timeouts to a 5xx of your own.
Anything else keeps the session and retries in 60 s. This is `isRefreshRejected()` — the
old "message contains 400/401" heuristic logged users out on worker cold starts.

## Lifecycle

- `auth.init()` **before** `router.init()`: completes a `?code=&state=` callback, or restores
  from storage and refreshes if inside the 10-minute window. A transient refresh failure
  on a still-valid token keeps the session.
- `checkAndRefresh()` / `getAccessToken()` / `getIdToken()`: called by the gateway on every
  request; concurrent callers share one in-flight refresh.
- Keep-alive: one timer at the leading edge of the refresh window (re-armed on every token
  install) plus `visibilitychange`. No polling. On by default; an app that wants refresh
  only on demand (guards / gateway calls) passes `auth.init({ keepAlive: false })`.
- Route guards are the app's call. The router runs `guard()` async, so a guard that refreshes
  is one line:

```js
{ path: '@features/dashboard/dashboard.js', guard: () => auth.checkAndRefresh() }
```

## Storage keys

| Key | Holds | Cleared by |
|---|---|---|
| `axiom_auth` | token bundle `{ accessToken, idToken, refreshToken, expiresAt, admin?, role?, tier? }` | logout / rejection |
| `axiom_pkce_verifier`, `axiom_oauth_state` | held across the provider redirect (localStorage on purpose: some in-app browsers finish the redirect in a fresh tab) | callback (one-shot) |
| `axiom_auth_provider` | `google` \| `cognito` — routes refresh | never (harmless) |
| `axiom_profile` | last-known-good `sub/email/name/picture` — a refreshed Google id_token omits name + picture | logout / rejection |
| `axiom-avatar` | `{ key: sub, url, data }` data-URL cache; fetched `no-referrer`, size pinned to `=s96-c` | logout / rejection |

**Choosing the store.** The identity keys — `axiom_auth`, `axiom_profile`, `axiom-avatar` — live in the store the app picks with `auth.init({ tokenStore })`: `'local'` (default, as above), `'session'` (gone when the tab closes), `'memory'` (gone on reload; the user signs in again), or any `{ getItem, setItem, removeItem }` adapter. Picking anything but `'local'` also deletes identity an earlier session left in localStorage, so the long-lived copy does not outlive the choice. The flow keys (`axiom_pkce_verifier`, `axiom_oauth_state`, `axiom_auth_provider`) stay in localStorage whatever the choice — some in-app browsers complete the redirect in a fresh tab. No store protects a token from script running in the page; SECURITY.md says what the choice does and does not buy.

## Why these exist (the reload bug, 2026-06/07)

"Google auth doesn't survive a reload" had four causes, fixed separately in tender, ev and
scobot and reconciled here on 2026-09-05: lean refreshed tokens blanking the profile,
a guard that only checked expiry with nothing refreshing proactively, transient refresh
errors clearing the session, and avatar fetches 429'd by Referer / re-fetched on URL rotation.

## Pulling this into a downstream project

Sync `src/core/auth.js` + `auth-helpers.js` wholesale, then re-apply what is yours:

- **scobot**: `sessionToken`/LTI `applySession`, `_installSession`, `_refreshScobotSession`,
  the OIDC provider path (`/api/<tool>` dispatch, nonce). Its OIDC `state` handling is now
  the template's default for every provider.
- **tender**: `ensureShop()` after install; `/api` dispatch; `NAV_STYLE`.
- **ev**: a different file (`ev_*` keys, `POST_AUTH_KEY` return path, `renderButton`). Nothing
  to pull except the worker contract above, which it already follows (401-only).
- **daystrom**: runs the March file unchanged — pull wholesale. Its nexus does not yet emit
  `invalid_grant`; until it does, a dead refresh token keeps retrying until `expiresAt`, then
  the next boot clears it (still strictly better than the old logout-on-cold-start).
