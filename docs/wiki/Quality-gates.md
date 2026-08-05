# Quality gates

Five gate scripts. Each covers a class of defect the others structurally
cannot see. All five run offline — no browser, no dev server — which is what
lets them run in CI where `npm run verify` cannot.

```bash
npm run test:source-invariants
npm run test:category-coverage
npm run test:status-checks
npm run test:convex-deployed
node convex/status.test.ts
```

`test:status-checks` reads `lib/status.generated.json`, so run
`node scripts/build-status.ts` (or any `registry:build`) first. The other four
have no build prerequisite beyond the `pre*` hooks already in `package.json`.

## 1. `scripts/test-source-invariants.ts`

A static gate over hand-authored source only: `app/**`, `lib/**`,
`registry/**`. It exists because `scripts/verify.ts` drives a browser over
`/preview/<component>` — so verify covers registry components at runtime and
**nothing under `app/**`**, and can only catch what shows up in a screenshot
diff.

Every check in it is a defect class that shipped green through the browser
gate at least once. The classes named in the CI workflow: dead CSS tokens
after the `--ns-*` rename, the `outline-none` / `focus-visible` trap,
mouse-only click handlers, colour-only state, unguarded animations, missing
landmarks. `app/globals.css` is read first as the token contract every other
check is measured against.

It is deliberately grep-shaped rather than AST-shaped — no parser dependency,
no test framework — and the file states its own blind spots rather than
implying coverage it does not have. Those explicitly-not-covered classes are
listed in the script's header comment; a green run is not a claim that they
are gated.

## 2. `scripts/test-category-coverage.ts`

Two reachability invariants over `registry.json`:

- Every published component appears in at least one clickable category page
  (`categoryPages()` only satisfies this because of the `other` catch-all).
- Every category id `categoryPages()` returns has a `CATEGORY_COPY` entry.
  This is the one that matters: `app/categories/[id]/page.tsx` 404s any id
  without copy, so a category could be "reachable" by member count while its
  route was dead in production — which is exactly what happened to `other`
  before this assertion existed.

It also pins the `other` page's id and label verbatim, so the tree, the chips
and `/categories/<id>` cannot disagree about the same bucket.

It resolves the `@/` path alias with a ten-line `registerHooks` shim rather
than pulling in a bundler or test runner.

## 3. `scripts/test-status-checks.ts`

Proves the `/status` check layer against the real emitted measurements. It
reads `lib/status.generated.json` and exercises the pure builders in
`lib/status-checks.ts`: that the measurements are internally consistent (no
`*Ok` count exceeding its total, `redirectEntries == redirectPairs * 4`, a
parseable `builtAt`), and that rows are ordered severity-descending so no row
is followed by a more severe one.

Offline and deterministic by default. `--live` additionally **prints** the
four network reads; they are never asserted, because a test that fails when
npm or unpkg is down teaches nothing.

## 4. `scripts/test-convex-deployed.ts`

Guards the failure that hit this project three times: a Convex function exists
in the repo but was never deployed, so the deployment silently lacks it. The
symptom always read as something else — `fetchQuery` throws, the caller's
catch maps it to a 401, or the route just says "Server Error".

It greps every `api.<module>.<fn>` reference the app actually calls (never a
hardcoded list, which would rot the moment a route adds a call), classifies
each against the `convex/<module>.ts` that defines it, and issues a real HTTP
POST to the deployment's `/api/query` for every public query. **Mutations are
enumerated and reported but never called** — calling one to test it would
write data.

The load-bearing detail, spelled out in the script because getting it wrong
produced a check that always passed: a production Convex deployment redacts
every masked error identically. A missing function, a malformed path, a
mutation called via `/api/query`, and a query that throws a plain Error all
return byte-identical `Server Error` bodies. So the script trusts only:

- `status: "success"` — the function ran. Exists.
- `status: "error"` **with** `errorData` — a `ConvexError` the function's own
  code threw deliberately. The handler had to run to throw it. Exists.
- `status: "error"` with no `errorData` — indistinguishable from missing.
  Reported as a **fail** naming the Request ID, because laundering that
  ambiguity into a pass is what let three outages read as something else.

Functions whose argument shape it cannot confidently infer are reported
UNVERIFIABLE by name rather than skipped or wrongly asserted.

It reads `.env.local` so it does not silently skip when run locally.

## 5. `convex/status.test.ts`

Runs offline against an in-memory store, not a deployment. The logic under
test (`convex/status.logic.ts`) is deliberately free of Convex imports so that
`convex/status.ts` and this file exercise the same code path.

It proves the properties the daily status strip depends on: one bar per
`(day, service)`, a bar that aggregates *every* sample of its day rather than
the last one written, and a day nobody sampled staying **absent** rather than
being filled in.

The two-dot filename is load bearing: the Convex bundler skips any basename
with more than one dot, so this file is never registered as a deployed module.

## Also present, but not part of the five

- `npm run verify` (`scripts/verify.ts`) — the Playwright screenshot gate.
  Needs a running dev server and downloaded browsers, so it is a local gate,
  not a CI one. What it hard-fails on is documented in `README.md`.
- `npm run test:name-policy` (`scripts/test-name-policy.ts`) and
  `scripts/test-testimonial-moderation.ts` — narrower unit checks over
  `lib/name-policy.ts` and the moderation path.

## In CI

`.github/workflows/ci.yml` runs on push to `main` and on every pull request:
`npm ci`, `npm run registry:build`, `npm run typecheck`,
`npm run test:source-invariants`, `npm run build`. It sets
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` because CI never runs the browser gate.
A second job enforces a `Signed-off-by` trailer on every non-merge commit in a
PR (see the DCO section of `CONTRIBUTING.md`).

Note that CI currently runs only one of the five gates. The other four are
run locally.
