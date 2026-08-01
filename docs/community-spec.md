# ns-ui: from personal registry to community registry

Status: proposal. Nothing below is implemented.

Backend is **Convex** — owner's decision, recorded in §7.1, not re-argued. An earlier draft of this
document evaluated Neon/Postgres and recommended it; that evaluation is in git history if the
reasoning is ever wanted. This version specs what was chosen.

Verified against the repo, against the owner's seven existing Convex projects, and against the
installed `@convex-dev/auth` package source. Where a claim is a guess it says so (§9).

---

## 1. Non-goals

1. **User-uploaded components are not previewed on this origin.** Ever. Submissions are GitHub pull
   requests. §6.2 states what would have to change and what it costs.
2. **No in-app code editor, no paste-and-run playground.** Same reason.
3. **No passwords.** GitHub, Google, email OTP.
4. **The catalog does not become dynamic.** `/`, `/preview/<name>`, `/preview/<name>/embed`,
   `/preview/<name>/play` keep their current caching behaviour exactly. Specifically:
   `ConvexAuthNextjsServerProvider` is **never** placed in `app/layout.tsx` (§6.4), and no
   `cookies()`/`headers()` call is added to the layout or `SiteShell`.
5. **No Convex client on catalog pages.** `ConvexReactClient` and the auth provider mount only on
   auth-bearing routes. §7.2.
6. **`npx shadcn add` stays anonymous forever.** `/r/*.json`, `/registry.json`, `/llms.txt` never
   require a session, never receive a `Set-Cookie`, never leave the CDN.
7. **No realtime.** No `useQuery` subscriptions, no WebSocket on the catalog. Saves are a fetch, not
   a subscription. Convex is chosen as a database here, not as a reactivity engine.
8. **No public user directory, no follows, comments, ratings or DMs.**
9. **No moderation tooling.** GitHub's PR review UI is the moderation tooling.
10. **No migration of the registry into Convex.** Component metadata stays in `meta.json` on disk.
11. **No SSR of user-specific content into any cached route.**

---

## 2. Phases

### Phase 0 — auth spike (load-bearing)

**Depends on:** nothing. Runs *while* the rename lands, so it costs no calendar time.

A throwaway Next 16 app on a scratch Convex deployment that proves the three things this spec assumes
and the owner's existing code does not demonstrate:

1. **GitHub OAuth** through `@convex-dev/auth`.
2. **Google OAuth** through `@convex-dev/auth`.
3. **Email OTP** as a first-class sign-in method (not just the password-reset flow).
4. **Token storage**: confirm §6.1's finding on the pinned version, and confirm `storage="inMemory"`
   suppresses the localStorage write.

**Why this exists:** of the three required providers, only OTP-over-Resend has a working precedent in
the owner's code (`reserved-app/convex/ResendOTP.ts`). marketmyapp is Password-only, and its
`CLAUDE.md` records that Google OAuth was *dropped* in the Supabase→Convex cutover because re-adding
it "needs an Auth.js Google provider + client id/secret on the Convex deployment." OAuth on Convex
Auth is unexercised in this owner's stack.

**Done means:** all four demonstrated, or a written recommendation to change auth library. One day of
work. **If the spike fails on OAuth, stop and reopen the auth decision** — do not work around it
inside Phase A.

### Phase A — auth, profiles, saves

**Depends on:** Phase 0 passing, **and** the 223-slug rename being merged to `main`. Hard gate — §3.

**Ships:**

- `@convex-dev/auth` with GitHub, Google, email OTP (Resend).
- Convex schema: `authTables` + `profiles`, `saves`, optionally `collections`.
- Next route handlers on our own origin, all dynamic, all outside the cached set:
  - `/api/auth` — Convex Auth's proxy endpoint (required by the middleware, §6.4).
  - `/api/me` — `{ signedIn, handle, displayName }` or `{ signedIn: false }`.
  - `/api/saves` — `GET`/`POST`/`DELETE`, reading the session cookie server-side and calling Convex
    with an authed server client.
- `/account` and `/u/<handle>` pages.
- Header auth UI in `SiteShell`, rendered **client-side after hydration** from `/api/me`.
- Save control on the catalog card and playground, hydrated from one `GET /api/saves` per page load.
- `SECURITY.md` rewritten. Its lines 5-7 currently say "There is no backend, no database, and no user
  data" — false the moment this ships.
