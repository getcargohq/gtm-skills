import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { accountQualifier } from "../agents/account-qualifier";
import { contactFinder } from "../agents/contact-finder";
import { lookalikeResearcher } from "../agents/lookalike-researcher";
import { openerWriter } from "../agents/opener-writer";
import { emailVerification } from "../connectors/email-verification";
import { playsFolder } from "../folders";
import { lookalikeProspects } from "../models/lookalike-prospects";
import { lookalikeSeeds } from "../models/lookalike-seeds";
import { gateAccount } from "../scripts/lookalikes/gate-account";
import { gateContact } from "../scripts/lookalikes/gate-contact";
import { scorePersona } from "../scripts/lookalikes/score-persona";
import { lookalikesPerCustomer } from "../settings";

// One customer in, up to five judged lookalikes out:
//
//   exclusions   every customer, and every company already found for this one
//   research     lookalikes of the customer at the moment they bought
//   per company  skip if already judged, then four gates, cheapest first:
//                account fit and situation -> a person -> a verified email ->
//                a persona score -> a two-sentence opener
//
// Every company the researcher returns gets a row in `lookalike_prospects`
// with the verdict of the gate it stopped at, so it is judged once and the
// next month's research can exclude it. Nothing is sent to anyone: the play
// ends at the row.
//
// Each stage writes its verdict BEFORE its guard, and the guard is a bare
// `continue`. Do not fold the write into the guard
// (`if (stop) { model.upsert(…); continue; }`): the workflow parser in
// @cargo-ai/cdk 1.0.119 rewrites a guard that ends in `continue` into an empty
// branch, and the write inside it silently disappears from the graph.
const findLookalikesForCustomer = defineWorkflow(
  "find_lookalikes_for_customer",
  {
    input: z.object({
      customer: z.string(),
      domain: z.string(),
      relationship: z.string().optional(),
      what_they_bought: z.string().optional(),
      deal_shape: z.string().optional(),
      trigger: z.string().optional(),
      signer: z.string().optional(),
      at_purchase: z.string().optional(),
      segment_hint: z.string().optional(),
      notes: z.string().optional(),
    }),
    output: z.object({ status: z.string() }),
    uses: {
      lookalikeResearcher,
      accountQualifier,
      contactFinder,
      openerWriter,
      emailVerification,
    },
    imports: { lookalikeSeeds, lookalikeProspects, lookalikesPerCustomer },
  },
  ({ input, uses, model }) => {
    // The exclusions. Without them the same lookalikes come back every month
    // and each one is scored, searched and enriched again.
    const customers = model.search({
      modelUuid: lookalikeSeeds.uuid,
      limit: 100,
      selectedColumnSlugs: ["domain"],
    });
    const alreadyFound = model.search({
      modelUuid: lookalikeProspects.uuid,
      filter: {
        conjonction: "and",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                kind: "string",
                columnSlug: "seed_domain",
                operator: "is",
                values: [input.domain],
              },
            ],
          },
        ],
      },
      limit: 100,
      selectedColumnSlugs: ["domain"],
    });

    const research = uses.lookalikeResearcher({
      prompt: `Find up to ${lookalikesPerCustomer} lookalikes for this customer.

customer: ${input.customer}
domain: ${input.domain}
relationship: ${input.relationship}
what they bought: ${input.what_they_bought}
deal: ${input.deal_shape}
why they bought: ${input.trigger}
who signed: ${input.signer}
at purchase: ${input.at_purchase}
segment hint: ${input.segment_hint}
notes: ${input.notes}

Never return these domains, our customers: ${JSON.stringify(customers)}
Never return these domains, already found for this customer: ${JSON.stringify(alreadyFound)}

Return only the JSON object.`,
    });

    // Inside the loop `input` is the lookalike, not the customer: the
    // customer's fields come from the research answer.
    for (const lookalike of research.answer.lookalikes) {
      // A company already in the ledger was judged before, by this customer or
      // another. Skip it and pay for nothing.
      const known = model.search({
        modelUuid: lookalikeProspects.uuid,
        filter: {
          conjonction: "and",
          groups: [
            {
              conjonction: "and",
              conditions: [
                {
                  kind: "string",
                  columnSlug: "domain",
                  operator: "is",
                  values: [lookalike.domain],
                },
              ],
            },
          ],
        },
        limit: 1,
        selectedColumnSlugs: ["domain"],
      });
      if (known.length > 0) continue;

      // Gate 1: the account.
      const account = uses.accountQualifier({
        prompt: `Score this company now.

company: ${lookalike.company}
domain: ${lookalike.domain}
linkedin: ${lookalike.linkedin_url}
why it looks like a customer: ${lookalike.why_similar}
seed customer: ${research.answer.seed_customer} (${research.answer.seed_domain}). Its shape at purchase: ${research.answer.seed_summary}
today: ${new Date().toISOString()}

Return only the JSON object.`,
      });
      const accountGate = gateAccount({ account: account.answer });

      model.upsert({
        modelUuid: lookalikeProspects.uuid,
        matchingColumnSlug: "domain",
        matchingValue: lookalike.domain,
        mappings: [
          { columnSlug: "domain", value: lookalike.domain },
          { columnSlug: "company", value: lookalike.company },
          { columnSlug: "linkedin_url", value: lookalike.linkedin_url },
          { columnSlug: "seed_customer", value: research.answer.seed_customer },
          { columnSlug: "seed_domain", value: research.answer.seed_domain },
          { columnSlug: "why_similar", value: lookalike.why_similar },
          {
            columnSlug: "similarity_evidence",
            value: lookalike.evidence_urls.join(" "),
          },
          { columnSlug: "account_fit", value: account.answer.account_fit },
          { columnSlug: "tier", value: account.answer.tier },
          { columnSlug: "situation", value: account.answer.situation },
          { columnSlug: "urgency", value: account.answer.urgency },
          { columnSlug: "roles_present", value: account.answer.roles_present },
          { columnSlug: "roles_missing", value: account.answer.roles_missing },
          {
            columnSlug: "coverage_ratio",
            value: account.answer.coverage_ratio,
          },
          { columnSlug: "verdict", value: accountGate.verdict },
          {
            columnSlug: "verdict_reason",
            value: account.answer.verdict_reason,
          },
          {
            columnSlug: "score_evidence",
            value: account.answer.evidence_urls.join(" "),
          },
          { columnSlug: "run_at", value: new Date().toISOString() },
        ],
      });
      if (accountGate.viable !== true) continue;

      // Gate 2: a person to write to, aimed at the function nobody owns.
      const contact = uses.contactFinder({
        prompt: `Find the one person to write to.

company: ${lookalike.company}
domain: ${lookalike.domain}
tier: ${account.answer.tier}
roles present: ${account.answer.roles_present}
roles missing: ${account.answer.roles_missing}
urgency: ${account.answer.urgency}

Return only the JSON object.`,
      });
      const contactGate = gateContact({ contact: contact.answer });

      model.upsert({
        modelUuid: lookalikeProspects.uuid,
        matchingColumnSlug: "domain",
        matchingValue: lookalike.domain,
        mappings: [
          {
            columnSlug: "contact_name",
            value: `${contact.answer.first_name} ${contact.answer.last_name}`,
          },
          { columnSlug: "contact_title", value: contact.answer.title },
          {
            columnSlug: "contact_linkedin",
            value: contact.answer.linkedin_url,
          },
          { columnSlug: "contact_email", value: contact.answer.email },
          { columnSlug: "persona_tier", value: contact.answer.persona_tier },
          { columnSlug: "verdict", value: contactGate.verdict },
        ],
      });
      if (contactGate.found !== true) continue;

      // Gates 3 and 4: a verified email, then the persona score. The verifier
      // may fail; the script reads an empty verdict as not verified.
      const verification = uses.emailVerification.verifyEmail(
        { email: contact.answer.email },
        { continueOnFailure: true },
      );
      const persona = scorePersona({
        personaTier: contact.answer.persona_tier,
        verification: verification,
        startedRoleOn: contact.answer.started_role_on,
      });

      model.upsert({
        modelUuid: lookalikeProspects.uuid,
        matchingColumnSlug: "domain",
        matchingValue: lookalike.domain,
        mappings: [
          { columnSlug: "email_status", value: persona.emailStatus },
          { columnSlug: "persona_score", value: persona.personaScore },
          { columnSlug: "persona_reason", value: persona.reason },
          { columnSlug: "verdict", value: persona.verdict },
        ],
      });
      if (persona.qualified !== true) continue;

      // Only a qualified person costs a writer call.
      const opener = uses.openerWriter({
        prompt: `first_name: ${contact.answer.first_name}
title: ${contact.answer.title}
company: ${lookalike.company}
urgency: ${account.answer.urgency}
roles_missing: ${account.answer.roles_missing}
why_similar: ${lookalike.why_similar}

Return only the JSON object.`,
      });

      model.upsert({
        modelUuid: lookalikeProspects.uuid,
        matchingColumnSlug: "domain",
        matchingValue: lookalike.domain,
        mappings: [
          { columnSlug: "subject", value: opener.answer.subject },
          { columnSlug: "opener", value: opener.answer.opener },
          { columnSlug: "verdict", value: "drafted" },
        ],
      });
    }

    return { status: "done" };
  },
);

// Every customer row, once a month: the 1st at 07:00 UTC. All three change
// kinds, because the point is that an unchanged customer still yields new
// lookalikes each month; the exclusions are what stop it paying twice for the
// same company.
//
// Ships disabled. Pilot one customer through the workflow first
// (references/run.md), then enable.
export const findLookalikes = definePlay("find_lookalikes", {
  description:
    "Once a month, finds up to five lookalikes of each customer, scores each against the rubric, finds and verifies the one person to write to, and drafts a two-sentence opener for the ones that qualify.",
  folder: playsFolder,
  model: lookalikeSeeds,
  workflow: findLookalikesForCustomer,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added", "updated", "unchanged"],
  schedule: { type: "cron", cron: "0 7 1 * *" },
});
