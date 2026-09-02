import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// Same rationale as app/opengraph-image.tsx: Satori has no DOM, so these are
// the dark-mode token values from app/globals.css, copied literally. Always
// renders dark.
const TOKEN = {
  background: "#0a0a0a",
  border: "#2e2e2e",
  foreground: "#ededed",
  muted: "#8f8f8f",
  accent: "#006bff",
} as const;

export const alt = "ns-ui categories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "node_modules/geist/dist/fonts");

export default async function Image() {
  const [sansRegular, sansSemibold, mono] = await Promise.all([
    readFile(join(FONT_DIR, "geist-sans/Geist-Regular.ttf")),
    readFile(join(FONT_DIR, "geist-sans/Geist-SemiBold.ttf")),
    readFile(join(FONT_DIR, "geist-mono/GeistMono-Regular.ttf")),
  ]);

  const description = `Browse ns-ui's ${registry.items.length} React components by category: heroes, navigation, forms, charts, feedback and more.`;

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
            NS-UI / CATEGORIES
          </div>
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
            Categories
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
          {REGISTRY_ORIGIN.replace(/^https?:\/\//, "")}/categories
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
