import { pageMetadata, site } from "@/lib/site";

export const metadata = pageMetadata(
  "/about/",
  site.about.title,
  site.about.description,
);

export default function AboutPage() {
  return (
    <article className="max-w-3xl py-16 sm:py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {site.about.title}
      </h1>
      <p className="mt-6 text-lg text-pretty text-muted-foreground">
        {site.about.description}
      </p>
      <div className="mt-10 space-y-6 leading-7">
        {site.about.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
