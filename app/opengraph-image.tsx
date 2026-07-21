import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// Satori (the renderer behind ImageResponse) has no DOM, so it can't read
// globals.css custom properties — these are the dark-mode token values from
// app/globals.css, copied literally. The OG image is always rendered dark
// regardless of the viewer's theme, matching the brand default used for
// external-facing marketing surfaces.
const TOKEN = {
  background: "#0a0a0a",
  foreground: "#ededed",
  surface: "#171717",
  border: "#2e2e2e",
  muted: "#8f8f8f",
  accent: "#006bff",
} as const;

export const alt = "ns-ui — a personal registry of 50 React components";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "node_modules/geist/dist/fonts");

export default async function Image() {
  const [sansRegular, sansSemibold, mono] = await Promise.all([
    readFile(join(FONT_DIR, "geist-sans/Geist-Regular.ttf")),
    readFile(join(FONT_DIR, "geist-sans/Geist-SemiBold.ttf")),
    readFile(join(FONT_DIR, "geist-mono/GeistMono-Regular.ttf")),
  ]);

  const installLabel = `${REGISTRY_ORIGIN.replace(/^https?:\/\//, "")}/r/[name].json`;

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
              fontSize: 22,
              letterSpacing: 4,
              color: TOKEN.muted,
            }}
          >
            NS-UI
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.12,
              letterSpacing: -2,
              color: TOKEN.foreground,
            }}
          >
            50 React components,
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.12,
              letterSpacing: -2,
              color: TOKEN.foreground,
            }}
          >
            built on Geist.
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 24,
              lineHeight: 1.5,
              color: TOKEN.muted,
              maxWidth: 640,
            }}
          >
            Canvas, motion and glass — every component runs live, in light
            and dark.
          </div>
        </div>

        {/* Install form */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            alignSelf: "flex-start",
            border: `1px solid ${TOKEN.border}`,
            background: TOKEN.surface,
            borderRadius: 12,
            padding: "18px 28px",
          }}
        >
          <div
            style={{
              fontFamily: "GeistMono",
              fontSize: 22,
              color: TOKEN.foreground,
              display: "flex",
            }}
          >
            <span style={{ color: TOKEN.muted, marginRight: 12 }}>$</span>
            npx shadcn add {installLabel}
          </div>
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
