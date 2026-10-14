/**
 * GitHub API calls for `/submit` (docs/community-spec.md §2 Phase C):
 * "Form -> validate -> fork as the user -> commit on a branch -> open a PR,
 * all through the GitHub API under an incremental OAuth scope requested at
 * submit time."
 *
 * Everything here runs server-side in `app/api/submit/route.ts`, using the
 * short-lived, `public_repo`-scoped access token minted by the incremental
 * consent flow in `app/api/submit/github/{authorize,callback}/route.ts` —
 * never the browser, never the Convex Auth session token (that token has no
 * GitHub API scope at all; see the file header on the authorize route for
 * why a second consent is required).
 *
 * D3 ("PR appears under the submitting user's own GitHub identity") falls
 * out of using the CALLER's own OAuth token for every one of these calls
 * rather than a repo-owned service token: the fork, the commit and the PR
 * are all created as that GitHub user, by GitHub's own attribution — there
 * is nothing here to get wrong on that point, because we never hold or use
 * any token but theirs.
 */

const GITHUB_API = "https://api.github.com";

// Upstream repo this registry lives in (package.json's own "repository"
// field). Overridable via env for a fork/staging deployment of this site
// itself, without hardcoding a second constant that could drift from it.
export const UPSTREAM_OWNER = process.env.GITHUB_REPO_OWNER ?? "nikolas-sapa";
export const UPSTREAM_REPO = process.env.GITHUB_REPO_NAME ?? "ns-ui";
export const UPSTREAM_DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH ?? "main";

class GitHubApiError extends Error {
  readonly status: number;

