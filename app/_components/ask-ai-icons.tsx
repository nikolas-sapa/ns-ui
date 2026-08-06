/**
 * Simple monochrome glyphs for the 5 platforms in ask-ai.tsx — hand-drawn
 * abstractions of each brand's mark (not the trademarked logos themselves),
 * inline SVG so there's nothing fetched at runtime and no icon-library
 * dependency. Same convention as copy-button.tsx: 16x16 viewBox,
 * `currentColor`, `aria-hidden` (the button around each carries the
 * accessible name).
 */

const BASE = {
  viewBox: "0 0 16 16",
  className: "size-4",
  "aria-hidden": true as const,
};

export function ClaudeIcon() {
  // Sunburst asterisk — Claude's mark is an eight-spoke starburst.
  return (
    <svg {...BASE} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
      <path d="M8 1v14M8 1 5.8 6M8 1l2.2 5M8 15l-2.2-5M8 15l2.2-5" />
      <path d="M1 8h14M1 8l5-2.2M1 8l5 2.2M15 8l-5-2.2M15 8l-5 2.2" />
    </svg>
  );
}

export function GeminiIcon() {
  // Four-point sparkle — Gemini's mark is a single asymmetric twinkle.
  return (
    <svg {...BASE} fill="currentColor" stroke="none">
      <path d="M8 1c.3 2.8 1 4.3 1.9 5.4C10.9 7.5 12.4 8.1 15 8.4v.2c-2.6.3-4.1.9-5.1 2-.9 1.1-1.6 2.6-1.9 5.4h-.2c-.3-2.8-1-4.3-1.9-5.4-.9-1.1-2.4-1.7-4.9-2v-.2c2.5-.3 4-.9 4.9-2C7 5.3 7.7 3.8 8 1z" />
    </svg>
  );
}

export function GrokIcon() {
  // Angular open loop — an abstraction of Grok's knotted mark, not a
  // literal reproduction.
  return (
    <svg {...BASE} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5 8 8l5-3.5M8 8v6.5M3 11.5 8 8" />
    </svg>
  );
}

export function OpenAIIcon() {
  // Three interlocking loops — an abstraction of the pinwheel/flower mark.
  return (
    <svg {...BASE} fill="none" stroke="currentColor" strokeWidth="1.25">
      <circle cx="8" cy="4.6" r="2.1" />
      <circle cx="4.6" cy="10.2" r="2.1" />
      <circle cx="11.4" cy="10.2" r="2.1" />
    </svg>
  );
}

export function PerplexityIcon() {
  // Compass rose — radiating spokes inside a ring.
  return (
    <svg {...BASE} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 3.25v3.5M8 9.25v3.5M3.25 8h3.5M9.25 8h3.5" />
    </svg>
  );
}
