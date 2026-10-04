import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { researcher } from "../agents/researcher";
import { slack } from "../connectors/slack";
import { playsFolder } from "../folders";
import { gtmAccounts } from "../models/gtm-accounts";
import { gtmContacts } from "../models/gtm-contacts";

// PLACEHOLDER: the Slack channel every inbound note lands in, as a channel id
// (C…) read from the connector's channel autocomplete. Fixed here so no run
// can post anywhere else: the note carries a tier and a rationale that must
// never reach a customer shared channel.
const slackChannelId = "PLACEHOLDER_SLACK_CHANNEL_ID";

// PLACEHOLDER: contact `owner_id` -> Slack user id, so the note mentions the
// owner. An owner missing here is named by id instead of mentioned; the
// pipeline never assigns or changes an owner.
const ownerSlackIds: Record<string, string> = {
  "owner-id": "U0123456789",
};

// One new inbound contact:
//
//   researched already -> never reached: the play filter excludes it
//   no email           -> stop: no domain to research, no person to brief
//   researcher answers -> tier, brief and rationale written onto the contact
//                         row, the tier onto its account only if the account
//                         has none, then one Slack note to the channel
//
// The writes target the native record ids the row came with. Bare slugs on
// the write: the write path nests them under `custom` itself, so the
// `custom__` names the read side shows would be dropped while the node still
// reports success.
const researchInbound = defineWorkflow(
  "research_inbound_contact",
  {
    // `defineContact` columns. Confirm with `cargo-ai storage column list`
    // after deploy.
    input: z.object({
      id: z.string(),
      account_id: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      title: z.string().optional(),
      email: z.string().optional(),
      linkedin_url: z.string().optional(),
      lead_source: z.string().optional(),
      owner_id: z.string().optional(),
      description: z.string().optional(),
    }),
    output: z.object({
      status: z.enum(["researched", "skipped_no_email"]),
      tier: z.string().optional(),
    }),
    uses: { slack, researcher },
    // The body is parsed from source, not executed: model handles and
    // constants it names must be listed here or the parser cannot resolve them.
    imports: { gtmContacts, gtmAccounts, slackChannelId, ownerSlackIds },
  },
  ({ input, uses, model }) => {
    if (!input.email) {
      return { status: "skipped_no_email" as const };
    }

    // What is already known about the company, if the contact is linked to
    // one. Empty for a contact that arrived without an account.
    const account = model.search({
      modelUuid: gtmAccounts.uuid,
      filter: {
        conjonction: "and",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                kind: "string",
                columnSlug: "id",
                operator: "is",
                values: [input.account_id || "none"],
              },
            ],
          },
        ],
      },
      limit: 1,
    });

    const verdict = uses.researcher({
      prompt: `Research and tier this new inbound contact. Contact: ${JSON.stringify(input)}. Account on file: ${JSON.stringify(account)}`,
    });

    // The judgment and the stamp land on one node, so a contact is never
    // marked researched without carrying the research.
    model.customColumn({
      modelUuid: gtmContacts.uuid,
      id: input.id,
      mappings: [
        { columnSlug: "inbound_tier", value: verdict.answer.tier },
        { columnSlug: "inbound_brief", value: verdict.answer.brief },
        {
          columnSlug: "inbound_rationale",
          value: verdict.answer.rationale,
        },
        { columnSlug: "inbound_researched_at", value: new Date() },
      ],
    });

    // Fill-blank on the account: a tier already there was set on more
    // evidence than one inbound lead carries.
    if (account.length > 0 && !account[0].custom__tier) {
      model.customColumn({
        modelUuid: gtmAccounts.uuid,
        id: account[0].id,
        mappings: [
          { columnSlug: "tier", value: verdict.answer.tier },
          { columnSlug: "tier_reason", value: verdict.answer.rationale },
        ],
      });
    }

    const ownerSlackId = input.owner_id ? ownerSlackIds[input.owner_id] : "";
    const ownerLine = ownerSlackId
      ? `<@${ownerSlackId}>`
      : input.owner_id
        ? `owner ${input.owner_id}`
        : "No owner yet";

    uses.slack.postMessage({
      channelId: slackChannelId,
      format: "markdown",
      disableUnfurling: true,
      body: `:inbox_tray: *${input.first_name} ${input.last_name}*, ${input.title} (${input.email}) — tier *${verdict.answer.tier}*\n${verdict.answer.brief}\n_${verdict.answer.rationale}_\nOwner: ${ownerLine} · Source: ${input.lead_source}\nSources: ${verdict.answer.evidence_urls.join(" · ")}`,
    });

    return { status: "researched" as const, tier: verdict.answer.tier };
  },
);

// Researches each new contact whose lead source says it came to you, once.
//
// `changeKinds: ["added"]` creates runs for rows entering the filter, not for
// the whole table on every tick. The `inbound_researched_at` blank test
// is the second key, so re-enabling the play or a manual run never pays twice.
//
// PLACEHOLDER: the `lead_source` values your capture writes for inbound. An
// allow-list, not a deny-list: a sourced list loaded into the same model with
// an unexpected source must not be researched at inbound cost. Count the
// values in the model before you set it.
//
// Ships disabled. Enabling is the last yes after the pilot, and `added` does
// not backfill what landed while it was off.
export const researchInboundContacts = definePlay("research_inbound_contacts", {
  description:
    "Researches each new inbound contact, writes a tier and a brief onto the record, and posts a note to Slack.",
  folder: playsFolder,
  model: gtmContacts,
  workflow: researchInbound,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: gtmContacts.columns.email,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: gtmContacts.columns.lead_source,
            operator: "is",
            values: ["inbound", "website", "demo_request"],
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: gtmContacts.columns.custom__inbound_researched_at,
            operator: "isNull",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "*/15 * * * *" },
});
