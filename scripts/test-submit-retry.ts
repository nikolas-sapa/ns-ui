// Guards the /submit retry trap: a submission whose serverless function is
// killed part-way through must be RETRYABLE, not permanently poisoned.
//
// The trap, as it shipped: the branch name is `submit/<slug>`, deterministic
// per slug, and three separate steps answered "this already exists" with a
// throw. A function killed anywhere after the branch was created — the
// fork-ready poll alone can burn seconds getting there, and the route set no
// `maxDuration` — left state on the contributor's own fork that made EVERY
// later retry of that slug fail, forever, with no way out but deleting the
// branch by hand on GitHub. Measured against this file before the fix:
// attempts 2 and 3 both died on `Could not create branch submit/… (422)`.
//
// Why a fake at the `fetch` boundary rather than a local HTTP server:
// `GITHUB_API` in lib/github-submit.ts is a hardcoded constant and must stay
// one. Making the GitHub API host env-overridable to make it testable would
// turn a misconfigured env var into a token-exfiltration hole, which is a
// worse bug than the one under test. `githubFetch` is the single choke point
// and it resolves the global `fetch` per call, so replacing that global
// drives the real shipped sequence with nothing in production changed.
//
// The token here is a literal placeholder. The fake asserts every call
// carries SOME bearer token and never reads, prints or compares its value.
import assert from "node:assert/strict";
import {
  createSubmitBudget,
  GitHubApiError,
  submitComponentToGithub,
  UPSTREAM_OWNER,
  UPSTREAM_REPO,
  type SubmitFile,
} from "../lib/github-submit.ts";

const LOGIN = "contributor";
const UPSTREAM = `${UPSTREAM_OWNER}/${UPSTREAM_REPO}`;
const TOKEN = "placeholder-not-a-credential";
const SLUG = "retry-trap-demo";
const BRANCH = `submit/${SLUG}`;

/** Stands in for the platform killing the function mid-flow. */
class FunctionKilled extends Error {}

type Pull = { head: string; state: "open" | "closed"; html_url: string };

type Fake = {
  calls: string[];
  forks: Set<string>;
  refs: Map<string, string>;
  files: Map<string, { base64: string; sha: string }>;
  pulls: Pull[];
  /** Every call past this one throws, as if the function were killed. */
  killAfterCall: number;
  /** `GET /repos/{o}/{r}` 404s this many times first, as a real fresh fork
   *  does while GitHub creates it asynchronously. */
  forkNotReadyFor: number;
  blobs: number;
};

function newFake(): Fake {
  return {
    calls: [],
    forks: new Set(),
    refs: new Map(),
    files: new Map(),
    pulls: [],
    killAfterCall: Infinity,
    forkNotReadyFor: 0,
    blobs: 0,
  };
}

let fake = newFake();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Mimics the GitHub REST responses this flow depends on, including the three
 *  "already exists" rejections that are the whole point of the test. Statuses
 *  and message shapes are GitHub's own. */
