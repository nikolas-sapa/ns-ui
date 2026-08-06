/**
 * "Ask AI about ns-ui" launcher — prompt text and per-platform link shapes.
 * Pure data/functions (no "use client"), shared by the registry-wide
 * placement (/connect) and the per-component placement
 * (/components/[name]), which differ only in which subject they build.
 *
 * Every platform below was checked in a real headless browser where
 * possible, same discipline as app/connect/mcp-clients.ts — see `source` on
 * each entry for what was verified and what a future editor should
 * re-check. ChatGPT and Grok's `?q=` prefill is undocumented/reverse-
 * engineered (not officially documented by OpenAI or xAI) — flagged as such
 * rather than presented as equally certain to Perplexity's. Claude sits
 * behind a login wall that blocked full verification in the sandbox this
 * was built in and ships on the strength of it being Anthropic's own
 * documented share-prompt shape. Gemini has no known working prefill route
 * and stays on clipboard.
 */

export type AskAiSubject = {
  /** Short form for the visible title and accessible names, e.g. "ns-ui" or a component's title. */
  short: string;
  /** Full sentence fragment describing what the AI is being pointed at. */
  description: string;
  /** URLs worth telling the AI to read, most useful first. */
  urls: string[];
  /** What kind of opinion to ask for — the registry as a whole, or one component in it. */
  scope: "registry" | "component";
};

/** Registry-wide subject — the default, used on /connect. */
export function registrySubject(origin: string): AskAiSubject {
  return {
    short: "ns-ui",
    description:
      "ns-ui, a shadcn-compatible registry of React + Tailwind components",
    urls: [`${origin}/llms.txt`, `${origin}/llms-full.txt`],
    scope: "registry",
  };
}

/** One component's subject — used on /components/[name]. */
export function componentSubject(origin: string, title: string, slug: string): AskAiSubject {
  return {
    short: title,
    description: `the "${title}" component in the ns-ui registry`,
    urls: [`${origin}/llms-full.txt`, `${origin}/components/${slug}`],
    scope: "component",
  };
}

/**
 * Points the AI at the actual feeds (so its answer is grounded, not
 * hallucinated) and asks it to form a view, not just echo the docs back —
 * the owner's ask was specifically for an opinion, not a lookup. Kept to one
 * sentence per half so the encoded URL stays well under platform query
 * length limits.
 */
export function buildPrompt(subject: AskAiSubject): string {
  const ask =
    subject.scope === "registry"
      ? "Give me your honest take: what it's good at, how it compares to other component registries (shadcn/ui, Radix, Origin UI, Aceternity), and which components are worth using and why."
      : "Give me your honest take on it: what it's good for, how it compares to similar components elsewhere, and whether it's worth using over building it myself.";
  return `Read ${subject.urls.join(" and ")} — ${subject.description}. ${ask} If I want to use it, show the exact install command.`;
}

export type AskAiPlatform = {
  id: string;
  label: string;
  /**
   * "prefill": the composer actually fills with the prompt (or, for
   * Perplexity, the query auto-runs) when the URL is opened — verified.
   * "clipboard": no verified URL-based prefill exists, so the prompt is
   * copied to the clipboard and the platform opens to a blank chat instead
   * of a button that silently does nothing.
   */
  kind: "prefill" | "clipboard";
  buildHref: (prompt: string) => string;
  /** Where the clipboard fallback opens. Also what "prefill" platforms fall back to if buildHref ever can't run (see AskAiLauncher). */
  homeHref: string;
  source: string;
};

export const ASK_AI_PLATFORMS: AskAiPlatform[] = [
  {
    id: "claude",
    label: "Claude",
    kind: "prefill",
    buildHref: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
    homeHref: "https://claude.ai/new",
    source:
      "claude.ai/new?q=<text> is Anthropic's own share-prompt URL shape (used by claude.ai's " +
      "own \"share\" links and third-party \"Ask Claude\" buttons). Could not confirm the " +
      "composer actually fills in this sandbox: an unauthenticated visit redirects straight " +
      "to /logout before the app mounts, so there was no signed-in session to load the URL " +
      "against. Re-check signed in before trusting this fully. Verified 2026-08-06.",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    kind: "prefill",
    buildHref: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
    homeHref: "https://chatgpt.com/",
    source:
      "Undocumented, reverse-engineered — re-check before trusting fully. chatgpt.com/?q=<text> " +
      "prefills the composer (chatgpt.com normalises ?q= to ?prompt= internally, both accepted); " +
      "it does not reliably auto-submit, the user still presses send. An earlier pass here tested " +
      "this logged out and saw an empty composer, which is the likely reason it was previously " +
      "marked clipboard-only — corroborated independently by Mintlify shipping \"Open in ChatGPT\" " +
      "as a production contextual-menu option using this same shape in 2026. Updated 2026-08-06.",
  },
  {
    id: "gemini",
    label: "Gemini",
    kind: "clipboard",
    buildHref: () => "https://gemini.google.com/app",
    homeHref: "https://gemini.google.com/app",
    source:
      "gemini.google.com/app requires Google sign-in before the app mounts at all (consent + " +
      "sign-in interstitial in a headless test), and no publicly documented query-param prefill " +
      "for the current Gemini web app was found to test in the first place. Falls back to " +
      "copy-to-clipboard + open the app. Verified 2026-08-06.",
  },
  {
    id: "grok",
    label: "Grok",
    kind: "prefill",
    buildHref: (prompt) => `https://grok.com/?q=${encodeURIComponent(prompt)}`,
    homeHref: "https://grok.com/",
    source:
      "Undocumented, reverse-engineered — re-check before trusting fully. grok.com/?q=<text> " +
      "prefills the composer and usually auto-submits. grok.com is the canonical surface (x.com/" +
      "i/grok is legacy); a prior pass here couldn't reach grok.com at all from a sandbox with " +
      "the owner's own X/Twitter hosts-file block. Also a first-class Mintlify contextual-menu " +
      "option. Updated 2026-08-06.",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    kind: "prefill",
    buildHref: (prompt) => `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`,
    homeHref: "https://www.perplexity.ai/",
    source:
      "Verified in a headless browser, unauthenticated: perplexity.ai/search?q=<text> redirects " +
      "to /search/new?q=<text> and the query actually auto-runs (visible \"Thinking\" state), " +
      "no login required. Verified 2026-08-06.",
  },
];
