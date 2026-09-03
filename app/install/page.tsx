import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "../_components/copy-button";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// Static by construction: no `dynamic`/`revalidate` export, no `cookies()`,
// `headers()`, `searchParams`, Convex fetch, or auth import. This route
// prerenders once at build time, same guarantee /guidelines keeps.

const title = "Install";
const description =
  "How to install one ns-ui component into a project: the shadcn command, what it assumes about your app, and what the gate does and doesn't guarantee about it.";

export const metadata: Metadata = {
  alternates: { canonical: "/install" },
  title,
  description,
  openGraph: { title, description },
};

const SECTION_LABEL =
  "text-lg font-medium tracking-[-0.02em] text-foreground";

const CODE_BLOCK =
  "flex items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5";

const INSTALL_ONE = `npx shadcn add ${REGISTRY_ORIGIN}/r/<name>.json`;
const INIT_NEW = "npx shadcn init -d -n my-app";
const INIT_CD = "cd my-app";
const INSTALL_AFTER_INIT = `npx shadcn add ${REGISTRY_ORIGIN}/r/gallery-coverflow-caustic.json`;
/** Shown as three lines, copied as one paste — see the block below. */
const NEW_PROJECT_STEPS = [INIT_NEW, INIT_CD, INSTALL_AFTER_INIT];
const NEW_PROJECT_SEQUENCE = NEW_PROJECT_STEPS.join("\n");

