import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// Screenshot embedding was tried and dropped: registry/<collection>/<name>/
// screenshots/dark-default.png reads fine off disk in this runtime, but the
// content is currently wrong — checked particle-hero and glass-button, both
// are correctly THAT component (particle-hero's "Interfaces with gravity"
// headline + CTA; glass-button's own "Get started" pill), but rendered in
// the LIGHT theme, not dark, despite the "dark-default" filename. All of
// screenshots/ was touched today ~06:44-06:47, so this looks like an
// in-flight theme regression in the screenshot pipeline from a concurrent
// agent. Filed as a bug report (wrong theme, not wrong component) rather
// than fixed here (out of this task's file lane) — this route ships the
// type-only card the task spec allows as a fallback instead of risking a
// visibly wrong-theme image.

// Same rationale as app/opengraph-image.tsx: Satori has no DOM, so these are
// the dark-mode token values from app/globals.css, copied literally rather
// than read from CSS. The card always renders dark.
const TOKEN = {
  background: "#0a0a0a",
  border: "#2e2e2e",
  foreground: "#ededed",
  muted: "#8f8f8f",
  accent: "#006bff",
} as const;

export const alt = "ns-ui component preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "node_modules/geist/dist/fonts");

/** One-liner for the card: a few meta.json descriptions run past 200 chars. */
function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const item = registry.items.find((i) => i.name === name);

  const title = item?.title ?? "ns-ui";
  const description = item
    ? truncate(item.description, 150)
    : "Component not found.";
  const collection = item?.meta?.collection ?? "core";

  const [sansRegular, sansSemibold, mono] = await Promise.all([
    readFile(join(FONT_DIR, "geist-sans/Geist-Regular.ttf")),
    readFile(join(FONT_DIR, "geist-sans/Geist-SemiBold.ttf")),
    readFile(join(FONT_DIR, "geist-mono/GeistMono-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: TOKEN.background,
          padding: "72px 80px",
          fontFamily: "GeistSans",
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: 9999,
              background: TOKEN.accent,
              marginRight: 12,
            }}
          />
          <div
            style={{
              fontFamily: "GeistMono",
              fontSize: 20,
              letterSpacing: 4,
              color: TOKEN.muted,
            }}
          >
            NS-UI
          </div>
          {collection === "loud" ? (
            <div
              style={{
                display: "flex",
                marginLeft: 14,
                padding: "3px 9px",
                borderRadius: 6,
                border: `1px solid ${TOKEN.border}`,
                fontFamily: "GeistMono",
                fontSize: 13,
                letterSpacing: 2,
                color: TOKEN.muted,
              }}
            >
              LOUD
            </div>
          ) : null}
        </div>

        {/* Title + description */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.12,
              letterSpacing: -2,
              color: TOKEN.foreground,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 26,
              lineHeight: 1.5,
              color: TOKEN.muted,
              maxWidth: 860,
            }}
          >
            {description}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            fontFamily: "GeistMono",
            fontSize: 18,
            color: TOKEN.muted,
          }}
        >
          {REGISTRY_ORIGIN.replace(/^https?:\/\//, "")}/preview/{name}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "GeistSans", data: sansRegular, weight: 400, style: "normal" },
        { name: "GeistSans", data: sansSemibold, weight: 600, style: "normal" },
        { name: "GeistMono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
