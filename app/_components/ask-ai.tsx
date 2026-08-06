"use client";

import { useState, type ComponentType } from "react";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import {
  ASK_AI_PLATFORMS,
  buildPrompt,
  componentSubject,
  registrySubject,
  type AskAiSubject,
} from "@/lib/ask-ai";
import {
  ClaudeIcon,
  GeminiIcon,
  GrokIcon,
  OpenAIIcon,
  PerplexityIcon,
} from "./ask-ai-icons";
import { CopyIcon, CheckIcon } from "./copy-button";

const ICONS: Record<string, ComponentType> = {
  claude: ClaudeIcon,
  gemini: GeminiIcon,
  grok: GrokIcon,
  chatgpt: OpenAIIcon,
  perplexity: PerplexityIcon,
};

// 44x44 hit area (size-11), rounded square per the spec, subtle border on
// the surface token so it reads as a soft card in light mode and a correct
// dark-mode card in dark — same border/surface pair every code block on the
// site already uses, not a hardcoded off-white.
const BUTTON =
  "relative flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ns-muted outline-none transition-colors motion-reduce:transition-none hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * "Ask AI about ns-ui" launcher. Defaults to the whole registry; pass
 * `component` to scope the question to one item instead (used on
 * /components/[name]). Rendered full on /connect and /components/[name],
 * and compact (icon row only) in the homepage header and the footer's "For
 * AI agents" column — see the `variant` prop.
 *
 * One prompt, five entry points, built from the same registrySubject /
 * componentSubject + buildPrompt in lib/ask-ai.ts that generates llms.txt —
 * the prompt can't drift from what those feeds actually say. Platforms with
 * a working prefill URL (Claude*, ChatGPT*, Grok*, Perplexity) render first
 * and open straight into a chat with the prompt already there; Gemini, the
 * one platform with no known prefill route, renders after a divider, copies
 * the prompt to the clipboard, and opens a blank chat for the user to paste
 * into — a small copy/check corner badge (copy-button.tsx's own glyphs)
 * plus a caption below the row spell out the split, since a bare icon row
 * left it silently indistinguishable from the ones that just work (owner
 * report: "clicked ChatGPT, no prompt" — it was in the clipboard, he just
 * had no way to know that before or after the click; ChatGPT has since
 * moved to prefill, but the same reasoning is why Gemini still gets a
 * badge rather than being silently identical to the rest). Exactly which
 * platforms are which, and what was checked to decide: lib/ask-ai.ts.
 * (*Claude ships on the strength of it being Anthropic's own documented
 * share-prompt shape — the actual composer fill couldn't be re-confirmed
 * from this build because an unauthenticated visit redirects to /logout
 * before the app loads. ChatGPT and Grok's prefill is undocumented/
 * reverse-engineered, not an official API — see the source notes in
 * lib/ask-ai.ts for all three.)
 */
export function AskAI({
  component,
  variant = "full",
}: {
  component?: { title: string; slug: string };
  /**
   * "full" (default): the titled block with a description line, used on
   * /connect and /components/[name] where Ask AI is the point of the
   * section. "compact": bare icon row, no heading or copy — for placements
   * where Ask AI is a secondary utility alongside other content (the
   * footer's "For AI agents" column, the homepage header).
   */
  variant?: "full" | "compact";
}) {
  const subject: AskAiSubject = component
    ? componentSubject(REGISTRY_ORIGIN, component.title, component.slug)
    : registrySubject(REGISTRY_ORIGIN);
  const prompt = buildPrompt(subject);

  // Set once per click, never cleared on a timer: the owner's own report was
  // "clicked ChatGPT, got a blank composer, had no idea the prompt was in
  // the clipboard" — his attention was in the new tab well past any 1.6s
  // window, so a clock-based confirmation is invisible for exactly the
  // person it's for. It now clears only when a *different* clipboard button
  // is used, so it's still showing "copied" when he comes back and checks.
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyAndOpen = (id: string, homeHref: string) => {
    // Fire-and-forget, not awaited: awaiting the clipboard promise before
    // window.open pushes the open outside the click's user-activation
    // window and risks the popup blocker (Safari does this reliably). The
    // clipboard write and the tab open both start synchronously in the
    // click handler instead.
    navigator.clipboard.writeText(prompt).catch(() => {
      // Clipboard can fail (permissions, insecure context) — still open the
      // site so the click isn't a dead end, just without a paste-ready
      // prompt waiting there.
    });
    window.open(homeHref, "_blank", "noopener,noreferrer");
    setCopiedId(id);
  };

  const prefillPlatforms = ASK_AI_PLATFORMS.filter((p) => p.kind === "prefill");
  const clipboardPlatforms = ASK_AI_PLATFORMS.filter((p) => p.kind === "clipboard");

  const renderPlatform = (platform: (typeof ASK_AI_PLATFORMS)[number]) => {
    const Icon = ICONS[platform.id];
    const copied = copiedId === platform.id;

    if (platform.kind === "prefill") {
      const label = `Ask ${platform.label} about ${subject.short}`;
      return (
        <a
          key={platform.id}
          href={platform.buildHref(prompt)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={BUTTON}
        >
          <Icon />
        </a>
      );
    }

    // Names the action, not just the destination — "no prompt" was the
    // report from someone who only ever saw "Ask ChatGPT about ns-ui" and
    // had no reason to expect a clipboard step before the click.
    const label = `Copy prompt and open ${platform.label}`;
    return (
      <button
        key={platform.id}
        type="button"
        onClick={() => copyAndOpen(platform.id, platform.homeHref)}
        aria-label={copied ? `Prompt copied — paste it into ${platform.label}` : label}
        title={copied ? `Copied — paste into ${platform.label}` : label}
        className={BUTTON}
      >
        <Icon />
        {/* Corner badge, not a colour change (BUTTON stays the same border/
            surface either way) — copy-button.tsx's own glyph-swap idiom,
            same two icons, reused rather than a second "this copies
            something" language invented for this file. Visible before the
            click (outline glyph) so the distinction from Claude/Perplexity
            doesn't depend on hover, and after the click (check) so the
            state survives the tab switch instead of a timer expiring while
            the user is in ChatGPT. */}
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full border border-border bg-background text-ns-muted"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </span>
      </button>
    );
  };

  const buttons = (
    <div
      className="flex flex-wrap items-center gap-2"
      {...(variant === "compact"
        ? { role: "group", "aria-label": `Ask AI about ${subject.short}` }
        : {})}
    >
      {prefillPlatforms.map(renderPlatform)}
      {/* Divider between the four prefill platforms and Gemini, the one
          remaining clipboard fallback — still worth a divider even for a
          single odd-one-out, since the corner badge alone is easy to miss
          at a glance and the gap reads as "this one's different" before
          anyone gets that close. */}
      <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
      {clipboardPlatforms.map(renderPlatform)}
    </div>
  );

  if (variant === "compact") return buttons;

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
        Ask AI
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ns-muted">
        {component ? (
          <>
            Point an assistant at this component&apos;s docs (
            <code className="font-mono text-foreground">llms-full.txt</code>) with one click.
          </>
        ) : (
          <>
            Point an assistant at the registry&apos;s{" "}
            <code className="font-mono text-foreground">llms.txt</code> feeds with one click.
          </>
        )}
      </p>
      <div className="mt-3">{buttons}</div>
      <p className="mt-2 text-xs text-ns-muted">
        Claude, ChatGPT, Grok, and Perplexity open with the prompt already in. Gemini{" "}
        <span className="inline-flex translate-y-[3px] items-center justify-center">
          <CopyIcon />
        </span>{" "}
        copies it to your clipboard first — paste it in once the chat opens.
      </p>
    </div>
  );
}