function installFakeGithub(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const path = url.pathname;
    fake.calls.push(`${method} ${path}`);
    if (fake.calls.length > fake.killAfterCall) {
      throw new FunctionKilled(`function killed at call ${fake.calls.length} (${method} ${path})`);
    }

    assert.equal(url.origin, "https://api.github.com", "calls must go to the GitHub API host");
    // Presence only. The value is never inspected, logged or compared.
    assert.match(
      String((init.headers as Record<string, string> | undefined)?.Authorization ?? ""),
      /^Bearer \S+$/,
      `${method} ${path} sent no bearer token`,
    );
    // The timeout fix: no GitHub call may be unbounded.
    assert.ok(init.signal instanceof AbortSignal, `${method} ${path} has no AbortSignal`);

    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};

    if (path === "/user") return json(200, { login: LOGIN });

    let m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/forks$/);
    if (m && method === "POST") {
      const repo = m[2];
      fake.forks.add(`${LOGIN}/${repo}`);
      fake.refs.set(`${LOGIN}/${repo}:main`, "base000");
      return json(202, { owner: { login: LOGIN }, name: repo, default_branch: "main" });
    }

    m = path.match(/^\/repos\/([^/]+)\/([^/]+)$/);
    if (m && method === "GET") {
      if (fake.forkNotReadyFor > 0) {
        fake.forkNotReadyFor -= 1;
        return json(404, { message: "Not Found" });
      }
      return fake.forks.has(`${m[1]}/${m[2]}`) ? json(200, {}) : json(404, { message: "Not Found" });
    }

    m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/ref\/heads\/(.+)$/);
    if (m && method === "GET") {
      const sha = fake.refs.get(`${m[1]}/${m[2]}:${m[3]}`);
      return sha ? json(200, { object: { sha } }) : json(404, { message: "Not Found" });
    }

    m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/refs$/);
    if (m && method === "POST") {
      const branch = String(body.ref).replace(/^refs\/heads\//, "");
      const key = `${m[1]}/${m[2]}:${branch}`;
      if (fake.refs.has(key)) return json(422, { message: "Reference already exists" });
      fake.refs.set(key, String(body.sha));
      return json(201, { ref: body.ref, object: { sha: body.sha } });
    }

    m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/);
    if (m && method === "PUT") {
      const key = `${m[1]}/${m[2]}:${body.branch}:${m[3]}`;
      const existing = fake.files.get(key);
      if (existing && !body.sha) {
        return json(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' });
      }
      if (existing && body.sha !== existing.sha) {
        return json(409, { message: `${m[3]} does not match ${body.sha}` });
      }
      fake.blobs += 1;
      fake.files.set(key, { base64: String(body.content), sha: `blob${fake.blobs}` });
      fake.refs.set(`${m[1]}/${m[2]}:${body.branch}`, `commit${fake.blobs}`);
      return json(existing ? 200 : 201, { content: { sha: `blob${fake.blobs}` } });
    }
    if (m && method === "GET") {
      const f = fake.files.get(`${m[1]}/${m[2]}:${url.searchParams.get("ref")}:${m[3]}`);
      // GitHub line-wraps the base64 it returns; wrap it here too, so the
      // content comparison in `putFile` is tested against the real shape.
      return f
        ? json(200, {
            sha: f.sha,
            encoding: "base64",
            content: (f.base64.match(/.{1,60}/g) ?? []).join("\n"),
          })
        : json(404, { message: "Not Found" });
    }

    m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/pulls$/);
    if (m && method === "POST") {
      assert.equal(`${m[1]}/${m[2]}`, UPSTREAM, "the PR must target the upstream repo");
      if (fake.pulls.some((p) => p.head === body.head && p.state === "open")) {
        return json(422, {
          message: "Validation Failed",
          errors: [{ message: `A pull request already exists for ${body.head}.` }],
        });
      }
      const pr: Pull = {
        head: String(body.head),
        state: "open",
        html_url: `https://github.com/${UPSTREAM}/pull/${fake.pulls.length + 1}`,
      };
      fake.pulls.push(pr);
      return json(201, pr);
    }
    if (m && method === "GET") {
      const head = url.searchParams.get("head");
      const state = url.searchParams.get("state") ?? "open";
      return json(
        200,
        fake.pulls.filter(
          (p) => (head === null || p.head === head) && (state === "all" || p.state === state),
        ),
      );
    }

    return json(501, { message: `fake GitHub has no route for ${method} ${path}` });
  }) as typeof fetch;
}

// The payload shape `app/api/submit/route.ts` builds. Content is arbitrary
// here — this test is about the call sequence, not about validation, which
// `lib/submission-validation.ts` owns and which runs before any of this.
function submission(componentSource = "export default function C() { return null; }") {
  const files: SubmitFile[] = [
    { path: `registry/core/${SLUG}/component.tsx`, content: componentSource },
    { path: `registry/core/${SLUG}/demo.tsx`, content: "export default function D() { return null; }" },
    { path: `registry/core/${SLUG}/meta.json`, content: '{\n  "name": "retry-trap-demo"\n}' },
  ];
  return {
    branch: BRANCH,
    commitMessage: `feat(core): add ${SLUG}\n\nSigned-off-by: A Contributor <a@contributor.test>`,
    files,
    prTitle: `Add Retry Trap Demo`,
    prBody: "New component.",
  };
}

const attempt = (componentSource?: string) =>
  submitComponentToGithub(TOKEN, submission(componentSource), createSubmitBudget(30_000));

function openPulls() {
  return fake.pulls.filter((p) => p.state === "open");
}

