# SmolClouds — console

The signed-in control plane at `app.smolclouds.com`. Lists the apps on your
account, hands you the API token the CLI needs, and shows what is awake.

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Clerk

```bash
npm install
cp .env.example .env.local   # fill it in, see below
npm run dev                  # http://localhost:3000
```

## Pages

| Route | What it does |
| --- | --- |
| `/apps` | Deployments from the router: state (awake / asleep), last request, delete |
| `/token` | The account's `sc_live_…` token, copyable, rotatable |
| `/usage` | App count, awake now, active in the last 24h, recent activity |
| `/welcome` | Closed-pilot gate — invite code redemption |
| `/sign-in`, `/sign-up` | Clerk, themed to match the console |

## How the pieces fit

**Auth** is Clerk (Google, GitHub, email). `proxy.ts` — Next 16's renamed
middleware — protects everything except the auth routes and
`/api/token/verify`.

**The closed pilot** is enforced in `app/(console)/layout.tsx`, so no page
behind it can forget the check. An email on `PILOT_ALLOWED_DOMAINS` is approved
on first sight; anyone else lands on `/welcome` and redeems a code from
`PILOT_INVITE_CODES`. The result is written to the Clerk user's public
metadata, so it is one metadata read afterwards. Setting `PILOT_OPEN=true`
lifts the gate: every signed-in account is approved and `/welcome` forwards
straight to `/apps`.

**The API token** is minted in `lib/token.ts`:

```
sc_live_<base64url(payload)>.<base64url(hmac_sha256(secret, payload))>
payload = {"u": clerk user id, "k": key id, "i": issued at}
```

Opaque to whoever holds it, verifiable offline by the router with the shared
`SMOLCLOUDS_TOKEN_SECRET` — no key table, no round trip. The token is stored in
the Clerk user's **private** metadata, which never reaches the browser, so
`/token` can show it again instead of only once. Rotation writes a new key id;
the router can honour that by calling `/api/token/verify`.

**Router calls happen server-side.** `lib/router.ts` is imported only from
server components and server actions, so the token stays off the client and the
console does not need `api.smolclouds.com` to send CORS headers. When the
router is unreachable the pages say so instead of rendering an empty list.

`lib/router.ts` accepts both `[...]` and `{"deployments": [...]}`, camelCase and
snake_case dates, and maps several state spellings (`running`/`active` → awake,
`sleeping`/`suspended`/`idle` → asleep), so the router does not have to change
vocabulary to be displayed correctly.

## Environment

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk; written by `clerk init` |
| `SMOLCLOUDS_TOKEN_SECRET` | Signs API tokens. **The router needs the same value.** |
| `SMOLCLOUDS_API_BASE` | Router base URL, defaults to `https://api.smolclouds.com` |
| `PILOT_ALLOWED_DOMAINS` | Comma-separated domains admitted without a code |
| `PILOT_INVITE_CODES` | Comma-separated invite codes |
| `PILOT_OPEN` | `true` admits every signed-in account (demo mode) |

## Router side

`docs/ROUTER_PATCH.md` has the token verification code (Node and Python), the
CORS block for the day a browser calls the router directly, and the two
endpoints the console expects. None of it is applied yet — the router source is
not in this repo.

## Deploying to Vercel

1. Set every variable above in the project's environment.
2. Point `app.smolclouds.com` at the deployment.
3. In the Clerk dashboard, add the production domain and enable Google, GitHub
   and email.
4. Give the router the same `SMOLCLOUDS_TOKEN_SECRET`.

## Design

Black ground, JetBrains Mono everywhere, no radius, no shadow, no colour — the
deck's language. Emphasis is contrast: white is live, the grey ramp is
everything else. `app/globals.css` holds the whole palette.
