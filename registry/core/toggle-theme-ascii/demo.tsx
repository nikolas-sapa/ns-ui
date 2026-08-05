"use client";

import { ThemeToggleAscii } from "./component";

export default function ThemeToggleAsciiDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / toggle-theme-ascii
      </p>
      <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-surface px-10 py-8">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-ns-muted">
          appearance
        </span>
        {/* `storageKey` is overridden and NOT left at its default, which is
            `ns-ui-theme` — byte-identical to this site's own
            THEME_STORAGE_KEY (lib/theme.ts). The catalog renders every demo
            in a same-origin iframe and the autoplay driver presses this
            control on a loop, so the default key had each pass overwrite the
            visitor's real theme preference. localStorage is shared across
            same-origin frames, so the iframe boundary does not contain it:
            the site read the mutated value and flipped light/dark seemingly
            at random while scrolling the catalog. Keeping `syncDocument` on
            is deliberate — it is the component's actual behaviour and worth
            demonstrating — it just must not write the key the host reads. */}
        <ThemeToggleAscii storageKey="ns-ui-theme-demo" />
      </div>
      <p className="max-w-md text-center text-xs text-ns-muted">
        The chip is painted in the negative of the current theme's real
        token colors — it previews almost exactly what the page will look
        like the instant you click it.
      </p>
    </div>
  );
}
