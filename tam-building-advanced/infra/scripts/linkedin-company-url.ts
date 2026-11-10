// One spelling per LinkedIn company page. Sources write the same page as
// "http://www.linkedin.com/company/acme/", "https://linkedin.com/company/Acme"
// or "linkedin.com/company/acme?trk=…"; compared as written, they are three
// companies, and the TAM pays three times to find out they are one.

import { defineScript } from "@cargo-ai/cdk";

export const linkedinCompanyUrl = defineScript(
  ({ url }: { url: string }): string => {
    if (!url) {
      return "";
    }
    const path = url
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^([a-z]{2,3}\.)?(www\.)?linkedin\.com\//i, "")
      .split(/[?#]/)[0]
      .replace(/\/+$/, "");
    const handle = path
      .replace(/^company\//i, "")
      .split("/")[0]
      .toLowerCase();
    if (!handle) {
      return "";
    }
    return `https://www.linkedin.com/company/${handle}`;
  },
);
