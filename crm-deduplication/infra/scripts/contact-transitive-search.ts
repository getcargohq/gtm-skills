import { defineScript } from "@cargo-ai/cdk";

import { linkedinUrlVariants, readContacts } from "./contacts";

export const prepareTransitiveContactSearch = defineScript(
  ({ records }: { records: unknown }) => {
    const contacts = readContacts(records);
    return {
      linkedinPersonIds: unique(
        contacts
          .map((contact) => contact.linkedinPersonId)
          .filter((value): value is string => value !== undefined),
      ),
      linkedinUrlVariants: unique(
        contacts.flatMap((contact) => linkedinUrlVariants(contact.linkedinUrl)),
      ),
      emails: unique(
        contacts
          .map((contact) => contact.email)
          .filter((value): value is string => value !== undefined),
      ),
      phones: unique(
        contacts
          .map((contact) => contact.phone)
          .filter((value): value is string => value !== undefined),
      ),
    };
  },
);

const unique = <T>(values: T[]): T[] => {
  return values.filter((value, index) => values.indexOf(value) === index);
};