- Privacy note on `/account`, linked from the footer.

**Done means:** §4 groups A, B and C all pass, and the `next build` route table for the four catalog
routes is byte-identical to the pre-change baseline.

### Phase B — guidelines and contributor credit

**Depends on:** nothing in A; ship after so credit can link to a profile, degrading to a plain GitHub
login otherwise.

- `/guidelines`, static. The *taste* document the repo lacks: what "one interaction" means, why both
  themes are non-negotiable, why the card matters as much as the preview, the token rule, what gets
  rejected. `CONTRIBUTING.md` stays the mechanical how-to; they cross-link.
- MIT grant stated; PR template gains a DCO checkbox and `Signed-off-by`; add a `DCO` file.
- `scripts/build-contributors.ts` → `lib/contributors.generated.json` (slug → GitHub login), read
  from **git history at build time, not from Convex**. Added to the `registry:build` chain,
  gitignored like its siblings.

**Done means:** `/guidelines` is static, sign-off is required, and credit renders for a contributor
with no account.

### Phase C — PR-opening submission portal

**Depends on:** A and B.

- `/submit`, GitHub sign-in only. Form → validate → fork as the user → commit on a branch → open a
  PR, all through the GitHub API under an incremental OAuth scope requested at submit time.
- Submitted code is **never imported, built, rendered or executed on this origin.** CI runs it in
  GitHub's sandbox.
- Contributors still run `npm run verify` locally and attach screenshots.

**Done means:** a fresh account produces a well-formed PR, and static analysis confirms no code path
imports the payload.

---

## 3. Data model

Convex, so `defineSchema`/`defineTable`/`v.*` with explicit indexes. Two properties differ from a SQL
draft and change real things: **Convex has no foreign keys and no cascading deletes**, and **no unique
indexes**.

```ts
export default defineSchema({
  ...authTables,   // users, authAccounts, authSessions, authRefreshTokens,
                   // authVerificationCodes, authVerifiers, authRateLimits

  profiles: defineTable({
    userId:      v.id("users"),
    handle:      v.string(),        // stored lowercased
    displayName: v.union(v.string(), v.null()),
    bio:         v.union(v.string(), v.null()),   // capped, rendered as plain text
    url:         v.union(v.string(), v.null()),   // http/https only, validated on write
    createdAt:   v.number(),
  }).index("by_userId", ["userId"])
    .index("by_handle", ["handle"]),

  saves: defineTable({
    userId:    v.id("users"),
    slug:      v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"]),

  collections: defineTable({
    userId: v.id("users"), name: v.string(), isPublic: v.boolean(), createdAt: v.number(),
  }).index("by_user", ["userId"]),

  collectionItems: defineTable({
    collectionId: v.id("collections"), slug: v.string(), position: v.number(),
  }).index("by_collection", ["collectionId"]),
});
```

**Uniqueness is enforced by mutation, not by the schema.** Convex has no unique index. `claimHandle`
reads `by_handle` and inserts in one mutation; Convex mutations are serializable, so the
read-then-insert is atomic and a concurrent duplicate loses. That is a real guarantee, but it is a
*transaction* guarantee, not a constraint — anything writing `profiles` outside that mutation
bypasses it. One writer, by convention, enforced in review.

### The slug gate

There is no stable non-slug identity in this repo. `meta.json`'s `name` *is* the slug, the folder name
*is* the slug, and `files[0].target` derives from the folder (`docs/rename-plan.md` §1).

`docs/rename-plan.md` renames **222 of 223** components in one atomic commit. A `saves` table
populated before it merges holds 222 dead pointers the day it lands.

**No table keyed on slug may exist before the rename commit is on `main`** — `saves` and
`collectionItems`. Phase 0 has no schema and is unaffected; run it during the rename.

`saves.slug` has no referential integrity and cannot have any. Unresolvable slugs degrade silently,
matching `app/page.tsx:26-31`, where `FEATURED` is filtered against `registryNames` so a rename
"degrades quietly instead of leaving a dead slug in the featured rail." The client filters saves
against the slugs already in the catalog payload. Future renames ship a one-off migration mutation;
put that line in the rename runbook.

---

## 4. Test plan

Numeric criteria, before the implementation plan. Group C baselines come from
`docs/perf-audit-2026-07.md`, measured against production.

