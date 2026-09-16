import type { Connection } from "@cargo-ai/api";
import {
  Button,
  CargoEmpty,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";

export const LinkedInSend: React.FC = () => {
  const api = useCargoApi();
  const [connectorUuid, setConnectorUuid] = React.useState<string | undefined>(
    undefined,
  );
  const [identityId, setIdentityId] = React.useState<string | undefined>(
    undefined,
  );
  const [profileUrl, setProfileUrl] = React.useState("");
  const [message, setMessage] = React.useState("");

  const connectorsQuery = useQuery({
    queryKey: ["connection.connector", "list", "linkedin"],
    queryFn: () =>
      api.connection.connector.list({ integrationSlug: "linkedin" }),
  });

  const connectors: Connection.Connector[] =
    connectorsQuery.data === undefined ? [] : connectorsQuery.data.connectors;

  React.useEffect(() => {
    if (connectorUuid !== undefined) {
      return;
    }
    const first = connectors[0];
    if (first !== undefined) {
      setConnectorUuid(first.uuid);
    }
  }, [connectorUuid, connectors]);

  const identitiesQuery = useQuery({
    queryKey: ["connection.connector", "identities", connectorUuid],
    enabled: connectorUuid !== undefined,
    queryFn: () => {
      if (connectorUuid === undefined) {
        throw new Error("No LinkedIn connector selected.");
      }

      return api.connection.connector.autocomplete({
        connectorUuid,
        slug: "listIdentityIds",
        params: {},
      });
    },
  });

  const identities =
    identitiesQuery.data === undefined ? [] : identitiesQuery.data.results;

  React.useEffect(() => {
    const first = identities[0];
    if (identityId === undefined && first !== undefined) {
      setIdentityId(first.value);
    }
  }, [identities, identityId]);

  const send = useMutation({
    mutationFn: async () => {
      if (connectorUuid === undefined || identityId === undefined) {
        throw new Error("Pick a LinkedIn account first.");
      }

      return await api.orchestration.action.execute({
        action: {
          kind: "connector",
          integrationSlug: "linkedin",
          connectorUuid,
          actionSlug: "messageProfile",
        },
        data: {
          linkedinProfileUrl: profileUrl.trim(),
          message,
          identityIds: [identityId],
        },
        waitUntilFinished: true,
      });
    },
    onSuccess: () => {
      setMessage("");
    },
  });

  if (connectorsQuery.isLoading === true) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <CargoEmpty
        title="No LinkedIn connection"
        description="Connect LinkedIn in the workspace, then send DMs from here. Inbound LinkedIn replies stay on LinkedIn — Cargo does not sync that inbox."
      />
    );
  }

  const canSend =
    connectorUuid !== undefined &&
    identityId !== undefined &&
    profileUrl.trim() !== "" &&
    message.trim() !== "" &&
    send.isLoading === false;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Send a LinkedIn message</h1>
        <p className="text-sm text-muted-foreground">
          Outbound only. Replies stay in LinkedIn — this page does not read
          that inbox.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Connection</Label>
        <Select
          value={connectorUuid}
          onValueChange={(value) => {
            setConnectorUuid(value);
            setIdentityId(undefined);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a LinkedIn connection" />
          </SelectTrigger>
          <SelectContent>
            {connectors.map((connector) => (
              <SelectItem key={connector.uuid} value={connector.uuid}>
                {connector.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Send as</Label>
        {identitiesQuery.isLoading === true ? (
          <Spinner />
        ) : (
          <Select value={identityId} onValueChange={setIdentityId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a LinkedIn identity" />
            </SelectTrigger>
            <SelectContent>
              {identities.map((identity) => (
                <SelectItem key={identity.value} value={identity.value}>
                  {identity.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label>Profile URL</Label>
        <Input
          placeholder="https://www.linkedin.com/in/…"
          value={profileUrl}
          onChange={(event) => setProfileUrl(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Message</Label>
        <Textarea
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {send.isError === true ? (
        <p className="text-sm text-destructive">
          {send.error instanceof Error
            ? send.error.message
            : "The message did not send."}
        </p>
      ) : null}
      {send.isSuccess === true ? (
        <p className="text-sm text-muted-foreground">Sent.</p>
      ) : null}
      <div className="flex justify-end">
        <Button disabled={canSend === false} onClick={() => send.mutate()}>
          {send.isLoading === true ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
};
