import {
  defineConnector,
  defineModel,
  definePlay,
  defineRelationship,
  defineTool,
  defineWorkflow,
  toolRef,
} from "@cargo-ai/cdk";
import { z } from "zod";

// Checked HubSpot example. For Salesforce or Attio, replace the connector
// integration, the account extractor (HubSpot object: companies), the
// record-id field, the write action, and the fill-blank guard. Keep one
// CRM shape in this file.
const crm = defineConnector("crm", {
  integration: "hubspot",
  adopt: true,
});

export const crmAccounts = defineModel("crm_accounts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "companies", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});

const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  adopt: true,
});

const enrichCompanyData = defineWorkflow(
  "account_enrichment_workflow",
  {
    input: z.object({
      linkedinUrlOrHandle: z.string().optional(),
      domain: z.string().optional(),
    }),
    output: z.object({
      company_id: z.string().optional(),
      company_name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_url: z.string().optional(),
      employee_count: z.number().optional(),
    }),
    uses: { linkedin },
  },
  ({ input, uses }) => {
    // Keep the reusable tool safe when called outside the play. The play's
    // managed segment already excludes rows without either identifier.
    if (!input.linkedinUrlOrHandle && !input.domain) {
      return {};
    }

    if (input.linkedinUrlOrHandle) {
      const result = uses.linkedin.enrichCompany({
        linkedinUrl: input.linkedinUrlOrHandle.startsWith("http")
          ? input.linkedinUrlOrHandle
          : `https://www.linkedin.com/company/${input.linkedinUrlOrHandle}`,
      });

      return {
        company_id: result.company_id,
        company_name: result.company_name,
        domain: result.domain,
        website: result.website,
        linkedin_url: result.linkedin_url,
        employee_count: result.employee_count,
      };
    }

    const result = uses.linkedin.enrichCompanyFromDomain({
      domain: input.domain,
    });

    return {
      company_id: result.company_id,
      company_name: result.company_name,
      domain: result.domain,
      website: result.website,
      linkedin_url: result.linkedin_url,
      employee_count: result.employee_count,
    };
  },
);

export const accountEnrichment = defineTool("account_enrichment", {
  workflow: enrichCompanyData,
  name: "Account enrichment",
  description:
    "Normalize a company identifier and return enriched company data without writing to a CRM.",
});

const enrichCrmAccount = defineWorkflow(
  "enrich_crm_account",
  {
    input: z.object({
      hs_object_id: z.string(),
      linkedin_company_id: z.string().optional(),
      name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_company_page: z.string().optional(),
      numberofemployees: z.number().optional(),
    }),
    output: z.object({
      status: z.literal("written"),
      company_id: z.string().optional(),
      company_name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_url: z.string().optional(),
      employee_count: z.number().optional(),
    }),
    uses: { crm, accountEnrichment },
  },
  ({ input, uses }) => {
    // The managed segment trigger owns identifier and freshness eligibility.
    // Per-field write policy decides fill blank versus refresh selected.
    const result = uses.accountEnrichment({
      linkedinUrlOrHandle: input.linkedin_company_page,
      domain: input.domain,
    });

    // Only the play workflow writes the approved result back to the CRM.
    uses.crm.updateRecords({
      objectType: "companies",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
        {
          propertyName: "linkedin_company_id",
          value: result.company_id,
          skipIfExist: true,
        },
        {
          propertyName: "name",
          value: result.company_name,
          skipIfExist: true,
        },
        {
          propertyName: "domain",
          value: result.domain,
          skipIfExist: true,
        },
        {
          propertyName: "website",
          value: result.website,
          skipIfExist: true,
        },
        {
          propertyName: "linkedin_company_page",
          value: result.linkedin_url,
          skipIfExist: true,
        },
        {
          propertyName: "numberofemployees",
          value: result.employee_count,
          skipIfExist: true,
        },
        { propertyName: "cargo_last_enriched_at", value: new Date() },
        { propertyName: "cargo_enrichment_status", value: "succeeded" },
      ],
    });

    return {
      status: "written" as const,
      company_id: result.company_id,
      company_name: result.company_name,
      domain: result.domain,
      website: result.website,
      linkedin_url: result.linkedin_url,
      employee_count: result.employee_count,
    };
  },
);

