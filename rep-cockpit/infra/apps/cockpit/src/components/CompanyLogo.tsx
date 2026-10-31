import React from "react";

// The company's logo, from its domain's favicon: no lookup and no credits,
// which is what a list of two hundred accounts needs. A domain with no icon
// falls back to its first letter.
export const CompanyLogo: React.FC<{ domain: string; name: string }> = ({
  domain,
  name,
}) => {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      className="h-8 w-8 shrink-0 rounded-md"
      onError={() => setFailed(true)}
    />
  );
};

// The company page on LinkedIn, when tam-building holds it.
export const LinkedinLink: React.FC<{ url: string | null | undefined }> = ({
  url,
}) => {
  if (url === null || url === undefined || url === "") {
    return null;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-muted-foreground underline"
    >
      LinkedIn
    </a>
  );
};
