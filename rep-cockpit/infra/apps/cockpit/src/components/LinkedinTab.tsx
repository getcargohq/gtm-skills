import { Button, Textarea, useCargoApi } from "@cargo-ai/app-sdk";
import { useMutation } from "@tanstack/react-query";
import React from "react";

import { linkedinToolUuid } from "../config";
import { startTool, waitForRun } from "../lib/cargo";
import { orEmpty } from "../lib/drafts";
import { hasText, type Claim, type Draft } from "../lib/queries";
import type { Rep } from "../lib/rep";

const noteLimit = 300;

const sentLabel = (status: string | null | undefined): string | undefined => {
  if (status === "invited") {
    return "Invite sent";
  }
  if (status === "messaged") {
    return "Message sent";
  }
  return undefined;
};

// The LinkedIn side of a person: the writer's connection note, editable, and
// two sends from the rep's own LinkedIn identity. Invite is for someone not
// yet connected, Message for a connection; LinkedIn refuses the other one,
// and the reason shows here.
export const LinkedinTab: React.FC<{
  draft: Draft;
  claim: Claim | undefined;
  rep: Rep | undefined;
  onChanged: () => void;
}> = ({ draft, claim, rep, onChanged }) => {
  const api = useCargoApi();
  const [note, setNote] = React.useState(orEmpty(draft.linkedin_note));

  const send = useMutation({
    mutationFn: async (kind: "invite" | "message") => {
      if (rep === undefined || rep.linkedinIdentityId === undefined) {
        throw new Error("No LinkedIn identity to send from.");
      }
      if (claim === undefined || !hasText(claim.account_id)) {
        throw new Error("The claim is still being recorded.");
      }
      const runUuid = await startTool(api, linkedinToolUuid, {
        contact_id: draft.contact_id,
        account_id: claim.account_id,
        rep_email: rep.email,
        identity_id: rep.linkedinIdentityId,
        linkedin_url: draft.linkedin_url,
        contact_name: draft.contact_name,
        message: note,
        kind,
      });
      await waitForRun(api, runUuid, 90);
    },
    onSuccess: onChanged,
  });

  let blocker: string | undefined;
  if (rep !== undefined && rep.linkedinIdentityId === undefined) {
    blocker = "Connect LinkedIn with the Cargo Chrome extension to send here.";
  } else if (note.trim() === "") {
    blocker = "Write a note first.";
  } else if (note.length > noteLimit) {
    blocker = `LinkedIn caps a note at ${noteLimit} characters.`;
  }
  let sent = sentLabel(draft.linkedin_status);
  if (send.isSuccess) {
    sent = "Sent";
  }
  const isBlocked =
    blocker !== undefined || send.isLoading || rep === undefined;

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={note}
        rows={4}
        placeholder="A short note to connect"
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {sent === undefined ? `${note.length} / ${noteLimit}` : sent}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {blocker === undefined ? null : (
            <span className="text-xs text-muted-foreground">{blocker}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isBlocked}
            onClick={() => send.mutate("message")}
          >
            Send as message
          </Button>
          <Button
            size="sm"
            disabled={isBlocked}
            onClick={() => send.mutate("invite")}
          >
            {send.isLoading ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>
      {send.error === null ? null : (
        <p className="text-sm text-destructive">{String(send.error)}</p>
      )}
    </div>
  );
};
