import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { researcher } from "../agents/researcher";
import { hubspot } from "../connectors/hubspot";
import { slack } from "../connectors/slack";
import { playsFolder } from "../folders";
import { crmContacts } from "../models/crm-contacts";

// PLACEHOLDER: the Slack channel every inbound note lands in, as a channel id
// (C…) read from the connector's channel autocomplete. Fixed here so no run
// can post anywhere else: the note carries a tier and a rationale that must
// never reach a customer shared channel.
const slackChannelId = "PLACEHOLDER_SLACK_CHANNEL_ID";

// PLACEHOLDER: HubSpot owner id -> Slack user id, so the note mentions the
// owner. Read owner ids from the HubSpot `listUsers` autocomplete and Slack ids
// from the Slack `listUsers` action. An owner missing here is named by id
// instead of mentioned; the pipeline never assigns or changes an owner.
const ownerSlackIds: Record<string, string> = {
  "00000000": "U0123456789",
};

// One new inbound contact:
//
//   researched already -> never reached: the play filter excludes it
//   researcher answers -> tier and brief written onto the HubSpot contact,
//                         tier onto its company if the company has none,
//                         then one Slack note to the channel
//
// The write targets the HubSpot record id the row came with. Nothing sits
// between the extract and the write: a unification step there makes the run
// look successful while nothing lands.
const researchInbound = defineWorkflow(
  "research_inbound_contact",
  {
    // The `fetchRecords` contact columns this workflow reads. Confirm them
    // against the live model after the first sync (`cargo-ai storage column
    // list`).
    input: z.object({
      hs_object_id: z.string(),
      email: z.string().optional(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      jobtitle: z.string().optional(),
      company: z.string().optional(),
      website: z.string().optional(),
      associatedcompanyid: z.string().optional(),
      hubspot_owner_id: z.string().optional(),
      hs_analytics_source: z.string().optional(),
      message: z.string().optional(),
    }),
    output: z.object({
      status: z.enum(["researched", "skipped_no_email"]),
      tier: z.string().optional(),
    }),
    uses: { hubspot, slack, researcher },
    imports: { slackChannelId, ownerSlackIds },
  },
  ({ input, uses }) => {
    // Without an email there is no domain to research and no person to brief.
    if (!input.email) {
      return { status: "skipped_no_email" as const };
    }

    const verdict = uses.researcher({
      prompt: `Research and tier this new inbound contact. CRM record: ${JSON.stringify(input)}`,
    });

    // Fill-blank guard on the judgment, a stamp that always lands. The stamp
    // is what the play filter reads, so a contact is researched once; the
    // guard keeps a rep's hand-written tier or an earlier brief.
    uses.hubspot.updateRecords({
      objectType: "contacts",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
        {
          propertyName: "cargo_inbound_tier",
          value: verdict.answer.tier,
          skipIfExist: true,
        },
        {
          propertyName: "cargo_inbound_brief",
          value: verdict.answer.brief,
          skipIfExist: true,
        },
        {
          propertyName: "cargo_inbound_rationale",
          value: verdict.answer.rationale,
          skipIfExist: true,
        },
        { propertyName: "cargo_inbound_researched_at", value: new Date() },
      ],
    });

    // The company keeps whatever tier it already has: account-scoring, or a
    // rep, may have set it on more evidence than one inbound lead carries.
    if (input.associatedcompanyid) {
      uses.hubspot.updateRecords({
        objectType: "companies",
        matchingPropertyName: "hs_object_id",
        matchingValue: input.associatedcompanyid,
        mappings: [
          {
            propertyName: "cargo_tier",
            value: verdict.answer.tier,
            skipIfExist: true,
          },
          {
            propertyName: "cargo_tier_reason",
            value: verdict.answer.rationale,
            skipIfExist: true,
          },
        ],
      });
    }

    const ownerSlackId = input.hubspot_owner_id
      ? ownerSlackIds[input.hubspot_owner_id]
      : "";
    const ownerLine = ownerSlackId
      ? `<@${ownerSlackId}>`
      : input.hubspot_owner_id
        ? `HubSpot owner ${input.hubspot_owner_id}`
        : "No owner yet";

    uses.slack.postMessage({
      channelId: slackChannelId,
      format: "markdown",
      disableUnfurling: true,
      body: `:inbox_tray: *${input.firstname} ${input.lastname}*, ${input.jobtitle} at ${input.company} — tier *${verdict.answer.tier}*\n${verdict.answer.brief}\n_${verdict.answer.rationale}_\nOwner: ${ownerLine} · Source: ${input.hs_analytics_source}\nSources: ${verdict.answer.evidence_urls.join(" · ")}`,
    });

    return { status: "researched" as const, tier: verdict.answer.tier };
  },
);

// Researches each contact that arrives through an online channel and has not
// been researched yet.
//
// `changeKinds: ["added"]` is what makes a contact researched once on arrival:
// the model re-extracts on every sync, and only rows that were not there
// before create a run. The `cargo_inbound_researched_at` blank test is the
// second key, so re-enabling the play or a manual run never pays twice.
//
// `hs_analytics_source` is HubSpot's original source. `OFFLINE` is imports,
// integrations and contacts a rep typed in: not inbound, and the reason the
// filter excludes it. Blank HubSpot strings surface as NULL or empty, so every
// blank test pairs isNull with isEmpty.
//
// Ships disabled. Enabling is the last yes after the pilot, and
// `changeKinds: ["added"]` does not backfill what landed while it was off.
export const researchInboundContacts = definePlay("research_inbound_contacts", {
  description:
    "Researches each new inbound HubSpot contact, writes a tier and a brief onto the record, and posts a note to Slack.",
  folder: playsFolder,
  model: crmContacts,
  workflow: researchInbound,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.email,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.hs_analytics_source,
            operator: "isNot",
            values: ["OFFLINE"],
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: crmContacts.columns.cargo_inbound_researched_at,
            operator: "isNull",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "10,40 * * * *" },
});
