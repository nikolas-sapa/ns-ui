# ns-ui: from personal registry to community registry

Status: proposal. Nothing below is implemented **in this repo** — Phase 0 ran as a throwaway spike on
a scratch deployment and its results are recorded in §2, §6.1a and §10.

Backend is **Convex** — owner's decision, recorded in §7.1, not re-argued. An earlier draft of this
document evaluated Neon/Postgres and recommended it; that evaluation is in git history if the
reasoning is ever wanted. This version specs what was chosen.

Verified against the repo, against the owner's seven existing Convex projects, and against the
installed `@convex-dev/auth` package source. Where a claim is a guess it says so (§10).

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
12. **No user-uploaded images.** No avatar upload, no cover image. Avatars are the provider's,
    proxied through this origin. Uploaded imagery is user-generated content on our origin and would
    contradict non-goal #9 the day it shipped — §8.2 prices it.

---

## 2. Phases

### Phase 0 — auth spike (load-bearing) — **RAN. Verdict: proceed to Phase A on Convex Auth.**

The auth decision is **not** reopened. All four items are answered; item 4 is answered in two halves,
one of which is a defect in 0.0.94 and is now a named constraint on Phase A (§6.1a). Results are
recorded in place below, and the evidence caveats are in §10.

**Depended on:** nothing. Ran *while* the rename lands, so it cost no calendar time.

A throwaway Next 16 app on a scratch Convex deployment, proving the four things this spec assumes and
the owner's existing code does not demonstrate:

1. **GitHub OAuth** through `@convex-dev/auth` — **code-complete, blocked only on real credentials.**
2. **Google OAuth** through `@convex-dev/auth` — **same.**
3. **Email OTP** as a first-class sign-in method (not just the password-reset flow) — **proven end to
   end.**
4. **Token storage**: confirm §6.1's finding on the pinned version, and confirm `storage="inMemory"`
   suppresses the localStorage write — **suppression confirmed; the in-memory client's React auth
   state is separately broken. §6.1a.**

**Why this existed:** of the three required providers, only OTP-over-Resend had a working precedent in
the owner's code (`reserved-app/convex/ResendOTP.ts`). marketmyapp is Password-only, and its
`CLAUDE.md` records that Google OAuth was *dropped* in the Supabase→Convex cutover because re-adding
it "needs an Auth.js Google provider + client id/secret on the Convex deployment." OAuth on Convex
Auth was unexercised in this owner's stack.

**1 and 2 — OAuth. The risk is closed.** With fake client ids set, `signIn()` was called through the
real client → proxy → Convex path and the redirect Convex actually issued was followed. PKCE
challenge generation, cookie issuance, provider config resolution and redirect construction all
worked; the only thing missing is a real client id and secret. marketmyapp's note was exactly right
and nothing more than it said: an Auth.js provider plus credentials on the deployment.

- **Env var names** are the standard Auth.js convention — `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`,
  `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`. Confirmed by reading `provider_utils.js`, which calls
  `@auth/core`'s `setEnvDefaults`.
- **Callback URLs are on the Convex HTTP router, not on the Next app's origin.** This is the thing
  people get wrong, and it is what goes into the GitHub and Google app registrations:

  ```
  https://<deployment>.convex.site/api/auth/callback/github
  https://<deployment>.convex.site/api/auth/callback/google
  ```

  Confirmed from `dist/server/implementation/index.js`'s `addHttpRoutes`. Note `.convex.site`, not
  `.convex.cloud`, and note that a per-deployment URL means the dev and prod deployments of §5 step 4
  need **separate OAuth app registrations**, or at least separate callback entries.

**3 — Email OTP works as a primary sign-in method.** Request code → submit → `signIn("email-otp")` →
authenticated, resolving to exactly one `users` doc. This was listed in §10 as an assumption; it is
now a result.

**4 — `storage="inMemory"` works, and the mode it enables has a defect.** Zero `localStorage` keys
before sign-in, after sign-in, after reload and on a second route, in both dev and a production
build. §6.1's mitigation is real rather than theoretical and A11 passes. The defect it exposes is
§6.1a, and it changes one rule for Phase A rather than the design.

**Verdict:** proceed to Phase A on `@convex-dev/auth`. Nothing found here meets the "stop and reopen
the auth decision" bar that this section set — that bar was a spike *failure* on OAuth, and OAuth did
not fail.

### Phase A — auth, profiles, saves

**Depends on:** ~~Phase 0 passing~~ (done — see above), **and** the 223-slug rename being merged to
`main`. That is now the only gate left. Hard gate — §3.

**Ships:**

