import type { CargoIdentity } from "@cargo-ai/app-sdk";
import { useCargoApi } from "@cargo-ai/app-sdk";
import { useGetIdentity } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";

export type Rep = {
  email: string;
  firstName: string;
  // The first mailbox attached to the rep's revenue-organization member, or
  // undefined when none is: Send is then off, with the reason on screen.
  mailboxUuid: string | undefined;
};

// The signed-in rep, matched to their member by login email. A rep who signs
// in with another address than their member's is a rep with no mailbox.
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

  if (member === undefined || member.mailboxes.length === 0) {
    return { email, firstName, mailboxUuid: undefined };
  }
  return { email, firstName, mailboxUuid: member.mailboxes[0].uuid };
};
