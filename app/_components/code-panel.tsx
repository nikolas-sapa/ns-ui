import { CopyButton } from "@/app/_components/copy-button";

/**
 * A labelled, copyable, scrollable block of real source — the shape
 * `/components/<name>` uses to put a component's code directly under its live
 * preview.
 *
 * A Server Component, and that is the whole point of the file rather than a
 * stylistic preference: the source text is interpolated into the HTML of a
 * statically generated page, so putting one of these on all 542 component
 * pages adds nothing to the client bundle
 * (scripts/test-perf-budget.ts weighs `.next/static/chunks/**` only, and the
 * one piece of client code here — `CopyButton` — already shipped on this page
 * for the install command). Anything that made this a Client Component would
 * pull every byte of every component's source into a chunk instead.
 *
 * No syntax highlighter, matching the collapsed Source disclosure this
 * replaced: one `<pre>` of the real bytes, no theme to keep in sync, no
 * dependency. The filename is shown instead of a language chip — it is the
 * more useful fact, since the path is also where the file lives in the repo.
 */
export function CodePanel({
  label,
  path,
  code,
  copyLabel,
}: {
  /** Short eyebrow above the block ("Usage", "Component"). */
  label: string;
  /** Repo-relative path of the file, rendered as the block's subtitle. */
  path: string;
  code: string;
  /** Accessible name for the copy button — the caller knows the component's
   *  title, this component only knows a generic label. */
  copyLabel: string;
}) {
  // Trailing newline trimmed once and used for BOTH the render and the
  // clipboard value: rendered, it is an extra blank line inside the <pre>;
  // copied, it is invisible — but letting the two differ means the text on
  // screen is not quite the text on the clipboard, which is the one promise a
  // copy button makes.
  const text = code.trimEnd();
  const lines = text.split("\n").length;

  return (
    <div className="min-w-0">
      {/* `flex-wrap`: at 390px the longest paths are wider than the column
          once the label has taken its share of the row, and a path broken
          mid-token ("…compone / nt.tsx") is harder to read than one on its
          own line. Wrapped, the path gets the full width and lands
          left-aligned under the label; unwrapped, `justify-between` keeps it
          at the right edge above the copy button. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
          {label}
        </p>
        {/* `break-all` is the last resort for the handful of paths still too
            long for a line of their own at 390px — the longest in the tree is
            `registry/core/gallery-ascii-gradient-orientation/component.tsx`. */}
        <code className="min-w-0 break-all font-mono text-[11px] text-ns-muted">
          {path}
        </code>
      </div>
      {/* Same code-block shape as /install, /theming and the install command
          above: code to the left, block padding to the right, `gap-2` between.
          CopyButton's "inline" variant sizes its hit area against exactly this
          shape (see its docblock), so the padding is load-bearing. */}
      <div className="mt-2 flex items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5">
        {/* `tabIndex` + `role="region"` + a name, because this box scrolls in
            both axes: a keyboard-only visitor has no other way to reach the
            bottom of a 200-line file or the end of a long line, and an
            unnamed scrollable region is an unlabelled stop in the tab order.
            The line count is part of the name so the size of the thing being
            entered is audible, not just visible. */}
        <pre
          tabIndex={0}
          role="region"
          aria-label={`${label}, ${path}, ${lines} lines`}
          className="min-w-0 flex-1 overflow-auto rounded-sm font-mono text-[11px] leading-relaxed text-foreground outline-none max-h-[420px] focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          <code>{text}</code>
        </pre>
        <CopyButton variant="inline" value={text} label={copyLabel} />
      </div>
    </div>
  );
}