export default function InstallPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        Install
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        Get one component into a project.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-muted">
        This page is for installing a component into your own app. If you're
        working inside this repository instead, see{" "}
        <a
          href="https://github.com/nikolas-sapa/ns-ui/blob/main/CONTRIBUTING.md"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          CONTRIBUTING.md
        </a>
        . If you're an agent rather than a person reading this, see{" "}
        <Link
          href="/connect"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          Connect
        </Link>{" "}
        for the MCP server, CLI, and text feeds instead.
      </p>

      <section className="mt-12 max-w-2xl border-t border-border pt-8">
        <h2 className={SECTION_LABEL}>Install a component</h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          Any project already configured for shadcn, zero extra config:
        </p>
        <div className={`mt-3 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {INSTALL_ONE}
          </code>
          <CopyButton variant="inline" value={INSTALL_ONE} label="Copy install command" />
        </div>
        <p className="mt-3 text-sm leading-6 text-ns-muted">
          That drops the source at{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            components/ui/&lt;name&gt;.tsx
          </code>{" "}
          and installs that component's own npm dependencies (per-component,
          not registry-wide: most components have none). There's no{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            ns-ui
          </code>{" "}
          package and nothing to keep in sync afterward. The file is yours;
          edit it directly.
        </p>
        <p className="mt-3 text-sm leading-6 text-ns-muted">
          The same command also writes any custom design token the component
          needs into your project's CSS file: shadcn's CLI merges the
          registry entry's <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">cssVars</code>{" "}
          block into your <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">:root</code>/
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">.dark</code> on install
          (printing "Updating CSS variables" while it does). See{" "}
          <Link
            href="/theming"
            className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            Theming
          </Link>{" "}
          for the full token table and what each one controls.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className={SECTION_LABEL}>Starting a new project</h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          From an empty directory, scaffold and initialize first, then install
          as above:
        </p>
        {/* One block, one copy, three lines — it used to be three separate
            blocks with a copy button each, so the shortest path from this
            page to a running component was three clicks and three switches
            back to the terminal for what is a single sequence. The copied
            text is exactly the three lines shown, newline-separated and with
            no trailing newline, so a paste runs the first two and leaves the
            third on the prompt for the visitor to send. */}
        <div className={`mt-3 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {NEW_PROJECT_STEPS.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </code>
          <CopyButton
            variant="inline"
            value={NEW_PROJECT_SEQUENCE}
            label="Copy all three commands"
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-ns-muted">
          The{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            -n
          </code>{" "}
          flag is what keeps this non-interactive. Without it,{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            shadcn init
          </code>{" "}
          has no project to configure and stops on a &ldquo;What is your project
          named?&rdquo; prompt. It scaffolds a Next.js app into{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            my-app/
          </code>
          , which is why the install runs from inside it.
        </p>
      </section>

      <section className="mt-10 max-w-2xl border-t border-border pt-8">
        <h2 className={SECTION_LABEL}>Before you install</h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          Every component is built against, at minimum, five CSS custom
          properties already in scope on the host app:{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --background
          </code>
          ,{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --foreground
          </code>
          ,{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --ns-muted
          </code>
          ,{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --border
          </code>
          , and{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --ns-accent
          </code>, never a
          hardcoded color, in markup or in canvas/SVG draw code. A component that
          needs more than that (a card surface, an error or status color) declares
          it in its own registry entry, and the
          install command above adds it for you; the full set of ten tokens
          the registry as a whole draws from is on{" "}
          <Link
            href="/theming"
            className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            Theming
          </Link>
          . A component that draws to a{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            &lt;canvas&gt;
          </code>{" "}
          reads these with{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            getComputedStyle
          </code>{" "}
          at mount and again on theme change, rather than baking in a color
          literal. If your project doesn't define these properties before
          installing, an installed component won't necessarily error. It may
          just render with the wrong ink, or invisible ink on one theme.
          Full detail:{" "}
          <Link
            href="/guidelines"
            className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            Guidelines
          </Link>
          , "The token rule."
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className={SECTION_LABEL}>What's assumed about your stack</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            "React 19+.",
            "Tailwind CSS v4. Every component is styled entirely with Tailwind utility classes: no shipped CSS file, no CSS-in-JS.",
            "Geist Sans / Geist Mono, inherited from the host app's own font-family rather than set by the component itself.",
            `"use client" is already on every component file, and each ships with zero or minimal npm dependencies of its own.`,
          ].map((line) => (
            <li key={line} className="flex gap-2.5 text-sm leading-6 text-ns-muted">
              <span
                aria-hidden
                className="mt-2 size-1 shrink-0 rounded-full bg-border"
              />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 max-w-2xl border-t border-border pt-8">
        <h2 className={SECTION_LABEL}>What the gate guarantees</h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          Every component in the registry passed an automated accessibility
          audit before merge: every exposed, non-disabled interactive control
          has an accessible name, a control with{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            role=switch|checkbox|radio
          </code>{" "}
          carries{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            aria-checked
          </code>
          , a visible dialog has an accessible name, and if a component
          renders any control at all, Tab reaches something. Keyboard focus
          is also required to render visibly differently from unfocused. What
          that check does and doesn't cover (presence of a name, not its wording;
          reachability, not per-element tab order) is on{" "}
          <Link
            href="/guidelines"
            className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            Guidelines
          </Link>
          .
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className={SECTION_LABEL}>Motion and performance: convention, not gate</h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          None of the following is checked by the automated gate: it has no
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            {" "}
            prefers-reduced-motion
          </code>
          , tab-visibility, or device-pixel-ratio assertion anywhere. These
          are conventions the codebase holds itself to, at varying degrees of
          consistency, not guarantees a build enforces:
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          <li className="flex gap-2.5 text-sm leading-6 text-ns-muted">
            <span
              aria-hidden
              className="mt-2 size-1 shrink-0 rounded-full bg-border"
            />
            <span>
              <strong className="font-medium text-foreground">
                prefers-reduced-motion
              </strong>{" "}
              is close to universal: 288 of 298 components respond to it,
              either with a{" "}
              <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
                matchMedia
              </code>{" "}
              check that swaps an animation for a static or discrete-step
              equivalent, or the{" "}
              <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
                motion-reduce:
              </code>{" "}
              Tailwind variant on a CSS transition. It is not universal, and
              nothing fails a build for the remaining 10.
            </span>
          </li>
          <li className="flex gap-2.5 text-sm leading-6 text-ns-muted">
            <span
              aria-hidden
              className="mt-2 size-1 shrink-0 rounded-full bg-border"
            />
            <span>
              <strong className="font-medium text-foreground">
                Device-pixel-ratio capping
              </strong>{" "}
              applies only to the canvas-based components (90 of 298 draw to a
              2D context). There is no DPR to cap on anything else. Within
              that group it&apos;s close to universal but not total: 89 of 90
              cap the ratio at 2 before sizing their canvas.
            </span>
          </li>
          <li className="flex gap-2.5 text-sm leading-6 text-ns-muted">
            <span
              aria-hidden
              className="mt-2 size-1 shrink-0 rounded-full bg-border"
            />
            <span>
              <strong className="font-medium text-foreground">
                Pausing on visibilitychange
              </strong>{" "}
              is the weakest of the three: only 63 of 298 components pause
              their render loop when the tab is hidden, and even scoped to
              just the canvas-based components it's a minority behavior (48
              of 90). Don't assume a given animated component stops rendering
              in a background tab. Check its source.
            </span>
          </li>
        </ul>
      </section>

      <footer className="mt-16 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-border pt-6 font-mono text-xs text-ns-muted">
        <Link
          href="/"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          Back to the grid
        </Link>
        <Link
          href="/theming"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          Theming
        </Link>
        <Link
          href="/guidelines"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          Guidelines
        </Link>
        <Link
          href="/connect"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          Connect
        </Link>
      </footer>
    </main>
  );
}