### Group A — auth and saves

| # | Test | Pass criterion |
|---|---|---|
| A1 | `GET /api/saves`, no cookie | `401`, no user data, < 100ms |
| A2 | `POST /api/saves`, no cookie | `401`; `saves` count unchanged |
| A3 | GitHub sign-in → `GET /api/me` | `200`, resolves to exactly one `users` doc, p95 over 20 sequential calls **< 200ms** warm |
| A4 | Google sign-in | identical criteria |
| A5 | Email OTP request → deliver → submit | delivered **< 30s**, valid **10 minutes**, single-use (second submit `400`), max **5** requests per address per hour |
| A6 | Save, reload `/preview/<slug>/play` | saved state within **500ms** of hydration, from exactly **1** `GET /api/saves` |
| A7 | Save a slug absent from the registry | `400`, no doc written |
| A9 | **Explicit-cascade audit.** After delete, query by `userId` across `users`, `authAccounts`, `authSessions`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, `profiles`, `saves`, `collections`, and `collectionItems` by owning collection | **0 docs from every one of the ten**, within **60s**. Enumerated because Convex has no cascade and a missed table is silent orphan data |
| A10 | Session cookie inspection | name is `__Host-__convexAuthJWT`; `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, **no `Domain`** |
| A11 | **`window.localStorage` after sign-in, on every page** | **0 keys** containing `__convexAuthJWT` or `__convexAuthRefreshToken`. This is §6.1; it is the single most important test in this document |
| A12 | Sign out | cookies cleared **and** the `authSessions` doc deleted; replaying the captured cookie → `401` |
| A13 | 100 `POST /api/saves` in 10s, one session | ≥ the 31st returns `429`; docs written ≤ **30** |
| A14 | Cross-origin `POST /api/saves` from `https://evil.example`, with credentials | blocked or `403`; no doc written; no `Access-Control-Allow-Origin` for that origin |
| A15 | **Unauthenticated direct call to every exported Convex query and mutation**, at `NEXT_PUBLIC_CONVEX_URL`, enumerated from `convex/_generated/api.d.ts` | every one returns null/throws; **0 rows of anyone's data**. See §6.3 — Convex functions are public by default |
| A16 | Two simultaneous claims of one handle | exactly one succeeds, one fails; exactly **1** `profiles` doc with that handle |
| A17 | `bio` containing `<script>`; `url` set to `javascript:...` | bio renders as literal text; url rejected at write unless http/https |

### Group B — the static invariant

| # | Test | Pass criterion |
|---|---|---|
| B1 | `next build` route table | rows for `/`, `/preview/[name]`, `/preview/[name]/embed`, `/preview/[name]/play`, `/writing/[slug]` **byte-identical** to the baseline captured at step 2 |
| B2 | `grep -rn "ConvexAuthNextjsServerProvider\|cookies()\|headers()" app/layout.tsx app/_components/site-shell.tsx` | **0 matches**. §6.4 |
| B3 | Middleware matcher is an explicit allowlist | matches only `/api/auth(.*)`, `/api/me`, `/api/saves`, `/account(.*)`, `/submit(.*)`. Asserted by reading `proxy.ts` **and** by B4-B6 |
| B4 | Anonymous `curl -I /preview/<slug>/embed`, warm | `200`, `x-nextjs-cache: HIT`, `s-maxage=3600`, **no `set-cookie`** |
| B5 | Same for `/preview/<slug>/play` | identical |
| B6 | Anonymous `curl -I /r/<slug>.json`, `/registry.json` | `200`, cache HIT, **no `set-cookie`**, no `vary: cookie` |
| B7 | `npx shadcn add <origin>/r/<slug>.json`, clean project, no session | succeeds, same bytes as before |
| B8 | HTML of `/`, anonymous vs signed-in | **identical bytes** |
| B9 | JS bundle of `/` | contains **no** `ConvexReactClient` and no `convex/react`. Non-goal #5 |

### Group C — performance

