import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "../_components/copy-button";
import { ThemeToggle } from "../_components/theme-toggle";

const title = "Theming · ns-ui";
const description =
  "Every --ns-* token in the registry: what it controls, its light/dark values, how to override it, and why it's namespaced instead of reusing stock shadcn tokens.";

export const metadata: Metadata = {
  alternates: { canonical: "/theming" },
  title,
  description,
  openGraph: { title, description },
};

const SECTION_LABEL =
  "font-mono text-xs uppercase tracking-[0.14em] text-foreground";

const CODE_BLOCK =
  "flex items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5";

type TokenRow = {
  name: string;
  light: string;
  dark: string;
  role: string;
};

// Verbatim from app/globals.css :root and .dark — the only two blocks that
// define these values. If a value changes there, it goes stale here too.
const TOKENS: TokenRow[] = [
  { name: "--background", light: "#ffffff", dark: "#0a0a0a", role: "Page background." },
  { name: "--foreground", light: "#171717", dark: "#ededed", role: "Body text." },
  {
    name: "--surface",
    light: "#fafafa",
    dark: "#171717",
    role: "Elevated surfaces: cards, code blocks, inset panels.",
  },
  { name: "--border", light: "#ebebeb", dark: "#2e2e2e", role: "Hairlines and dividers." },
  {
    name: "--ns-muted",
    light: "#4d4d4d",
    dark: "#8f8f8f",
    role: "Secondary text: descriptions, captions, eyebrows.",
  },
  {
    name: "--ns-accent",
    light: "#006bff",
    dark: "#006bff",
    role: "The brand blue. Links, active states, primary actions.",
  },
  {
    name: "--ns-accent-hover",
    light: "#0059d1",
    dark: "#0059d1",
    role: "Hover/pressed state for anything using --ns-accent.",
  },
  {
    name: "--error",
    light: "#ea001d",
    dark: "#ff6369",
    role: "Destructive actions, invalid state, failure text.",
  },
  {
    name: "--success",
    light: "#2d7a2d",
    dark: "#47a447",
    role: "Positive/confirmation state.",
  },
  {
    name: "--warning",
    light: "#7a5200",
    dark: "#f5a623",
    role: "Caution state. Never a brand accent.",
  },
];

const GLOBALS_ROOT = `:root {
  color-scheme: light;
  --background: #ffffff;
  --foreground: #171717;
  --surface: #fafafa;
  --border: #ebebeb;
  --ns-muted: #4d4d4d;
  --ns-accent: #006bff;
  --ns-accent-hover: #0059d1;
  --error: #ea001d;
  --success: #2d7a2d;
  --warning: #7a5200;
}

.dark {
  color-scheme: dark;
  --background: #0a0a0a;
  --foreground: #ededed;
  --surface: #171717;
  --border: #2e2e2e;
  --ns-muted: #8f8f8f;
  --error: #ff6369;
  --success: #47a447;
  --warning: #f5a623;
}`;

const THEME_INLINE = `@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-border: var(--border);
  --color-ns-muted: var(--ns-muted);
  --color-ns-accent: var(--ns-accent);
  --color-ns-accent-hover: var(--ns-accent-hover);
}`;

