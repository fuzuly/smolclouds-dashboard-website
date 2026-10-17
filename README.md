# SmolClouds — console

The signed-in control plane at `app.smolclouds.com`. Lists the apps on your
account, hands you the API token the CLI needs, and shows what is awake.

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Clerk

```bash
npm install
cp .env.example .env.local   # fill it in, see below
npm run dev                  # http://localhost:3000
npm test                     # vitest, no network or Clerk needed
```

## Pages

| Route | What it does |
| --- | --- |
| `/apps` | Apps from the router: state, URL (copyable), last request, delete. Search, state filter and order, kept in the URL |
| `/apps/[id]` | One app: URL and state, this month's usage, deployment history with rollback, console logs with search and download |
| `/token` | The account's `sc_live_…` token, copyable, rotatable |
| `/usage` | This month's active time, egress and requests per app, plus what is awake now |
| `/welcome` | Closed-pilot gate — invite code redemption |
| `/sign-in`, `/sign-up` | Clerk, themed to match the console |

## How the pieces fit

**Auth** is Clerk (Google, GitHub, email). `proxy.ts` — Next 16's renamed
middleware — protects everything except the auth routes and
`/api/token/verify`.

**The closed pilot** is enforced in `app/(console)/layout.tsx`, so no page
behind it can forget the check. An email on `PILOT_ALLOWED_DOMAINS` is approved
on every request by comparing the domain — nothing is written. Anyone else
lands on `/welcome` and redeems a code from `PILOT_INVITE_CODES`; only that
redemption is written, to the Clerk user's public metadata. Setting `PILOT_OPEN=true`
lifts the gate: every signed-in account is approved and `/welcome` forwards
straight to `/apps`.

**The API token** is minted in `lib/token.ts`:

```
sc_live_<base64url(payload)>.<base64url(hmac_sha256(secret, payload))>
payload = {"u": clerk user id, "k": key id, "i": issued at}
```

Opaque to whoever holds it, verifiable offline by the router with the shared
`SMOLCLOUDS_TOKEN_SECRET` — no key table, no round trip. The first token is
derived from the account (same user, key id and creation time, same string), so
nothing is stored until someone rotates. Rotation writes a new key id to the
Clerk user's **private** metadata, which never reaches the browser, so `/token`
can show it again instead of only once. The old token keeps a valid signature,
so it is only refused once the router checks `/api/token/verify` — which it
does not do yet (see `docs/ROUTER_PATCH.md`).

**Router calls happen server-side.** `lib/router.ts` is imported only from
server components and server actions, so the token stays off the client and the
console does not need `api.smolclouds.com` to send CORS headers. When the
router is unreachable the pages say so instead of rendering an empty list.

The app list comes from `/v1/apps`, with live state from `/deployments` merged
on top; if `/deployments` fails the list still renders. `lib/router.ts` accepts
several envelopes, camelCase and snake_case fields, and maps several state
spellings (`running`/`active` → awake, `sleeping`/`suspended`/`idle` → asleep),
so the router does not have to change vocabulary to be displayed correctly.
When the router refuses with one of its documented codes (`app_limit_reached`,
`spend_cap_reached`, …), `lib/errors.ts` turns it into what happened and what to
do. Every endpoint and shape is listed in `docs/ROUTER_PATCH.md`.

## Environment

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk; written by `clerk init` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-in` and `/sign-up`, so signed-out visitors see the console's pages, not Clerk's hosted ones |
| `SMOLCLOUDS_TOKEN_SECRET` | Signs API tokens. **The router needs the same value.** |
| `SMOLCLOUDS_API_BASE` | Router base URL, defaults to `https://api.smolclouds.com` |
| `PILOT_ALLOWED_DOMAINS` | Comma-separated domains admitted without a code |
| `PILOT_INVITE_CODES` | Comma-separated invite codes |
| `PILOT_OPEN` | `true` admits every signed-in account (demo mode) |

## Router side

`docs/ROUTER_PATCH.md` has the token verification code (Node and Python), the
CORS block for the day a browser calls the router directly, and every endpoint
the console calls. Token verification and CORS are not applied yet — the router
source is not in this repo.

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
