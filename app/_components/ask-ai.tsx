"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
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
 * /components/[name]).
 *
 * One prompt, five entry points, built from the same registrySubject /
 * componentSubject + buildPrompt in lib/ask-ai.ts that generates llms.txt —
 * the prompt can't drift from what those feeds actually say. Platforms with
 * a verified working prefill URL (Claude*, Perplexity) open straight into a
 * running chat; the rest copy the prompt to the clipboard and open a blank
 * chat instead of doing nothing when clicked. Exactly which platforms are
 * which, and what was checked to decide: lib/ask-ai.ts.
 * (*Claude ships on the strength of it being Anthropic's own documented
 * share-prompt shape — the actual composer fill couldn't be re-confirmed
 * from this build because an unauthenticated visit redirects to /logout
 * before the app loads. See the source note in lib/ask-ai.ts.)
 */
export function AskAI({ component }: { component?: { title: string; slug: string } }) {
  const subject: AskAiSubject = component
    ? componentSubject(REGISTRY_ORIGIN, component.title, component.slug)
    : registrySubject(REGISTRY_ORIGIN);
  const prompt = buildPrompt(subject);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copyAndOpen = async (id: string, homeHref: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Clipboard can fail (permissions, insecure context) — still open the
      // site so the click isn't a dead end, just without a paste-ready
      // prompt waiting there.
    }
    window.open(homeHref, "_blank", "noopener,noreferrer");
    setCopiedId(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedId(null), 1600);
  };

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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ASK_AI_PLATFORMS.map((platform) => {
          const Icon = ICONS[platform.id];
          const label = `Ask ${platform.label} about ${subject.short}`;
          const copied = copiedId === platform.id;

          if (platform.kind === "prefill") {
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