export default function ThemingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
            ns-ui / theming
          </p>
          <ThemeToggle />
        </div>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          Ten tokens, two themes.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ns-muted">
          Every component reads color from CSS custom properties already in scope, never a
          hardcoded hex, whether in markup or in canvas/SVG draw code. This is the full list, what
          each one controls, and how to change what they resolve to.
        </p>
      </header>

      <section className="mt-16">
        <h2 className={SECTION_LABEL}>The tokens</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Values as this site defines them (<code className="font-mono text-foreground">app/globals.css</code>).
          A consuming project can set these to anything: the names and what they mean are
          the contract, not the hex values below.
        </p>
        <div className="mt-5 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left font-mono text-[11px] uppercase tracking-wider text-ns-muted">
                <th className="px-3.5 py-2.5 font-normal">Token</th>
                <th className="px-3.5 py-2.5 font-normal">Light</th>
                <th className="px-3.5 py-2.5 font-normal">Dark</th>
                <th className="px-3.5 py-2.5 font-normal">Controls</th>
              </tr>
            </thead>
            <tbody>
              {TOKENS.map((t, i) => (
                <tr
                  key={t.name}
                  className={i < TOKENS.length - 1 ? "border-b border-border" : ""}
                >
                  <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-xs text-foreground">
                    {t.name}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-xs text-ns-muted">
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block size-2.5 rounded-full border border-border align-middle"
                      style={{ background: t.light }}
                    />
                    {t.light}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-xs text-ns-muted">
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block size-2.5 rounded-full border border-border align-middle"
                      style={{ background: t.dark }}
                    />
                    {t.dark}
                  </td>
                  <td className="px-3.5 py-2.5 text-xs leading-5 text-ns-muted">{t.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ns-muted">
          <code className="font-mono text-foreground">--ns-accent</code> and{" "}
          <code className="font-mono text-foreground">--ns-accent-hover</code> are the same
          value in both themes. The brand blue is deliberately theme-invariant, everything
          else here is not.
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>Three tokens with a narrower job than their name</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Reading the right variable is not the same as using it for the right job. These
          three are the ones this registry gets wrong most often. Every ratio below is a
          WCAG contrast figure computed from the values in the table above.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ns-muted">
          <code className="font-mono text-foreground">--border</code> is a separator, not a
          fill. In light theme it measures 1.19:1 against{" "}
          <code className="font-mono text-foreground">--background</code>, a hairline and
          nothing more. Fill a shape with it, stroke a chart with it, or draw canvas ink in
          it and the result is invisible in light while looking correct in dark, where it
          reaches 1.46:1. For a faint but legible mark, use{" "}
          <code className="font-mono text-foreground">--foreground</code> at low alpha.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          <code className="font-mono text-foreground">--ns-accent</code> is interaction
          chrome only: buttons, links, focus rings, active states. Not an ambient highlight,
          not a pointer trail, not a component&apos;s climactic moment. A resting screenshot
          is not an interaction. Pointer highlights vary luminance, never hue.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          <code className="font-mono text-foreground">--ns-muted</code> is a second ink at
          full strength, for secondary text and captions, and it is entirely correct used
          that way. It is not a variable-strength wash. Its contrast ceiling is
          theme-dependent, 8.45:1 in light against 6.12:1 in dark, so a mid-strength wash
          looks acceptable in both themes today and fails in dark first the moment anyone
          strengthens it, in a change that never touched the component. Use it at full
          strength, or use <code className="font-mono text-foreground">--foreground</code>{" "}
          at an explicit alpha where you control both ends.
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>Two layers, not one</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          A component's markup never writes{" "}
          <code className="font-mono text-foreground">var(--ns-muted)</code> directly. It
          uses a Tailwind utility, <code className="font-mono text-foreground">text-ns-muted</code>
          . That utility only exists because it's registered in a second block, separate from
          the custom property itself:
        </p>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          Layer 1: the raw custom properties
        </p>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-6 text-foreground">
            {GLOBALS_ROOT}
          </pre>
          <CopyButton variant="inline" value={GLOBALS_ROOT} label="Copy :root and .dark block" />
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          Layer 2: the Tailwind utility mapping
        </p>
        <div className={`mt-2 ${CODE_BLOCK}`}>
          <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-6 text-foreground">
            {THEME_INLINE}
          </pre>
          <CopyButton variant="inline" value={THEME_INLINE} label="Copy @theme inline block" />
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Tailwind v4's <code className="font-mono text-foreground">@theme inline</code>{" "}
          generates <code className="font-mono text-foreground">text-*</code>/
          <code className="font-mono text-foreground">bg-*</code>/
          <code className="font-mono text-foreground">border-*</code> utilities from{" "}
          <code className="font-mono text-foreground">--color-*</code> variables, resolved at
          build time. Copy only the <code className="font-mono text-foreground">:root</code>/
          <code className="font-mono text-foreground">.dark</code> block into a project and
          the custom properties exist, but{" "}
          <code className="font-mono text-foreground">text-ns-muted</code> doesn&apos;t.
          Tailwind never sees a reason to generate it. The component renders with no error
          and no color: unstyled ink. Both blocks have to land together.
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>Light and dark</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Dark mode is a <code className="font-mono text-foreground">.dark</code> class on{" "}
          <code className="font-mono text-foreground">&lt;html&gt;</code>, not a media query.
          Every token above is redeclared inside <code className="font-mono text-foreground">.dark</code>{" "}
          and the cascade does the rest. <code className="font-mono text-foreground">color-scheme</code>{" "}
          is set alongside it (<code className="font-mono text-foreground">light</code> in{" "}
          <code className="font-mono text-foreground">:root</code>,{" "}
          <code className="font-mono text-foreground">dark</code> in{" "}
          <code className="font-mono text-foreground">.dark</code>) so native browser chrome (the scrollbar, a native{" "}
          <code className="font-mono text-foreground">&lt;select&gt;</code> panel, autofill
          backgrounds) follows the same theme instead of staying light
          against a dark page.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Every component in the registry is verified in both themes, and the gate hard-fails
          a component whose light and dark render as byte-identical screenshots. That only
          catches a component that ignored theming entirely, not one that merely looks wrong
          in light. Whatever theme you ship, look at both yourself before calling it done.
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>Overriding a value</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Change what a token resolves to by redeclaring it in your own{" "}
          <code className="font-mono text-foreground">:root</code>/
          <code className="font-mono text-foreground">.dark</code>. Components read the
          variable, not a specific value, so a different{" "}
          <code className="font-mono text-foreground">--ns-accent</code> re-themes every
          installed component that uses it, with no component code to touch. This is also
          what running <Link
            href="/install"
            className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            <code className="font-mono text-foreground">shadcn add</code>
          </Link>{" "}
          does automatically the first time you install a component that needs a token you
          don&apos;t have yet: it merges that token into your CSS file rather than failing or
          silently doing nothing.
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className={SECTION_LABEL}>Why --ns-* and not --muted / --accent</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Stock shadcn already ships tokens named <code className="font-mono text-foreground">--muted</code>{" "}
          and <code className="font-mono text-foreground">--accent</code>, but as neutral
          surface colors: a muted background and a subtle hover background, each with its
          own <code className="font-mono text-foreground">-foreground</code> pair for text on
          top of them. This registry needed different things under similar-sounding names:{" "}
          <code className="font-mono text-foreground">--ns-muted</code> is a text color
          (secondary body text, captions), and{" "}
          <code className="font-mono text-foreground">--ns-accent</code> is the brand blue
          used as a foreground/ink color on links and active states, not a background.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ns-muted">
          Reusing the stock names would mean a component's{" "}
          <code className="font-mono text-foreground">text-accent</code> resolves to whatever
          neutral hover-surface color a project's own shadcn setup already defined for{" "}
          <code className="font-mono text-foreground">--accent</code>. There is no error,
          because the property exists and just holds the wrong kind of color for the job. Namespacing under <code className="font-mono text-foreground">--ns-*</code>{" "}
          keeps the two vocabularies from ever aliasing each other: a project can define both
          shadcn&apos;s own tokens and ns-ui&apos;s side by side with no collision.
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
          href="/install"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Install
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
