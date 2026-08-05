import type { Metadata } from "next";
import Link from "next/link";
import registry from "@/registry.json";
import { CopyButton } from "../_components/copy-button";
import { ThemeToggle } from "../_components/theme-toggle";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// Same registry.json the categories hub and the site's counts everywhere else
// read from, so this page can never quote a number the rest of the site
// disagrees with.
const COMPONENT_COUNT = registry.items.length;
const WITH_CSS_VARS = registry.items.filter((i) => i.cssVars).length;

const title = "Installation — ns-ui";
const description =
  "Install any ns-ui component into a shadcn-configured project with one command — prerequisites, what the CLI does to your project, and framework notes.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
};

const SECTION_LABEL =
  "font-mono text-xs uppercase tracking-[0.14em] text-foreground";

const CODE_BLOCK =
  "flex items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5";

const ADD_COMMAND = `npx shadcn add ${REGISTRY_ORIGIN}/r/<name>.json`;
const INIT_COMMAND = "npx shadcn init -d";
const CLI_ADD = "npx @nikolas.sapa/ns-ui add <name>";

export default function InstallationPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
            ns-ui / installation
          </p>
          <ThemeToggle />
        </div>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          One command per component. No package to depend on.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ns-muted">
          There is no <code className="font-mono text-foreground">ns-ui</code> package to
          install. Every one of the {COMPONENT_COUNT} components is a shadcn registry item —{" "}
          <code className="font-mono text-foreground">npx shadcn add</code> fetches its
          source and drops it straight into your project, yours to edit from that point on.
        </p>
      </header>

      <section className="mt-16">
        <h2 className={SECTION_LABEL}>Prerequisites</h2>
        <ul className="mt-4 flex flex-col gap-2.5">
          {[
            <>
              A React project on <span className="text-foreground">Tailwind CSS v4</span>.
              Components are styled entirely with Tailwind utility classes — no shipped CSS
              file, no CSS-in-JS.
            </>,
            <>
              A <code className="font-mono text-foreground">components.json</code>, i.e. the
              project has already run{" "}
              <code className="font-mono text-foreground">shadcn init</code> at least once
              (any style, any base color — ns-ui doesn&apos;t require a specific shadcn
              preset).
            </>,
            <>
              Node 18+ to run <code className="font-mono text-foreground">npx</code>.
            </>,
          ].map((text, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-6 text-ns-muted">
              <span
                aria-hidden
                className="mt-2 size-1 shrink-0 rounded-full bg-border"
              />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ns-muted">
          No project yet? <code className="font-mono text-foreground">shadcn init -d</code>{" "}
          scaffolds one with defaults, no prompts:
        </p>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {INIT_COMMAND}
          </code>
          <CopyButton variant="inline" value={INIT_COMMAND} label="Copy init command" />
        </div>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>Install a component</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Every component page and card on this site shows its exact install command. The
          shape is always the same, pointed at this registry&apos;s origin:
        </p>
        <div className={`mt-4 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {ADD_COMMAND}
          </code>
          <CopyButton variant="inline" value={ADD_COMMAND} label="Copy install command" />
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ns-muted">
          That single command does three things:
        </p>
        <ol className="mt-4 flex flex-col gap-3">
          <li className="flex gap-3 text-sm leading-6 text-ns-muted">
            <span className="font-mono text-xs text-ns-accent">1</span>
            <span>
              Writes the component&apos;s source to{" "}
              <code className="font-mono text-foreground">components/ui/&lt;name&gt;.tsx</code>{" "}
              (or wherever your <code className="font-mono text-foreground">components.json</code>{" "}
              aliases point).
            </span>
          </li>
          <li className="flex gap-3 text-sm leading-6 text-ns-muted">
            <span className="font-mono text-xs text-ns-accent">2</span>
            <span>
              Installs the component&apos;s npm dependencies, if it has any (most have zero
              or one).
            </span>
          </li>
          <li className="flex gap-3 text-sm leading-6 text-ns-muted">
            <span className="font-mono text-xs text-ns-accent">3</span>
            <span>
              Merges the component&apos;s design tokens into your project&apos;s CSS file —{" "}
              {WITH_CSS_VARS} of {COMPONENT_COUNT} components declare a{" "}
              <code className="font-mono text-foreground">cssVars</code> block in their
              registry entry, and shadcn&apos;s CLI writes those custom properties into your{" "}
              <code className="font-mono text-foreground">:root</code>/
              <code className="font-mono text-foreground">.dark</code> for you (it prints
              "Updating CSS variables" while it does). See{" "}
              <Link
                href="/theming"
                className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
              >
                /theming
              </Link>{" "}
              for what those tokens are and what they control.
            </span>
          </li>
        </ol>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ns-muted">
          That third step covers the custom{" "}
          <code className="font-mono text-foreground">--ns-*</code> tokens a component needs
          beyond the ones shadcn&apos;s own init already sets up. It does not add anything for{" "}
          <code className="font-mono text-foreground">--background</code>,{" "}
          <code className="font-mono text-foreground">--foreground</code> or{" "}
          <code className="font-mono text-foreground">--border</code> — every component
          assumes those three already exist under those exact names, matching stock shadcn.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Installing more than one component at once, from a terminal: the{" "}
          <code className="font-mono text-foreground">ns-ui</code> CLI (
          <code className="font-mono text-foreground">@nikolas.sapa/ns-ui</code>) wraps the
          same <code className="font-mono text-foreground">shadcn add</code> call, once per
          name, and fails fast on a typo with a "did you mean" instead of handing it straight
          to shadcn:
        </p>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
            {CLI_ADD}
          </code>
          <CopyButton variant="inline" value={CLI_ADD} label="Copy CLI add command" />
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ns-muted">
          If <code className="font-mono text-foreground">npx</code> refuses either package
          with "No versions available", that&apos;s npm&apos;s own{" "}
          <code className="font-mono text-foreground">minimum-release-age</code> setting on
          your machine rejecting a recently-published package, not a problem with the
          package. Wait out the window or override the policy locally.
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>Framework notes</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Every component is <code className="font-mono text-foreground">&quot;use client&quot;</code>{" "}
          and built against React 19. Next.js App Router needs nothing extra — the directive
          is already in the file. A component that reads or writes{" "}
          <code className="font-mono text-foreground">localStorage</code>, canvas, or another
          browser-only API does so inside an effect, not at module scope, so it doesn&apos;t
          break server rendering on mount.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Fonts: components inherit <code className="font-mono text-foreground">font-family</code>{" "}
          from the host app rather than setting their own. This site uses Geist Sans and
          Geist Mono; a project on a different font stack still gets a correctly themed
          component, just rendered in its own typeface.
        </p>
      </section>

      <footer className="mt-24 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-border pt-6 font-mono text-xs text-ns-muted">
        <Link
          href="/"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Back to the grid
        </Link>
        <Link
          href="/theming"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Theming
        </Link>
        <Link
          href="/connect"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Connect
        </Link>
      </footer>
    </main>
  );
}
