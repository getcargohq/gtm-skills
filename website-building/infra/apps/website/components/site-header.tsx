import Link from "next/link";
import { Sparkle } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-6">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight"
      >
        <Sparkle aria-hidden className="size-5 text-primary" />
        {site.companyName}
      </Link>
      <nav aria-label="Main" className="-mx-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/#approach">Our approach</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/about/">About</Link>
        </Button>
        <ThemeToggle />
      </nav>
    </header>
  );
}