function submitBranches() {
  return [...fake.refs.keys()].filter((k) => k.includes(":submit/"));
}

installFakeGithub();

const CHECK_TIMEOUT_MS = 15_000;

const failures: string[] = [];
async function check(name: string, fn: () => Promise<void>) {
  // A hard ceiling per check. Without it, a regression that removes the
  // AbortSignal from `githubFetch` makes the wedged-fetch check below hang
  // forever instead of failing — a test that cannot fail is worse than no
  // test, so a hang is reported as a failure.
  //
  // The timer is deliberately NOT `unref()`d: an unref'd timer does not hold
  // the event loop open, so with every pending fetch wedged Node drains the
  // loop and dies on "unsettled top-level await" (exit 13) BEFORE this
  // ceiling can fire. That is still non-zero, so the gate caught it either
  // way — but it skips the per-check `FAIL` line and the summary, which is
  // the part a reader needs. Measured: with the signal mutated out, this
  // reported `exit=13` and no verdict for the timeout checks. Cleared in
  // `finally`, so a check that passes leaves nothing behind to delay exit.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`check timed out after ${CHECK_TIMEOUT_MS}ms (hung, not merely slow)`)),
          CHECK_TIMEOUT_MS,
        );
      }),
    ]);
    console.log(`  ok   ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}\n       ${message.split("\n")[0]}`);
    console.log(`  FAIL ${name}`);
    console.log(`       ${message.split("\n").slice(0, 4).join("\n       ")}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Runs one attempt that dies at `killAfterCall`, then one that doesn't, and
 *  asserts the retry succeeded and produced exactly one PR. */
async function killThenRetry(killAfterCall: number, label: string) {
  await check(`retry succeeds after the function is killed at call ${killAfterCall} (${label})`, async () => {
    fake = newFake();
    fake.killAfterCall = killAfterCall;
    await assert.rejects(attempt(), "the first attempt was supposed to die");
    const diedAfter = fake.calls.length;

    fake.killAfterCall = Infinity;
    const result = await attempt();

    assert.match(
      result.prUrl,
      /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/,
      `prUrl ${result.prUrl} would be rejected by convex/submissions.ts PR_URL_PATTERN`,
    );
    assert.equal(result.login, LOGIN);
    assert.equal(openPulls().length, 1, `expected exactly 1 open PR, got ${openPulls().length}`);
    assert.deepEqual(
      submitBranches(),
      [`${LOGIN}/${UPSTREAM_REPO}:${BRANCH}`],
      "the retry must reuse the one submit branch, not accumulate branches on the fork",
    );
    assert.equal(
      fake.files.size,
      3,
      `expected the 3 fixed filenames on the branch, got ${fake.files.size}`,
    );
    assert.ok(diedAfter > 0, "sanity: the killed attempt made calls");
  });
}

console.log("retry after an interrupted submission");
// Call 1 GET /user, 2 POST /forks, 3 GET /repos/:fork, 4 GET /git/ref/heads/main,
// 5 POST /git/refs, 6-8 PUT /contents x3, 9 POST /pulls.
await killThenRetry(5, "branch created, nothing else");
await killThenRetry(6, "branch + component.tsx");
await killThenRetry(7, "branch + two files");
await killThenRetry(8, "branch + all three files, no PR");

// The ninth step has no tenth call to be killed on: a function killed in the
// gap between GitHub opening the PR and Convex recording it leaves GitHub in
// exactly the state a FULLY successful attempt does. The contributor saw an
// error (or a dead tab), so they press Submit again — and before the fix that
// retry threw 422 on a submission that had actually worked.
await check("retry succeeds after the PR opened but Convex never recorded it", async () => {
  fake = newFake();
  const first = await attempt();
  assert.equal(openPulls().length, 1);

  const retry = await attempt();
  assert.equal(retry.prUrl, first.prUrl, "the retry must hand back the PR that already exists");
  assert.equal(retry.resumed, true);
  assert.equal(openPulls().length, 1, "a duplicate PR was opened upstream");
  assert.deepEqual(submitBranches(), [`${LOGIN}/${UPSTREAM_REPO}:${BRANCH}`]);
});

console.log("fork-ready poll");
await check("a fork that 404s for several probes still submits", async () => {
  fake = newFake();
  fake.forkNotReadyFor = 3;
  const result = await attempt();
  assert.equal(openPulls().length, 1);
  assert.ok(result.prUrl.length > 0);
});

console.log("resume semantics");
await check("a first-ever submission reports resumed:false", async () => {
  fake = newFake();
  const result = await attempt();
  assert.equal(result.resumed, false);
  assert.equal(result.prUrl, `https://github.com/${UPSTREAM}/pull/1`);
});