export const enrichAccounts = definePlay("enrich_accounts", {
  model: crmAccounts,
  workflow: enrichCrmAccount,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.domain,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_page,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: crmAccounts.columns.cargo_last_enriched_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: crmAccounts.columns.cargo_last_enriched_at,
            operator: "lowerThan",
            value: "6 months",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "0 6 * * *" },
});
// ---------------------------------------------------------------------------
// People path. Same discipline as the account path above: the tool enriches
// without CRM access, the plays orchestrate and own every CRM read and write,
// and both plays run directly on the CRM contact extract matching
// hs_object_id. One CRM shape in this file: HubSpot is the checked example.
// ---------------------------------------------------------------------------

export const crmContacts = defineModel("crm_contacts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "contacts", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});

// Champion-segment membership reads the RELATED account's lifecycle stage
// through this relationship. Contact-side lifecyclestage is unreliable
// (portals do not sync it) and is never written here. A dataset's
// relationship set is replaced wholesale on deploy: if the workspace already
// declares this exact relationship, adopt it instead of creating a second
// one, and always send the full array.
export const contactPrimaryCompany = defineRelationship(
  "contact_primary_company",
  {
    from: { model: crmAccounts, column: "hs_object_id" },
    to: { model: crmContacts, column: "associatedcompanyid" },
    relation: "oneToMany",
  },
);

// PLACEHOLDER: instantiate Cargo's "Find LinkedIn URL from email" template
// tool in the workspace (template catalog), then paste its UUID here. The
// waterfall inside it prices per resolved row; record the live quote at the
// field-selection gate.
const findLinkedinUrlFromEmail = toolRef<{ linkedin_url?: string }>(
  "REPLACE-WITH-FIND-LINKEDIN-URL-FROM-EMAIL-TOOL-UUID",
);

// The linkedin.enrichProfile output paths below were verified live on
// 2026-09-03 (flat schema: profile_id, job_title, linkedin_url, company,
// company_domain, company_linkedin_url, experiences). The resolver tool's
// output path is a PLACEHOLDER: confirm it on the instantiated template
// tool's release before deploying.
const enrichContactData = defineWorkflow(
  "contact_enrichment_workflow",
  {
    input: z.object({
      linkedinUrl: z.string().optional(),
      email: z.string().optional(),
    }),
    output: z.object({
      person_id: z.string().optional(),
      job_title: z.string().optional(),
      linkedin_url: z.string().optional(),
      company_name: z.string().optional(),
      company_domain: z.string().optional(),
      company_linkedin_url: z.string().optional(),
      profile_json: z.string().optional(),
    }),
    uses: { linkedin, findLinkedinUrlFromEmail },
  },
  ({ input, uses }) => {
    // Keep the reusable tool safe when called outside the plays. Both play
    // filters already exclude rows without either identifier.
    if (!input.linkedinUrl && !input.email) {
      return {};
    }

    if (input.linkedinUrl) {
      const profileUrl = input.linkedinUrl.startsWith("http")
        ? input.linkedinUrl
        : `https://www.linkedin.com/in/${input.linkedinUrl}`;
      const profile = uses.linkedin.enrichProfile({ linkedinUrl: profileUrl });

      return {
        person_id: profile.profile_id,
        job_title: profile.job_title,
        linkedin_url: profile.linkedin_url,
        company_name: profile.company,
        company_domain: profile.company_domain,
        company_linkedin_url: profile.company_linkedin_url,
        profile_json: JSON.stringify(profile),
      };
    }

    const resolved = uses.findLinkedinUrlFromEmail({ email: input.email });

    // The resolver found no profile: end without the person-enrich call so
    // the row takes at most one full paid chain.
    if (!resolved.linkedin_url) {
      return {};
    }

    const profile = uses.linkedin.enrichProfile({
      linkedinUrl: resolved.linkedin_url,
    });

    return {
      person_id: profile.profile_id,
      job_title: profile.job_title,
      linkedin_url: profile.linkedin_url,
      company_name: profile.company,
      company_domain: profile.company_domain,
      company_linkedin_url: profile.company_linkedin_url,
      profile_json: JSON.stringify(profile),
    };
  },
);

export const contactEnrichment = defineTool("contact_enrichment", {
  workflow: enrichContactData,
  name: "Contact enrichment",
  description:
    "Normalize a person identifier, resolve a LinkedIn profile from an email when needed, and return enriched person data without writing to a CRM.",
});

const enrichCrmContact = defineWorkflow(
  "enrich_crm_contact",
  {
    input: z.object({
      hs_object_id: z.string(),
      email: z.string().optional(),
      linkedin_profile_url: z.string().optional(),
      linkedin_person_id: z.string().optional(),
      jobtitle: z.string().optional(),
    }),
    output: z.object({
      status: z.literal("written"),
      person_id: z.string().optional(),
      job_title: z.string().optional(),
      linkedin_url: z.string().optional(),
    }),
    uses: { crm, contactEnrichment },
  },
  ({ input, uses }) => {
    // The managed segment trigger owns identifier, customer-status, and
    // freshness eligibility. Per-field write policy fills approved blanks.
    const result = uses.contactEnrichment({
      linkedinUrl: input.linkedin_profile_url,
      email: input.email,
    });

    // Only the play workflow writes the approved result back to the CRM.
    uses.crm.updateRecords({
      objectType: "contacts",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
        {
          propertyName: "linkedin_person_id",
          value: result.person_id,
          skipIfExist: true,
        },
        {
          propertyName: "linkedin_profile_url",
          value: result.linkedin_url,
          skipIfExist: true,
        },
        {
          propertyName: "jobtitle",
          value: result.job_title,
          skipIfExist: true,
        },
        { propertyName: "cargo_last_enriched_at", value: new Date() },
        { propertyName: "cargo_enrichment_status", value: "succeeded" },
      ],
    });

    return {
      status: "written" as const,
      person_id: result.person_id,
      job_title: result.job_title,
      linkedin_url: result.linkedin_url,
    };
  },
);

