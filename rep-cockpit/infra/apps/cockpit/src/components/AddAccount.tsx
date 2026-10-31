import { Button, Input, useCargoApi } from "@cargo-ai/app-sdk";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { useNavigate } from "react-router-dom";

import { sql } from "../lib/cargo";
import { useHeldClicks } from "../lib/held";
import { accountContextOf, startClaim, toDomain } from "../lib/leads";
import {
  accountLookupQuery,
  claimQuery,
  type Claim,
  type HotLead,
} from "../lib/queries";
import type { Rep } from "../lib/rep";

// An account the queue did not surface: a rep's own lead, a referral, an
// inbound. It goes through the same claim as a Hot lead, with what the queue
// knows about the domain, unless a teammate already holds it.
export const AddAccount: React.FC<{ rep: Rep | undefined }> = ({ rep }) => {
  const api = useCargoApi();
  const navigate = useNavigate();
  const { hold } = useHeldClicks();
  const [website, setWebsite] = React.useState("");

  const add = useMutation({
    mutationFn: async (): Promise<string> => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      const domain = toDomain(website);
      if (!domain.includes(".")) {
        throw new Error("Enter the company's website, like northwind.example.");
      }
      const claims = await sql<Claim>(api, claimQuery(domain));
      if (claims.length > 0 && claims[0].status === "claimed") {
        throw new Error(
          `${claims[0].account_name} is already claimed by ${claims[0].rep_email}.`,
        );
      }
      const found = await sql<HotLead>(api, accountLookupQuery(domain));
      let lead: HotLead = { domain, name: domain };
      if (found.length > 0) {
        lead = found[0];
      }
      hold(domain, { status: "claimed", accountName: lead.name });
      await startClaim(
        api,
        rep,
        lead,
        `Added by the rep, not surfaced by the queue. ${accountContextOf(lead, [])}`,
      );
      return domain;
    },
    onSuccess: (domain) => navigate(`/accounts/${domain}`),
  });

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate();
      }}
    >
      <div className="flex gap-2">
        <Input
          value={website}
          placeholder="company.com"
          aria-label="Company website"
          className="w-48"
          onChange={(event) => setWebsite(event.target.value)}
        />
        <Button
          size="sm"
          type="submit"
          variant="outline"
          disabled={add.isLoading || rep === undefined || website === ""}
        >
          {add.isLoading ? "Claiming…" : "Add and claim"}
        </Button>
      </div>
      {add.error === null ? null : (
        <p className="text-xs text-destructive">{String(add.error)}</p>
      )}
    </form>
  );
};
