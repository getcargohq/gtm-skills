import { defineScript } from "@cargo-ai/cdk";

import { linkedinUrlVariants, normalizeEmail } from "./contacts";

export const prepareContactSearch = defineScript(
  ({
    sourceId,
    linkedinPersonId,
    linkedinUrl,
    email,
    phone,
  }: {
    sourceId: string;
    linkedinPersonId: string | undefined;
    linkedinUrl: string | undefined;
    email: string | undefined;
    phone: string | undefined;
  }) => {
    return {
      sourceId,
      linkedinPersonId,
      linkedinUrlVariants: linkedinUrlVariants(linkedinUrl),
      email: normalizeEmail(email),
      phone,
    };
  },
);