| # | Test | Pass criterion |
|---|---|---|
| C1 | `/` TTFB, warm CDN hit, 3 runs | ≤ **200ms** (baseline 174-182ms) |
| C2 | `/` steady-state TBT, 15-25s window, 4x CPU throttle, quiet machine | **0ms, 3 of 3 runs** (current shipped value) |
| C3 | `/` LCP, 4x throttle | ≤ **600ms** (baseline 516ms) |
| C4 | Requests on one `/` load | ≤ **57** (baseline 53; `/api/me` + `/api/saves`) |
| C5 | `/api/saves` p95, signed in, warm | < **250ms** (one extra hop: our origin → Convex) |
| C6 | Initial JS added to `/` | ≤ **10KB** brotli over the current ~225KB. Target, not a measurement — §9 |

### Group D — submission portal

| # | Test | Pass criterion |
|---|---|---|
| D1 | Static analysis | **0** `import`, `eval`, `new Function`, `dangerouslySetInnerHTML` or dynamic `import()` deriving from submitted content |
| D2 | Payload with a webpack magic comment, `../`, or a null byte in a filename | rejected before any GitHub call; path always `registry/<collection>/<validated-slug>/<fixed-filename>` |
| D3 | End-to-end submit | PR appears under the submitting user's own GitHub identity; CI runs |
| D4 | Limits | rejected above **256KB**; max **1** submission per user per 10 minutes |

---

## 5. Implementation plan

1. **Phase 0 spike** (§2). Runs during the rename.
2. Capture the pre-change `next build` route table as the B1 baseline. Before touching anything.
3. Wait for the rename commit on `main`.
4. Provision Convex. Set `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`
   **on the Convex deployment** via `npx convex env set` — not `.env.local`. Set them on **both** the
   dev and prod Convex deployments, and `NEXT_PUBLIC_CONVEX_URL` in **both** Vercel Production and
   Preview, in one change. A missing one is a total outage.
5. `convex/schema.ts` (`authTables` + `profiles`), `convex/auth.ts`, `convex/http.ts`,
   `convex/auth.config.ts`.
6. `proxy.ts` with the **allowlist** matcher (§6.4). Run B3.
7. Auth routes and the `/account` shell. Run A3, A4, A5, A10, **A11**, A12.
8. `saves` table and its mutations; `/api/saves`, `/api/me` on our origin. Run A1, A2, A6, A7, A13,
   A14, A15.
9. Client auth UI in `SiteShell`, hydration-only. **Run all of groups B and C here** — this is the
   step that can break the site.
10. `/u/<handle>`, handle claim, account deletion. Run A9, A16, A17.
11. Rewrite `SECURITY.md`; add the privacy note.
12. Phase B: `/guidelines`, DCO, `build-contributors.ts`. Re-run group B.
13. Phase C: incremental GitHub scope, `/submit`. Run D1-D4.

---

## 6. Security

### 6.1 The finding that shapes everything: Convex Auth mirrors its tokens into `localStorage`

Read from the installed package at `@convex-dev/auth@0.0.94`.

The **cookie** posture is excellent, and better than a hand-specified one.
`dist/nextjs/server/cookies.js:20-31,71-81` sets `__Host-__convexAuthJWT` and
`__Host-__convexAuthRefreshToken` with `httpOnly: true`, `secure: true`, `sameSite: "lax"`,
`path: "/"`. The `__Host-` prefix is enforced by the browser to mean host-only with no `Domain` —
which **structurally forbids** the `.helpmarq.com` cookie-scope mistake that a copy-paste from the
owner's other stack would otherwise create. That risk is gone by construction.

But the React layer also writes the same tokens to JavaScript-readable storage.
`dist/react/client.js:14-15,46-47` stores `__convexAuthJWT` and `__convexAuthRefreshToken` through
the injected `storage`, and `dist/nextjs/client.js:28-32` injects `window.localStorage` by default.
Lines 219-229 write both again from the server-provided state.

**Why that is disqualifying for this specific site.** `localStorage` is same-origin readable by any
script on the origin — including the three un-sandboxed same-origin iframes documented in §6.2:
`preview-card.tsx:210`, `featured-card.tsx:232`, and the *interactive* one at `play/page.tsx:134`. A
component would need one line to read a refresh token and exfiltrate it. That is strictly worse than
the cookie case: it is bearer-credential theft usable from anywhere, not merely an authenticated
fetch an attacker can trigger from inside the page.

**Two mitigations, and we take both.**

