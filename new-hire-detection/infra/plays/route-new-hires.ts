import { definePlay, defineWorkflow, toolRef } from "@cargo-ai/cdk";
import { z } from "zod";

import { icpQualifier } from "../agents/icp-qualifier";
import { crm } from "../connectors/crm";
import { linkedin } from "../connectors/linkedin";
import { playsFolder } from "../folders";
import { newHires } from "../models/new-hires";

// Instantiate Cargo's native Find Email tool, confirm that it accepts these
// inputs, and replace this value with its deployed tool UUID. Confirm the
// release output path before deployment; this example expects `email`.
const findEmail = toolRef<{ email?: string }>(
  "REPLACE-WITH-FIND-EMAIL-TOOL-UUID",
);

// PLACEHOLDER: the HubSpot owner ID that receives accounts this play creates.
// A new account has no owner until someone is named, and a task with no owner
// lands in nobody's queue. Resolve it from the live owner list; never guess.
const newAccountOwnerId = "REPLACE-WITH-HUBSPOT-OWNER-ID";

// HubSpot's task-to-company and task-to-contact association types. A task
// cannot be associated when it is created (`insertRecord` takes mappings
// only), so each task is followed by explicit associations, or it surfaces in
// a task list detached from the account a rep would open.
const taskToCompany = "HUBSPOT_DEFINED:192";
const taskToContact = "HUBSPOT_DEFINED:204";

