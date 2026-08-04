"use client";

// Replaces the root layout, so it renders its own <html>/<body> and cannot use
// site chrome, fonts or globals.css tokens — this only runs when the layout
// itself threw.
// ponytail: inline styles instead of tokens because the stylesheet the root
// layout loads may not be present here. Ceiling: it ignores the visitor's
// theme. Upgrade path: inline a two-rule prefers-color-scheme <style> block if
// this page ever gets hit often enough to matter.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 500, margin: 0 }}>
          Something went wrong.
        </h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="button" onClick={reset}>
            Try again
          </button>
          <a href="/">Back to components</a>
        </div>
        {error.digest ? (
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: "10px" }}>
            {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