1. **Do not mount the Convex auth client on catalog pages at all** (non-goal #5). The provider mounts
   only on `/account`, `/submit` and the sign-in route — pages with no component iframes. The catalog
   ships no `convex/react` (test B9).
2. **Pass `storage="inMemory"`.** Verified available: `dist/nextjs/server/index.js:13-16` accepts a
   `storage` prop and forwards it to the client provider, and `dist/nextjs/client.js:30-32` maps
   `"inMemory"` to `null`, which `dist/react/client.js:287` resolves to an in-memory store rather
   than `localStorage`. Note `ConvexAuthNextjsProvider` (`dist/nextjs/index.js:31-34`) takes only
   `client` and `children` and does **not** forward `storage` — the prop belongs on
   `ConvexAuthNextjsServerProvider`. Easy to get wrong.

Test A11 asserts the outcome on every page. In-memory still means the token exists in JS memory on
those two pages, reachable in principle by same-origin script; that is acceptable only because those
pages render no component iframes, and it is why mitigation 1 is not optional.

**Consequence for the data path.** Because the browser never holds a usable token, saves do not go
browser→Convex. They go **browser → `/api/saves` on our origin → Convex server-side**, with the route
handler reading the `__Host-` cookie and calling Convex with an authed server client. This is the
owner's own pattern in `marketmyapp/src/lib/convex/server.ts` and `reserved-app`. It costs one hop
(C5 budgets 250ms rather than 200ms) and forecloses realtime, which is already non-goal #7. It
preserves the entire CSRF story below.

### 6.2 The origin question — why uploads stay PRs

Three same-origin iframes render component code, none with a `sandbox` attribute:

- `app/_components/preview-card.tsx:210-242` — `/preview/<name>/embed`, and it **reads the child
  document**: `el.contentDocument?.querySelector(frame.focus)` at line 95,
  `contentDocument?.readyState` at line 138. The comments at lines 79-80 and 131-133 state the
  same-origin dependency outright.
- `app/_components/featured-card.tsx:232` — same route, un-sandboxed, but it does **not** read
  `contentDocument` (only `onLoad`). The exposure is the shared origin, not a document read.
- `app/preview/[name]/play/page.tsx:134` — `?embed=1&interactive=1`, un-sandboxed and **not**
  `inert`. The only frame that receives real user input, and the one nobody names.

The iframe is not the boundary anyway. `app/preview/[name]/page.tsx:3` imports `demos` from
`@/registry/index`, generated by `scripts/build-index.ts` from folder names. **Component code is
compiled into the site's own bundle**, so untrusted code would execute during `next build` (with
build-environment secrets), during SSR/ISR of `/preview/<name>`, and in the browser — iframe or not.
A `sandbox` attribute addresses only the last.

**What would have to change to ever preview user-uploaded components:**

1. **A separate origin with its own build and deployment** — a distinct registrable origin, its own
   Vercel project, no Convex URL, no auth env, no session cookie ever scoped to it.
2. **`sandbox="allow-scripts"` without `allow-same-origin`.** Together those two are equivalent to no
   sandbox; that is the easy mistake.
3. **Card framing rebuilt.** `contentDocument` is `null` across an opaque origin, so `refit()` and
   the `readyState` poll both die. `lib/card-frame.generated.json` carries **75** `focus` entries —
   75 components lose framing. Replacement is a `postMessage` handshake that must also replace the
   poll, which exists because `onLoad` is a race (`preview-card.tsx:128-133`); a card that never
   receives the message needs a timeout fallback or it sits at opacity 0 showing a blank stage.
4. **A strict CSP** on that origin.
5. **Cost:** a second Vercel project and build pipeline, the `postMessage` protocol and its
   fallbacks, and the loss of the "card and direct link are the same document" invariant
   `preview-card.tsx` exists to protect. About a week, plus a permanent second thing to maintain. Not
   worth it to avoid a pull request.

### 6.3 Convex functions are public by default — no RLS, no row security

The owner's own code says it plainly. `networth/convex/lib.ts:1-3`: *"Convex query/mutation endpoints
are callable by anyone who knows the deployment URL — there is no RLS equivalent."*
`marketmyapp/convex/schema.ts:5-6`: *"Convex has no foreign keys or RLS; ownership is enforced
explicitly in each function."*

`NEXT_PUBLIC_CONVEX_URL` is public by definition — it is in the client bundle. So **every exported
query and mutation is an internet-facing endpoint**, and authorization is per-function code with no
backstop. A forgotten check is a data leak, not a bug caught by a policy engine.

