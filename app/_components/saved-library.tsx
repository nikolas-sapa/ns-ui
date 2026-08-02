"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CopyButton } from "./copy-button";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

type Folder = { id: string; name: string; slugs: string[] };
type Item = { name: string; title: string; description: string };

export function SavedLibrary({ items, slugs, initialFolders }: { items: Item[]; slugs: string[]; initialFolders: Folder[] }) {
  const [folders, setFolders] = useState(initialFolders);
  const [selected, setSelected] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
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
    setFolders((current) => [...current, { id: data.id!, name: data.name!, slugs: [] }]);
    setSelected(data.id);
    setNewFolder("");
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
      {visible.length === 0 ? <p className="mt-6 text-sm text-muted">{selected === "all" ? "Nothing saved yet." : "This folder is empty."}</p> : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
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
