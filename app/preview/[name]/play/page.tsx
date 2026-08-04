import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import registry from "@/registry.json";
import order from "@/lib/component-order.json";
import { loadUseWhen } from "@/lib/use-when";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { CopyButton } from "@/app/_components/copy-button";
import { kindOf } from "@/lib/kind";
import { loadSource } from "@/lib/source";
import { ThemeToggle } from "@/app/_components/theme-toggle";

/**
 * The playground: a dedicated, fully-interactive page per component, one
 * click away from a catalog card.
 *
 * Deliberately does NOT frame `/components/[name]` — that route now carries
 * full site chrome (sidebar, nav) so it's indexable, which is exactly what
 * this iframe cannot have: `scripts/verify.ts` and `scripts/record.ts`
 * screenshot `/preview/[name]` (the bare verification fixture, kept
 * chrome-less and noindex specifically for that gate — see its own docblock),
 * and they emulate both themes, then grab "the first visible interactive
 * element" for hover/press/focus assertions. A header, theme toggle, copy
 * button etc. — or a sidebar — in that same document would hand the gate a
 * different "first interactive element" than the component's own, breaking
 * the hover/focus diff for every component that has one (measured, once
 * `/components/[name]` gained chrome: the locator resolved to the sidebar's
 * own wordmark link). So this page frames the bare fixture in an iframe
 * instead — `?embed=1&interactive=1` already exists for exactly this (the
 * featured-card thumbnail uses the same URL once activated) and is provably
 * unchanged by this file.
 *
 * Layout rule: the component is the page. Everything the visitor might read
 * *after* deciding they like it — the full description, when to reach for it,
 * the build spec — sits in closed disclosures under the demo, so the demo is
 * the first thing in view rather than the fourth.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const item = registry.items.find((i) => i.name === name);
  if (!item) return {};
  const title = `${item.title} — playground — ns-ui`;
  return { title, description: item.description };
}

/**
 * Declaring this at all is what moves the route out of the always-dynamic
 * bucket and into ISR. Without it the playground served `no-store` and every
 * visit was a function invocation — and because each catalog card links here,
 * Next prefetches the route for every card near the viewport, so one homepage
 * load fired ~38 uncached renders (measured). The list is empty on purpose:
 * prerendering 218 pages at build buys nothing over caching the first request
 * for each, and costs build time. `revalidate` below does the rest.
 */
export function generateStaticParams() {
  return [];
}

export const revalidate = 3600;

/** The lead sentence carries the component's job; the rest is build detail. */
const firstSentence = (text: string) => text.split(/(?<=\.)\s/, 1)[0] ?? text;

const SUMMARY =
  "cursor-pointer select-none rounded-sm font-mono text-xs uppercase tracking-[0.14em] text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none";