Rules:

- Every public function derives identity from `getAuthUserId(ctx)` and returns null or throws when it
  is null. Never accept a `userId` argument from the caller — that is an IDOR by construction.
- Anything not called from the browser path is an `internalQuery`/`internalMutation`, unreachable
  from outside.
- The shared-secret pattern in `networth`/`reserved-app` is for **server-only** callers. Our
  `/api/saves` handler is server-side, so it can use it in addition to the auth identity; do not ship
  a secret to the browser, which would defeat it entirely.
- Test A15 enumerates every export from `convex/_generated/api.d.ts` and calls it unauthenticated.
  Run it in CI, not once.

### 6.4 Middleware: the single likeliest way to break this site

The owner's working Convex Auth setup, `marketmyapp/src/proxy.ts:28-32`, uses:

```
matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
```

That is a deny-list: it runs on essentially **every route**. Copied into ns-ui it would run
`convexAuthNextjsMiddleware` on `/`, on `/preview/<name>/embed`, and on `/r/<slug>.json`.
`docs/perf-audit-2026-07.md` cause 2 was precisely "~50 uncached invocations per visitor"; this
reintroduces an edge invocation on every catalog and registry request, and middleware that touches
auth cookies can attach `Set-Cookie` to a CDN-cached response — which leaks a session to every
subsequent visitor of that cached object.

**Rule, not just a test: the matcher is an explicit allowlist** — `/api/auth(.*)`, `/api/me`,
`/api/saves`, `/account(.*)`, `/submit(.*)` — and never the deny-list default. Middleware is still
required, because `dist/nextjs/server/index.js:58-60` shows `convexAuthNextjsMiddleware` proxies auth
actions at `/api/auth`. B3 asserts the matcher by reading it; B4-B6 assert the observable harms.

**Related trap:** `ConvexAuthNextjsServerProvider` (`dist/nextjs/server/index.js:13`) is an async
server component that reads cookies via `next/headers`. In `app/layout.tsx` it makes **every route
dynamic** — non-goal #4, violated in one line. marketmyapp puts it in its root layout, correctly for
that app, and that is exactly the file someone will copy. B2 guards it.

### 6.5 CSRF

`SameSite=Lax` on the `__Host-` cookies handles classic cross-site CSRF for `POST`/`DELETE`. On top of
it, `/api/saves` and `/api/me` validate `Origin` against an allowlist of exactly this origin,
rejecting anything else including a missing `Origin` on a state-changing method (A14).

The deeper point from §6.1 and §6.2 still stands: `HttpOnly` and `SameSite` are necessary and
insufficient, because a same-origin frame can call `fetch('/api/saves', {method:'DELETE'})` with the
cookie riding along and read any CSRF token the page holds. A same-origin frame defeats all of these
at once. That is why the answer to untrusted components is a different origin, not a stricter cookie.

### 6.6 What an attacker gets from a leaked session

They can read a public profile, read and modify that user's saves and collections, edit display
name/bio/URL, and delete the account. They cannot reach component source (public anyway), cannot
publish (submissions are PRs; Phase C needs a separately granted GitHub scope), and cannot reach
another user. Blast radius: one person's bookmark list. `/account` offers "sign out everywhere",
which deletes that user's `authSessions` docs.

The refresh token is the sharper risk, which is why A11 exists: a stolen JWT expires, a stolen refresh
token renews.

### 6.7 Personal data, and the deletion path

Stored in Convex: email address; provider account id and provider name in `authAccounts`; OAuth tokens
where the provider requires them; display name and avatar URL from the provider; handle; optional bio
and URL; saved slugs and collections with timestamps; sessions, refresh tokens, verification codes and
verifiers in the `auth*` tables. Vercel Analytics is unchanged. Resend holds delivery logs for OTP
emails — a second processor, named in the privacy note.

**Deletion is an explicit enumerated mutation.** Convex has no cascade, so this is code, not a
constraint:

```
deleteAccount → for the calling userId, delete docs from:
  saves, collectionItems (via owning collections), collections, profiles,
  authVerifiers, authVerificationCodes, authRefreshTokens, authSessions,
  authAccounts, users
```

**A missed table is silent orphan data with no safety net**, which is why test A9 enumerates all ten
and asserts zero from each rather than spot-checking. Add a new table, add it to both the mutation and
A9 — put that line in a comment above the mutation.

