import { LiquidCollar } from "@/registry/loud/liquid-collar/component";

const REPO_URL = "https://github.com/nikolas-sapa/ns-ui";

/**
 * The star CTA. Two placements share one component so the copy and target
 * never drift apart, but only the hero gets the LiquidCollar treatment —
 * a second WebGL context for a below-the-fold repeat would double the GPU
 * cost of the CTA for no reason and start reading as an ad by repetition.
 * `variant="quiet"` is a plain bordered link with the same label and target.
 *
 * LiquidCollar itself renders `children` unconditionally outside its GL
 * effect (see registry/loud/liquid-collar/component.tsx), so the link is
 * always in the DOM and clickable even where WebGL is unavailable or a
 * shader fails to compile — the ring is a visual bonus, never a dependency.
 */
export function GitHubStarButton({
  variant = "collar",
  className = "",
}: {
  variant?: "collar" | "quiet";
  className?: string;
}) {
  if (variant === "quiet") {
    return (
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm text-foreground outline-none transition-colors hover:border-muted hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      >
        <StarIcon />
        Star ns-ui on GitHub
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
        style={{ borderRadius: 6 }}
        className="inline-flex items-center gap-2 bg-surface px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-border/60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <StarIcon />
        Star on GitHub
      </a>
    </LiquidCollar>
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
