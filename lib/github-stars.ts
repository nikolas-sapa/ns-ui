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
    // GITHUB_TOKEN raises the ceiling from 60 requests/hour/IP to 5,000.
    // Unauthenticated is not just slow, it silently corrupts the homepage:
    // this runs at BUILD time for a prerendered page, so one rate-limited
    // build bakes `null` into the static HTML and the count stays missing
    // until the next deploy -- which is exactly what happened in production
    // (the /writing page kept its count because it rendered at a different
    // moment). Optional: unset still works, it just has the old ceiling.
    const token = process.env.GITHUB_TOKEN?.trim();
    const res = await fetch(REPO_API_URL, {
      headers: {
        "User-Agent": "ns-ui",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