// One person who just took a target role. The same event means different
// things depending on what the CRM already holds, and the routes below are
// the play:
//
//   not in the CRM      -> qualify, then create the account, the contact and
//                          a task for the new account's owner
//   open opportunity    -> a new decision-maker mid-deal: tell the owner now
//   customer            -> a new stakeholder who did not choose you: the
//                          owner welcomes them before they form a view
//   known, no open deal -> a reason to call an account that already has an
//                          owner
//
// On every account the CRM already holds, a person who is already a contact
// there is not news, so the run stops before paying for an email. Ends at the
// CRM write: no message is drafted or sent.
const routeNewHire = defineWorkflow(
  "route-new-hire",
  {
    // The `fetchLeadSearch` columns this workflow reads. Confirm them against
    // the live model after the first sync (`cargo-ai storage column list`).
    input: z.object({
      linkedin_profile_url: z.string(),
      sales_navigator_company_url: z.string(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      job_title: z.string().optional(),
      company_name: z.string().optional(),
      tenure_length: z.string().optional(),
    }),
    output: z.object({
      route: z.enum([
        "no_domain",
        "new_account",
        "open_opportunity",
        "customer",
        "known_account",
      ]),
      status: z.enum([
        "written",
        "not_icp",
        "contact_already_in_crm",
        "skipped",
      ]),
      rationale: z.string().optional(),
    }),
    uses: { crm, linkedin, findEmail, icpQualifier },
    imports: { newAccountOwnerId, taskToCompany, taskToContact },
  },
  ({ input, uses }) => {
    // The lead carries a company URL, not a domain, and the CRM is matched on
    // the domain. Enrich first, match second.
    const company = uses.linkedin.enrichCompany({
      linkedinUrl: input.sales_navigator_company_url,
    });

    // The domain guard. An empty domain matches nothing in HubSpot and
    // everything in a `contains` lookup on other CRMs; either way the route
    // would be wrong, so the run stops here.
    if (!company.domain) {
      return { route: "no_domain" as const, status: "skipped" as const };
    }

    // HubSpot matches `domain` exactly. A CRM that stores `www.` prefixes or
    // full URLs needs the variant searched too, or every known account looks
    // new and the qualifier creates a duplicate.
    const accounts = uses.crm.searchRecords({
      objectType: "companies",
      limit: 1,
      filter: {
        conjonction: "or",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                propertyName: "domain",
                operator: "is",
                values: [company.domain],
              },
            ],
          },
        ],
      },
    });

    if (accounts.length === 0) {
      // New account: the only route that pays for a qualification, and the
      // only one that gates. A company the ICP rejects never reaches the CRM.
      const verdict = uses.icpQualifier({
        prompt: `Qualify ${company.company_name} (${company.domain}) against the ICP. ${input.first_name} ${input.last_name} just joined as ${input.job_title}. Company object: ${JSON.stringify(company)}`,
      });

      if (!verdict.answer.is_icp) {
        return {
          route: "new_account" as const,
          status: "not_icp" as const,
          rationale: verdict.answer.rationale,
        };
      }

      const created = uses.crm.upsertRecords({
        objectType: "companies",
        matchingPropertyName: "domain",
        matchingValue: company.domain,
        mappings: [
          { propertyName: "name", value: company.company_name },
          { propertyName: "website", value: company.website },
          {
            propertyName: "linkedin_company_page",
            value: company.linkedin_url,
          },
          {
            propertyName: "numberofemployees",
            value: company.employee_count,
          },
          { propertyName: "lifecyclestage", value: "lead" },
          { propertyName: "hubspot_owner_id", value: newAccountOwnerId },
        ],
      });

      const found = uses.findEmail({
        linkedin_url: input.linkedin_profile_url,
        first_name: input.first_name,
        last_name: input.last_name,
      });

      // Keyed on the email when one was found, so the contact dedupes against
      // one the team created by hand; keyed on the LinkedIn URL when not, so
      // it is still reachable and still dedupes on the next sync.
      const contact = uses.crm.upsertRecords({
        objectType: "contacts",
        matchingPropertyName: found.email ? "email" : "hs_linkedin_url",
        matchingValue: found.email ? found.email : input.linkedin_profile_url,
        mappings: [
          { propertyName: "email", value: found.email ? found.email : "" },
          { propertyName: "firstname", value: input.first_name },
          { propertyName: "lastname", value: input.last_name },
          { propertyName: "jobtitle", value: input.job_title },
          {
            propertyName: "hs_linkedin_url",
            value: input.linkedin_profile_url,
          },
          { propertyName: "associatedcompanyid", value: created[0].id },
        ],
      });

      const task = uses.crm.insertRecord({
        objectType: "tasks",
        mappings: [
          {
            propertyName: "hs_task_subject",
            value: `New ${input.job_title} at ${company.company_name}, a new ${verdict.answer.fit_tier} account`,
          },
          {
            propertyName: "hs_task_body",
            value: `${input.first_name} ${input.last_name} just joined ${company.company_name} as ${input.job_title} (${input.tenure_length}). The account was not in the CRM; it was created because it qualified.\n\nICP: ${verdict.answer.fit_tier}, ${verdict.answer.fit_score}/100, ${verdict.answer.confidence} confidence. ${verdict.answer.rationale}\n\nLinkedIn: ${input.linkedin_profile_url}`,
          },
          { propertyName: "hs_task_status", value: "NOT_STARTED" },
          { propertyName: "hs_task_priority", value: "MEDIUM" },
          { propertyName: "hs_task_type", value: "TODO" },
          { propertyName: "hs_timestamp", value: new Date() },
          { propertyName: "hubspot_owner_id", value: newAccountOwnerId },
        ],
      });

      uses.crm.createAssociation(
        {
          fromObjectType: "tasks",
          fromObjectId: task[0].id,
          toObjectType: "companies",
          toObjectId: created[0].id,
          associationTypeId: taskToCompany,
        },
        { continueOnFailure: true },
      );
      uses.crm.createAssociation(
        {
          fromObjectType: "tasks",
          fromObjectId: task[0].id,
          toObjectType: "contacts",
          toObjectId: contact[0].id,
          associationTypeId: taskToContact,
        },
        { continueOnFailure: true },
      );

      return {
        route: "new_account" as const,
        status: "written" as const,
        rationale: verdict.answer.rationale,
      };
    }

    // The account is in the CRM. Its lifecycle stage is the routing signal in
    // HubSpot; confirm it is actually maintained before trusting it (see
    // references/crm-adaptation.md for routing on deals instead).
    const stage = accounts[0].properties.lifecyclestage;
    const route =
      stage === "opportunity"
        ? ("open_opportunity" as const)
        : stage === "customer"
          ? ("customer" as const)
          : ("known_account" as const);

    const known = uses.crm.searchRecords({
      objectType: "contacts",
      limit: 1,
      filter: {
        conjonction: "or",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                propertyName: "hs_linkedin_url",
                operator: "is",
                values: [input.linkedin_profile_url],
              },
            ],
          },
        ],
      },
    });

    if (known.length > 0) {
      return { route, status: "contact_already_in_crm" as const };
    }

    const found = uses.findEmail({
      linkedin_url: input.linkedin_profile_url,
      first_name: input.first_name,
      last_name: input.last_name,
    });

    const contact = uses.crm.upsertRecords({
      objectType: "contacts",
      matchingPropertyName: found.email ? "email" : "hs_linkedin_url",
      matchingValue: found.email ? found.email : input.linkedin_profile_url,
      mappings: [
        { propertyName: "email", value: found.email ? found.email : "" },
        { propertyName: "firstname", value: input.first_name },
        { propertyName: "lastname", value: input.last_name },
        { propertyName: "jobtitle", value: input.job_title },
        { propertyName: "hs_linkedin_url", value: input.linkedin_profile_url },
        { propertyName: "associatedcompanyid", value: accounts[0].id },
      ],
    });

    // The routes differ in who is told, how urgently and why. Each task goes
    // to the account owner and sits on both the account and the contact.
    if (stage === "opportunity") {
      // The highest-urgency route and the one most CRMs miss: a new
      // decision-maker landed mid-deal. The owner hears it today.
      const task = uses.crm.insertRecord({
        objectType: "tasks",
        mappings: [
          {
            propertyName: "hs_task_subject",
            value: `New decision-maker mid-deal: ${input.first_name} ${input.last_name}, ${input.job_title} at ${company.company_name}`,
          },
          {
            propertyName: "hs_task_body",
            value: `${input.first_name} ${input.last_name} just joined ${company.company_name} as ${input.job_title} (${input.tenure_length}), and the account has an open deal. They were not in the CRM before today. Multi-thread now: a new decision-maker either unblocks the deal or restarts it.\n\nLinkedIn: ${input.linkedin_profile_url}`,
          },
          { propertyName: "hs_task_status", value: "NOT_STARTED" },
          { propertyName: "hs_task_priority", value: "HIGH" },
          { propertyName: "hs_task_type", value: "TODO" },
          { propertyName: "hs_timestamp", value: new Date() },
          {
            propertyName: "hubspot_owner_id",
            value: accounts[0].properties.hubspot_owner_id,
          },
        ],
      });
      uses.crm.createAssociation(
        {
          fromObjectType: "tasks",
          fromObjectId: task[0].id,
          toObjectType: "companies",
          toObjectId: accounts[0].id,
          associationTypeId: taskToCompany,
        },
        { continueOnFailure: true },
      );
      uses.crm.createAssociation(
        {
          fromObjectType: "tasks",
          fromObjectId: task[0].id,
          toObjectType: "contacts",
          toObjectId: contact[0].id,
          associationTypeId: taskToContact,
        },
        { continueOnFailure: true },
      );
      return { route: "open_opportunity" as const, status: "written" as const };
    } else if (stage === "customer") {
      // A new leader inside a customer is a churn risk before it is an
      // expansion: they did not choose you. The account owner welcomes them
      // before they form a view.
      const task = uses.crm.insertRecord({
        objectType: "tasks",
        mappings: [
          {
            propertyName: "hs_task_subject",
            value: `New ${input.job_title} at customer ${company.company_name}: welcome them before they form a view`,
          },
          {
            propertyName: "hs_task_body",
            value: `${input.first_name} ${input.last_name} just joined ${company.company_name} as ${input.job_title} (${input.tenure_length}). This is a customer, and a new leader arrives with opinions about the tools they used before. Welcome them and walk them through what the team already runs this week, before the renewal becomes their decision instead of the team's.\n\nLinkedIn: ${input.linkedin_profile_url}`,
          },
          { propertyName: "hs_task_status", value: "NOT_STARTED" },
          { propertyName: "hs_task_priority", value: "HIGH" },
          { propertyName: "hs_task_type", value: "TODO" },
          { propertyName: "hs_timestamp", value: new Date() },
          {
            propertyName: "hubspot_owner_id",
            value: accounts[0].properties.hubspot_owner_id,
          },
        ],
      });
      uses.crm.createAssociation(
        {
          fromObjectType: "tasks",
          fromObjectId: task[0].id,
          toObjectType: "companies",
          toObjectId: accounts[0].id,
          associationTypeId: taskToCompany,
        },
        { continueOnFailure: true },
      );
      uses.crm.createAssociation(
        {
          fromObjectType: "tasks",
          fromObjectId: task[0].id,
          toObjectType: "contacts",
          toObjectId: contact[0].id,
          associationTypeId: taskToContact,
        },
        { continueOnFailure: true },
      );
      return { route: "customer" as const, status: "written" as const };
    } else {
      // Known account, no open deal: it already has an owner, so it is
      // neither re-qualified nor dropped. The owner gets a reason to call.
      const task = uses.crm.insertRecord({
        objectType: "tasks",
        mappings: [
          {
            propertyName: "hs_task_subject",
            value: `New ${input.job_title} at ${company.company_name}: a reason to reach out`,
          },
          {
            propertyName: "hs_task_body",
            value: `${input.first_name} ${input.last_name} just joined ${company.company_name} as ${input.job_title} (${input.tenure_length}). The account is in the CRM with no open deal. A new leader has a mandate and no vendor loyalty yet.\n\nLinkedIn: ${input.linkedin_profile_url}`,
          },
          { propertyName: "hs_task_status", value: "NOT_STARTED" },
          { propertyName: "hs_task_priority", value: "MEDIUM" },
          { propertyName: "hs_task_type", value: "TODO" },
          { propertyName: "hs_timestamp", value: new Date() },
          {
            propertyName: "hubspot_owner_id",
            value: accounts[0].properties.hubspot_owner_id,
          },
        ],
      });
      uses.crm.createAssociation(
        {
          fromObjectType: "tasks",
          fromObjectId: task[0].id,
          toObjectType: "companies",
          toObjectId: accounts[0].id,
          associationTypeId: taskToCompany,
        },
        { continueOnFailure: true },
      );
      uses.crm.createAssociation(
        {
          fromObjectType: "tasks",
          fromObjectId: task[0].id,
          toObjectType: "contacts",
          toObjectId: contact[0].id,
          associationTypeId: taskToContact,
        },
        { continueOnFailure: true },
      );
      return { route: "known_account" as const, status: "written" as const };
    }
  },
);

// Routes every person the search adds. There is no filter: the search URL
// already IS the audience, and a segment that restated it would be a drift
// trap.
//
// `changeKinds: ["added"]` is what makes a person routed once. The model
// re-extracts the whole search on every sync, and only people who were not in
// it before create a run. Drop it and every sync re-routes the whole search,
// paying for the enrichment and the email again and raising duplicate tasks.
//
// Cron, not watch or realtime: `fetchLeadSearch` is a fetch-mode extractor,
// so realtime and watch both fail at deploy with integrationNotCompatible.
// Hourly, because the model syncs on its own schedule and a new row should not
// wait a day for its run; ticks with nothing added create nothing.
//
// Ships disabled. Enabling is the last yes after the pilot of ten, not an
// input. Enable, then execute once: `changeKinds: ["added"]` does not
// backfill rows that landed while the play was off.
export const routeNewHires = definePlay("route-new-hires", {
  description:
    "Routes each person who just took a target role into the CRM by what the CRM already holds: qualify and create, alert the deal owner, warn the account owner, or flag a known account.",
  folder: playsFolder,
  model: newHires,
  workflow: routeNewHire,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "20 * * * *" },
});