- `@convex-dev/auth` with GitHub, Google, email OTP (Resend).
- Convex schema: `authTables` + `profiles`, `saves`, optionally `collections`.
- Next route handlers on our own origin, all dynamic, all outside the cached set:
  - `/api/auth` — Convex Auth's proxy endpoint (required by the middleware, §6.4).
  - `/api/me` — `{ signedIn, handle, displayName }` or `{ signedIn: false }`.
  - `/api/saves` — `GET`/`POST`/`DELETE`, reading the session cookie server-side and calling Convex
    with an authed server client.
- `/account` and `/welcome` (onboarding, §8.3). **`/u/<handle>` moves to Phase B** — with
  private-by-default (§8.1) every profile page in existence would return 404 in Phase A.
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
- `/u/<handle>` and the collection-publish toggle (§8.1), moved here from Phase A. Credit is the
  first thing on the site with a reason to link to a profile, and publishing is the first thing that
  makes a profile non-empty. Building the route in the phase that also builds its only reader keeps
  the enumeration and caching questions of §8.1 out of the phase carrying the auth risk.

**Done means:** `/guidelines` is static, sign-off is required, credit renders for a contributor
with no account, and §4 tests A18-A21, A26 and B10 pass.

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
    displayName: v.union(v.string(), v.null()),   // ≤ 50 code points, plain text
    bio:         v.union(v.string(), v.null()),   // ≤ 280 code points, rendered as plain text
    url:         v.union(v.string(), v.null()),   // http/https only, ≤ 200 chars, validated on write
    tags:        v.array(v.string()),             // ≤ 3, each a CATEGORIES id (§8.2). [] by default
    isPublic:    v.boolean(),                     // FALSE on insert. §8.1 — gates /u/<handle>
    handleChangedAt: v.union(v.number(), v.null()),  // one free change, then it is a support request
    createdAt:   v.number(),
  }).index("by_userId", ["userId"])
    .index("by_handle", ["handle"]),

  // Deliberately has NO visibility field. A save is never individually publishable — §8.1.
  saves: defineTable({
    userId:    v.id("users"),
    slug:      v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"]),

  // isPublic is the ONLY publish switch in the schema, and it is false on insert.
  collections: defineTable({
    userId: v.id("users"), name: v.string(), isPublic: v.boolean(), createdAt: v.number(),
  }).index("by_user", ["userId"]),

  collectionItems: defineTable({
    collectionId: v.id("collections"), slug: v.string(), position: v.number(),
  }).index("by_collection", ["collectionId"]),
});
```

**There is no avatar field**, and that is a decision, not an omission: the avatar is the provider's,
already present as `users.image` from `authTables`. Uploads are declined in §8.2.

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
| A10 | Session cookie inspection, **on a preview deployment, not localhost** | name is `__Host-__convexAuthJWT`; `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, **no `Domain`**. `cookies.js:21-22` gates the prefix and `Secure` on `isLocalhost`, so a local run tests the dev-mode cookie and proves nothing here — §10 |
| A11 | **`window.localStorage` after sign-in, on every page** | **0 keys** containing `__convexAuthJWT` or `__convexAuthRefreshToken`. This is §6.1; it is the single most important test in this document |
| A12 | Sign out | cookies cleared **and** the `authSessions` doc deleted; replaying the captured cookie → `401` |
| A13 | 100 `POST /api/saves` in 10s, one session | ≥ the 31st returns `429`; docs written ≤ **30** |
| A14 | Cross-origin `POST /api/saves` from `https://evil.example`, with credentials | blocked or `403`; no doc written; no `Access-Control-Allow-Origin` for that origin |
| A15 | **Unauthenticated direct call to every exported Convex query and mutation**, at `NEXT_PUBLIC_CONVEX_URL`, enumerated from `convex/_generated/api.d.ts` | every one returns null/throws; **0 rows of anyone's data**. See §6.3 — Convex functions are public by default |
| A16 | Two simultaneous claims of one handle | exactly one succeeds, one fails; exactly **1** `profiles` doc with that handle |
| A17 | `bio` containing `<script>`; `url` set to `javascript:...` | bio renders as literal text; url rejected at write unless http/https |
| A18 | **Signed-out `GET /u/<handle>` for a private profile** (Phase B) | `404`, and the response is **byte-identical** to `GET /u/<a-handle-nobody-has-claimed>` — status, body and headers. Any difference is a handle-enumeration oracle against a site with no user directory (non-goal #8). No `set-cookie` |
| A19 | **`POST /api/saves` from a default client that sends no visibility field** | doc written has **no visibility field at all**; then call every anonymous read path (`/u/<handle>`, its collection route, and every export in `convex/_generated/api.d.ts`) and assert **0 rows** referencing that save. Privacy must not require the client to ask for it |
| A20 | Publish one collection of 3 items, with 4 other private collections and 20 bare saves on the account; fetch `/u/<handle>` anonymously | `200`; payload contains exactly the **3** published slugs and **0** of the other 21 distinct private slugs, asserted by substring search over the raw response |
| A21 | Un-publish that collection | `/u/<handle>` returns `404` within **≤ 5s** — the publish mutation calls `revalidateTag`, so this is not a TTL wait. If the tag path is not used, the route's `revalidate` must be ≤ 60 and the criterion becomes 60s |
| A22 | Handle validation: the reserved list plus **40** fuzz inputs (uppercase, leading/trailing hyphen, double hyphen, empty, 31 chars, RTL override, homoglyphs, `.`/`_`/`/`) | **40/40 rejected** at the mutation, `0` new `profiles` docs; the 13 reserved words rejected too |
| A23 | Profile field caps: 281-code-point bio, 51-char display name, 4 tags, one tag outside the 12 `CATEGORIES` ids, 201-char url | each `400` with **0** writes; the out-of-vocabulary tag is **rejected, not silently dropped** |
| A24 | Onboarding abandonment: complete OAuth, close the tab before claiming a handle, save 2 components, sign in again | exactly **1** `users` doc and **0** `profiles` docs after the abandon; both saves still resolve; the handle prompt reappears; **0** rows deleted by any cleanup path |
| A27 | **§6.1a.** `grep -rn "useConvexAuth" app/` **and** `/account` signed-in, `storage="inMemory"` | **0 matches**; `/account` shows signed-in UI on first paint and still does **after a reload and on a second auth route**, with **0** `localStorage` keys. The grep is the real test — the defect is silent and looks like a session bug |
| A26 | HTML + network trace of `/u/<handle>` and `/account`, anonymous and signed-in | **0** requests to `github.com`, `githubusercontent.com` or `googleusercontent.com`; every avatar byte served from this origin (§8.2) |

### Group B — the static invariant

| # | Test | Pass criterion |
|---|---|---|
| B1 | `next build` route table | rows for `/`, `/preview/[name]`, `/preview/[name]/embed`, `/preview/[name]/play`, `/writing/[slug]` **byte-identical** to the baseline captured at step 2 |
| B2 | `grep -rn "ConvexAuthNextjsServerProvider\|cookies()\|headers()" app/layout.tsx app/_components/site-shell.tsx` | **0 matches**. §6.4 |
| B3 | Middleware matcher is an explicit allowlist | matches only `/api/auth(.*)`, `/api/me`, `/api/saves`, `/account(.*)`, `/welcome`, `/submit(.*)`. **`/u/(.*)` is not on it** — §8.1. Asserted by reading `proxy.ts` **and** by B4-B6 |
| B4 | Anonymous `curl -I /preview/<slug>/embed`, warm | `200`, `x-nextjs-cache: HIT`, `s-maxage=3600`, **no `set-cookie`** |
| B5 | Same for `/preview/<slug>/play` | identical |
| B6 | Anonymous `curl -I /r/<slug>.json`, `/registry.json` | `200`, cache HIT, **no `set-cookie`**, no `vary: cookie` |
| B7 | `npx shadcn add <origin>/r/<slug>.json`, clean project, no session | succeeds, same bytes as before |
| B8 | HTML of `/`, anonymous vs signed-in | **identical bytes** |
| B9 | JS bundle of `/` | contains **no** `ConvexReactClient` and no `convex/react`. Non-goal #5 |
| B10 | Anonymous `curl -I /u/<a-public-handle>` | `200`, **no `set-cookie`**, **no `vary: cookie`**. `/u/<handle>` renders the public projection only and never reads a cookie — the owner's own preview of an unpublished profile lives at `/account`, not here (§8.1) |

### Group C — performance

| # | Test | Pass criterion |
|---|---|---|
| C1 | `/` TTFB, warm CDN hit, 3 runs | ≤ **200ms** (baseline 174-182ms) |
| C2 | `/` steady-state TBT, 15-25s window, 4x CPU throttle, quiet machine | **0ms, 3 of 3 runs** (current shipped value) |
| C3 | `/` LCP, 4x throttle | ≤ **600ms** (baseline 516ms) |
| C4 | Requests on one `/` load | ≤ **57** (baseline 53; `/api/me` + `/api/saves`) |
| C5 | `/api/saves` p95, signed in, warm | < **250ms** (one extra hop: our origin → Convex) |
| C6 | Initial JS added to `/` | ≤ **10KB** brotli over the current ~225KB. Target, not a measurement — §10 |

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
4. Provision Convex. Set `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`,
   `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
   **on the Convex deployment** via `npx convex env set` — not `.env.local`. Set them on **both** the
   dev and prod Convex deployments, and `NEXT_PUBLIC_CONVEX_URL` in **both** Vercel Production and
   Preview, in one change. A missing one is a total outage. Register the OAuth apps against the
   **`.convex.site` callback URLs** of Phase 0 — one set per deployment, since the URL contains the
   deployment name.
5. `convex/schema.ts` (`authTables` + `profiles`), `convex/auth.ts`, `convex/http.ts`,
   `convex/auth.config.ts`.
6. `proxy.ts` with the **allowlist** matcher (§6.4). Run B3.
7. Auth routes and the `/account` shell — signed-in state from `isAuthenticatedNextjs()` or
   `/api/me`, **never `useConvexAuth()`** (§6.1a). Run A3, A4, A5, A10, **A11**, A12, A27.
8. `saves` table and its mutations; `/api/saves`, `/api/me` on our origin. Run A1, A2, A6, A7, A13,
   A14, A15.
9. Client auth UI in `SiteShell`, hydration-only. **Run all of groups B and C here** — this is the
   step that can break the site.
10. `/welcome` onboarding and the handle claim (§8.3), profile fields (§8.2), account deletion. Run
    A16, A17, A22, A23, A24, A9.
11. Rewrite `SECURITY.md`; add the privacy note, including the two sentences §8.1 requires about
    contributor credit.
12. Phase B: `/guidelines`, DCO, `build-contributors.ts`, then `/u/<handle>` and the
    collection-publish toggle. Run A18-A21, A26, B10, and re-run group B.
13. Phase C: incremental GitHub scope, `/submit`. Run D1-D4.

---

## 6. Security

### 6.1 The finding that shapes everything: Convex Auth mirrors its tokens into `localStorage`

Read from the installed package at `@convex-dev/auth@0.0.94`.

The **cookie** posture is excellent, and better than a hand-specified one.
`dist/nextjs/server/cookies.js:20-31,71-81` sets `__Host-__convexAuthJWT` and
`__Host-__convexAuthRefreshToken` with `httpOnly: true`, `secure: true`, `sameSite: "lax"`,
`path: "/"`. Lines 21-22 gate the prefix and `Secure` on `isLocalhost`, so this posture is the
deployed one and a local run will not show it (§10 — read, not witnessed).
The `__Host-` prefix is enforced by the browser to mean host-only with no `Domain` —
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

### 6.1a Constraint from Phase 0: under `inMemory`, client-side auth state never settles

**Named constraint, not a footnote.** Phase 0 confirmed `storage="inMemory"` suppresses every
`localStorage` write (A11 passes). In that same mode the client-side React auth state does not
settle: the websocket sends `Authenticate{tokenType:"User"}` and then immediately
`Authenticate{tokenType:"None"}`.

**Root cause**, read from `dist/react/client.js:287`:

```js
useMemo(() => peristentStorage ?? inMemoryStorage(), [peristentStorage])
```

When `peristentStorage` is `null` — which is exactly what `"inMemory"` maps to
(`dist/nextjs/client.js:30-32`) — the dependency never changes, so `getItem`/`setItem` stay closed
over the first render's `useState({})` forever. A **stale closure, not a race**: no amount of waiting
or retrying fixes it. It is a genuine defect in 0.0.94's in-memory path.

**Why it does not sink the design.** The server-side `httpOnly` cookie is still issued correctly under
`inMemory`, and a proxy-gated route using `convexAuth.isAuthenticated()` — which reads that cookie
server-side — passes. The broken path is the browser's own view of its auth state, and this spec
never uses it: non-goal #5 forbids mounting `ConvexReactClient` on catalog pages, non-goal #7 forbids
`useQuery`, and §6.1 already routes every read and write through
browser → `/api/saves` on our origin → Convex server-side. The defect lands squarely inside the part
of the library the design had already declined.

**The rule it produces, which is now load-bearing:**

> On `/account` and `/submit` — the only two pages that mount the auth client — signed-in UI state is
> derived **from the server**: `isAuthenticatedNextjs()` in a server component, or `/api/me`. Never
> from `useConvexAuth()` on the client.

Step 7 of §5 already fetches `/api/me`; what changes is that this stops being a stylistic preference
and becomes the thing that makes those pages work. A future contributor reaching for
`useConvexAuth()` there will get a component that believes nobody is signed in, and it will look like
a session bug rather than a library bug — which is why this is written down here rather than left to
be rediscovered. Re-check it after any upgrade off 0.0.94; if the stale closure is fixed upstream the
rule can relax, and nothing else in the spec depends on it.

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
`/api/saves`, `/account(.*)`, `/welcome`, `/submit(.*)` — and never the deny-list default.
`/u/(.*)` is deliberately absent: §8.1 makes the profile page anonymous-only, and adding it to the
matcher is how it would quietly acquire a cookie read. Middleware is still
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

They can read that user's profile — including the parts §8.1 keeps private — read and modify their
saves and collections, publish or unpublish a collection, edit display name/bio/URL/tags, and delete
the account. They cannot reach component source (public anyway), cannot
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
`/u/<handle>` link to a plain GitHub login. **A private profile takes the same degradation path as a
deleted one** — credit links to `/u/<handle>` only where a profile exists *and* is public (§8.1) —
so the public-by-design credit line and the private-by-default profile never contradict each other on
the page. §8.1 gives the two sentences the privacy note and `/guidelines` must both carry.

Also stored, from §8.2: up to 3 category tags, and `isPublic` on the profile and on each collection.
No avatar bytes are stored — the avatar is the provider's, proxied through this origin so a profile
view does not report the viewer's IP to GitHub or Google.

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
  breaking changes; pin the version. Phase 0 found one such defect in the in-memory storage path
  (§6.1a), which is the concrete form this risk takes.
- ~~**GitHub and Google OAuth are unexercised in this owner's Convex code.**~~ **Closed by Phase 0**
  — both are code-complete through the real client → proxy → Convex path and blocked only on real
  credentials.
- **The localStorage default is a genuine defect for this site**, mitigated but not removed (§6.1) —
  and the mitigation carries the §6.1a constraint with it.

Phase 0 existed to close that gap and did. The fallback it was hedging against — an external OIDC
provider (Auth0/WorkOS/Clerk free tier) fronting Convex via `auth.config.ts`, keeping Convex as the
database and moving only the identity problem, roughly $0-25/mo at this scale — is **not being
taken**, because its trigger was a spike failure on OAuth and OAuth did not fail. Recorded here in
case a future upgrade reopens it.

### 7.3 Convex alongside a heavily static Next site

- **The catalog ships no Convex at all.** No `ConvexReactClient`, no provider, no `useQuery`
  (non-goal #5, test B9). The prerendered HTML is identical for everyone (B8).
- **Saves are read client-side after paint**, by `fetch('/api/saves')` from our own origin — one
  request per page load, after hydration, filtered client-side against the slugs already in the
  catalog payload.
- **A signed-out visitor** gets exactly today's site: same bytes, same CDN cache entry, one extra
  `/api/me` returning `{ signedIn: false }`. Budgeted in C4.
- **First render of a profile page** (`/u/<handle>`) is server-rendered on demand from Convex through
  the server client, or short-revalidate ISR if it proves slow. Not in the static set either way. It
  reads no cookie and renders the same bytes for everyone (§8.1, B10), so ISR is safe here in a way
  it would not be for a route with a signed-in variant; the publish mutation invalidates by tag so
  A21's un-publish criterion is 5s rather than a TTL.
  There is no flash-of-signed-out on the catalog because the header's signed-out state *is* the
  server-rendered default — the auth UI appears on hydration, additively.
- **`/account` and `/submit`** are the only pages that mount the Convex auth client, with
  `storage="inMemory"`, and they render no component iframes.

The one honest cost: server-side reads add a hop (our origin → Convex) versus the browser talking to
Convex directly. C5 budgets 250ms p95 for it. In exchange the browser never holds a token, which
§6.1 makes non-negotiable here.

### 7.4 Free tier, in numbers — **all figures unverified, see §10**

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

## 8. Profiles, privacy and onboarding

### 8.1 Everything is private by default — decided

**Owner's decision, recorded, not re-argued.** Every row a signed-in user creates — their profile,
their saves, their collections — is invisible to everyone but them until they take an explicit action
to publish it. This closes what was open question 2, and it closes it *further* than the old
recommendation there, which had profiles public.

It is a server-side invariant, not a UI one: `isPublic` is `false` on insert (§3) and the anonymous
read path filters on it, so a forgotten client-side check cannot leak anything. §6.3 is the reason
that distinction matters here — Convex has no RLS, so "the query does not return it" is the whole of
the enforcement.

**What `/u/<handle>` renders for someone who has shared nothing: a 404**, byte-identical to the 404
for a handle nobody has ever claimed. Both are defensible and this one wins on one argument: any
distinguishable response is a handle-enumeration oracle. A minimal card that says "this user exists
but has published nothing" confirms membership of a user list that non-goal #8 says does not exist,
and it does so for every account on the site — including accounts that signed up with an email whose
local part they let us pre-fill into the handle (§8.3). The secondary argument is smaller but real:
a minimal card is a thin page with no content, one per account, offered to a crawler. Test A18
asserts the byte-identity rather than merely asserting the status code, because a status match with
a different body is the same oracle.

**The owner previewing their own unpublished profile does not happen at `/u/<handle>`.** It lives
under `/account`. That keeps `/u/<handle>` a route that never reads a cookie — anonymous-only,
cacheable, taggable, `no set-cookie`, `no vary: cookie` (B10) — instead of a route whose output
depends on who is asking, which is the shape non-goal #11 exists to prevent. One route, one
audience.

**Recommendation — `/u/<handle>` moves out of Phase A and into Phase B.** In Phase A there is no
publish control, so every profile page that could exist returns 404: the route would ship with no
reachable non-error state. Phase B is where its first real reader arrives (contributor credit) and
where publishing arrives, and it is the phase that is not also carrying the auth cutover. The handle
*claim* stays in Phase A — it is identity, it is cheap while `profiles` is being written anyway, and
A16's race test belongs next to the mutation that has the race. **Owner can overrule; the cost of
overruling is building a 404 and testing it twice.**

**Per-item versus per-collection visibility: per-collection only, and `saves` gets no visibility
field at all.** A single save is never individually publishable. If someone wants to share one
component they make a collection containing one component. The argument, in order of weight:

1. **One enforcement point.** Two publishable row types means every anonymous read path unions two
   sources, and every future feature has to remember both. §6.3 makes a forgotten check a data leak.
2. **The mental model already exists.** "A list I can share" is a thing people have used elsewhere.
   "This one bookmark is public but that one is not" is a thing they have to be taught.
3. **Page cost.** A per-item toggle is a second control next to the save control on the catalog card
   — on the page whose byte budget (C6, ≤10KB) is the tightest constraint in this document, for a
   capability collections already cover.

`collections.isPublic` is therefore the only publish switch in the data model, and `profiles.isPublic`
gates whether the page that would list them exists at all. Publishing a collection prompts once, in
plain words, that this also makes `/u/<handle>` visible, and sets both flags in one mutation. Two
flags rather than one because the profile must be able to be public with zero public collections —
that is exactly the case contributor credit needs, below.

**Contributor credit (§6.7) and the privacy default do not contradict each other, and the page must
say why.** Credit is derived at build time from merged git history. It is not profile data, it is not
read from Convex, it does not consult `isPublic`, and it exists for people who never created an
account. What a private profile changes is only the *link target*: §6.7 already specifies that credit
degrades from a `/u/<handle>` link to a plain GitHub login, and a private profile takes that same
degradation path as a deleted account does. So the rule is one line: **credit links to `/u/<handle>`
only when a profile exists and is public; otherwise it renders the GitHub login as plain text.**

The privacy note and `/guidelines` must both carry both halves, in these terms:

- Nothing you save, and nothing you write on your profile, is visible to anyone unless you publish
  it. Publishing is per collection, and it is off until you turn it on.
- Contributing a component to the repository is public git history under the GitHub identity you
  opened the pull request with. It is not covered by the privacy setting, it is not something this
  site stores about you, and it survives deleting your account.

Written that way the two never look like the same promise being broken.

### 8.2 Profile customization

The owner asked for full customization. Below is the concrete field list, the two places where
"more" costs a permanent duty rather than a day, and an explicit list of what is being declined.

**Avatar — recommendation: provider-supplied only.** GitHub and Google both hand us one; it lands in
`users.image` from `authTables`, so it costs zero schema and zero storage. OTP-only users, who have
no provider avatar, get a deterministic identicon derived from the handle — generated, not stored.

Serve it from this origin. Hotlinking `avatars.githubusercontent.com` sends every viewer's IP to a
third party on every profile view, which is a privacy regression introduced by a privacy feature.
`next/image` with the two avatar hosts allowlisted in `remotePatterns` does it in a config line;
A26 asserts the outcome.

What uploads would actually entail, since it is Convex's own feature and therefore looks free:
`ctx.storage.generateUploadUrl()` for a client-direct PUT, a storage id on the profile row, the
`_storage` system table, and metering against the ~1 GiB file-storage line in §7.4. Then the parts
that are not Convex's problem: server-side content-type sniffing (never the client's declared type),
a hard byte cap (512KB), dimension caps and a re-encode so a 40-byte decompression bomb cannot be
served back, EXIF stripping (uploaded photos carry GPS), a delete path wired into the §6.7 cascade
and test A9, and — the actual cost — **a moderation surface**. An uploaded avatar is user-generated
imagery rendered on this origin, next to a public credit line, and non-goal #9 says there is no
moderation tooling. Uploads do not merely add work, they contradict a stated non-goal unless a
report-and-takedown path and a person to action it arrive with them.

So: **provider avatar only, and uploads join §1 as a non-goal until there is a moderation story.**
Provider-avatar-only ships in a day. Uploads are a week plus a permanent duty, and the duty is the
expensive half. **This is the recommendation the owner is most likely to want to overrule, so it is
the one to overrule first if any of them are.**

**Tags — recommendation: a fixed vocabulary, drawn from `lib/search-categories.ts`.** The 12 ids
(`heroes`, `actions`, `forms`, `navigation`, `data`, `feedback`, `scroll`, `text`, `surfaces`,
`media`, `backgrounds`, `sections`), maximum 3, chosen from chips. Free text has no abuse story here
that does not end in moderation: a bio field is one thing, but a tag is a short public label that
invites slurs, handles-in-a-tag and URL-in-a-tag, and it needs length caps, normalization, homoglyph
handling and a review path. The fixed vocabulary needs none of that — the validator is
`tags.every(t => CATEGORY_IDS.includes(t))`, rejecting rather than silently dropping (A23) — and it
buys something free text cannot: the values are already the site's own taxonomy, so "contributors who
work on backgrounds" is a query later rather than a text search.

**Bio, display name, URL.** Already in §3; the concrete rules:

- `bio`: **280 code points** (counted as code points, not UTF-16 units, or an emoji costs two),
  plain text, rendered as text. No markdown, no HTML, and **no autolinking** — autolinking is what
  turns a bio into a spam vector and it quietly undoes the URL-scheme validation next to it.
  Newlines preserved, runs of blank lines collapsed to one.
- `displayName`: 50 code points, same rendering rule.
- `url`: one field, parsed with `new URL()`, `http:`/`https:` only, 200 chars, rejected at the
  mutation on anything else. A17 already covers `javascript:`; A23 covers the cap.

**What is not being built, and why — this is the "no".**

- **A social-links array** (X, Bluesky, Dribbble, LinkedIn…). N rows of URL validation, a per-platform
  icon set and a per-platform normalizer, to do what the single `url` field already does. No.
- **Uploaded avatars and cover images.** Above. The banner is the same cost with more pixels. No.
- **Pronouns, location, company, "available for work".** These are user-directory furniture, and
  non-goal #8 says there is no user directory. They also broaden what a leaked session exposes
  (§6.6) from a bookmark list to a small dossier. No.
- **A per-profile accent colour or theme.** The registry's entire contract is that colour comes from
  tokens and both themes are non-negotiable. A profile that overrides the accent breaks the one rule
  every component here is held to. No.
- **Markdown or rich text in the bio.** No.

That is "full customization" minus every part that buys a moderation duty this project has already
declined. Each bullet is a recommendation, overrulable individually.

### 8.3 Onboarding

**Hard cap: two steps**, both after identity is established, and only one of them is required.

The justification is the abandonment arithmetic. The account already exists the moment the OAuth
callback returns — a question asked after that point cannot prevent a signup, it can only produce a
half-finished account. And the entire value of a new account on this site is one thing: saving a
component. Anything not required to make a save work is therefore asked later, from `/account`, where
the person is already invested rather than standing in a doorway. One thing must be collected (the
handle) and one thing is worth offering while attention is high (an optional profile). That is two.
A third step would have to justify itself against "ask this from `/account` instead", and nothing
does.

**Step 1 — handle. Required, and the only required step.** This resolves open question 1.

**Decision: always show the field, pre-filled where we can derive a value.** Not silent auto-derive,
and not an empty box.

- GitHub gives `login`. Google and OTP give only an email, so the candidate is the local part.
- Normalize the candidate: lowercase, drop everything outside `[a-z0-9-]`, collapse repeated hyphens,
  trim leading/trailing hyphens, truncate to 30, and on collision append `-2`, `-3`.
- Show it in an editable field with the collision-checked state visible, and claim it only on submit.

Why not silent auto-derive: for the two providers that have nothing to derive from but an email, the
derived handle publishes a fragment of the email address without anyone being asked —
`firstname.lastname@` becomes a public `firstnamelastname`. Why not a bare choice: it is the only
blocking step in the flow, and a valid pre-filled value turns it into one keystroke for the GitHub
majority.

Validation: 2-30 characters, `^[a-z0-9](-?[a-z0-9])*$`, plus a reserved list — `account`, `submit`,
`api`, `u`, `r`, `preview`, `writing`, `guidelines`, `contributors`, `admin`, `about`, `new`,
`settings`. Claimed by the `claimHandle` mutation of §3; A16 covers the race, A22 the validation.
**One free change later** from `/account` (`handleChangedAt`), then it is a support request: enough
to fix a typo or a regretted signup, not enough to churn handles that credit links point at.

**Step 2 — profile. Entirely optional, one screen.** Display name (pre-filled from the provider), up
to 3 tags from the fixed vocabulary, bio. Plus one unchecked newsletter checkbox — which is where
open question 4's "explicit checkbox, not an assumption" lives, and it lives nowhere else. "Skip" is
rendered with the same weight as "Continue", not as a grey link under it.

**Not asked at all:** how you heard about us; role or company; interests for personalization (there
is no personalization); email confirmation for OAuth users (the provider did it); and — deliberately
— any privacy toggle. Everything is already private (§8.1). A privacy question here would imply
otherwise and hand the user a chance to mis-set on their first thirty seconds on the site.

**Abandonment. Nothing is destroyed and nothing needs cleaning up.** Two points to abandon at:

- *Before the handle is claimed.* A `users` row exists with no `profiles` row. That is a valid and
  usable state, not a broken one: saves are keyed on `userId`, so the person can browse and save
  normally, and the header shows the provider's display name. The handle prompt reappears on the
  next visit to any auth surface. Nothing is blocked except a profile page, which for them would 404
  anyway (§8.1).
- *After the handle, before step 2.* Nothing to do; step 2 is optional by construction.

So the rule is: **onboarding is resumable and never destructive, and the only gate is that the handle
prompt reappears until it is answered.** There is deliberately no timed cleanup of half-onboarded
accounts — such a job would delete real saves belonging to someone who closed a tab. A24 asserts the
whole of this: one `users` doc, zero `profiles` docs, both saves surviving, zero rows deleted.

**The account of someone who skips everything:** a `users` row, and a `profiles` row carrying the
handle, the provider's display name and avatar, `isPublic: false`, no bio, no tags, no collections.
Zero public surface, fully functional for saving, and `/u/<handle>` 404s — which is exactly the
"shared nothing" case §8.1 describes.

**Where it runs:** a dedicated `/welcome` route, dynamic and `no-store`, in the middleware allowlist
of §6.4 alongside `/account`. Not a modal over the catalog — a modal on `/` would need auth state in
the catalog bundle, which is non-goal #5 and test B9.

---

## 9. Open questions for the owner

1. ~~**Handles.**~~ **Answered in §8.3:** always show the field, pre-filled from the GitHub login or
   the email local part, editable before it is claimed, one free change afterwards.
2. ~~**Are profiles public by default?**~~ **Decided by the owner, §8.1: private by default** —
   further than this document's old recommendation, which had profiles public. Visibility is
   per-collection only; `saves` has no visibility field.
3. **Collections in Phase A or deferred?** Schema costs little; the UI is real work. Saves alone is a
   cleaner Phase A. §8.1 sharpens the question: the publish toggle is now the *only* way anything
   becomes public, so deferring collections defers publishing entirely — which is consistent with
   `/u/<handle>` moving to Phase B, and is the recommended pairing.
4. **Does the email-capture form merge with auth?** OTP signup produces an email and EmailOctopus
   already has a list. Needs an explicit checkbox, not an assumption. §8.3 places that checkbox —
   unchecked, on the optional onboarding step, and nowhere else — but whether the list itself is
   wired to EmailOctopus is still the owner's call.
5. **One Convex deployment or two?** Vercel Preview builds against the prod Convex deployment would
   let a preview write to real user data. Recommendation: a separate dev deployment wired to Preview.
6. **Sign-in for the CLI or MCP server?** Both exist and this spec assumes both stay anonymous.
7. **Contributor credit for the 223 existing components** — all one author today. Does `/contributors`
   ship in Phase B as a single-entry page, or wait?
8. **Rename timing.** Phase A is blocked on it; Phase 0 is not.

---

## 10. Where this document is guessing

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
  upgrade. **Phase 0 re-checked every one of these against installed 0.0.94 and found no
  contradiction in any load-bearing claim.**
- ~~**Whether email OTP works as a primary sign-in method**~~ — **answered by Phase 0: yes.** Proven
  end to end, resolving to exactly one `users` doc. No longer an assumption.
- **A10's `__Host-` prefix and `Secure` flag are read, not witnessed.** `cookies.js:21-22` gates both
  on `isLocalhost`, and the spike ran on localhost, so what it observed was the plain dev-mode
  cookie. The production behaviour follows from the source and from how the browser enforces
  `__Host-`, but nobody has seen it on a real deployment. A10 is therefore the first test to run
  against a preview URL rather than locally — it is currently the strongest claim in §6.1 with the
  weakest evidence behind it.
- **The C6 bundle budget (≤10KB)** is a target, not a measurement. Measure at step 9 and correct this
  document if wrong rather than quietly failing the test.
- **The "week of work" in §6.2** is a judgement call.
- **§8 mixes one decision with several recommendations.** Private-by-default (§8.1) is the owner's
  decision. The 404-not-minimal-card choice, `/u/<handle>` moving to Phase B, per-collection-only
  visibility, provider-avatars-only, the fixed tag vocabulary, the declined field list and the
  two-step cap are all recommendations with the reasoning attached, and each is overrulable on its
  own. The "week plus a permanent duty" for avatar uploads is the same kind of judgement call as the
  one in §6.2.
- **Verified, not remembered:** the 12 category ids quoted in §8.2 were read from
  `lib/search-categories.ts`. Convex file-storage API names in §8.2 are from memory — check them
  before costing an upload path.
