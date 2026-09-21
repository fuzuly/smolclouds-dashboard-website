# api.smolclouds.com — changes the console needs

Two additions on the router side. Neither is applied yet: the router source is
not in this repo, so this file is the spec plus copy-pasteable code.

Nothing here blocks the console. Deployment data is fetched **server-side** by
Next.js (`lib/router.ts`, called from route handlers), so the browser never
talks to `api.smolclouds.com` directly and CORS is not on the critical path.
Add it when a browser-side or CLI-from-browser caller appears.

---

## 1. Accept the console's API tokens

The console mints tokens of the form:

```
sc_live_<base64url(payload)>.<base64url(hmac_sha256(secret, payload))>

payload = {"u":"<clerk user id>","k":"<key id>","i":<issued at, seconds>}
```

The token is opaque to the user, but the router verifies it offline — no key
table, no round trip. Both sides share one secret, `SMOLCLOUDS_TOKEN_SECRET`.

### Node / TypeScript

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "sc_live_";

export type TokenPayload = { u: string; k: string; i: number };

export function verifyToken(token: string, secret: string): TokenPayload | null {
  if (!token.startsWith(PREFIX)) return null;
  const [body, signature] = token.slice(PREFIX.length).split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(body).digest("base64url"),
  );
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof payload?.u === "string" && typeof payload?.k === "string" ? payload : null;
  } catch {
    return null;
  }
}
```

### Python

```python
import base64, hmac, json, hashlib

PREFIX = "sc_live_"

def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

def verify_token(token: str, secret: str) -> dict | None:
    if not token.startswith(PREFIX):
        return None
    raw = token[len(PREFIX):]
    body, _, signature = raw.partition(".")
    if not body or not signature:
        return None

    expected = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    if not hmac.compare_digest(expected, signature):
        return None

    try:
        payload = json.loads(_b64url_decode(body))
    except ValueError:
        return None
    return payload if isinstance(payload.get("u"), str) and isinstance(payload.get("k"), str) else None
```

Use `payload["u"]` as the owning account id when scoping `/deployments`.

### Revocation

A rotated token keeps the same user id but gets a new key id, so an old token
still verifies by signature alone. To honour rotation, ask the console which
key id is current:

```
GET https://app.smolclouds.com/api/token/verify
Authorization: Bearer <sc_live_...>

200 {"valid":true,"userId":"user_...","keyId":"..."}
401 {"valid":false,"reason":"revoked"}
```

That endpoint exists in this repo (`app/api/token/verify/route.ts`). Cache a
positive answer for a minute or two; fall back to offline signature
verification if the console is unreachable and you would rather stay up than
stay strict.

---

## 2. CORS, for when a browser calls the router directly

Allow the console origin only — not `*`, since these requests carry a bearer
token.

### Express / Node

```ts
const ALLOWED_ORIGINS = new Set([
  "https://app.smolclouds.com",
  "http://localhost:3000", // development console
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
```

### FastAPI

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.smolclouds.com", "http://localhost:3000"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["authorization", "content-type"],
    max_age=86400,
)
```

`Access-Control-Allow-Credentials` stays off: the console authenticates with a
bearer header, not cookies.

---

## 3. Endpoints the console expects

| Method | Path | Used by | Notes |
| --- | --- | --- | --- |
| `GET` | `/deployments` | `/apps`, `/usage` | Array, or `{"deployments":[...]}` |
| `DELETE` | `/deployments/{id}` | delete button on `/apps` | 2xx on success |

Per deployment the console reads `id`, `name`, `url`, `state`, `lastRequestAt`,
`createdAt`. `state` is matched case-insensitively and several
spellings already map through (`running`/`active` → awake,
`sleeping`/`suspended`/`idle` → asleep, `waking`/`pending` → starting), so the
router does not have to change its vocabulary. Snake_case keys
(`last_request_at`, `created_at`) are accepted too. Unknown fields are ignored;
a missing `state` renders as `unknown` rather than breaking the page.
