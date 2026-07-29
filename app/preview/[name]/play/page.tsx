import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import registry from "@/registry.json";
import order from "@/lib/component-order.json";
import { loadUseWhen } from "@/lib/use-when";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { CopyButton } from "@/app/_components/copy-button";
import { ThemeToggle } from "@/app/_components/theme-toggle";

/**
 * The playground: a dedicated, fully-interactive page per component, one
 * click away from a catalog card.
 *
 * Deliberately does NOT touch `/preview/[name]` (the sibling route). That
 * bare route is what `scripts/verify.ts` and `scripts/record.ts` screenshot
 * directly — they emulate both themes, then grab "the first visible
 * interactive element" for hover/press/focus assertions. Adding a header,
 * theme toggle, copy button etc. to that same document would hand the gate a
 * different "first interactive element" than the component's own, breaking
 * the hover/focus diff for every component that has one. So this page frames
 * the honest reference page in an iframe instead — `?embed=1&interactive=1`
 * already exists for exactly this (the featured-card thumbnail uses the same
 * URL once activated) and is provably unchanged by this file.
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

  // Prev/next by recency, not by the homepage's featured-first order — that
  // order changes with curation, this stays stable and covers every
  // component. A slug missing from the snapshot (freshly added, order not
  // yet regenerated) simply gets no neighbours.
  const slugs = order as string[];
  const idx = slugs.indexOf(name);
  const newer = idx > 0 ? slugs[idx - 1] : null;
  const older = idx >= 0 && idx < slugs.length - 1 ? slugs[idx + 1] : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 pb-16 pt-8 sm:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-sm font-mono text-xs uppercase tracking-[0.14em] text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            <BackIcon /> All components
          </Link>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {item.title}
            </h1>
            {collection === "loud" ? (
              <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted">
                loud
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {item.description}
          </p>
        </div>
        <ThemeToggle />
      </header>

      {useWhen ? (
        <p className="mt-5 max-w-2xl rounded-md border border-border bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-mono uppercase tracking-wider text-foreground">
            Use when
          </span>{" "}
          {useWhen}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 max-w-xl flex-1 items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5">
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
        {tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Fully interactive, uninert, not autoplaying — `interactive=1` on the
          honest reference page. Full real viewport (no scale transform), so
          this is exactly what the direct link renders, breathing room and
          all — the thing the owner asked to "play with". */}
      <div className="mt-8 flex-1 overflow-hidden rounded-md border border-border bg-surface">
        <iframe
          key={name}
          src={`/preview/${name}?embed=1&interactive=1`}
          title={`${item.title} — interactive`}
          className="h-[75vh] min-h-[520px] w-full border-0 bg-transparent"
        />
      </div>

      {instruction ? (
        <details className="mt-8 rounded-md border border-border bg-surface px-4 py-3">
          <summary className="cursor-pointer select-none font-mono text-xs uppercase tracking-[0.14em] text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Build spec
          </summary>
          <p className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">
            {instruction}
          </p>
        </details>
      ) : null}

      <nav className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-5 font-mono text-xs text-muted">
        {older ? (
          <Link
            href={`/preview/${older}/play`}
            className="inline-flex items-center gap-1.5 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            <BackIcon /> Older
          </Link>
        ) : (
          <span />
        )}
        {newer ? (
          <Link
            href={`/preview/${newer}/play`}
            className="inline-flex items-center gap-1.5 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            Newer <BackIcon className="rotate-180" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

function BackIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-3.5 ${className}`}
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