// Blank HubSpot values surface as NULL in the Cargo extract: a condition
// that tests only isEmpty matches nothing. Every blank test below pairs
// isNull with isEmpty.
export const enrichContacts = definePlay("enrich_contacts", {
  model: crmContacts,
  workflow: enrichCrmContact,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_profile_url,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.email,
            operator: "isNotEmpty",
          },
        ],
      },
      // Non-customer contacts only, read from the RELATED account through
      // contact_primary_company: monitor_champions owns the customer book on
      // its faster cadence. A contact with no primary company is enrichable
      // here. The audited customer-status mapping replaces lifecyclestage =
      // customer when the live CRM marks customers elsewhere.
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            relatedModelUuid: crmAccounts.uuid as unknown as string,
            columnSlug: crmAccounts.columns.lifecyclestage,
            operator: "isNull",
          },
          {
            kind: "string",
            relatedModelUuid: crmAccounts.uuid as unknown as string,
            columnSlug: crmAccounts.columns.lifecyclestage,
            operator: "isEmpty",
          },
          {
            kind: "string",
            relatedModelUuid: crmAccounts.uuid as unknown as string,
            columnSlug: crmAccounts.columns.lifecyclestage,
            operator: "isNot",
            values: ["customer"],
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.associatedcompanyid,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.associatedcompanyid,
            operator: "isEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: crmContacts.columns.cargo_last_enriched_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: crmContacts.columns.cargo_last_enriched_at,
            operator: "lowerThan",
            value: "6 months",
          },
        ],
      },
      // At least one approved destination is still blank. Remove this group
      // only for an operator-approved refresh of populated stale fields.
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_person_id,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_person_id,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_profile_url,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_profile_url,
            operator: "isEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.jobtitle,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.jobtitle,
            operator: "isEmpty",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "0 7 * * *" },
});

const slack = defineConnector("slack", {
  integration: "slack",
  adopt: true,
});

// PLACEHOLDER: replace with the Slack channel that receives champion
// job-change alerts, resolved from the live workspace before deploying. The
// operator must add the Cargo app to that channel (Slack → channel →
// Add apps → Cargo) first: a channel without the app fails at send time,
// not at build time.
const championAlertChannelId = "REPLACE-WITH-SLACK-CHANNEL-ID";

// HubSpot-defined association type ids for the checked example: contact →
// company (non-primary) 279, note → contact 202, note → company 190.
// PLACEHOLDER: verify all three against the live connector's association
// autocomplete before deploying.
const contactToCompanyTypeId = "279";
const noteToContactTypeId = "202";
const noteToCompanyTypeId = "190";

