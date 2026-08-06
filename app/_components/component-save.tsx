"use client";

// Save control for a single component's detail page. `Showcase` owns this
// state for the whole grid (one `/api/saves` read for every card); a detail
// page has exactly one slug, so it does the same read for itself rather than
// mounting the catalog's state machine.
//
// Same endpoint and same optimistic-with-rollback contract as the grid — see
// `showcase.tsx`. Auth state comes from `/api/saves` returning 401, never
// from a client-side Convex auth hook (§6.1a / A27).
import { useCallback, useEffect, useState } from "react";
import { SaveButton } from "./save-button";

export function ComponentSave({ name }: { name: string }) {
  const [saved, setSaved] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let disposed = false;
    fetch("/api/saves")
      .then(async (res) => {
        if (disposed) return;
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (!res.ok) throw new Error("save list failed");
        const data = (await res.json()) as { slugs?: unknown };
        const slugs = Array.isArray(data.slugs) ? data.slugs : [];
        if (disposed) return;
        setSaved(slugs.includes(name));
        setAuthenticated(true);
      })
      .catch(() => {
        if (!disposed) setAuthenticated(false);
      });
    return () => {
      disposed = true;
    };
  }, [name]);

  const toggle = useCallback(async () => {
    if (authenticated !== true || pending) return;
    const wasSaved = saved;
    setPending(true);
    setSaved(!wasSaved);
    try {
      const res = await fetch("/api/saves", {
        method: wasSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: name }),
      });
      if (res.status === 401) setAuthenticated(false);
      if (!res.ok) throw new Error("save failed");
    } catch {
      setSaved(wasSaved); // rollback
    } finally {
      setPending(false);
    }
  }, [authenticated, pending, saved, name]);

  return (
    <SaveButton
      name={name}
      saved={saved}
      authenticated={authenticated}
      pending={pending}
      onToggle={toggle}
    />
  );
}
