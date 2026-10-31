import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { firstTouchWriter } from "../agents/first-touch-writer";
import { aiArk } from "../connectors/ai-ark";
import { prospeo } from "../connectors/prospeo";
import { toolsFolder } from "../folders";
import { cockpitClaims } from "../models/cockpit-claims";
import { cockpitDrafts } from "../models/cockpit-drafts";
import { gtmAccounts } from "../models/gtm-accounts";
import { gtmContacts } from "../models/gtm-contacts";
import {
  committeeDepartments,
  committeeSeniorities,
  contactsPerClaim,
} from "../settings";

// The claim row and the people search's row, as far as this workflow reads
// them. With the project's integration types generated, the search returns a
// typed reference that TypeScript will not iterate; naming the row type makes
// the loop typecheck, and the cast is stripped before the body is parsed.
type ClaimRow = {
  account_domain: string;
  account_name: string;
  rep_email: string;
  rep_name: string;
  account_context: string;
};

type SourcedPerson = {
  linkedin_url: string;
  full_name: string;
  first_name: string;
  last_name: string;
  title: string;
  headline: string;
  city: string;
  country: string;
};

// One claim, server-side, in one run: the cockpit starts it and never
// orchestrates the steps itself, so closing the tab never stops sourcing.
//
//   account   -> upserted on gtm_accounts by website
//   committee -> AI Ark people search at the domain, `contactsPerClaim` people
//   each      -> gtm_contacts row, Prospeo email, one draft from the writer
//   claim     -> sourcing_status ready, with the count
//
// The cockpit writes the claim row itself the moment the rep clicks, so a
// teammate sees it at once. This run writes it again at the start (the run is
// the durable path if the click's write was lost) and at the end.
const claimAccountWorkflow = defineWorkflow(
  "claim_account",
  {
    input: z.object({
      account_domain: z.string(),
      account_name: z.string(),
      rep_email: z.string(),
      rep_first_name: z.string(),
      // What the queue knew about the account: tier and its reason, readiness
      // and its signals. Passed to the writer as ACCOUNT CONTEXT.
      account_context: z.string().optional(),
    }),
    output: z.object({ contacts_found: z.number() }),
    uses: { aiArk, prospeo, firstTouchWriter },
    imports: {
      gtmAccounts,
      gtmContacts,
      cockpitClaims,
      cockpitDrafts,
      contactsPerClaim,
      committeeSeniorities,
      committeeDepartments,
    },
  },
  ({ input, uses, model }) => {
    const accounts = model.upsert({
      modelUuid: gtmAccounts.uuid,
      matchingColumnSlug: "website",
      matchingValue: input.account_domain,
      mappings: [
        { columnSlug: "website", value: input.account_domain },
        { columnSlug: "name", value: input.account_name },
      ],
    });

    // Inside the loop below, `input` is the person being iterated, not this
    // tool's input: every value the loop needs from the claim is read from
    // this row instead. An earlier node's output is the one thing a loop
    // iteration can see.
    const claims = model.upsert<ClaimRow>({
      modelUuid: cockpitClaims.uuid,
      matchingColumnSlug: "account_domain",
      matchingValue: input.account_domain,
      mappings: [
        { columnSlug: "account_domain", value: input.account_domain },
        { columnSlug: "account_name", value: input.account_name },
        { columnSlug: "account_id", value: accounts[0].id },
        { columnSlug: "rep_email", value: input.rep_email },
        { columnSlug: "rep_name", value: input.rep_first_name },
        { columnSlug: "account_context", value: input.account_context },
        { columnSlug: "status", value: "claimed" },
        { columnSlug: "status_at", value: new Date() },
        { columnSlug: "sourcing_status", value: "running" },
      ],
    });

    const people = uses.aiArk.searchPeople({
      companyInfo: { domain_or: [input.account_domain] },
      jobRole: {
        seniority_or: committeeSeniorities,
        department_or: committeeDepartments,
      },
      limit: contactsPerClaim,
    }) as unknown as SourcedPerson[];

    for (const person of people) {
      const contacts = model.upsert<{ id: string }>({
        modelUuid: gtmContacts.uuid,
        matchingColumnSlug: "linkedin_url",
        matchingValue: person.linkedin_url,
        mappings: [
          { columnSlug: "linkedin_url", value: person.linkedin_url },
          { columnSlug: "account_id", value: accounts[0].id },
          { columnSlug: "name", value: person.full_name },
          { columnSlug: "first_name", value: person.first_name },
          { columnSlug: "last_name", value: person.last_name },
          { columnSlug: "title", value: person.title },
          { columnSlug: "lead_source", value: "rep_cockpit" },
        ],
      });

      // A miss is a normal answer, not a failed claim: the run goes on, the
      // draft is still written, and the cockpit shows the person as no_email.
      const found = uses.prospeo.findEmail(
        {
          firstName: person.first_name,
          lastName: person.last_name,
          companyDomain: claims[0].account_domain,
        },
        { continueOnFailure: true },
      );

      const draft = uses.firstTouchWriter({
        prompt: `SENDER: ${claims[0].rep_name}
ACCOUNT: ${claims[0].account_name} (${claims[0].account_domain})
ACCOUNT CONTEXT: ${claims[0].account_context}
PERSON: ${person.full_name}, ${person.title}
HEADLINE: ${person.headline}
LOCATION: ${person.city}, ${person.country}
LINKEDIN: ${person.linkedin_url}`,
      });

      if (found.person.email.email) {
        model.upsert({
          modelUuid: gtmContacts.uuid,
          matchingColumnSlug: "linkedin_url",
          matchingValue: person.linkedin_url,
          mappings: [{ columnSlug: "email", value: found.person.email.email }],
        });
        model.upsert({
          modelUuid: cockpitDrafts.uuid,
          matchingColumnSlug: "contact_id",
          matchingValue: contacts[0].id,
          mappings: [
            { columnSlug: "contact_id", value: contacts[0].id },
            { columnSlug: "account_domain", value: claims[0].account_domain },
            { columnSlug: "account_id", value: accounts[0].id },
            { columnSlug: "account_name", value: claims[0].account_name },
            { columnSlug: "rep_email", value: claims[0].rep_email },
            { columnSlug: "rep_name", value: claims[0].rep_name },
            { columnSlug: "contact_name", value: person.full_name },
            { columnSlug: "contact_title", value: person.title },
            { columnSlug: "contact_email", value: found.person.email.email },
            { columnSlug: "linkedin_url", value: person.linkedin_url },
            { columnSlug: "subject", value: draft.answer.subject },
            { columnSlug: "body", value: draft.answer.body },
            { columnSlug: "why_now", value: draft.answer.why_now },
            { columnSlug: "status", value: "draft" },
            { columnSlug: "touches", value: 0 },
            { columnSlug: "drafted_at", value: new Date() },
          ],
        });
      } else {
        model.upsert({
          modelUuid: cockpitDrafts.uuid,
          matchingColumnSlug: "contact_id",
          matchingValue: contacts[0].id,
          mappings: [
            { columnSlug: "contact_id", value: contacts[0].id },
            { columnSlug: "account_domain", value: claims[0].account_domain },
            { columnSlug: "account_id", value: accounts[0].id },
            { columnSlug: "account_name", value: claims[0].account_name },
            { columnSlug: "rep_email", value: claims[0].rep_email },
            { columnSlug: "rep_name", value: claims[0].rep_name },
            { columnSlug: "contact_name", value: person.full_name },
            { columnSlug: "contact_title", value: person.title },
            { columnSlug: "linkedin_url", value: person.linkedin_url },
            { columnSlug: "subject", value: draft.answer.subject },
            { columnSlug: "body", value: draft.answer.body },
            { columnSlug: "why_now", value: draft.answer.why_now },
            { columnSlug: "status", value: "no_email" },
            { columnSlug: "touches", value: 0 },
            { columnSlug: "drafted_at", value: new Date() },
          ],
        });
      }
    }

    model.upsert({
      modelUuid: cockpitClaims.uuid,
      matchingColumnSlug: "account_domain",
      matchingValue: input.account_domain,
      mappings: [
        { columnSlug: "sourcing_status", value: "ready" },
        { columnSlug: "contacts_found", value: people.length },
      ],
    });

    return { contacts_found: people.length };
  },
);

export const claimAccount = defineTool("rep_cockpit_claim_account", {
  name: "Cockpit · Claim account",
  description:
    "Claims one account for a rep: sources its buying committee, finds each person's work email, and drafts a first touch per person for review in the cockpit.",
  workflow: claimAccountWorkflow,
  folder: toolsFolder,
});
