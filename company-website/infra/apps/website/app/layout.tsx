import type { Metadata } from "next";
import type * as React from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { isDraft, site } from "@/lib/site";
import { visitorConsentConfig } from "@/visitor-support.mjs";
// next.config.ts resolves this to an empty stub while tracking is off.
import { VisitorConsent } from "@visitor-consent";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: site.canonicalUrl ? new URL(site.canonicalUrl) : undefined,
  title: { default: site.companyName, template: `%s | ${site.companyName}` },
  description: site.description,
};

// Evaluated during `next build` from the app root, never in the browser.
const visitors = visitorConsentConfig(process.cwd());

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
          >
            Skip to content
          </a>
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <SiteHeader />
            {isDraft ? (
              <p
                role="status"
                className="rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground"
              >
                Draft preview
              </p>
            ) : null}
            <main id="main" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <SiteFooter />
          </div>
        </ThemeProvider>
        {visitors ? <VisitorConsent config={visitors} /> : null}
      </body>
    </html>
  );
}
