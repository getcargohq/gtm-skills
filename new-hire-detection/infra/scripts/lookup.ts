// What the account and person lookups search for: the enriched domain and the
// Sales Navigator profile, in every form a CRM could have stored them. A CRM
// lookup matches stored text, not normalized text, so one exact form misses the
// account stored as `www.` and the contact stored without a trailing slash, and
// the play then creates a duplicate of each.
//
// The same normalization as crm-deduplication (`scripts/contacts/identity.ts`,
// `scripts/accounts/account.ts`), so a record this play writes reads as the
// same record to the deduplication audit.

import { defineScript } from "@cargo-ai/cdk";

export const prepareLookups = defineScript(
  ({
    domain,
    linkedinProfileUrl,
  }: {
    domain: string | undefined;
    linkedinProfileUrl: string;
  }) => {
    const bareDomain = normalizeDomain(domain);
    return {
      // The domain guard reads this rather than the enrichment's raw value,
      // so a domain of `https://` alone stops the run too.
      domain: bareDomain,
      domainVariants: domainVariants(bareDomain),
      linkedinUrlVariants: linkedinUrlVariants(linkedinProfileUrl),
    };
  },
);

/** A property as text, with `""` and absence read as the same thing. */
const asText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  return text === "" ? undefined : text;
};

/** A domain as its bare host: no scheme, `www.`, path, port or trailing dot. */
const normalizeDomain = (value: unknown): string | undefined => {
  const domain = asText(value)
    ?.toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?/, "")
    .replace(/[/?#][\s\S]*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return domain === "" ? undefined : domain;
};

/** The forms a CRM could hold for one company's domain. */
const domainVariants = (domain: string | undefined): string[] => {
  if (domain === undefined) {
    return [];
  }

  return [
    domain,
    `www.${domain}`,
    `https://${domain}`,
    `https://www.${domain}`,
  ];
};

/** The forms a CRM could hold for one LinkedIn profile. */
const linkedinUrlVariants = (value: unknown): string[] => {
  const handle = asText(value)
    ?.toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  if (handle === undefined || handle === "") {
    return [];
  }

  return [
    `https://linkedin.com/in/${handle}`,
    `https://linkedin.com/in/${handle}/`,
    `https://www.linkedin.com/in/${handle}`,
    `https://www.linkedin.com/in/${handle}/`,
  ];
};
