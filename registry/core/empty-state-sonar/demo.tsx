"use client";

import { useEffect, useState } from "react";
import { EchoSound, type EchoSoundItem } from "./component";

function Row({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex h-full w-full items-center justify-between gap-4 rounded-md border border-border bg-background px-4">
      <p className="truncate text-sm font-medium text-foreground">{title}</p>
      <p className="shrink-0 text-xs text-muted">{meta}</p>
    </div>
  );
}

const RESULTS: EchoSoundItem[] = [
  { id: "1", content: <Row title="Northwind — Q3 invoice.pdf" meta="4.2 MB" /> },
  { id: "2", content: <Row title="Contoso — invoice #2291.pdf" meta="1.8 MB" /> },
  { id: "3", content: <Row title="invoice-template-v3.docx" meta="212 KB" /> },
  { id: "4", content: <Row title="Fabrikam — invoice, paid.pdf" meta="3.1 MB" /> },
];

export default function EchoSoundDemo() {
  const [items, setItems] = useState<EchoSoundItem[] | null>(null);

  // Loops so the card stays alive: probe for a stretch, let data interrupt
  // the ping early (the exact moment the brief is about), hold the resolved
  // list, then return to probing. Reduced motion settles once and stays.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setItems(RESULTS), 700);
      return () => window.clearTimeout(id);
    }
    let id = 0;
    const toLoaded = () => {
      setItems(RESULTS);
      id = window.setTimeout(toEmpty, 4800);
    };
    const toEmpty = () => {
      setItems(null);
      id = window.setTimeout(toLoaded, 2600);
    };
    id = window.setTimeout(toLoaded, 2600);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / empty-state-sonar — a probe that the results interrupt
      </p>

      <div className="w-[420px] rounded-md border border-border bg-background p-6">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          search · &ldquo;invoice&rdquo;
        </p>
        <EchoSound items={items} query="invoice" rowHeight={52} rowGap={10} stageRows={RESULTS.length} />
      </div>
    </div>
  );
}