await check("a retry reports resumed:true and adopts the existing PR", async () => {
  fake = newFake();
  fake.killAfterCall = 8;
  await assert.rejects(attempt());
  fake.killAfterCall = Infinity;
  const result = await attempt();
  assert.equal(result.resumed, true, "the retry did not report resuming");
  assert.equal(result.prUrl, `https://github.com/${UPSTREAM}/pull/1`, "a second PR was opened");
  assert.equal(fake.pulls.length, 1);
});

await check("an open PR is adopted without rewriting the files under it", async () => {
  fake = newFake();
  await attempt("export default function Original() { return null; }");
  const before = new Map([...fake.files].map(([k, v]) => [k, v.base64]));
  const callsBefore = fake.calls.length;
  fake.calls = [];

  const result = await attempt("export default function Rewritten() { return null; }");

  assert.equal(result.resumed, true);
  assert.equal(result.prUrl, `https://github.com/${UPSTREAM}/pull/1`);
  assert.equal(fake.pulls.length, 1, "no second PR");
  assert.deepEqual(
    new Map([...fake.files].map(([k, v]) => [k, v.base64])),
    before,
    "resubmitting a slug with an open PR must not rewrite the files a maintainer is reviewing",
  );
  assert.ok(
    !fake.calls.some((c) => c.startsWith("PUT ")),
    `no write should have been attempted, got: ${fake.calls.filter((c) => c.startsWith("PUT ")).join(", ")}`,
  );
  assert.ok(callsBefore > 0);
});

await check("a retry after the PR was CLOSED opens a fresh one", async () => {
  fake = newFake();
  await attempt();
  fake.pulls[0].state = "closed";
  const result = await attempt();
  assert.equal(result.prUrl, `https://github.com/${UPSTREAM}/pull/2`);
  assert.equal(openPulls().length, 1);
});

// The orchestrator's pre-check asks `GET .../pulls?head=…` whether a PR is
// already open. That list is not strongly consistent, so it can answer "none"
// for a PR that does exist — and then `POST .../pulls` is the one that says
// 422 "A pull request already exists". Both layers are needed: this is the
// case only the second one catches, and without it a lagging list turns a
// successful submission back into a hard failure.
await check("a lagging PR list is still caught by the 422 on POST .../pulls", async () => {
  fake = newFake();
  await attempt();
  assert.equal(fake.pulls.length, 1);

  const realFetch = globalThis.fetch;
  let listCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/pulls") && (init.method ?? "GET") === "GET") {
      listCalls += 1;
      // Only the FIRST list (the pre-check) lags; the lookup after the 422
      // sees the truth.
      if (listCalls === 1) {
        fake.calls.push("GET /pulls (stale, returned empty)");
        return json(200, []);
      }
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
  try {
    const result = await attempt();
    assert.equal(listCalls, 2, `expected a pre-check and a post-422 lookup, saw ${listCalls} list call(s)`);
    assert.equal(result.prUrl, `https://github.com/${UPSTREAM}/pull/1`, "did not adopt the existing PR");
    assert.equal(result.resumed, true);
    assert.equal(fake.pulls.length, 1, "a duplicate PR was opened upstream");
  } finally {
    globalThis.fetch = realFetch;
  }
});

await check("a retry with changed sources updates the files, no empty commits", async () => {
  fake = newFake();
  fake.killAfterCall = 8; // all three files written, no PR
  await assert.rejects(attempt("export default function First() { return null; }"));
  fake.killAfterCall = Infinity;
  fake.calls = [];

  await attempt("export default function Second() { return null; }");

  const component = fake.files.get(
    `${LOGIN}/${UPSTREAM_REPO}:${BRANCH}:registry/core/${SLUG}/component.tsx`,
  );
  assert.ok(component, "component.tsx missing from the branch");
  assert.equal(
    Buffer.from(component.base64, "base64").toString("utf-8"),
    "export default function Second() { return null; }",
    "the retry's source did not land",
  );
  // demo.tsx and meta.json were byte-identical, so they must have been
  // recognised as unchanged rather than re-committed.
  const unchangedWrites = fake.calls.filter(
    (c) => c.startsWith("PUT ") && !c.endsWith("component.tsx"),
  );
  assert.equal(
    unchangedWrites.length,
    2,
    "identical files should be probed once each, not written twice",
  );
  assert.equal(fake.blobs, 4, `expected 3 original blobs + 1 update, got ${fake.blobs}`);
});