Provider tokens are revoked where the provider supports it, deleted locally where it does not, and the
privacy note says which. Resend's own logs follow Resend's retention, which we do not control; the
note says that too.

**Contributor credit is not deleted, and the guidelines page must say so.** Credit is derived at build
time from merged git history — a public record of an MIT-licensed contribution, not data the site
stores about a person. It survives account deletion; a deleted account's credit reverts from a
`/u/<handle>` link to a plain GitHub login.

---

## 7. Convex: the decision, and the four things that will bite

### 7.1 Decision, recorded

**Backend is Convex.** The owner's reasons: Supabase is out; they are wary of hitting limits on
Neon-via-Vercel; they already run Convex on this machine (seven projects); and one backend for
everything beats an auth adapter plus a separate database. Recorded, not re-argued. Convex is used
here as a database with server functions — its reactivity is explicitly declined (non-goal #7),
because a save is written by one person and read once after paint, and a subscription per visitor on
a CDN-cached catalog would add steady-state work to a page whose measured steady-state cost is
currently 0ms.

### 7.2 Auth library: use Convex Auth, not Better Auth

**Recommendation: `@convex-dev/auth`.**

For it:
- **One backend is the owner's stated reason for choosing Convex.** Bolting Better Auth on
  reintroduces exactly the two-system split the decision was meant to avoid.
- **`@convex-dev/better-auth` is installed in zero projects on this machine** and its maturity could
  not be checked this session. Specifying an unverifiable dependency at the centre of the auth system
  is the wrong risk to take.
- **Email OTP over Resend is already proven in the owner's own code** — `reserved-app/convex/ResendOTP.ts`
  is a complete, working `Email()` provider with a CSPRNG 6-digit code, a 15-minute expiry, per-email
  rate limiting deliberately made indistinguishable from a normal send to avoid a probing side
  channel, and no logging of the token. That file is a template, not a starting point.
- **The cookie posture is better than a hand-specified one** — `__Host-` prefixed, httpOnly, secure,
  lax (§6.1).

Against it, stated plainly:
- **`@convex-dev/auth` is 0.0.94.** Pre-1.0, and the owner's own comment records having to read
  `dist/` source to confirm parameter names "since the API is version-pinned at 0.0.94". Expect
  breaking changes; pin the version.
- **GitHub and Google OAuth are unexercised in this owner's Convex code.** marketmyapp is
  Password-only and dropped Google in the cutover. Only OTP has a working precedent.
- **The localStorage default is a genuine defect for this site**, mitigated but not removed (§6.1).

That gap is exactly what Phase 0 exists to close. If the spike fails on OAuth, the fallback is an
external OIDC provider (Auth0/WorkOS/Clerk free tier) fronting Convex via `auth.config.ts` — Convex
accepts any OIDC issuer. That keeps Convex as the database and moves only the identity problem. Cost
roughly $0-25/mo at this scale; do not take it without the spike failing first.

### 7.3 Convex alongside a heavily static Next site

- **The catalog ships no Convex at all.** No `ConvexReactClient`, no provider, no `useQuery`
  (non-goal #5, test B9). The prerendered HTML is identical for everyone (B8).
- **Saves are read client-side after paint**, by `fetch('/api/saves')` from our own origin — one
  request per page load, after hydration, filtered client-side against the slugs already in the
  catalog payload.
- **A signed-out visitor** gets exactly today's site: same bytes, same CDN cache entry, one extra
  `/api/me` returning `{ signedIn: false }`. Budgeted in C4.
- **First render of a profile page** (`/u/<handle>`) is server-rendered on demand from Convex through
  the server client, or short-revalidate ISR if it proves slow. Not in the static set either way.
  There is no flash-of-signed-out on the catalog because the header's signed-out state *is* the
  server-rendered default — the auth UI appears on hydration, additively.
- **`/account` and `/submit`** are the only pages that mount the Convex auth client, with
  `storage="inMemory"`, and they render no component iframes.

The one honest cost: server-side reads add a hop (our origin → Convex) versus the browser talking to
Convex directly. C5 budgets 250ms p95 for it. In exchange the browser never holds a token, which
§6.1 makes non-negotiable here.

### 7.4 Free tier, in numbers — **all figures unverified, see §9**

Convex's free (Starter) tier meters roughly: **~1M function calls/month, ~0.5 GiB database storage,
~1 GiB database bandwidth/month, ~1 GiB file storage, 1-2 team members.** The first paid tier
(Professional) is around **$25/member/month**. Confirm on the pricing page before relying on these.

Per signed-in page view: **1 query** (`/api/saves`, plus `/api/me`, which can be folded into the same
call — do that). Mutations only on save/unsave. **No subscriptions**, so no long-lived connection
burning calls.

| | function calls/mo | storage |
|---|---|---|
| 0 users | ~0 | ~0 |
| 100 users, 20 page views each | ~2,000-4,000 | << 1 MB |
| 10,000 users, 20 page views each | ~200,000-400,000 | ~200,000 save docs, single-digit MB |

**10,000 users stays inside a ~1M-call free tier**, with room for roughly 2-3x that traffic before
billing. The binding limit at that point is the team-seat count, not usage.

On the owner's stated worry about limits, the failure modes genuinely differ. Neon meters **compute
hours**, so an idle database is nearly free and a busy one costs. Convex meters **function calls and
bandwidth**, so a chatty client is what moves the bill. This spec's design — no subscriptions, one
query per page load, nothing on the catalog — is the cheap shape for Convex's meter specifically. The
thing that would blow it is adding `useQuery` to the catalog, which is why that is non-goal #7 and not
merely a preference.

Other vendors: **Resend** for OTP, already in the owner's stack, ~$0 at these volumes. **Rate
limiting** uses a Convex table (`authRateLimits` already exists, and
`reserved-app/convex/passwordResetRateLimit.ts` is a working precedent) — no Redis, no extra vendor.
GitHub and Google OAuth app registrations and a verified Resend sending domain need DNS access and are
effort rather than cost.

**Total: $0 at 0, 100 and 10,000 users**, on these unverified figures.

---

## 8. Open questions for the owner

1. **Handles.** Auto-derive from the GitHub login with one free change, or force a choice at signup?
   Auto-derive has nothing to derive from for Google/OTP users.
2. **Are profiles public by default?** Recommendation: profiles public, saves private by default with
   a per-collection "make public" toggle.
3. **Collections in Phase A or deferred?** Schema costs little; the UI is real work. Saves alone is a
   cleaner Phase A.
4. **Does the email-capture form merge with auth?** OTP signup produces an email and EmailOctopus
   already has a list. Needs an explicit checkbox, not an assumption.
5. **One Convex deployment or two?** Vercel Preview builds against the prod Convex deployment would
   let a preview write to real user data. Recommendation: a separate dev deployment wired to Preview.
6. **Sign-in for the CLI or MCP server?** Both exist and this spec assumes both stay anonymous.
7. **Contributor credit for the 223 existing components** — all one author today. Does `/contributors`
   ship in Phase B as a single-entry page, or wait?
8. **Rename timing.** Phase A is blocked on it; Phase 0 is not.

---

## 9. Where this document is guessing

- **All Convex pricing and free-tier figures in §7.4 are unverified.** They are numbers the owner's
  decision partly rests on, so check them first.
- **`@convex-dev/better-auth` is entirely unverified** — not installed anywhere on this machine.
  §7.2 recommends against it partly *because* of that uncertainty, which is an argument about risk,
  not about the package's quality.
- **Verified from installed source, not memory:** the cookie names and flags
  (`dist/nextjs/server/cookies.js`), the localStorage write (`dist/react/client.js:14-15,46-47` with
  `dist/nextjs/client.js:28-32`), the `storage="inMemory"` escape hatch and the fact that
  `ConvexAuthNextjsProvider` does not forward it (`dist/nextjs/index.js:31-34`), the `/api/auth` proxy
  requirement (`dist/nextjs/server/index.js:58-60`), and `ConvexAuthNextjsServerProvider` being an
  async cookie-reading server component (`:13-16`). All at version **0.0.94** — re-check after any
  upgrade.
- **Whether email OTP works as a primary sign-in method** (rather than the password-reset flow proven
  in `reserved-app`) is an assumption. Phase 0 item 3 tests it.
- **The C6 bundle budget (≤10KB)** is a target, not a measurement. Measure at step 9 and correct this
  document if wrong rather than quietly failing the test.
- **The "week of work" in §6.2** is a judgement call.
