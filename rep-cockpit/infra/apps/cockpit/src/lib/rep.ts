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
  // The signed-in user's LinkedIn identity, written to their Cargo user by
  // the Cargo Chrome extension, or undefined until they connect LinkedIn there.
  linkedinIdentityId: string | undefined;
};

// The signed-in rep: their mailbox from the member matched by login email (a
// rep who signs in with another address has none), their LinkedIn identity
// from their own Cargo user.
export const useRep = (): Rep | undefined => {
  const api = useCargoApi();
  const { data: identity } = useGetIdentity<CargoIdentity>();

  const members = useQuery({
    queryKey: ["members"],
    queryFn: () => api.revenueOrganization.member.all(),
    staleTime: 10 * 60 * 1000,
  });

  const user = useQuery({
    queryKey: ["current-user"],
    queryFn: () => api.userManagement.user.getCurrent(),
    staleTime: 10 * 60 * 1000,
  });

  if (
    identity === undefined ||
    members.data === undefined ||
    user.data === undefined
  ) {
    return undefined;
  }
  let linkedinIdentityId: string | undefined;
  const extension = user.data.user.webExtensionData;
  if (extension !== null && extension !== undefined) {
    linkedinIdentityId = extension.edgesIdentityUid;
  }
  const email = identity.email.toLowerCase();
  const firstName = identity.name.split(" ")[0];

  const member = members.data.members.find(
    (candidate) => candidate.email.toLowerCase() === email,
  );
  if (member === undefined) {
    return { email, firstName, mailboxUuid: undefined, linkedinIdentityId };
  }

  let mailboxUuid: string | undefined;
  if (member.mailboxes.length > 0) {
    mailboxUuid = member.mailboxes[0].uuid;
  }
  return { email, firstName, mailboxUuid, linkedinIdentityId };
};
