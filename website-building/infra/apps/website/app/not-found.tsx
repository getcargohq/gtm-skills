import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="flex flex-col items-start gap-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-lg text-muted-foreground">
        This page does not exist or has moved.
      </p>
      <Button asChild>
        <Link href="/">Back to the home page</Link>
      </Button>
    </section>
  );
}
