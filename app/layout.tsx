import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeSync } from "./_components/theme-sync";
import { NO_FLASH_SCRIPT } from "@/lib/theme";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

const title = "ns-ui";
const description = "Personal component registry";

export const metadata: Metadata = {
  // Resolves every relative URL in this metadata object (including the
  // opengraph-image/twitter-image file conventions) against the same
  // env-driven origin the rest of the app uses — so pointing the registry at
  // a new host stays the one-variable change lib/registry-origin.ts promises.
  metadataBase: new URL(REGISTRY_ORIGIN),
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: title,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // No hardcoded "dark" here — the inline script below decides the theme
    // before first paint. suppressHydrationWarning is required because that
    // script mutates this element ahead of React hydration.
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="llms-txt" href="/llms.txt" />
        <link rel="llms-txt" href="/llms-full.txt" title="full" />
        {/* Runs before hydration so there's no flash of the wrong theme. See
            lib/theme.ts for what it does and why it has to stay inlined. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