export default async function PlaygroundPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const item = registry.items.find((i) => i.name === name);
  if (!item) notFound();

  const useWhen = loadUseWhen()[name];
  const instruction = (item.meta as { instruction?: string } | undefined)
    ?.instruction;
  const tags = (item.meta as { tags?: string[] } | undefined)?.tags ?? [];
  const collection =
    (item.meta as { collection?: string } | undefined)?.collection ?? "core";
  const installCommand = `npx shadcn add ${REGISTRY_ORIGIN}/r/${name}.json`;
  const kind = kindOf(tags);
  const source = loadSource(name);
  const summary = firstSentence(item.description);
  const hasMore = summary !== item.description;

  // Prev/next by recency, not by the homepage's featured-first order — that
  // order changes with curation, this stays stable and covers every
  // component. A slug missing from the snapshot (freshly added, order not
  // yet regenerated) simply gets no neighbours.
  const slugs = order as string[];
  const idx = slugs.indexOf(name);
  const newer = idx > 0 ? slugs[idx - 1] : null;
  const older = idx >= 0 && idx < slugs.length - 1 ? slugs[idx + 1] : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-6 pb-16 pt-6 sm:px-10 lg:pt-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 pl-14 lg:pl-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {item.title}
            </h1>
            {kind ? (
              <span className="shrink-0 text-sm text-muted">{kind}</span>
            ) : null}
            {collection === "loud" ? (
              <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted">
                loud
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            {summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyButton
            variant="inline"
            value={installCommand}
            label="Copy install command"
          />
          <NavArrow href={older} label="Older component" />
          <NavArrow href={newer} label="Newer component" flip />
          <ThemeToggle />
        </div>
      </header>

      {/* Fully interactive, uninert, not autoplaying — `interactive=1` on the
          bare verification fixture. Full real viewport (no scale transform,
          no site chrome), so this is exactly the component's own render,
          breathing room and all — the thing the owner asked to "play
          with" — without the sidebar that `/components/[name]` now carries. */}
      <div className="mt-5 flex-1 overflow-hidden rounded-md border border-border bg-surface">
        <iframe
          key={name}
          src={`/preview/${name}?embed=1&interactive=1`}
          title={`${item.title} — interactive`}
          className="h-[76vh] min-h-[520px] w-full border-0 bg-transparent"
        />
      </div>

      <div className="mt-6 divide-y divide-border border-y border-border">
        <details className="group py-3">
          <summary className={SUMMARY}>Install</summary>
          <div className="mt-3 flex max-w-xl items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5">
            <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
              npx shadcn add {REGISTRY_ORIGIN}
              <wbr />
              /r/{name}.json
            </code>
            <CopyButton
              variant="inline"
              value={installCommand}
              label="Copy install command"
            />
          </div>
        </details>

        {source ? (
          <details className="py-3">
            <summary className={SUMMARY}>Source</summary>
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3">
                <code className="font-mono text-[11px] text-muted">{source.file}</code>
                <CopyButton
                  variant="inline"
                  value={source.code}
                  label="Copy component source"
                />
              </div>
              {/* No highlighter: one <pre> of real source, the same bytes the
                  CLI would write, and nothing to keep in sync with a theme. */}
              <pre className="mt-2 max-h-[60vh] overflow-auto rounded-md border border-border bg-surface p-4 font-mono text-[11px] leading-relaxed text-foreground">
                <code>{source.code}</code>
              </pre>
            </div>
          </details>
        ) : null}

        {useWhen || hasMore ? (
          <details className="py-3">
            <summary className={SUMMARY}>Use when</summary>
            {hasMore ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {item.description}
              </p>
            ) : null}
            {useWhen ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {useWhen}
              </p>
            ) : null}
          </details>
        ) : null}

        {instruction ? (
          <details className="py-3">
            <summary className={SUMMARY}>Build spec</summary>
            <p className="mt-3 max-w-3xl whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">
              {instruction}
            </p>
          </details>
        ) : null}

        {tags.length > 0 ? (
          <details className="py-3">
            <summary className={SUMMARY}>Tags</summary>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <footer className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-border pt-4 font-mono text-xs text-muted">
        <Link
          href="/"
          className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          Back to the catalog
        </Link>
        <a
          href="https://nikolas.helpmarq.com"
          className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          Built by Nikolas Sapa
        </a>
      </footer>
    </div>
  );
}

function NavArrow({
  href,
  label,
  flip = false,
}: {
  href: string | null;
  label: string;
  flip?: boolean;
}) {
  const shared =
    "inline-flex size-8 items-center justify-center rounded-sm text-muted";
  if (!href) {
    return (
      <span className={`${shared} opacity-30`} aria-hidden>
        <Chevron flip={flip} />
      </span>
    );
  }
  return (
    <Link
      href={`/preview/${href}/play`}
      aria-label={label}
      className={`${shared} outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none`}
    >
      <Chevron flip={flip} />
    </Link>
  );
}

function Chevron({ flip }: { flip: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-3.5 ${flip ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </svg>
  );
}
