# ns-ui: from personal registry to community registry

Status: proposal. Nothing below is implemented.

Verified against the repo, and against the owner's other projects on this machine, at read time.
Where a claim is a guess it says so.

Two corrections to the original brief, both of which make the security case stronger:
`featured-card.tsx` does **not** read `contentDocument` (only `preview-card.tsx` does — the exposure
is the shared origin, and a third frame nobody mentions is the interactive one), and
`generateStaticParams()` returns `[]` on both cached preview routes, so they are ISR rather than
build-time prerender. Details in §6.1 and §4 group B.

---

## 1. Non-goals

These are explicitly out of scope. Each is here because someone will ask for it.

1. **User-uploaded components are not previewed on this origin.** Ever, under this spec. Submissions
   are GitHub pull requests. §6 states what would have to change and what it costs; the answer is a
   separate deployment, not an attribute.
2. **No in-app code editor, no paste-and-run playground.** Same reason.
3. **No passwords.** GitHub, Google, email OTP. No Apple, no X.
4. **The catalog does not become dynamic.** `/`, `/preview/<name>`, `/preview/<name>/embed`,
   `/preview/<name>/play` keep their current caching characteristics exactly. No `cookies()` or
   `headers()` call is added to `app/layout.tsx` or `SiteShell` — one such call opts every route out
   of static generation.
5. **`npx shadcn add` stays anonymous forever.** `/r/*.json`, `/registry.json`, `/llms.txt` never
   require a session, never receive a `Set-Cookie`, never leave the CDN.
6. **No public user directory, no follows, no comments, no ratings, no DMs.** Profiles are a page
   about you and your saves; they are not a social graph.
7. **No moderation tooling.** GitHub's PR review UI is the moderation tooling.
8. **No realtime.** No subscriptions, no WebSocket, no live-updating catalog. §7 explains why this
   is a decision rather than an omission.
9. **No migration of the shipped registry into a database.** Component metadata stays in `meta.json`
   on disk, built by `registry:build`. The database holds people and their pointers, nothing else.
10. **No SSR of user-specific content into any cached route.** Saves are read client-side after
    hydration.

---

## 2. Phases

Each phase ships on its own and leaves the site correct if the next never happens.

### Phase A — auth, profiles, saves

**Depends on:** the in-flight 223-slug rename landing on `main` first. Hard gate, not a preference —
see §3.

**Ships:**

