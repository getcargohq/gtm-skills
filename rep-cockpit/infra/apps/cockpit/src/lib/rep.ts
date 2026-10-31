import type { CargoIdentity } from "@cargo-ai/app-sdk";
import { useCargoApi } from "@cargo-ai/app-sdk";
import { useGetIdentity } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";

import { linkedinConnectorUuid } from "../config";

export type Rep = {
  email: string;
  firstName: string;
  // The first mailbox attached to the rep's revenue-organization member, or
  // undefined when none is: Send is then off, with the reason on screen.
  mailboxUuid: string | undefined;
  // The rep's LinkedIn identity on the workspace's LinkedIn connector, or
  // undefined until they connect LinkedIn with the Cargo Chrome extension.
  linkedinIdentityId: string | undefined;
};

// The signed-in rep, matched to their member by login email. A rep who signs
// in with another address than their member's is a rep with no mailbox and no
// LinkedIn identity.
export const useRep = (): Rep | undefined => {
  const api = useCargoApi();
  const { data: identity } = useGetIdentity<CargoIdentity>();

  const members = useQuery({
    queryKey: ["members"],
    queryFn: () => api.revenueOrganization.member.all(),
    staleTime: 10 * 60 * 1000,
  });

  if (identity === undefined || members.data === undefined) {
    return undefined;
  }
  const email = identity.email.toLowerCase();
  const firstName = identity.name.split(" ")[0];

  const member = members.data.members.find(
    (candidate) => candidate.email.toLowerCase() === email,
  );
  if (member === undefined) {
    return {
      email,
      firstName,
      mailboxUuid: undefined,
      linkedinIdentityId: undefined,
    };
  }

  let mailboxUuid: string | undefined;
  if (member.mailboxes.length > 0) {
    mailboxUuid = member.mailboxes[0].uuid;
  }
  const linkedinIdentity = member.connectors.find(
    (connector) => connector.uuid === linkedinConnectorUuid,
  );
  let linkedinIdentityId: string | undefined;
  if (linkedinIdentity !== undefined) {
    linkedinIdentityId = linkedinIdentity.userId;
  }
  return { email, firstName, mailboxUuid, linkedinIdentityId };
};
