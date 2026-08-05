import { LiquidCollar } from "@/registry/loud/border-chrome-ring/component";

const REPO_URL = "https://github.com/nikolas-sapa/ns-ui";

/** `1234` -> `1,234`, `12400` -> `12.4k`. Matches at a glance rather than to
 *  the digit, which is all a header CTA needs. */
function formatStarCount(count: number): string {
  if (count < 1000) return count.toLocaleString("en-US");
  return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * The star CTA. Two placements share one component so the copy and target
 * never drift apart, but only the hero gets the LiquidCollar treatment —
 * a second WebGL context for a below-the-fold repeat would double the GPU
 * cost of the CTA for no reason and start reading as an ad by repetition.
 * `variant="quiet"` is a plain bordered link with the same label and target.
 *
 * LiquidCollar itself renders `children` unconditionally outside its GL
 * effect (see registry/loud/border-chrome-ring/component.tsx), so the link is
 * always in the DOM and clickable even where WebGL is unavailable or a
 * shader fails to compile — the ring is a visual bonus, never a dependency.
 *
 * `stars` is fetched server-side (see lib/github-stars.ts) and passed down
 * rather than fetched here — this stays a client component for the hover/
 * focus states, and a client-side fetch would mean a loading state, a
 * layout shift once it resolves, and one API call per visitor against
 * GitHub's 60/hour unauthenticated limit instead of one per hour. `null`
 * (fetch failed, or not threaded through) renders exactly as before: no
 * count, no divider, same height either way.
 */
export function GitHubStarButton({
  variant = "collar",
  className = "",
  stars = null,
}: {
  variant?: "collar" | "quiet";
  className?: string;
  stars?: number | null;
}) {
  const label = variant === "quiet" ? "Star ns-ui on GitHub" : "Star on GitHub";
  const ariaLabel = stars !== null ? `${label}, ${stars.toLocaleString("en-US")} stars` : undefined;

  if (variant === "quiet") {
    return (
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm text-foreground outline-none transition-colors hover:border-ns-muted hover:bg-surface focus-visible:ring-2 focus-visible:ring-ns-accent ${className}`}
      >
        <StarIcon />
        {label}
        <StarCount stars={stars} />
      </a>
    );
  }

  return (
    <LiquidCollar
      variant="pill"
      radius={6}
      ringWidth={10}
      className={className}
    >
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        style={{ borderRadius: 6 }}
        className="inline-flex items-center gap-2 bg-surface px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-border/60 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <StarIcon />
        {label}
        <StarCount stars={stars} />
      </a>
    </LiquidCollar>
  );
}

/** The count, set off from the label by the same border token used
 *  everywhere else so it reads as a counter rather than trailing words in
 *  the sentence. `aria-hidden` because the parent link's `aria-label`
 *  already speaks the count when it's present. Renders nothing — no
 *  divider, no width — when the count is unavailable, so the button's
 *  height and shape never depend on the fetch. */
function StarCount({ stars }: { stars: number | null }) {
  if (stars === null) return null;
  return (
    <span aria-hidden className="ml-0.5 flex items-center gap-2 border-l border-border pl-2 font-mono text-xs tabular-nums text-ns-muted">
      {formatStarCount(stars)}
    </span>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 1.5l1.98 4.2 4.52.55-3.34 3.24.85 4.51L8 11.9l-4.01 2.1.85-4.51L1.5 6.25l4.52-.55L8 1.5Z" />
    </svg>
  );
}
