// Hover/focus hint on the Save button for signed-out visitors. Presentation
// only — `SaveButton` still owns the click, and the reason the popover is
// pure CSS (`group-hover` / `group-focus-within` on a wrapper that contains
// both the button and this) rather than React state is the pointer-crossing
// gap: with hover state in JS you need an open/close delay so moving the
// cursor from the button into the popover doesn't flash it shut. Nesting it
// inside the hovered element removes the gap instead of timing around it.
//
// Not `"use client"`: no hooks, no handlers. It renders inside a client
// component and stays server-renderable on its own.
export function SignInSavePopover({ id }: { id: string }) {
  return (
    <span
      id={id}
      role="tooltip"
      // `invisible` (not just opacity-0) keeps it out of the hit-test and
      // the a11y tree while hidden — an opacity-0 overlay still swallows
      // clicks aimed at the card underneath it.
      className="pointer-events-none invisible absolute right-0 top-full z-30 mt-1.5 w-max max-w-[12rem] rounded-sm border border-border bg-surface px-2 py-1.5 text-left opacity-0 shadow-sm transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    >
      <span className="block text-[11px] leading-4 text-foreground">
        Sign in to save.
      </span>
    </span>
  );
}
