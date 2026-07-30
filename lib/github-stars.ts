const REPO_API_URL = "https://api.github.com/repos/nikolas-sapa/ns-ui";

/**
 * Live star count for the header CTA. ISR-cached for an hour so this is one
 * request per hour total, not one per visitor — the unauthenticated GitHub
 * API is rate-limited to 60 requests/hour/IP, and there's no token here (the
 * repo is public, this stays anonymous).
 *
 * Every failure mode — network error, non-200, rate-limit, a body without the
 * field it expects — collapses to `null`. The caller renders the button
 * exactly as it does with no count in that case, so a GitHub outage on launch
 * day degrades silently instead of breaking the homepage.
 */
export async function getStarCount(): Promise<number | null> {
  try {
    const res = await fetch(REPO_API_URL, {
      headers: { "User-Agent": "ns-ui" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const count = (data as { stargazers_count?: unknown })?.stargazers_count;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}
