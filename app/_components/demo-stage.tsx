/**
 * The bordered, iframed stage that presents a component's live demo, used by
 * `/components/<name>` (directly under the header, full site chrome) — the
 * one canonical page per component. Formerly shared with `/preview/<name>/play`
 * before that route was folded into this one; kept as its own component
 * rather than inlined so the frame itself (border, card background, iframe
 * sizing) still has one source of truth if another page ever needs it.
 *
 * Always iframes `/preview/<name>?embed=1&interactive=1` — the bare
 * verification fixture — rather than mounting `DemoFrame` inline. That's
 * load-bearing, not cosmetic: inside an iframe, a demo root's own
 * `min-h-screen` resolves against the iframe's own box instead of the real
 * page viewport, so the component renders at its natural height with
 * nothing to bound or crop — no `h-full!`/`min-h-full!`/`*-safe!` override
 * soup required, and no risk of the demo's own content (a hero's title,
 * copy, CTA) landing below a fixed well's fold. `embed=1` keeps the demo
 * inert and out of the host page's tab order; `interactive=1` opts back into
 * uninert so a visitor can actually use it — see `DemoFrame` for why both
 * exist.
 */
export function DemoStage({ name, title }: { name: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <iframe
        key={name}
        src={`/preview/${name}?embed=1&interactive=1`}
        title={`${title} — interactive`}
        className="h-[min(76vh,620px)] min-h-[520px] w-full border-0 bg-transparent"
      />
    </div>
  );
}