console.log("errors that must still be errors");
await check("a 422 that is NOT an existing branch still throws", async () => {
  fake = newFake();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    // A 422 on ref creation with no ref actually created: a genuine
    // rejection (bad sha, bad ref name), which must not be swallowed.
    if (url.pathname.endsWith("/git/refs") && (init.method ?? "GET") === "POST") {
      fake.calls.push("POST /git/refs (forced 422)");
      return json(422, { message: "Invalid request." });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
  try {
    await assert.rejects(attempt(), (error: unknown) => {
      assert.ok(error instanceof GitHubApiError, `expected GitHubApiError, got ${String(error)}`);
      assert.equal(error.status, 422);
      return true;
    });
    assert.equal(submitBranches().length, 0, "no branch should exist");
  } finally {
    globalThis.fetch = realFetch;
  }
});

await check("a 422 on the PR with no open PR to adopt still throws", async () => {
  fake = newFake();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/pulls") && (init.method ?? "GET") === "POST") {
      fake.calls.push("POST /pulls (forced 422)");
      return json(422, { message: "Validation Failed", errors: [{ message: "head sha can't be blank" }] });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
  try {
    await assert.rejects(attempt(), (error: unknown) => {
      assert.ok(error instanceof GitHubApiError, `expected GitHubApiError, got ${String(error)}`);
      assert.equal(error.status, 422);
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

await check("a non-422 failure is reported, not resumed", async () => {
  fake = newFake();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/git/refs") && (init.method ?? "GET") === "POST") {
      return json(403, { message: "Resource not accessible by integration" });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
  try {
    await assert.rejects(attempt(), (error: unknown) => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.status, 403, "a 403 must surface as a 403");
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

console.log("timeouts");
await check("a wedged GitHub call fails on its own timeout, bounded", async () => {
  fake = newFake();
  const realFetch = globalThis.fetch;
  // `AbortSignal.timeout` timers are unref'd and the wedged fetch below has
  // no socket of its own, so nothing here would hold the event loop open on
  // its own — Node would drain it and bail on "unsettled top-level await"
  // before the budget fired. `check`'s per-check ceiling timer is ref'd and
  // supplies that handle (in the real runtime the in-flight request is it),
  // which is also what turns a dropped-signal regression into a reported
  // FAIL rather than a bare exit 13.
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.pathname === "/user") {
      // Never resolves on its own — only the signal can end this.
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "TimeoutError";
          reject(err);
        });
      });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
  try {
    const started = Date.now();
    await assert.rejects(
      submitComponentToGithub(TOKEN, submission(), createSubmitBudget(300)),
      (error: unknown) => {
        assert.ok(error instanceof GitHubApiError, `expected GitHubApiError, got ${String(error)}`);
        assert.equal(error.status, 504);
        assert.doesNotMatch(error.message, /placeholder-not-a-credential/, "token leaked into the error");
        return true;
      },
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 5_000, `expected the budget to cut this off quickly, took ${elapsed}ms`);
  } finally {
    globalThis.fetch = realFetch;
  }
});

await check("the submission budget stops the fork poll sleeping past it", async () => {
  fake = newFake();
  fake.forkNotReadyFor = 6; // never becomes ready: 6 probes, 5 sleeps of 1.5s
  const started = Date.now();
  await assert.rejects(submitComponentToGithub(TOKEN, submission(), createSubmitBudget(400)));
  const elapsed = Date.now() - started;
  assert.ok(
    elapsed < 4_000,
    `the poll slept past its budget: ${elapsed}ms (unbudgeted this is ~7.5s)`,
  );
});

console.log("");
if (failures.length > 0) {
  console.error(`FAIL submit-retry: ${failures.length} check(s) failed`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("PASS submit-retry: an interrupted submission is retryable at every step");
