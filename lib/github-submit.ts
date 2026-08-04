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
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function githubFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  return res;
}

export async function fetchAuthenticatedLogin(token: string): Promise<string> {
  const res = await githubFetch(token, "/user");
  if (!res.ok) {
    throw new GitHubApiError(`Could not read authenticated GitHub user (${res.status})`, res.status);
  }
  const data = (await res.json()) as { login: string };
  return data.login;
}

/** Idempotent: forking a repo you've already forked returns the existing
 *  fork rather than erroring, so this is safe to call on every submission. */
export async function ensureFork(token: string): Promise<{ owner: string; repo: string; defaultBranch: string }> {
  const res = await githubFetch(token, `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/forks`, {
    method: "POST",
    body: JSON.stringify({ default_branch_only: true }),
  });
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
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const res = await githubFetch(token, `/repos/${owner}/${repo}`);
    if (res.ok) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new GitHubApiError(`Fork ${owner}/${repo} did not become ready in time`, 504);
}

async function getBranchHeadSha(token: string, owner: string, repo: string, branch: string): Promise<string> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  if (!res.ok) {
    throw new GitHubApiError(`Could not read ${owner}/${repo}@${branch} (${res.status})`, res.status);
  }
  const data = (await res.json()) as { object: { sha: string } };
  return data.object.sha;
}

export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  fromBranch: string,
  newBranch: string,
): Promise<void> {
  const sha = await getBranchHeadSha(token, owner, repo, fromBranch);
  const res = await githubFetch(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
  });
  if (!res.ok) {
    throw new GitHubApiError(`Could not create branch ${newBranch} (${res.status})`, res.status);
  }
}

/** Contents API PUT — creates the file. The commit this produces is
 *  authored/committed as the token's own GitHub identity automatically;
 *  nothing here sets an author on the caller's behalf. `message` is the
 *  full commit message INCLUDING the `Signed-off-by` trailer
 *  (lib/submission-validation.ts's `dcoTrailer`), so the commit that lands
 *  on the fork already satisfies the CI DCO check the moment the PR opens. */
export async function putFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch,
    }),
  });
  if (!res.ok) {
    throw new GitHubApiError(`Could not write ${path} (${res.status})`, res.status);
  }
}

export async function openPullRequest(
  token: string,
  forkOwner: string,
  branch: string,
  title: string,
  body: string,
): Promise<string> {
  const res = await githubFetch(token, `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title,
      head: `${forkOwner}:${branch}`,
      base: UPSTREAM_DEFAULT_BRANCH,
      body,
      maintainer_can_modify: true,
    }),
  });
  if (!res.ok) {
    throw new GitHubApiError(`Could not open pull request (${res.status})`, res.status);
  }
  const data = (await res.json()) as { html_url: string };
  return data.html_url;
}

export { GitHubApiError };
