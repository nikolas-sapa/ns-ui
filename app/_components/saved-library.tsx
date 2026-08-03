"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CopyButton } from "./copy-button";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

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
  const [error, setError] = useState("");
  const byName = useMemo(() => new Map(items.map((item) => [item.name, item])), [items]);
  const folder = folders.find((entry) => entry.id === selected);
  const visibleSlugs = selected === "all" ? slugs : folder?.slugs ?? [];
  const visible = visibleSlugs.map((slug) => byName.get(slug)).filter((item): item is Item => item !== undefined);

  async function createFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const name = newFolder.trim();
    if (!name) return;
    const response = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = (await response.json().catch(() => ({}))) as { id?: string; name?: string; error?: string };
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
        <button type="button" onClick={() => setSelected("all")} className={`rounded-sm px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected === "all" ? "bg-foreground text-background" : "border border-border text-muted hover:text-foreground"}`}>All saves <span className="font-mono">{slugs.length}</span></button>
        {folders.map((entry) => <button key={entry.id} type="button" onClick={() => setSelected(entry.id)} className={`rounded-sm px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected === entry.id ? "bg-foreground text-background" : "border border-border text-muted hover:text-foreground"}`}>{entry.name} <span className="font-mono">{entry.slugs.length}</span></button>)}
        <form onSubmit={createFolder} className="ml-auto flex items-center gap-1.5">
          <label htmlFor="new-folder" className="sr-only">New folder name</label>
          <input id="new-folder" value={newFolder} onChange={(event) => setNewFolder(event.target.value)} maxLength={40} placeholder="New folder" className="w-28 rounded-sm border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent" />
          <button type="submit" className="rounded-sm border border-border px-2.5 py-1.5 text-xs text-foreground outline-none hover:border-muted focus-visible:ring-2 focus-visible:ring-accent">Add</button>
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
                <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-accent bg-accent text-white">
                  <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
                </span>
                Published — anyone with the link can view this folder and your profile
              </span>
              {handle ? (
                <Link href={`/u/${handle}`} className="rounded-sm px-2 py-1 text-xs text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent">
                  View public profile
                </Link>
              ) : null}
              <button
                type="button"
                disabled={publishPending}
                onClick={() => void togglePublish(folder.id, false)}
                className="rounded-sm border border-border px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
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
                  className="rounded-sm border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                >
                  {publishPending ? "Publishing…" : "Publish"}
                </button>
                <button
                  type="button"
                  disabled={publishPending}
                  onClick={() => setConfirmingPublish(null)}
                  className="rounded-sm border border-border px-3 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>Not published — only you can see this folder</span>
              <button
                type="button"
                onClick={() => setConfirmingPublish(folder.id)}
                className="rounded-sm border border-border px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent"
              >
                Publish…
              </button>
            </div>
          )}
        </div>
      ) : null}
      {visible.length === 0 ? <p className="mt-6 text-sm text-muted">{selected === "all" ? "Nothing saved yet." : "This folder is empty."}</p> : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const currentFolder = folders.find((entry) => entry.slugs.includes(item.name));
            const installCommand = `npx shadcn add ${REGISTRY_ORIGIN}/r/${item.name}.json`;
            return (
              <li key={item.name} className="overflow-hidden rounded-md border border-border bg-surface">
                <Link href={`/preview/${item.name}/play`} className="group block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                  <div className="border-b border-border px-4 py-5 transition-colors group-hover:bg-foreground/[0.03]">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Saved component</p>
                    <h3 className="mt-2 text-sm font-semibold tracking-tight text-foreground">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{item.description}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                  <label htmlFor={`folder-${item.name}`} className="text-[11px] text-muted">Folder</label>
                  <select id={`folder-${item.name}`} value={currentFolder?.id ?? ""} disabled={pending === item.name} onChange={(event) => void move(item.name, event.target.value || null)} className="min-w-0 flex-1 rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <option value="">Unfiled</option>
                    {folders.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                  <CopyButton value={installCommand} label={`Copy install command for ${item.title}`} />
                  <Link href={`/preview/${item.name}/play`} className="rounded-sm px-2 py-1 text-xs text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent">Open preview</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
