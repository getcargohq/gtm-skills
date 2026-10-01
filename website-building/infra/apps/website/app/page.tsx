import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pageMetadata, site } from "@/lib/site";

export const metadata = {
  ...pageMetadata(
    "/",
    `${site.companyName} | ${site.headline}`,
    site.description,
  ),
  title: { absolute: `${site.companyName} | ${site.headline}` },
};

export default function HomePage() {
  return (
    <>
      <section
        aria-labelledby="headline"
        className="flex flex-col items-start gap-6 py-16 sm:py-24"
      >
        <Badge variant="secondary">{site.eyebrow}</Badge>
        <h1
          id="headline"
          className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
        >
          {site.headline}
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          {site.description}
        </p>
        <Button asChild size="lg">
          <a href={site.cta.href}>
            {site.cta.label}
            <ArrowUpRight aria-hidden />
          </a>
        </Button>
      </section>
      <section
        id="approach"
        aria-labelledby="approach-title"
        className="scroll-mt-8 py-12"
      >
        <p className="text-sm font-medium text-muted-foreground">
          The approach
        </p>
        <h2
          id="approach-title"
          className="mt-2 text-3xl font-semibold tracking-tight"
        >
          Clarity at every step.
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {site.features.map((feature, index) => (
            <Card key={feature.title}>
              <CardHeader>
                <span className="font-mono text-sm text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <CardTitle>
                  <h3 className="text-lg">{feature.title}</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                {feature.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