// The departure verdict is its own tool so the AI step materializes as one
// node whose answer the play branches on. Inlining ai() into branch
// conditions evaluates the prompt once per condition — and a condition like
// verdict.includes("LEFT") would then test the prompt text, which contains
// the word LEFT, instead of the model's answer.
const championVerdictWorkflow = defineWorkflow(
  "champion_verdict_workflow",
  {
    input: z.object({
      profile_json: z.string().optional(),
      crm_company_name: z.string().optional(),
      crm_company_domain: z.string().optional(),
      crm_company_linkedin_page: z.string().optional(),
    }),
    output: z.object({
      verdict: z.string().optional(),
    }),
  },
  ({ input, ai }) => {
    return {
      verdict: ai(
        `You are auditing one CRM contact against their live LinkedIn profile. CRM primary company: name "${input.crm_company_name}", domain "${input.crm_company_domain}", LinkedIn page "${input.crm_company_linkedin_page}". Live LinkedIn profile JSON, including every position in "experiences" with dates and is_current flags: ${input.profile_json}. Concurrent side positions (communities, advisory seats, volunteering, fractional work) are not primary employment. Question: did this person's PRIMARY employment change away from the CRM primary company? Answer with exactly one word: SAME if their primary employer is still the CRM primary company, MOVED if their primary employer is now a different company, LEFT if they left and no new primary employer is visible.`,
      ),
    };
  },
);

export const championVerdict = defineTool("champion_verdict", {
  workflow: championVerdictWorkflow,
  name: "Champion verdict",
  description:
    "Decide from a full LinkedIn profile and the CRM primary company whether a person's primary employment is unchanged, moved, or ended, ignoring concurrent side positions.",
});

