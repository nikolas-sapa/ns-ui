"use client";

// Owner-only review queue, rendered on `/account`. Renders NOTHING for a
// non-owner: authorization is the server's answer, not a prop — the queue
// endpoint 403s for anyone not in `OWNER_EMAILS`, and this component simply
// stays invisible when that happens. There is deliberately no "are you an
// owner" flag anywhere in the client bundle.
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  quote: string;
  name: string;
  role: string;
  company: string;
  profileUrl: string;
  status: "pending" | "approved" | "rejected";
  spamScore: number;
  spamFlags: string[];
  createdAt: number;
};

export function TestimonialModeration() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/testimonials/moderate");
      if (!res.ok) {
        setRows(null); // 401/403 → not an owner → render nothing
        return;
      }
      const data = (await res.json()) as { rows?: Row[] };
      setRows(data.rows ?? []);
    } catch {
      setRows(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/testimonials/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        setError("Could not update. Try again.");
        return;
      }
      await load();
    } catch {
      setError("Could not update. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (rows === null) return null;

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-foreground">
        Testimonials ({pending.length} pending)
      </h2>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-[var(--error)]">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ns-muted">No submissions yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-sm border border-border bg-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ns-muted">
                  {row.status}
                </span>
                {row.spamFlags.map((flag) => (
                  <span
                    key={flag}
                    // A flagged row is the one worth reading closely, so the
                    // flags are shown verbatim rather than reduced to a score.
                    className={`rounded-sm border px-1.5 py-px font-mono text-[10px] ${
                      flag === "hate_or_harassment"
                        ? "border-[var(--error)] text-[var(--error)]"
                        : "border-border text-ns-muted"
                    }`}
                  >
                    {flag}
                  </span>
                ))}
                {row.spamFlags.length > 0 ? (
                  <span className="font-mono text-[10px] text-ns-muted">
                    score {row.spamScore}
                  </span>
                ) : null}
              </div>

              <blockquote className="mt-2 text-sm leading-6 text-foreground">
                &ldquo;{row.quote}&rdquo;
              </blockquote>

              <p className="mt-2 text-xs text-ns-muted">
                {row.name} — {row.role} at {row.company} ·{" "}
                <a
                  href={row.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
                >
                  profile
                </a>
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy === row.id || row.status === "approved"}
                  onClick={() => act(row.id, "approve")}
                  className="rounded-sm border border-border px-2.5 py-1 text-xs text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy === row.id || row.status === "rejected"}
                  onClick={() => act(row.id, "reject")}
                  className="rounded-sm border border-border px-2.5 py-1 text-xs text-ns-muted outline-none transition-colors hover:border-ns-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
