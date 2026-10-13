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
/**
 * The hero's star CTA plus its progress toward the goal. Separate export
 * rather than a prop on GitHubStarButton, because the quiet variant appears
 * mid-page and in the newsletter CTA where a goal bar would be noise.
 */
export function GitHubStarCta({ stars = null }: { stars?: number | null }) {
  return (
    <div className="flex flex-col items-end">
      <GitHubStarButton stars={stars} />
      {stars !== null ? <StarGoal stars={stars} /> : null}
    </div>
  );
}

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
  const ariaLabel = stars !== null ? `${label}, ${stars.toLocaleString("en-US")} star${stars === 1 ? "" : "s"}` : undefined;

  if (variant === "quiet") {
    return (
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        // +1px on the y-inset compensates for this link's own `border` —
        // an absolutely positioned pseudo's containing block is the padding
        // box, not the border box (confirmed via elementFromPoint on the
        // catalog's category chips, same border-class shape) — so 4px here
        // reaches the intended ~3-4px past the visible edge. Plenty of
        // clearance above/below in both places this renders (header row,
        // newsletter CTA), so no horizontal-gap-style cap needed.
        className={`relative inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm text-foreground outline-none transition-colors hover:border-ns-muted hover:bg-surface focus-visible:ring-2 focus-visible:ring-ns-accent after:absolute after:-inset-x-[4px] after:-inset-y-[5px] after:content-[''] ${className}`}
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
      // 10 -> 6. Owner feedback: the collar read as thick enough to be the
      // subject, crowding the label it is supposed to frame. The glass effect
      // survives at 6 (it is a refraction band, not a border) while giving the
      // text back its visual priority.
      ringWidth={6}
      className={className}
    >
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        style={{ borderRadius: 6 }}
        className="relative inline-flex items-center gap-2 bg-surface px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-border/60 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:-inset-x-[4px] after:-inset-y-[4px] after:content-['']"
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

/** The number the owner is aiming at. One place, read by both the bar and
 *  the label, so they can never disagree. */
const STAR_GOAL = 5000;

/**
 * Progress toward STAR_GOAL, rendered under the hero's star button.
 *
 * Two honesty problems a naive progress bar has at this scale, both handled
 * here rather than papered over:
 *
 *  - A true-width fill at 25/5,000 is 0.5% of the track, which rounds to
 *    nothing and paints as an empty bar — indistinguishable from broken. The
 *    fill therefore has a 2px floor whenever the count is above zero: it
 *    overstates the bar by a hair at the very bottom of the range, and the
 *    LABEL next to it carries the exact figures, so nothing is actually
 *    misreported.
 *  - The percentage is shown to one decimal below 10%, because "0%" next to a
 *    real count of 25 reads as a bug and "1%" is wrong.
 *
 * `aria-hidden` on the bar with the numbers in the adjacent text, rather than
 * a progressbar role: a screen reader gets "25 of 5,000 stars, 0.5%" as plain
 * prose, which is the whole content. A role here would add a second
 * announcement of the same thing.
 */
function StarGoal({ stars }: { stars: number }) {
  const pct = (stars / STAR_GOAL) * 100;
  const shown = pct < 10 ? pct.toFixed(1) : Math.round(pct).toString();
  return (
    <div className="mt-2 w-full max-w-[13rem]">
      <div
        aria-hidden
        className="h-[3px] w-full overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-ns-accent"
          // Inline width because the value is data, not a design token — there
          // is no Tailwind class for "0.5%".
          // Rounded: the raw ratio serialises into the shipped HTML as
          // `max(2px, 0.5599999999999999%)`. Two decimals is well past
          // sub-pixel on any track width.
          style={{ width: stars > 0 ? `max(2px, ${pct.toFixed(2)}%)` : 0 }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[10px] tabular-nums text-ns-muted">
        {stars.toLocaleString("en-US")} of {STAR_GOAL.toLocaleString("en-US")} stars
        <span aria-hidden> · {shown}%</span>
      </p>
    </div>
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
