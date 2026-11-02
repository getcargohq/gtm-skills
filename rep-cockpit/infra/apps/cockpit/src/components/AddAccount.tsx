import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";

import { sql } from "../lib/cargo";
import { useHeldClicks } from "../lib/held";
import { accountContextOf, startClaim, toDomain } from "../lib/hot-accounts";
import {
  accountLookupQuery,
  claimQuery,
  type Claim,
  type HotAccount,
} from "../lib/queries";
import type { Rep } from "../lib/rep";

// An account the queue did not surface: a rep's own pick, a referral, an
// inbound. It goes through the same claim as a Hot account, with what the queue
// knows about the domain, unless a teammate already holds it.
export const AddAccount: React.FC<{ rep: Rep | undefined }> = ({ rep }) => {
  const api = useCargoApi();
  const navigate = useNavigate();
  const { hold } = useHeldClicks();
  const [isOpen, setIsOpen] = React.useState(false);
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
      const found = await sql<HotAccount>(api, accountLookupQuery(domain));
      let account: HotAccount = { domain, name: domain };
      if (found.length > 0) {
        account = found[0];
      }
      hold(domain, { status: "claimed", accountName: account.name });
      await startClaim(
        api,
        rep,
        account,
        `Added by the rep, not surfaced by the queue. ${accountContextOf(account, [])}`,
      );
      return domain;
    },
    onSuccess: (domain) => navigate(`/accounts/${domain}`),
  });

  return (
    <>
      <Button
        variant="outline"
        disabled={rep === undefined}
        onClick={() => setIsOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add account
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Add an account</DialogTitle>
              <DialogDescription>
                A company the queue did not surface: your own account, a
                referral, an inbound. It is claimed for you and its buying
                committee is sourced.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="website">Company website</Label>
              <Input
                id="website"
                value={website}
                autoFocus
                placeholder="northwind.example"
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>
            {add.error === null ? null : (
              <p className="text-sm text-destructive">{String(add.error)}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={add.isLoading || website === ""}>
                {add.isLoading ? "Claiming…" : "Add and claim"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
