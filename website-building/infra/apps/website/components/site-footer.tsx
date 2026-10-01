import Link from "next/link";

import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t py-8 text-sm text-muted-foreground">
      <Link href="/" className="font-medium text-foreground">
        {site.companyName}
      </Link>
      <nav aria-label="Footer" className="flex gap-6">
        <Link href="/#approach" className="hover:text-foreground">
          Our approach
        </Link>
        <Link href="/about/" className="hover:text-foreground">
          About
        </Link>
      </nav>
    </footer>
  );
}
