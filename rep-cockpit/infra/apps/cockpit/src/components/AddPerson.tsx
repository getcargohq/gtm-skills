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
import { UserPlus } from "lucide-react";
import React from "react";

import { addContactToolUuid } from "../config";
import { startTool, waitForRun } from "../lib/cargo";
import { orEmpty } from "../lib/drafts";
import { hasText, type Claim } from "../lib/queries";
import type { Rep } from "../lib/rep";

type Person = {
  linkedinUrl: string;
  name: string;
  title: string;
  email: string;
};

const nobody: Person = { linkedinUrl: "", name: "", title: "", email: "" };

const Field: React.FC<{
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}> = ({ id, label, value, placeholder, onChange }) => {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};

// A person the committee search missed, added by the rep: the writer drafts
// their first touch and they join the account like anyone sourced.
export const AddPerson: React.FC<{
  claim: Claim | undefined;
  rep: Rep | undefined;
  onAdded: () => void;
}> = ({ claim, rep, onAdded }) => {
  const api = useCargoApi();
  const [isOpen, setIsOpen] = React.useState(false);
  const [person, setPerson] = React.useState<Person>(nobody);

  const add = useMutation({
    mutationFn: async () => {
      if (rep === undefined || claim === undefined) {
        throw new Error("Still loading the account.");
      }
      if (!hasText(claim.account_id)) {
        throw new Error("The claim is still being recorded.");
      }
      const runUuid = await startTool(api, addContactToolUuid, {
        account_domain: claim.account_domain,
        account_name: claim.account_name,
        account_id: claim.account_id,
        account_context: orEmpty(claim.account_context),
        rep_email: rep.email,
        rep_name: rep.firstName,
        contact_name: person.name.trim(),
        contact_title: person.title.trim(),
        contact_email: person.email.trim(),
        linkedin_url: person.linkedinUrl.trim(),
      });
      await waitForRun(api, runUuid, 90);
    },
    onSuccess: () => {
      setIsOpen(false);
      setPerson(nobody);
      onAdded();
    },
  });

  const isComplete =
    person.name.trim() !== "" &&
    person.linkedinUrl.includes("linkedin.com/in/");

  return (
    <>
      <Button
        variant="outline"
        disabled={claim === undefined}
        onClick={() => setIsOpen(true)}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Add person
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
              <DialogTitle>Add a person</DialogTitle>
              <DialogDescription>
                Someone the search missed. A first touch is drafted for them in
                about a minute.
              </DialogDescription>
            </DialogHeader>
            <Field
              id="linkedin"
              label="LinkedIn profile"
              value={person.linkedinUrl}
              placeholder="https://www.linkedin.com/in/…"
              onChange={(linkedinUrl) => setPerson({ ...person, linkedinUrl })}
            />
            <Field
              id="name"
              label="Full name"
              value={person.name}
              placeholder="Jane Doe"
              onChange={(name) => setPerson({ ...person, name })}
            />
            <Field
              id="title"
              label="Title"
              value={person.title}
              placeholder="VP Sales"
              onChange={(title) => setPerson({ ...person, title })}
            />
            <Field
              id="email"
              label="Work email (optional)"
              value={person.email}
              placeholder="Leave empty to look it up later"
              onChange={(email) => setPerson({ ...person, email })}
            />
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
              <Button type="submit" disabled={!isComplete || add.isLoading}>
                {add.isLoading ? "Drafting…" : "Add and draft"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