const monitorCrmChampion = defineWorkflow(
  "monitor_crm_champion",
  {
    input: z.object({
      hs_object_id: z.string(),
      email: z.string().optional(),
      linkedin_profile_url: z.string().optional(),
      jobtitle: z.string().optional(),
      associatedcompanyid: z.string().optional(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
    }),
    output: z.object({
      status: z.enum([
        "left_no_new_company",
        "active_same_company",
        "job_change_updated",
        "job_change_unresolved",
      ]),
      target_contact_id: z.string().optional(),
      new_company_id: z.string().optional(),
    }),
    uses: { crm, slack, contactEnrichment, championVerdict },
    imports: {
      championAlertChannelId,
      contactToCompanyTypeId,
      noteToContactTypeId,
      noteToCompanyTypeId,
    },
  },
  ({ input, uses }) => {
    // The play filter owns eligibility: related-account customer status,
    // primary company link, identifier, and the 30-day freshness window.
    const enriched = uses.contactEnrichment({
      linkedinUrl: input.linkedin_profile_url,
      email: input.email,
    });

    // The contact's primary company record: identity for the deterministic
    // guards, name and owner for the note and the alert.
    const crmCompanies = uses.crm.findRecords({
      objectType: "companies",
      criterias: [
        { propertyName: "hs_object_id", value: input.associatedcompanyid },
      ],
    });
    const crmCompany = crmCompanies[0];

    // Deterministic same-company guards: LinkedIn company identity first,
    // domain second. A work email or its domain is never the person identity
    // and never proof of a job change.
    const liPageKey = enriched.company_linkedin_url
      ? enriched.company_linkedin_url
          .toLowerCase()
          .replace("https://", "")
          .replace("http://", "")
          .replace("www.", "")
          .replace(/\/+$/, "")
      : "";
    const crmPageKey = crmCompany?.properties.linkedin_company_page
      ? crmCompany.properties.linkedin_company_page
          .toLowerCase()
          .replace("https://", "")
          .replace("http://", "")
          .replace("www.", "")
          .replace(/\/+$/, "")
      : "";
    const liDomainKey = enriched.company_domain
      ? enriched.company_domain.toLowerCase().replace("www.", "")
      : "";
    const crmDomainKey = crmCompany?.properties.domain
      ? crmCompany.properties.domain.toLowerCase().replace("www.", "")
      : "";
    const sameCompany =
      liPageKey && crmPageKey
        ? liPageKey === crmPageKey
        : liDomainKey && crmDomainKey
          ? liDomainKey === crmDomainKey
          : false;

    if (!sameCompany) {
      // The guards could not confirm the company, so the departure verdict
      // is the AI tool over the complete profile, dates and concurrent
      // positions included. Profiles with side positions (communities,
      // advisory seats) make a bare current-company comparison misfire.
      const decided = uses.championVerdict({
        profile_json: enriched.profile_json,
        crm_company_name: crmCompany?.properties.name,
        crm_company_domain: crmCompany?.properties.domain,
        crm_company_linkedin_page: crmCompany?.properties.linkedin_company_page,
      });
      const verdict = decided.verdict;

      if (verdict.includes("LEFT")) {
        // Keep the existing company association; the next cycle retries.
        uses.crm.updateRecords({
          objectType: "contacts",
          matchingPropertyName: "hs_object_id",
          matchingValue: input.hs_object_id,
          mappings: [
            { propertyName: "primary_employment_status", value: "Left" },
            { propertyName: "cargo_last_enriched_at", value: new Date() },
            { propertyName: "cargo_enrichment_status", value: "succeeded" },
          ],
        });

        return {
          status: "left_no_new_company" as const,
          target_contact_id: input.hs_object_id,
        };
      }

      if (verdict.includes("MOVED")) {
        // One person is one contact. If another contact already holds this
        // LinkedIn identity, update that record; never create, merge, or
        // delete a contact here. The no-match literal keeps an empty
        // identifier from matching arbitrary records.
        const duplicateContacts = uses.crm.findRecords({
          objectType: "contacts",
          criterias: [
            {
              propertyName: "linkedin_person_id",
              value: enriched.person_id || "cargo-no-linkedin-person-id",
            },
          ],
        });
        const targetContactId = duplicateContacts[0]
          ? duplicateContacts[0].id
          : input.hs_object_id;

        if (!enriched.company_domain && !enriched.company_linkedin_url) {
          // A move with no company identifiers cannot be found or created
          // safely. Stamp the partial outcome and hand the owner the
          // context instead of minting an unmatchable company.
          uses.crm.updateRecords({
            objectType: "contacts",
            matchingPropertyName: "hs_object_id",
            matchingValue: input.hs_object_id,
            mappings: [
              { propertyName: "cargo_last_enriched_at", value: new Date() },
              { propertyName: "cargo_enrichment_status", value: "partial" },
            ],
          });

          uses.slack.postMessage({
            channelId: championAlertChannelId,
            format: "markdown",
            body: `JOB CHANGE (unresolved)\n${input.firstname} ${input.lastname} left ${crmCompany?.properties.name} for "${enriched.company_name}", but LinkedIn exposed no domain or company page to match or create a CRM record with.\nPrevious role: ${input.jobtitle}\nNew role: ${enriched.job_title}\nSource: LinkedIn enrichment\nContact record: ${input.hs_object_id}\nPrevious company record: ${input.associatedcompanyid} (owner: ${crmCompany?.properties.hubspot_owner_id})\nResolve the new company manually; the next cycle finishes the move.`,
          });

          return {
            status: "job_change_unresolved" as const,
            target_contact_id: input.hs_object_id,
          };
        }

        // Find the new company: LinkedIn company identity first, domain
        // second. The no-match literals keep empty identifiers from
        // matching arbitrary records.
        const companiesByPage = uses.crm.findRecords({
          objectType: "companies",
          criterias: [
            {
              propertyName: "linkedin_company_page",
              value:
                enriched.company_linkedin_url || "cargo-no-linkedin-company",
            },
          ],
        });
        const companiesByDomain = uses.crm.findRecords({
          objectType: "companies",
          criterias: [
            {
              propertyName: "domain",
              value: enriched.company_domain || "cargo-no-company-domain",
            },
          ],
        });
        const matchedCompany = companiesByPage[0] ?? companiesByDomain[0];

        if (!matchedCompany) {
          // Create the missing company, then converge on a re-read so the
          // continuation has its CRM record id.
          uses.crm.insertRecord({
            objectType: "companies",
            mappings: [
              { propertyName: "name", value: enriched.company_name },
              { propertyName: "domain", value: enriched.company_domain },
              {
                propertyName: "linkedin_company_page",
                value: enriched.company_linkedin_url,
              },
            ],
          });
        }

        const createdByDomain = uses.crm.findRecords({
          objectType: "companies",
          criterias: [
            {
              propertyName: "domain",
              value: enriched.company_domain || "cargo-no-company-domain",
            },
          ],
        });
        const createdByPage = uses.crm.findRecords({
          objectType: "companies",
          criterias: [
            {
              propertyName: "linkedin_company_page",
              value:
                enriched.company_linkedin_url || "cargo-no-linkedin-company",
            },
          ],
        });
        const newCompany =
          matchedCompany ?? createdByDomain[0] ?? createdByPage[0];

        // Preserve the former relationship explicitly before moving the
        // primary association.
        uses.crm.createAssociation({
          fromObjectType: "contacts",
          fromObjectId: targetContactId,
          toObjectType: "companies",
          toObjectId: input.associatedcompanyid,
          associationTypeId: contactToCompanyTypeId,
        });

        uses.crm.updateRecords({
          objectType: "contacts",
          matchingPropertyName: "hs_object_id",
          matchingValue: targetContactId,
          mappings: [
            { propertyName: "associatedcompanyid", value: newCompany?.id },
            { propertyName: "jobtitle", value: enriched.job_title },
            {
              propertyName: "linkedin_person_id",
              value: enriched.person_id,
              skipIfExist: true,
            },
            {
              propertyName: "linkedin_profile_url",
              value: enriched.linkedin_url,
              skipIfExist: true,
            },
            { propertyName: "primary_employment_status", value: "Active" },
            { propertyName: "cargo_last_enriched_at", value: new Date() },
            { propertyName: "cargo_enrichment_status", value: "succeeded" },
          ],
        });

        // One JOB CHANGE note, associated to the contact, the former
        // company, and the new company. PLACEHOLDER: confirm the created
        // note's id field on the generated insertRecord output types.
        const note = uses.crm.insertRecord({
          objectType: "notes",
          mappings: [
            { propertyName: "hs_timestamp", value: new Date() },
            {
              propertyName: "hs_note_body",
              value: `JOB CHANGE\n${input.firstname} ${input.lastname} moved from ${crmCompany?.properties.name} to ${enriched.company_name}.\nPrevious role: ${input.jobtitle}\nNew role: ${enriched.job_title}\nSource: LinkedIn enrichment`,
            },
          ],
        });
        uses.crm.createAssociation({
          fromObjectType: "notes",
          fromObjectId: note.id,
          toObjectType: "contacts",
          toObjectId: targetContactId,
          associationTypeId: noteToContactTypeId,
        });
        uses.crm.createAssociation({
          fromObjectType: "notes",
          fromObjectId: note.id,
          toObjectType: "companies",
          toObjectId: input.associatedcompanyid,
          associationTypeId: noteToCompanyTypeId,
        });
        uses.crm.createAssociation({
          fromObjectType: "notes",
          fromObjectId: note.id,
          toObjectType: "companies",
          toObjectId: newCompany?.id,
          associationTypeId: noteToCompanyTypeId,
        });

        uses.slack.postMessage({
          channelId: championAlertChannelId,
          format: "markdown",
          body: `JOB CHANGE\n${input.firstname} ${input.lastname} moved from ${crmCompany?.properties.name} to ${enriched.company_name}.\nPrevious role: ${input.jobtitle}\nNew role: ${enriched.job_title}\nPrevious work email: ${input.email}\nSource: LinkedIn enrichment\nContact record: ${targetContactId}\nPrevious company record: ${input.associatedcompanyid} (owner: ${crmCompany?.properties.hubspot_owner_id})\nNew company record: ${newCompany?.id}`,
        });

        return {
          status: "job_change_updated" as const,
          target_contact_id: targetContactId,
          new_company_id: newCompany?.id,
        };
      }

      // Any other verdict, SAME included, falls through to the
      // same-company path below.
    }

    uses.crm.updateRecords({
      objectType: "contacts",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
        {
          propertyName: "linkedin_person_id",
          value: enriched.person_id,
          skipIfExist: true,
        },
        {
          propertyName: "linkedin_profile_url",
          value: enriched.linkedin_url,
          skipIfExist: true,
        },
        {
          propertyName: "jobtitle",
          value: enriched.job_title,
          skipIfExist: true,
        },
        { propertyName: "primary_employment_status", value: "Active" },
        { propertyName: "cargo_last_enriched_at", value: new Date() },
        { propertyName: "cargo_enrichment_status", value: "succeeded" },
      ],
    });

    return {
      status: "active_same_company" as const,
      target_contact_id: input.hs_object_id,
    };
  },
);

export const monitorChampions = definePlay("monitor_champions", {
  model: crmContacts,
  workflow: monitorCrmChampion,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_profile_url,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.email,
            operator: "isNotEmpty",
          },
        ],
      },
      // The audited customer-status mapping, read from the RELATED account
      // through contact_primary_company — never from the contact's own
      // lifecycle stage.
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            relatedModelUuid: crmAccounts.uuid as unknown as string,
            columnSlug: crmAccounts.columns.lifecyclestage,
            operator: "is",
            values: ["customer"],
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.associatedcompanyid,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: crmContacts.columns.cargo_last_enriched_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: crmContacts.columns.cargo_last_enriched_at,
            operator: "lowerThan",
            value: "30 days",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "0 8 * * *" },
});