- Better Auth on Postgres. Providers: GitHub OAuth, Google OAuth, email OTP.
- New routes, all dynamic, all outside the cached set:
  - `/api/auth/[...all]` — Better Auth's handler.
  - `/api/saves` — `GET` (the caller's saves), `POST` (save a slug), `DELETE` (unsave).
  - `/account` — signed-in only: profile fields, connected providers, saved components,
    sign-out-everywhere, delete-account.
  - `/u/<handle>` — public profile. Dynamic or short-revalidate; not in the static set either way.
- Header auth UI in `SiteShell`, rendered **client-side after hydration** from the session endpoint.
  Signed-out is the server-rendered default, so the shell's HTML is identical for everyone and every
  cached route stays cached.
- A save control on the catalog card and the playground page. Optimistic, client-only, hydrated from
  one `GET /api/saves` per page load.
- `SECURITY.md` rewritten. Lines 5-7 currently read "There is no backend, no database, and no user
  data." That becomes false the moment this ships, and correcting it is part of the phase, not a
  follow-up. Add: what is stored, the deletion path, and that component previews still run as
  first-party code.
- A privacy note (short, on `/account`, linked from the footer) listing exactly what is stored and
  how to delete it.

**Done means:** every test in §4 groups A, B and C passes, and `next build`'s route table for `/`,
`/preview/[name]`, `/preview/[name]/embed`, `/preview/[name]/play` is byte-identical to the
pre-change baseline.

### Phase B — guidelines page and contributor credit

**Depends on:** nothing in A, technically. Ship after A so credit can link to a profile; it degrades
to a plain GitHub login if A slipped.

**Ships:**

- `/guidelines` — a static page. Not a copy of `CONTRIBUTING.md`; it is the *taste* document the
  repo does not have: what "one interaction" means, why both themes are non-negotiable, why the card
  matters as much as the preview, the token rule, what gets rejected and why. `CONTRIBUTING.md`
  stays the mechanical how-to; the two link to each other.
- Licensing stated there: contributions are MIT, and the PR template gains a DCO sign-off checkbox
  plus a `Signed-off-by` line. Add a `DCO` file at the repo root.
- Contributor credit: a build step reads merged git history and writes
  `lib/contributors.generated.json` (slug → GitHub login), consumed by the playground page and a
  `/contributors` index. **Generated at build from git, not from the database.** If a contributor
  also has an account, credit links to `/u/<handle>`; matching is by GitHub login on the `account`
  row.

**Done means:** `/guidelines` is in the static route set, the PR template requires sign-off, and
credit renders correctly for a component whose author has no account at all.

### Phase C — PR-opening submission portal

**Depends on:** A (session + GitHub token) and B (guidelines to point at).

**Ships:**

- `/submit` — signed-in with GitHub only. A form: component name, title, description, collection,
  tags, `component.tsx`, `demo.tsx`, and the `meta.json` fields.
- On submit, the server uses the user's own GitHub token — an incremental OAuth scope requested at
  submit time, not at sign-in — to fork the repo *as them*, commit the files on a branch, and open a
  PR. The bot never commits under the maintainer's identity.
- The pasted code is written to a file and pushed. **It is never imported, never built, never
  rendered, never executed on this origin.** CI runs it in GitHub's sandbox, as it does for any PR
  today.
- Contributors still run `npm run verify` locally and attach screenshots. The portal lowers the
  barrier to opening a PR; it does not replace the gate.

**Done means:** a fresh account can produce a PR that CI accepts as well-formed, and a static
analysis of the app confirms no code path imports anything from the submitted payload.

---

## 3. Data model

Better Auth's own CLI generates and owns `user`, `session`, `account`, `verification`. Do not
hand-author them; extend via its documented additional-fields mechanism rather than by altering its
tables.

Our tables, alongside:

```
profile
  user_id      text  PK, FK -> user.id  ON DELETE CASCADE
  handle       text  UNIQUE (case-insensitive)
  display_name text
  bio          text          -- length-capped, rendered as plain text, never HTML
  url          text          -- http/https only, validated on write
  created_at   timestamptz

save
  user_id    text  FK -> user.id ON DELETE CASCADE
  slug       text            -- registry item name
  created_at timestamptz
  PRIMARY KEY (user_id, slug)

collection                    -- ship in Phase A if cheap, otherwise defer
  id, user_id FK, name, created_at

collection_item
  collection_id FK ON DELETE CASCADE, slug, position
  PRIMARY KEY (collection_id, slug)
```

That is the whole model. No component table, no tags table, no ratings table.

### The slug problem, and why it gates Phase A

There is no stable non-slug identity in this repo. `meta.json`'s `name` *is* the slug, the folder
name *is* the slug, and `files[0].target` is derived from the folder (`docs/rename-plan.md` §1).
Introducing a permanent component id is a change to the registry format and is not proposed here.

`docs/rename-plan.md` renames **222 of 223** components in one atomic commit, and that rename is
executing now. A saves table populated before it merges holds 222 dead pointers on the day it lands,
and there is no migration unless someone commits to keeping `docs/rename-map.tsv` as a permanent
redirect table — which is worse than waiting a week.

**Therefore: no table keyed on slug may exist before the rename commit is on `main`.** That means
`save`, `collection_item`, and any future slug-keyed table. `user`, `session`, `account`,
`verification` and `profile` are slug-free and could technically ship earlier, but splitting Phase A
across the rename buys nothing; ship it whole, afterwards.

`save.slug` has no foreign key and cannot have one — the registry is not in the database.
Unresolvable slugs degrade silently, matching the idiom already in the repo at `app/page.tsx:26-31`,
where `FEATURED` is filtered against `registryNames` so a rename "degrades quietly instead of
leaving a dead slug in the featured rail". Saves do the same: the client filters its saves against
the slugs already in the catalog payload. A row resolving to nothing is invisible, not an error.

Future renames should ship a one-off `UPDATE save SET slug = ...` driven off the rename map. Add that
line to the rename runbook rather than building machinery for it.

---

## 4. Test plan

Written before the implementation plan, on purpose. Every criterion is a number or a literal string.
Group C baselines come from `docs/perf-audit-2026-07.md`, measured against production.

### Group A — auth and saves

| # | Test | Pass criterion |
|---|---|---|
| A1 | `GET /api/saves` with no cookie | `401`, no user data in body, < 100ms |
| A2 | `POST /api/saves` with no cookie | `401`; `SELECT count(*) FROM save` unchanged |
| A3 | Sign in via GitHub, then read the session endpoint | `200`, resolves to exactly one `user` row, p95 over 20 sequential calls **< 200ms** warm |
| A4 | Same via Google | identical criteria |
| A5 | Email OTP: request → deliver → submit | delivered in **< 30s**, valid exactly **10 minutes**, single-use (second submit → `400`), max **5** requests per address per hour |
| A6 | Save, then reload `/preview/<slug>/play` | control shows saved state within **500ms** of hydration, from exactly **1** `GET /api/saves` per page load |
| A7 | Save a slug not in the registry | `400`, no row written |
| A8 | Save 3 slugs, then delete account | rows in `user`, `session`, `account`, `profile`, `save`, `collection`, `collection_item` for that id all → **0**, verified by direct SQL, within **60s** |
| A9 | Session cookie inspection | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, **no `Domain` attribute**, `Max-Age` ≤ **30 days** |
| A10 | Cookie scope regression | `Set-Cookie` must not contain `helpmarq.com`. See §6.2 — this is a specific, likely copy-paste mistake |
| A11 | Sign out | cookie cleared **and** the `session` row deleted; replaying the captured cookie → `401` |
| A12 | 100 `POST /api/saves` in 10s from one session | ≥ the 31st returns `429`; rows written ≤ **30** |
| A13 | Cross-origin `POST /api/saves` from `https://evil.example` with credentials | blocked or `403`; no row written; no `Access-Control-Allow-Origin` for that origin |
| A14 | Handle uniqueness under concurrency | two simultaneous claims → exactly one `201`, one `409`, enforced by the DB unique constraint, not application code |
| A15 | `bio` containing `<script>`, `url` set to `javascript:...` | bio renders as literal text on `/u/<handle>`; url rejected at write unless scheme is http/https |

### Group B — the static invariant (the one that must not regress)

| # | Test | Pass criterion |
|---|---|---|
| B1 | `next build` route table | rows for `/`, `/preview/[name]`, `/preview/[name]/embed`, `/preview/[name]/play`, `/writing/[slug]` **byte-identical** to the pre-change baseline captured in step 3 |
| B2 | `grep -rn "cookies()\|headers()\|draftMode()" app/layout.tsx app/_components/site-shell.tsx` | **0 matches.** Currently 0 — this is a regression guard |
| B3 | Anonymous `curl -I /preview/<slug>/embed`, warm | `200`, `x-nextjs-cache: HIT`, `cache-control` contains `s-maxage=3600`, **no `set-cookie`** |
| B4 | Same for `/preview/<slug>/play` | identical criteria |
| B5 | Anonymous `curl -I /r/<slug>.json` and `/registry.json` | `200`, cache HIT, **no `set-cookie`**, no `vary: cookie` |
| B6 | `npx shadcn add <origin>/r/<slug>.json` in a clean project, no session | succeeds, writes the same bytes as before the change |
| B7 | Middleware matcher, if middleware exists at all | must not match `/`, `/preview/**`, `/r/**`, `/llms*.txt`, `/writing/**`. Assert by reading the matcher **and** by B3-B5 |
| B8 | HTML of `/` for anonymous vs. signed-in request | **identical bytes.** Auth UI appears only after hydration |

Note on what "static" means here, since it changes the reasoning: `generateStaticParams()` returns
`[]` on both `/preview/[name]/embed` and `/preview/[name]/play`. Declaring the function at all is
what moves them out of the always-dynamic bucket; they are ISR, not build-time prerender. That
**strengthens** the constraint — an ISR page is one cached artifact shared by every visitor, so
user-specific content can never be server-rendered into it under any circumstances.

### Group C — performance, against the audit's own baselines

| # | Test | Pass criterion |
|---|---|---|
| C1 | `/` TTFB, warm CDN hit, 3 runs | ≤ **200ms** (baseline 174-182ms) |
| C2 | `/` steady-state TBT, 15-25s window, 4x CPU throttle, quiet machine | **0ms, 3 of 3 runs** (current shipped value) |
| C3 | `/` LCP, 4x throttle | ≤ **600ms** (baseline 516ms) |
| C4 | Requests on one `/` load | ≤ **56** (baseline 53; the saves fetch is the one addition) |
| C5 | `/api/saves` p95, signed in, warm | < **200ms** |
| C6 | Initial JS added to `/` by auth | ≤ **15KB** brotli over the current ~225KB. Assert by bundle analysis. This is a target, not a measurement — see §9 |

### Group D — Phase C, submission portal

| # | Test | Pass criterion |
|---|---|---|
| D1 | Static analysis of the app | **0** `import`, `eval`, `new Function`, `dangerouslySetInnerHTML` or dynamic `import()` whose argument derives from submitted content |
| D2 | Submit a payload with a webpack magic comment, a `../` path, or a null byte in a filename | rejected before any GitHub call; the written path is always `registry/<collection>/<validated-slug>/<fixed-filename>` |
| D3 | End-to-end submit | a PR appears, authored by the submitting user's own GitHub identity, CI runs |
| D4 | Payload limits | rejected above **256KB** total; max **1** submission per user per 10 minutes |

---

## 5. Implementation plan

**Phase A**

1. Wait for the rename commit on `main`. Nothing below starts before it (§3).
2. Provision Postgres (§7). `DATABASE_URL` set in **both** Production and Preview on Vercel in the
   same change — a missing one is a total outage, and Preview builds run the same code.
3. Capture the pre-change `next build` route table as the B1 baseline artifact. Do this before
   touching anything.
4. Better Auth: install, run its schema CLI, commit the generated migration. Configure GitHub +
   Google + email OTP. Cookie flags per A9/A10.
5. Wire OTP delivery through Resend (§7).
6. `/api/auth/[...all]`. Run A3, A4, A5, A9, A10, A11.
7. `profile` + `save` migrations. `/api/saves` with origin allowlist and rate limiting. Run A1, A2,
   A6, A7, A12, A13.
8. Client auth UI in `SiteShell`, hydration-only. **Run all of groups B and C here.** This is the
   step that can break the site, and the step where the temptation to call `cookies()` in the layout
   appears.
9. `/account`, `/u/<handle>`, delete-account. Run A8, A14, A15.
10. Rewrite `SECURITY.md`. Add the privacy note.

**Phase B**

11. `/guidelines`, static. Cross-link with `CONTRIBUTING.md`.
12. `DCO` file, PR template checkbox and `Signed-off-by` line.
13. `scripts/build-contributors.ts` → `lib/contributors.generated.json`, added to the
    `registry:build` chain, listed in `CONTRIBUTING.md`'s generated-files table, gitignored like its
    siblings. Render credit on the playground and `/contributors`.
14. Re-run group B. A new build step must not change the route table.

**Phase C**

15. Incremental GitHub scope at submit time, not at sign-in.
16. `/submit`: validate → fork → branch → commit → PR, entirely through the GitHub API under the
    user's token. Run D1-D4.

---

## 6. Security

### 6.1 The origin question — the reason uploads are PRs

**Verified, and the constraint is one layer deeper than the iframe.**

Three same-origin iframes render component code, none with a `sandbox` attribute:

- `app/_components/preview-card.tsx:210-242` — `/preview/<name>/embed`, and it **reads the child
  document**: `el.contentDocument?.querySelector(frame.focus)` at line 95, and
  `contentDocument?.readyState` at line 138. The comments at lines 79-80 and 131-133 state the
  same-origin dependency outright.
- `app/_components/featured-card.tsx:232` — same route, un-sandboxed, but it does **not** read
  `contentDocument` (only `onLoad`). Correcting the brief: the exposure here is the shared origin,
  not a document read.
- `app/preview/[name]/play/page.tsx:134` — `/preview/<name>?embed=1&interactive=1`, un-sandboxed and
  **not** `inert`. This is the only frame that receives real user input, and it is the one nobody
  names when this comes up.

The deeper fact is that the iframe is not the boundary at all. `app/preview/[name]/page.tsx:3`
imports `demos` from `@/registry/index`, which `scripts/build-index.ts` generates from folder names.
**Component code is compiled into the site's own bundle.** Untrusted component code would therefore
execute:

- during `next build`, in the build environment, with whatever secrets it holds;
- during SSR/ISR render of `/preview/<name>`, in the server runtime;
- in the browser on the origin, iframe or not.

A `sandbox` attribute addresses the third case and neither of the first two. This is why
"submissions are PRs" is correct on its own merits, independent of auth: every component here is code
a human read before it was compiled in.

**What would have to change if user-uploaded components were ever previewed:**

1. **A separate origin with its own build and deployment.** Not a path, not a cookie-sharing
   subdomain — a distinct origin (e.g. `ns-ui-preview.dev`) with its own Vercel project, its own
   build, no `DATABASE_URL`, no auth secrets, no mail keys, and no session cookie ever scoped to it.
   Untrusted code is compiled and served only there.
2. **`sandbox="allow-scripts"` on every frame, without `allow-same-origin`.** Those two together are
   equivalent to no sandbox at all; that is the easy mistake. Without `allow-same-origin`, the frame
   gets an opaque origin.
3. **Card framing has to be rebuilt.** `contentDocument` returns `null` across an opaque origin, so
   both `refit()` and the `readyState` poll stop working. `lib/card-frame.generated.json` currently
   carries **75** `focus` entries — 75 components lose their framing and revert to the unframed
   full-viewport card. Replacing it means a `postMessage` handshake: the child measures its own
   subject and posts the rect; the parent applies it. That handshake must also replace the
   `readyState` poll, which exists precisely because `onLoad` is a race
   (`preview-card.tsx:128-133`) — a card that never receives the message must fall back to a
   timeout, or it sits at opacity 0 showing a blank stage.
4. **A strict CSP on the preview origin**, which now runs arbitrary code.
5. **Cost, honestly:** a second Vercel project, a second build pipeline, the `postMessage` protocol
   and its fallbacks, and the loss of the "the card and the direct link are the same document"
   invariant that `preview-card.tsx` exists to protect. Roughly a week of work and a permanent second
   thing to maintain. Not worth it to avoid a pull request.

**Until then the invariant is simple and testable:** every `.tsx` under `registry/` was reviewed by a
human and merged through a PR. Auth does not change that; it raises the cost of violating it, because
there are now session cookies on the origin to steal.

### 6.2 Cookies, CSRF, and why they are one problem here

- Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, **host-only (no `Domain`)**,
  lifetime ≤ 30 days with rotation. Sessions are DB-backed rows, so sign-out is a real revocation
  rather than a cleared cookie.
- **Do not copy the existing helpmarq Better Auth config as a template.**
  `helpmarq-backend/config/auth.js:24-36` sets `sameSite: "none"` and `domain: ".helpmarq.com"` in
  production, correctly, because that is a split frontend/backend across two hosts. ns-ui is a single
  Next app, and its origin `design.helpmarq.com` is a subdomain of that same parent — so a
  `.helpmarq.com`-scoped cookie would be sent to every sibling subdomain, including the marketplace
  app. That is a cross-application session leak created by a copy-paste. Test A10 exists for exactly
  this.
- `SameSite=Lax` handles classic cross-site CSRF for `POST`/`DELETE`. On top of it, `/api/saves`
  validates `Origin` against an allowlist of exactly this site's origin and rejects anything else,
  including a missing `Origin` on a state-changing method. Better Auth's `trustedOrigins` covers its
  own routes the same way (as it already does in the helpmarq config).
- **`HttpOnly` is necessary and insufficient, and this is where the origin question and CSRF turn out
  to be the same problem.** `HttpOnly` blocks `document.cookie`. It does not stop a same-origin frame
  from calling `fetch('/api/saves', {method:'DELETE'})` — the cookie rides along automatically,
  `SameSite` sees a same-site request, and any CSRF token the page holds is readable by that frame
  through `window.top`. A same-origin frame defeats all of these controls at once. That is why
  §6.1's answer is "a different origin", not "a stricter cookie".
- No auth cookie is ever set on a response from a cached route. Middleware, if any exists, must not
  match `/`, `/preview/**` or `/r/**` (test B7). A `Set-Cookie` on a CDN-cached response leaks a
  session to every subsequent visitor.

### 6.3 Rate limiting

- `POST`/`DELETE /api/saves`: 30/min per session, 300/hr per user.
- OTP: 5 requests per address per hour, 5 per IP per hour, 5 verification attempts per code.
- Sign-in: 10 per IP per minute.

In-memory counters do not survive serverless. Use one shared store across instances — Better Auth's
DB-backed limiter is preferred here (one fewer vendor, and saves traffic is low); Upstash Redis is the
fallback if it proves inadequate. Exceeding a limit returns `429` with `Retry-After`.

### 6.4 What an attacker gets if a session leaks

They can read a public profile, read and modify that user's saves and collections, edit display
name/bio/URL, and delete the account. They cannot reach component source (it is public anyway),
cannot publish anything (submissions are PRs, and Phase C needs a separately granted GitHub scope),
and cannot reach any other user. The blast radius is deliberately one person's bookmark list.
Mitigation: a "sign out everywhere" control on `/account` that deletes that user's `session` rows.

### 6.5 What is stored about people, and how it is deleted

Stored: email address; provider account id and provider name; OAuth tokens where the provider
requires them; display name and avatar URL as supplied by the provider; chosen handle; optional bio
and URL; saved slugs and collections with timestamps; session records with creation time. Vercel
Analytics is already in place and is unchanged.

Not stored: IP logs beyond Vercel's own platform logs; payment data (there is none); anything from
the components.

Deletion: `/account` → delete account → confirm. One transaction cascades `session`, `account`,
`profile`, `save`, `collection`, `collection_item` off `user`, then deletes the `user` row. Test A8
asserts zero rows within 60 seconds. Provider tokens are revoked where the provider supports it;
deleted locally where it does not, and the privacy note says which.

**Contributor credit is not deleted, and the guidelines page must say so.** Credit is derived at
build time from merged git history — a public record of an MIT-licensed contribution, not data the
site stores about a person. It survives account deletion. Promising otherwise would be a promise the
project cannot keep. A deleted account's credit reverts from a `/u/<handle>` link to a plain GitHub
login.

---

## 7. Backend: Convex vs Neon vs Supabase

The owner asked directly: why not Convex? Answering that is the point of this section. The repo
itself uses **no database and no auth vendor** today — `.env.example` lists exactly three variables
(`NEXT_PUBLIC_REGISTRY_ORIGIN`, `EMAILOCTOPUS_API_KEY`, `EMAILOCTOPUS_LIST_ID`) — so this is a
greenfield choice.

### What was found on this machine, rather than assumed

Context7 was unavailable, so instead of memory the owner's own installed code was checked:

- **Better Auth 1.6.23 is already running in the owner's production stack**, at
  `Marketplace/helpmarq-backend/config/auth.js`: GitHub + Google social providers, DB-backed sessions
  with cookie cache, `trustedOrigins`, account linking, session hooks. This is not a new library for
  this owner.
- **Resend is already a vendor in that stack** for transactional email, OTP included. It is not a new
  vendor, and it is the obvious OTP sender here.
- **Seven Convex projects exist on this machine** (`networth`, `marketmyapp`, `creator-roast`,
  `statement-converter`, `reserved-app`, `helm/control-plane`, `pulse/relay`), with a CLI token
  configured. Familiarity is real.
- **But that familiarity is with `@convex-dev/auth@0.0.94`** — Convex's own Auth.js-derived library,
  pre-1.0, and a *different* library from Better Auth. `@convex-dev/better-auth` is installed in
  **zero** projects on this machine. There is no local evidence about that adapter's maturity, and no
  context7 access this session to check it.

### The discriminator: where the session cookie is validated

Not realtime, not cost, not familiarity. It is §6.2, applied to each candidate.

`/api/saves` has to read an `HttpOnly` cookie and enforce an `Origin` allowlist **on this site's own
origin**, because §6.1 established that a same-origin frame defeats every cookie-level control. Better
Auth on Postgres puts that check in a Next route handler on `design.helpmarq.com` — structurally the
same as the config already working in helpmarq.

Convex's native model is a JWT the client holds and sends to `*.convex.cloud`. A token readable by
JavaScript is readable by the un-sandboxed same-origin frames at `preview-card.tsx:210`,
`featured-card.tsx:232` and `play/page.tsx:134`. That is strictly worse than the cookie case: it is
bearer-credential exfiltration, not merely an authenticated fetch the attacker can trigger. To get
equivalent safety you keep the `HttpOnly` cookie on the Next origin anyway and proxy through to
Convex — at which point Convex is a database sitting behind your own API route, and you are paying for
reactivity you have routed around.

That reasoning comes from this repo's own architecture, not from vendor documentation, so no answer
about adapter maturity changes it.

### Does reactivity buy anything here? No, plainly

The workload is one row per save, written by one person, read once after hydration, on a site whose
entire design is that nothing re-renders after paint. There is no second writer to a user's saves and
no shared document. A reactive subscription would mean an open WebSocket per visitor on a CDN-cached
catalog page, pushing updates for data only that visitor can change — new steady-state work on a
homepage whose measured steady-state main-thread cost is currently **0ms**, and which took a full
performance audit to get there. Convex's headline strength is a cost here, not a benefit.

### The honest case for Convex, stated fairly

One backend for database, functions, scheduling and file storage is worth real money in reduced
operational surface, and the owner already knows the tool. If this product were going to grow a
live-collaborative surface, that argument would probably win. It does not win against a users table, a
saves table, and a fetch after hydration. And the familiarity argument, followed honestly, points at
using `@convex-dev/auth` instead of Better Auth — which relitigates a decision the brief closed.

### Supabase

Postgres plus auth from one vendor, which would matter if auth were undecided. It is decided. Better
Auth's Postgres adapter works against Supabase's Postgres identically to Neon's, so choosing Supabase
buys an auth product this spec will not use, plus RLS and a client SDK it does not need, in exchange
for a second dashboard outside the deployment. If the project later wants file uploads (avatars beyond
provider URLs, submission screenshots), Supabase Storage becomes a genuine reason to revisit.

### Cost at 0 / 100 / 10,000 users

The data is genuinely small: 10,000 users × 20 saves ≈ 200,000 narrow rows, single-digit MB. Cost is
driven by compute time and connections, not storage — which argues for scale-to-zero and for keeping
`/api/saves` to one query per page load.

| | 0 users | 100 users | 10,000 users |
|---|---|---|---|
| **Neon (Vercel Marketplace)** | $0 | $0 | ~$19-25/mo |
| **Convex** | $0 | $0 | ~$25/mo, plus per-function-call and bandwidth beyond the included tier |
| **Supabase** | $0 | $0 | ~$25/mo |
| Resend (OTP) | $0 | $0 | ~$20/mo — **already in the owner's stack** |
| Rate-limit store | $0 (DB-backed) | $0 | $0-10 |
| **Total** | **$0** | **$0** | **~$40-55/mo** |

All three are effectively free at this scale, and within noise of each other at 10,000. **Cost does
not decide this.** Pricing is from memory and unverified this session — confirm before committing.
Note Convex's free tier is metered on function calls and bandwidth rather than storage, so a chatty
client is the thing that would move its bill; Neon's is metered on compute hours, so an idle database
is nearly free.

Also new and not free in effort, for any option: an OAuth app registration on GitHub and on Google,
and (already done for helpmarq, possibly reusable) a verified Resend sending domain. Both need DNS
access.

### Recommendation: Neon Postgres via the Vercel Marketplace

Because the security model requires an `HttpOnly` cookie validated on this origin, that path is Better
Auth's best-trodden adapter, the owner already runs Better Auth in production, provisioning happens in
the same dashboard as the deployment, and the workload has no property that reactivity improves.

**What would have to be true to flip to Convex:**

1. Realtime becomes load-bearing — public collections that several people edit, or live
   submission-review status. That is a genuine Convex win and this recommendation should be revisited
   the day it is on the roadmap.
2. `@convex-dev/better-auth` reaches ≥1.0 **and** supports the `HttpOnly`-cookie-on-your-own-origin
   pattern rather than only client-held JWTs. Verify this claim before acting on it; it is the one
   thing here that could not be checked.
3. Convex absorbs something else the project needs anyway — file uploads, scheduled jobs, or the MCP
   backend. One vendor for four jobs beats two vendors for two.

None of these hold today.

---

## 8. Open questions for the owner

1. **Handles.** Auto-derive from the GitHub login with one free change, or force a choice at signup?
   Auto-derive is friendlier but has nothing to derive from for Google/OTP users.
2. **Are profiles public by default?** Default-public makes `/u/<handle>` worth building;
   default-private makes it nearly empty. Recommendation: profiles public, saves private by default
   with a per-collection "make public" toggle. Not decidable from the code.
3. **Collections in Phase A, or deferred?** The schema costs little; the UI is real work. Saves alone
   is a smaller, cleaner Phase A.
4. **Does the existing email-capture form merge with auth?** OTP signup produces an email address and
   EmailOctopus already has a list. Subscribing signups to it needs an explicit checkbox, not an
   assumption.
5. **Sign-in for the CLI or MCP server?** Both exist (`cli/`, `mcp/`) and this spec assumes both stay
   anonymous forever. Syncing saves to the CLI is a token flow and its own spec.
6. **Contributor credit for the 223 existing components** — all one author today. Does
   `/contributors` ship in Phase B as a single-entry page, or wait for a second contributor?
7. **Rename timing.** Phase A is blocked on it. If the rename is far out, the alternative is
   introducing a stable component id first — a registry-format change and its own spec.

---

## 9. Where this document is guessing

- **`@convex-dev/better-auth`'s existence, version and cookie model are unverified.** No context7/MCP
  access this session, and the package is installed nowhere on this machine. §7's Convex
  recommendation does not rest on it — the discriminator is this repo's same-origin frames — but flip
  condition 2 does, and must be checked before anyone acts on it.
- **Better Auth's core behaviour is verified**, not from memory: `better-auth@1.6.23` is running in
  the owner's production stack with the social providers, DB-backed sessions and `trustedOrigins`
  this spec relies on. The narrow unknowns are the email-OTP plugin's exact configuration and the
  current schema-CLI invocation; check both at step 4.
- **All pricing in §7 is unverified.**
- **The ≤15KB auth bundle budget (C6)** is a target, not a measurement. Measure at step 8 and correct
  this document if it is wrong, rather than quietly failing the test.
- **The "week of work" estimate in §6.1** is a judgement call, not a plan.