  // Written out longhand rather than as a `public status: number` constructor
  // parameter property: that is TypeScript-only syntax Node's strip-only `.ts`
  // loader refuses outright (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX), and
  // `scripts/test-submit-retry.ts` imports this module directly under plain
  // `node`, the way every other `scripts/test-*.ts` in this repo runs.
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Per-call ceiling. 8s matches the precedent every other outbound fetch in
 *  this repo already uses (`app/api/status-snapshot/route.ts`,
 *  `lib/status-checks.ts`, both avatar routes). Without it a single wedged
 *  GitHub call hangs until the platform's own kill switch fires, which is
 *  silent: no error, no row update, nothing for the contributor to read. */
const GITHUB_CALL_TIMEOUT_MS = 8_000;

/** One wall-clock budget for a WHOLE submission, not per call. Nine-ish
 *  sequential calls at the per-call ceiling above is 72s, so the per-call
 *  timeout alone does not bound a submission — this does. Sized to land
 *  under `maxDuration` in `app/api/submit/route.ts` with room for the
 *  Convex bookkeeping that follows, so the error the contributor sees is
 *  OURS (a 502 naming the step that ran out of time) rather than the
 *  platform's silent kill. */
const SUBMIT_BUDGET_MS = 45_000;

/** Creates the budget signal for one submission. Exported so
 *  `scripts/test-submit-retry.ts` can drive the exhausted-budget path with a
 *  tiny number instead of waiting 45 real seconds. */
export function createSubmitBudget(totalMs: number = SUBMIT_BUDGET_MS): AbortSignal {
  return AbortSignal.timeout(totalMs);
}

function isAbortLike(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

async function githubFetch(
  token: string,
  path: string,
  init: RequestInit = {},
  budget?: AbortSignal,
): Promise<Response> {
  // `init.signal` wins if a caller set one; otherwise every call gets the
  // per-call ceiling, intersected with the submission-wide budget when one
  // was passed, so neither one slow call nor ten mediocre ones can run past
  // the function's lifetime.
  const signal =
    init.signal ??
    (budget
      ? AbortSignal.any([budget, AbortSignal.timeout(GITHUB_CALL_TIMEOUT_MS)])
      : AbortSignal.timeout(GITHUB_CALL_TIMEOUT_MS));

  try {
    return await fetch(`${GITHUB_API}${path}`, {
      ...init,
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (isAbortLike(error)) {
      // `path` only, never the token and never a response body — this message
      // is handed to `app/api/submit/route.ts`'s 502.
      throw new GitHubApiError(
        budget?.aborted
          ? `GitHub submission ran out of time at ${init.method ?? "GET"} ${path}`
          : `GitHub call timed out: ${init.method ?? "GET"} ${path}`,
        504,
      );
    }
    throw error;
  }
}

/** A `setTimeout` that gives up early when the submission budget is spent,
 *  so a poll loop cannot sleep past the function's own deadline. */
function sleep(ms: number, budget?: AbortSignal): Promise<void> {
  if (budget?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      budget?.removeEventListener("abort", done);
      resolve();
    }
    budget?.addEventListener("abort", done, { once: true });
  });
}

export async function fetchAuthenticatedLogin(token: string, budget?: AbortSignal): Promise<string> {
  const res = await githubFetch(token, "/user", {}, budget);
  if (!res.ok) {
    throw new GitHubApiError(`Could not read authenticated GitHub user (${res.status})`, res.status);
  }
  const data = (await res.json()) as { login: string };
  return data.login;
}

/** Idempotent: forking a repo you've already forked returns the existing
 *  fork rather than erroring, so this is safe to call on every submission. */
export async function ensureFork(
  token: string,
  budget?: AbortSignal,
): Promise<{ owner: string; repo: string; defaultBranch: string }> {
  const res = await githubFetch(
    token,
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/forks`,
    { method: "POST", body: JSON.stringify({ default_branch_only: true }) },
    budget,
  );
  if (!res.ok && res.status !== 202) {
    throw new GitHubApiError(`Could not fork ${UPSTREAM_OWNER}/${UPSTREAM_REPO} (${res.status})`, res.status);
  }
  const data = (await res.json()) as { owner: { login: string }; name: string; default_branch: string };
  return { owner: data.owner.login, repo: data.name, defaultBranch: data.default_branch };
}

/** GitHub's fork creation is async (§2 Phase C's diagram doesn't spell this
 *  out, but the API docs do) — a fork can 404 for a few seconds after the
 *  `POST .../forks` call above returns. Poll briefly rather than fail the
 *  whole submission on a timing race. */
export async function waitForForkReady(
  token: string,
  owner: string,
  repo: string,
  attempts = 6,
  delayMs = 1500,
  budget?: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const res = await githubFetch(token, `/repos/${owner}/${repo}`, {}, budget);
    if (res.ok) return;
    // No sleep after the LAST probe — it used to burn a final `delayMs`
    // (1.5s of the function's lifetime) immediately before throwing anyway.
    if (attempt < attempts - 1) await sleep(delayMs, budget);
  }
  throw new GitHubApiError(`Fork ${owner}/${repo} did not become ready in time`, 504);
}

async function getBranchHeadSha(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  budget?: AbortSignal,
): Promise<string> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`, {}, budget);
  if (!res.ok) {
    throw new GitHubApiError(`Could not read ${owner}/${repo}@${branch} (${res.status})`, res.status);
  }
  const data = (await res.json()) as { object: { sha: string } };
  return data.object.sha;
}

async function branchExists(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  budget?: AbortSignal,
): Promise<boolean> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`, {}, budget);
  return res.ok;
}

/** Creates `newBranch` off `fromBranch`, or reports that it was already
 *  there. `created: false` is the resume signal the orchestrator below acts
 *  on; it is NOT an error.
 *
 *  Why this is not `if (!res.ok) throw` any more: the branch name is
 *  `submit/<slug>`, deterministic per slug, so a submission whose function
 *  was killed after this call — the fork-ready poll above can spend seconds
 *  getting here — left a real branch on the contributor's own fork. Every
 *  later retry of that slug then got 422 "Reference already exists" and
 *  threw, permanently, for everyone who did not know to go delete the branch
 *  by hand. `scripts/test-submit-retry.ts` is the reproduction.
 *
 *  The 422 is confirmed POSITIVELY (re-read the ref) rather than by matching
 *  GitHub's prose: a 422 we cannot confirm is a real failure and still
 *  throws, so this swallows nothing it has not verified. */
export async function ensureBranch(
  token: string,
  owner: string,
  repo: string,
  fromBranch: string,
  newBranch: string,
  budget?: AbortSignal,
): Promise<{ created: boolean }> {
  const sha = await getBranchHeadSha(token, owner, repo, fromBranch, budget);
  const res = await githubFetch(
    token,
    `/repos/${owner}/${repo}/git/refs`,
    { method: "POST", body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }) },
    budget,
  );
  if (res.ok) return { created: true };
  if (res.status === 422 || res.status === 409) {
    if (await branchExists(token, owner, repo, newBranch, budget)) return { created: false };
  }
  throw new GitHubApiError(`Could not create branch ${newBranch} (${res.status})`, res.status);
}

/** What `putFile` actually did, so the orchestrator can tell a fresh
 *  submission from one that resumed a dead attempt. */
export type PutOutcome = "created" | "updated" | "unchanged";

/** Reads a file's blob sha and content on one branch. 404 (the file isn't
 *  there) is a `null`, not an error — that is the normal answer. */
async function readFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  budget?: AbortSignal,
): Promise<{ sha: string; base64: string | null } | null> {
  const res = await githubFetch(
    token,
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    {},
    budget,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new GitHubApiError(`Could not read ${path} on ${branch} (${res.status})`, res.status);
  }
  const data = (await res.json()) as { sha: string; content?: string; encoding?: string };
  return {
    sha: data.sha,
    // `encoding` is "none" for blobs the Contents API declines to inline.
    // A submission is capped at 256KB total (MAX_TOTAL_BYTES), so this
    // should not happen — but treat it as "unknown content", which only
    // costs a redundant update commit, never a wrong one.
    base64: data.encoding === "base64" && typeof data.content === "string" ? data.content : null,
  };
}

/** Contents API PUT — creates the file. The commit this produces is
 *  authored/committed as the token's own GitHub identity automatically;
 *  nothing here sets an author on the caller's behalf. `message` is the
 *  full commit message INCLUDING the `Signed-off-by` trailer
 *  (lib/submission-validation.ts's `dcoTrailer`), so the commit that lands
 *  on the fork already satisfies the CI DCO check the moment the PR opens.
 *
 *  Resume path: a PUT over a path that already exists on the branch is
 *  rejected (422 `"sha" wasn't supplied`, or 409 on a sha mismatch) rather
 *  than overwriting blindly. That is the SECOND permanent-retry trap, one
 *  step past `ensureBranch`'s — a killed attempt that wrote one file left
 *  every later retry of that slug failing here instead. So on either status
 *  we go look: identical content means the dead attempt already did this
 *  exact write and there is nothing to add (no empty commit on the
 *  contributor's fork), different content means update it at its current
 *  sha, and a path that genuinely is not there rethrows untouched. */
export async function putFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  budget?: AbortSignal,
): Promise<PutOutcome> {
  const base64 = Buffer.from(content, "utf-8").toString("base64");
  const put = (sha?: string) =>
    githubFetch(
      token,
      `/repos/${owner}/${repo}/contents/${path}`,
      { method: "PUT", body: JSON.stringify({ message, content: base64, branch, ...(sha ? { sha } : {}) }) },
      budget,
    );

  const res = await put();
  if (res.ok) return "created";
  if (res.status !== 422 && res.status !== 409) {
    throw new GitHubApiError(`Could not write ${path} (${res.status})`, res.status);
  }

  const existing = await readFile(token, owner, repo, branch, path, budget);
  if (existing === null) {
    throw new GitHubApiError(`Could not write ${path} (${res.status})`, res.status);
  }
  // GitHub line-wraps the base64 it returns; ours has no newlines.
  if (existing.base64 !== null && existing.base64.replace(/\s+/g, "") === base64) {
    return "unchanged";
  }

  const retry = await put(existing.sha);
  if (!retry.ok) {
    throw new GitHubApiError(`Could not write ${path} (${retry.status})`, retry.status);
  }
  return "updated";
}

/** The open PR upstream whose head is this fork's `branch`, if there is one.
 *  `null` means "none open", which is the normal answer for a first
 *  submission and is not an error. A CLOSED pr is deliberately not matched:
 *  resubmitting after a maintainer closed the PR should open a fresh one,
 *  and GitHub allows that from the same head. */
export async function findOpenPullRequest(
  token: string,
  forkOwner: string,
  branch: string,
  budget?: AbortSignal,
): Promise<string | null> {
  const head = encodeURIComponent(`${forkOwner}:${branch}`);
  const res = await githubFetch(
    token,
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls?head=${head}&state=open&per_page=1`,
    {},
    budget,
  );
  if (!res.ok) {
    throw new GitHubApiError(`Could not list pull requests (${res.status})`, res.status);
  }
  const data = (await res.json()) as { html_url: string }[];
  return Array.isArray(data) && data.length > 0 ? data[0].html_url : null;
}

/** `reused: true` = the PR was already open from an earlier attempt and this
 *  call adopted it. GitHub answers a duplicate `POST .../pulls` with 422
 *  ("A pull request already exists for user:branch") — the THIRD permanent
 *  trap: an attempt killed in the gap between GitHub opening the PR and
 *  Convex recording it had fully succeeded, yet every retry threw. Same
 *  positive-confirmation rule as `ensureBranch`: a 422 we cannot resolve to
 *  an actual open PR still throws. */
export async function openPullRequest(
  token: string,
  forkOwner: string,
  branch: string,
  title: string,
  body: string,
  budget?: AbortSignal,
): Promise<{ url: string; reused: boolean }> {
  const res = await githubFetch(
    token,
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title,
        head: `${forkOwner}:${branch}`,
        base: UPSTREAM_DEFAULT_BRANCH,
        body,
        maintainer_can_modify: true,
      }),
    },
    budget,
  );
  if (res.ok) {
    const data = (await res.json()) as { html_url: string };
    return { url: data.html_url, reused: false };
  }
  if (res.status === 422) {
    const open = await findOpenPullRequest(token, forkOwner, branch, budget);
    if (open !== null) return { url: open, reused: true };
  }
  throw new GitHubApiError(`Could not open pull request (${res.status})`, res.status);
}

export type SubmitFile = { path: string; content: string };

export type SubmitOutcome = {
  login: string;
  prUrl: string;
  /** True when this call adopted work an earlier, interrupted attempt had
   *  already landed on the fork, rather than doing all of it itself. The
   *  route does not branch on it; `scripts/test-submit-retry.ts` asserts on
   *  it, which is how "the retry actually resumed" stays proven. */
  resumed: boolean;
};

/** The whole GitHub half of a submission: fork -> branch -> commits -> PR,
 *  every call made with the CALLER's own token so D3's attribution holds by
 *  construction (see this file's header).
 *
 *  It lives here rather than inline in `app/api/submit/route.ts` for one
 *  concrete reason: this sequence — not its individual calls — is what the
 *  retry trap was a property of, so it has to be the thing a test can drive.
 *  `scripts/test-submit-retry.ts` calls exactly this function against a fake
 *  GitHub, kills it at each step, and retries. The route keeps everything
 *  that is its own business: the trust boundary, validation, the Convex
 *  rate-limit and audit rows, the branch name, and every byte of the commit
 *  message and PR body.
 *
 *  Every step is resume-safe, so the function being killed part-way through
 *  costs the contributor a retry, not their slug. */
export async function submitComponentToGithub(
  token: string,
  input: {
    branch: string;
    commitMessage: string;
    files: SubmitFile[];
    prTitle: string;
    prBody: string;
  },
  budget: AbortSignal = createSubmitBudget(),
): Promise<SubmitOutcome> {
  const login = await fetchAuthenticatedLogin(token, budget);
  const fork = await ensureFork(token, budget);
  await waitForForkReady(token, fork.owner, fork.repo, undefined, undefined, budget);

  const { created } = await ensureBranch(
    token,
    fork.owner,
    fork.repo,
    fork.defaultBranch,
    input.branch,
    budget,
  );

  if (!created) {
    // The branch was already there, so SOMETHING got this far before. If it
    // got all the way to an open PR, that PR *is* this submission — adopt it
    // and write nothing. This is the one case where pushing would be
    // actively harmful rather than merely redundant: the alternative
    // (commit, then discover the 422 on `POST .../pulls`) rewrites the files
    // under a PR a maintainer may be mid-review on, and the contributor is
    // never told it happened.
    const open = await findOpenPullRequest(token, fork.owner, input.branch, budget);
    if (open !== null) return { login, prUrl: open, resumed: true };
  }

  let resumed = !created;
  for (const file of input.files) {
    const outcome = await putFile(
      token,
      fork.owner,
      fork.repo,
      input.branch,
      file.path,
      file.content,
      input.commitMessage,
      budget,
    );
    if (outcome !== "created") resumed = true;
  }

  const pr = await openPullRequest(
    token,
    fork.owner,
    input.branch,
    input.prTitle,
    input.prBody,
    budget,
  );
  return { login, prUrl: pr.url, resumed: resumed || pr.reused };
}

export { GitHubApiError };
