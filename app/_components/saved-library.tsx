"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CopyButton } from "./copy-button";
import { LivePreviewFrame } from "./live-preview-frame";
import { useMountManager } from "./use-mount-manager";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

/**
 * How many saved previews may run at once. Lower than the homepage catalog's
 * MOUNT_CAP (12) — this grid is 2-3 columns of much smaller cards, and a
 * saved library can grow to be the largest grid on the site, so eviction
 * matters more here, not less. Same "never evict what's on screen" rule as
 * the homepage (see use-mount-manager.ts); this only shrinks the off-screen
 * preload budget.
 */
const MOUNT_CAP = 9;

/** Mount a preview this far outside the viewport so it's already run a beat
 *  before it scrolls into view. Smaller than the homepage's 600px — these
 *  cards are smaller too, so less runway is needed to stay ahead of scroll. */
const PRELOAD_MARGIN = 400;

type Folder = { id: string; name: string; slugs: string[]; isPublic: boolean };
type Item = { name: string; title: string; description: string };

export function SavedLibrary({ items, slugs, initialFolders, handle }: { items: Item[]; slugs: string[]; initialFolders: Folder[]; handle: string | null }) {
  const [folders, setFolders] = useState(initialFolders);
  const [selected, setSelected] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  const [publishPending, setPublishPending] = useState(false);
  // §8.1: "Publishing a collection prompts once, in plain words, that this
  // also makes /u/<handle> visible." Turning publish OFF needs no such
  // prompt — nothing new becomes visible by making something private again.
  // Tracks which folder id is mid-confirmation, same two-step shape as
  // `account-delete.tsx`'s `confirming` (a second, differently worded
  // control in place of the first, no modal).
  const [confirmingPublish, setConfirmingPublish] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const { registerRef, isActive, isOnScreen } = useMountManager({ mountCap: MOUNT_CAP, preloadMargin: PRELOAD_MARGIN });
  const byName = useMemo(() => new Map(items.map((item) => [item.name, item])), [items]);
  const folder = folders.find((entry) => entry.id === selected);
  const visibleSlugs = selected === "all" ? slugs : folder?.slugs ?? [];
  const visible = visibleSlugs.map((slug) => byName.get(slug)).filter((item): item is Item => item !== undefined);
  // Counts must come from the same registry-resolved set the grid renders,
  // otherwise a save whose slug no longer resolves shows as "All saves 3"
  // above "Nothing saved yet."
  const resolvedCount = (list: string[]) => list.filter((slug) => byName.has(slug)).length;

  async function createFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const name = newFolder.trim();
    if (!name || creating) return;
    setCreating(true);
    let response: Response;
    let data: { id?: string; name?: string; error?: string };
    try {
      response = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      data = (await response.json().catch(() => ({}))) as { id?: string; name?: string; error?: string };
    } catch {
      setError("Could not create folder.");
      setCreating(false);
      return;
    }
    setCreating(false);
    if (!response.ok || !data.id || !data.name) {
      setError(data.error === "folder_exists" ? "That folder already exists." : "Could not create folder.");
      return;
    }
    setFolders((current) => [...current, { id: data.id!, name: data.name!, slugs: [], isPublic: false }]);
    setSelected(data.id);
    setNewFolder("");
  }

  async function togglePublish(folderId: string, nextIsPublic: boolean) {
    setPublishPending(true);
    setError("");
    const response = await fetch("/api/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", folderId, isPublic: nextIsPublic }),
    });
    const data = (await response.json().catch(() => ({}))) as { isPublic?: boolean; error?: string };
    if (!response.ok || typeof data.isPublic !== "boolean") {
      setError(
        data.error === "no_profile"
          ? "Claim a handle before publishing a folder."
          : "Could not update this folder's visibility.",
      );
      setPublishPending(false);
      return;
    }
    setFolders((current) =>
      current.map((entry) => (entry.id === folderId ? { ...entry, isPublic: data.isPublic! } : entry)),
    );
    setPublishPending(false);
    setConfirmingPublish(null);
  }

  async function move(slug: string, folderId: string | null) {
    setPending(slug);
    setError("");
    const response = await fetch("/api/folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", slug, folderId }) });
    if (response.ok) {
      setFolders((current) => current.map((entry) => ({ ...entry, slugs: entry.slugs.filter((item) => item !== slug).concat(entry.id === folderId ? [slug] : []) })));
    } else {
      setError("Could not move this save.");
    }
    setPending(null);
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <button type="button" aria-pressed={selected === "all"} onClick={() => setSelected("all")} className={`rounded-sm px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ns-accent ${selected === "all" ? "bg-foreground text-background" : "border border-border text-ns-muted hover:text-foreground"} transition-colors`}>All saves <span className="font-mono">{resolvedCount(slugs)}</span></button>
        {folders.map((entry) => <button key={entry.id} type="button" aria-pressed={selected === entry.id} onClick={() => setSelected(entry.id)} className={`rounded-sm px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ns-accent ${selected === entry.id ? "bg-foreground text-background" : "border border-border text-ns-muted hover:text-foreground"} transition-colors`}>{entry.name} <span className="font-mono">{resolvedCount(entry.slugs)}</span></button>)}
        <form onSubmit={createFolder} className="ml-auto flex items-center gap-1.5">
          <label htmlFor="new-folder" className="sr-only">New folder name</label>
          <input id="new-folder" value={newFolder} onChange={(event) => setNewFolder(event.target.value)} disabled={creating} maxLength={40} placeholder="New folder" className="w-28 rounded-sm border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-60" />
          <button type="submit" disabled={creating} className="rounded-sm border border-border px-2.5 py-1.5 text-xs text-foreground outline-none hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-60 transition-colors">{creating ? "Adding…" : "Add"}</button>
        </form>
      </div>
      {error ? <p role="alert" className="mt-3 text-xs text-[var(--error)]">{error}</p> : null}
      {folder ? (
        <div className="mt-4 rounded-sm border border-border bg-surface px-3 py-2.5">
          {folder.isPublic ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-xs text-foreground">
                {/* Decorative only — "Unpublish" below is the real,
                    operable control. A `role="switch"` here with no handler
                    would announce a switch a screen reader user can't
                    actually flip. */}
                <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-ns-accent bg-ns-accent text-white">
                  <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
                </span>
                Published — anyone with the link can view this folder and your profile
              </span>
              {handle ? (
                <Link href={`/u/${handle}`} className="rounded-sm px-2 py-1 text-xs text-ns-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ns-accent">
                  View public profile
                </Link>
              ) : null}
              <button
                type="button"
                disabled={publishPending}
                onClick={() => void togglePublish(folder.id, false)}
                className="rounded-sm border border-border px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-60"
              >
                {publishPending ? "Unpublishing…" : "Unpublish"}
              </button>
            </div>
          ) : confirmingPublish === folder.id ? (
            <div className="space-y-2">
              <p className="text-xs text-foreground">
                Publishing “{folder.name}” makes it — and your public profile page at{" "}
                <span className="font-mono">/u/{handle ?? "…"}</span> (display name, bio, url, tags,
                avatar) — visible to anyone with the link. Nothing else you saved becomes visible.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={publishPending}
                  onClick={() => void togglePublish(folder.id, true)}
                  className="rounded-sm border border-ns-accent bg-ns-accent px-3 py-1.5 text-xs font-medium text-white outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:pointer-events-none"
                >
                  {publishPending ? "Publishing…" : "Publish"}
                </button>
                <button
                  type="button"
                  disabled={publishPending}
                  onClick={() => setConfirmingPublish(null)}
                  className="rounded-sm border border-border px-3 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-ns-muted">
              <span>Not published — only you can see this folder</span>
              <button
                type="button"
                onClick={() => setConfirmingPublish(folder.id)}
                className="rounded-sm border border-border px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent"
              >
                Publish…
              </button>
            </div>
          )}
        </div>
      ) : null}
      {visible.length === 0 ? <p className="mt-6 text-sm text-ns-muted">{selected === "all" ? "Nothing saved yet." : "This folder is empty."}</p> : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const currentFolder = folders.find((entry) => entry.slugs.includes(item.name));
            const installCommand = `npx shadcn add ${REGISTRY_ORIGIN}/r/${item.name}.json`;
            return (
              <SavedCard
                key={item.name}
                item={item}
                active={isActive(item.name)}
                onScreen={isOnScreen(item.name)}
                registerRef={registerRef}
              >
                <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                  <label htmlFor={`folder-${item.name}`} className="text-[11px] text-ns-muted">Folder</label>
                  <select id={`folder-${item.name}`} value={currentFolder?.id ?? ""} disabled={pending === item.name} onChange={(event) => void move(item.name, event.target.value || null)} className="min-w-0 flex-1 rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ns-accent">
                    <option value="">Unfiled</option>
                    {folders.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                  <CopyButton value={installCommand} label={`Copy install command for ${item.title}`} />
                  <Link href={`/components/${item.name}`} className="rounded-sm px-2 py-1 text-xs text-ns-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors">Open preview</Link>
                </div>
              </SavedCard>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * One saved card: a live, smaller version of the homepage's preview
 * (`preview-card.tsx`) — same `LivePreviewFrame`, same lazy-mount discipline
 * via the mount manager passed in from `SavedLibrary` — followed by the
 * title/description and, via `children`, the Folder/copy/open-preview row
 * SavedLibrary still owns (it needs the folder list and move handler, which
 * this component has no reason to know about).
 */
function SavedCard({
  item,
  active,
  onScreen,
  registerRef,
  children,
}: {
  item: Item;
  active: boolean;
  /** True viewport visibility — see `LivePreviewFrame`'s `onScreen`. */
  onScreen: boolean;
  registerRef: (name: string, el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const setCardRef = useCallback(
    (el: HTMLElement | null) => registerRef(item.name, el),
    [registerRef, item.name],
  );
  return (
    <li
      ref={setCardRef}
      data-name={item.name}
      className="overflow-hidden rounded-md border border-border bg-surface"
    >
      {/* `group/card` scoped to the Link only — the Folder/copy/Open-preview
          row below is a sibling, not part of this hit area, and before this
          the hover glow was scoped to the whole `<li>`, so the footer's dead
          space (the "Folder" label, the gaps) lit up on hover with no click
          behind it. */}
      <Link
        href={`/components/${item.name}`}
        className="group/card block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ns-accent"
      >
        <LivePreviewFrame
          name={item.name}
          title={item.title}
          active={active}
          onScreen={onScreen}
          className="aspect-[16/10] w-full rounded-none border-0 border-b border-border"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 rounded-none bg-foreground/0 transition-colors duration-200 group-hover/card:bg-foreground/[0.04] motion-reduce:transition-none"
          />
        </LivePreviewFrame>
        <div className="px-4 py-3 transition-colors group-hover/card:bg-foreground/[0.03]">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ns-muted">{item.description}</p>
        </div>
      </Link>
      {children}
    </li>
  );
}
