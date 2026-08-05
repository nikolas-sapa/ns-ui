"use client";

import { useState } from "react";
import { BurrChip } from "./component";

export default function BurrChipDemo() {
  const [tags, setTags] = useState<string[]>([
    "design",
    "engineering",
    "urgent",
    "2026-q3",
    "ops",
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / tag-input-pull — pull a chip loose, don&apos;t just delete it
      </p>

      <div className="w-full max-w-md">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Recipients
        </label>
        <BurrChip
          value={tags}
          onChange={setTags}
          aria-label="Recipients"
          inputLabel="Add recipient"
          placeholder="Add a recipient…"
        />
        <p className="mt-3 font-mono text-xs text-ns-muted">
          {tags.length} tag{tags.length === 1 ? "" : "s"}
        </p>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Click a chip&apos;s × to watch it stretch and pop free — the row
        exhales closed after. Or grab a chip and pull; release past the
        threshold to commit, or let go early and it eases back. Focus a chip
        and use Left/Right to move between them, Backspace/Delete to remove
        the focused one.
      </p>
    </div>
  );
}
