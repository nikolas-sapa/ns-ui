import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeSync } from "./_components/theme-sync";
import { NO_FLASH_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "ns-ui",
  description: "Personal component registry",
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
