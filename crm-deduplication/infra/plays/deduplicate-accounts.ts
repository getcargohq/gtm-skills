import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { crm } from "../connectors/crm";
import { slack } from "../connectors/slack";
import { crmAccounts } from "../models/crm-accounts";

// PLACEHOLDER — the Slack channel every review request is posted to. Resolve it
// against the live workspace and get it approved before deploying.
const reviewChannelId = "PLACEHOLDER_REVIEW_CHANNEL_ID";

// The automatic class is deliberately narrow: a cluster merges unattended only
// at this score AND under the exact-identity guard the evidence script sets.
// Either one alone is not enough — the score is evidence, the guard is policy.
const automaticMergeScore = 60;

// A reviewer has a working day to answer. After that the request declines
// itself, and a decline leaves the records separate — the safe outcome.
const reviewTimeoutMilliseconds = 24 * 60 * 60 * 1000;

// One CRM account row in, one terminal outcome out.
//
// One node below is a `js(...)` script. Its body is shipped to the engine as
// source and reads sibling node outputs from its `nodes` global, so it names
// the slug the compiler assigned: `nodes.hubspot` is the CRM search. Inserting
// a connector node ahead of it renames that slug, so `evals/contract.mjs`
// executes the body against the slug it expects.
//
// Survivor selection lives in that same script rather than a second one. It is
// policy, not evidence, but it ranks the cluster the evidence just built, and
// splitting the two only bought a second script reading the first one back
// through its compiler-assigned slug.
const deduplicateCrmAccount = defineWorkflow(
  "deduplicate_crm_account",
  {
    input: z.object({
      hs_object_id: z.string(),
      name: z.string().optional(),
      domain: z.string().optional(),
      linkedin_company_page: z.string().optional(),
      linkedin_company_id: z.string().optional(),
      // PLACEHOLDER — point these two at the protected-ID and parent-company
      // properties the live CRM audit approved.
      protected_business_id: z.string().optional(),
      parent_company_id: z.string().optional(),
      lifecyclestage: z.string().optional(),
      hs_num_open_deals: z.number().optional(),
      num_associated_contacts: z.number().optional(),
      hs_num_engagements: z.number().optional(),
      notes_last_updated: z.string().optional(),
      createdate: z.string().optional(),
    }),
    output: z.object({
      status: z.string(),
      score: z.number().optional(),
      survivorId: z.string().optional(),
      mergedIds: z.array(z.string()).optional(),
    }),
    uses: { crm },
  },
  ({ input, uses, js, scoring, humanReview }) => {
    // The queue can be hours old, so cluster membership is re-derived from the
    // CRM on every run rather than trusted from the extract that enrolled it.
    uses.crm.findRecords({
      objectType: "companies",
      criterias: [
        {
          propertyName: "linkedin_company_id",
          value: input.linkedin_company_id,
        },
        {
          propertyName: "linkedin_company_page",
          value: input.linkedin_company_page,
        },
        { propertyName: "domain", value: input.domain },
      ],
    });

    // Everything the merge decision rests on, derived deterministically: no
    // model, no judgement. The same records always produce the same evidence.
    const evidence = js(({ nodes }) => {
      // CRM properties arrive as whatever the API felt like sending, so every
      // value is coerced before it is compared to another one.
      const asText = (value: unknown) =>
        value === null || value === undefined ? "" : String(value).trim();
      const asNumber = (value: unknown) =>
        Number.isFinite(Number(value)) ? Number(value) : 0;
      const asDomain = (value: unknown) =>
        asText(value)
          .toLowerCase()
          .replace(/^(?:https?:\/\/)?(?:www\.)?/, "")
          .split(/[/?#]/)[0]
          .replace(/:\d+$/, "")
          .replace(/\.$/, "");
      const asHandle = (value: unknown) =>
        asText(value)
          .toLowerCase()
          .replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\//, "")
          .replace(/[?#].*$/, "")
          .replace(/\/+$/, "");

      // Domains thousands of unrelated companies share. One of these tells you
      // nothing, so it can neither pair two records nor score.
      const parked = [
        "bit.ly",
        "facebook.com",
        "github.com",
        "google.com",
        "hubs.ly",
        "instagram.com",
        "linkedin.com",
        "linktr.ee",
        "substack.com",
        "uk.com",
      ];
      const identifiesOneCompany = (domain: string) =>
        domain !== "" && !parked.includes(domain);

      // What the search just returned, in the shape the policy below reads. One
      // company can match several criteria, so the first row wins and the rest
      // of its appearances are dropped on the way in.
      const found: any[] = Array.isArray(nodes.hubspot) ? nodes.hubspot : [];
      const unique = new Map<string, any>();
      for (const record of found) {
        const id = asText(record && record.id);
        if (id === "" || unique.has(id)) continue;
        const fields = (record && record.properties) || {};
        unique.set(id, {
          id,
          linkedinId: asText(fields.linkedin_company_id),
          linkedinUrl: asHandle(fields.linkedin_company_page),
          domain: asDomain(fields.domain),
          protectedId: asText(fields.protected_business_id),
          parentId: asText(fields.parent_company_id),
          isCustomer:
            asText(fields.lifecyclestage).toLowerCase() === "customer",
          openDeals: asNumber(fields.hs_num_open_deals),
          contacts: asNumber(fields.num_associated_contacts),
          activities: asNumber(fields.hs_num_engagements),
          filledProperties: Object.values(fields).filter(
            (value) => value !== null && value !== undefined && value !== "",
          ).length,
          lastActivityAt: asText(fields.notes_last_updated),
          createdAt: asText(fields.createdate),
        });
      }
      const records = Array.from(unique.values());

      // The cluster is the enrolled row plus every record sharing an identity
      // key with it. A source the search no longer returns was absorbed by an
      // earlier merge: the cluster comes back empty, which leaves every flag
      // below false and stops any merge ID being emitted.
      const sourceId = asText(nodes.start.hs_object_id);
      const source = records.find((record) => record.id === sourceId);
      const cluster = records.filter((record) => {
        if (source === undefined) return false;
        if (record.id === source.id) return true;
        return (
          (source.linkedinId !== "" &&
            record.linkedinId === source.linkedinId) ||
          (source.linkedinUrl !== "" &&
            record.linkedinUrl === source.linkedinUrl) ||
          (identifiesOneCompany(source.domain) &&
            record.domain === source.domain)
        );
      });
      const duplicates = cluster.filter((record) => record.id !== sourceId);
      const hasDuplicates = duplicates.length > 0;

      // How one identity key behaves across the cluster. `sharedByAll` is the
      // bar for merging unattended — every record carries the key and they all
      // agree — and `conflicting` is what disqualifies a cluster outright.
      const agreementOn = (
        key: "linkedinId" | "linkedinUrl" | "domain" | "protectedId",
      ) => {
        const present = cluster
          .map((record) => record[key])
          .filter((value) => value !== "");
        const distinct = present.filter(
          (value, index, all) => all.indexOf(value) === index,
        );
        return {
          value: distinct.length === 1 ? distinct[0] : "",
          sharedByAll:
            present.length === cluster.length && distinct.length === 1,
          conflicting: distinct.length > 1,
        };
      };
      const linkedinId = agreementOn("linkedinId");
      const linkedinUrl = agreementOn("linkedinUrl");
      const domain = agreementOn("domain");
      const protectedId = agreementOn("protectedId");

      const exactLinkedinId = hasDuplicates && linkedinId.sharedByAll;
      const exactLinkedinUrl = hasDuplicates && linkedinUrl.sharedByAll;
      const exactDomain =
        hasDuplicates &&
        domain.sharedByAll &&
        identifiesOneCompany(domain.value);
      const identityConflict =
        linkedinId.conflicting || linkedinUrl.conflicting || domain.conflicting;

      // A record whose parent is also in the cluster is a subsidiary, and a
      // subsidiary is a different company however much it looks like this one.
      const clusterIds = cluster.map((record) => record.id);
      const parentOrSubsidiaryWarning = cluster.some(
        (record) =>
          record.parentId !== "" && clusterIds.includes(record.parentId),
      );

      // Which record survives is policy, not evidence, but it reads the same
      // cluster: the most connected record wins, ties break towards the oldest,
      // and the last tiebreak is the record ID so two runs over the same
      // cluster can never disagree.
      const ranked = cluster
        .slice()
        .sort(
          (left, right) =>
            Number(right.protectedId !== "") -
              Number(left.protectedId !== "") ||
            Number(right.isCustomer) - Number(left.isCustomer) ||
            right.openDeals - left.openDeals ||
            right.contacts - left.contacts ||
            right.activities - left.activities ||
            right.filledProperties - left.filledProperties ||
            right.lastActivityAt.localeCompare(left.lastActivityAt) ||
            left.createdAt.localeCompare(right.createdAt) ||
            left.id.localeCompare(right.id),
        );

      return {
        sourceFound: source !== undefined,
        hasDuplicates,
        duplicateCount: duplicates.length,
        cluster,
        primaryId: ranked.length > 0 ? ranked[0].id : "",
        idsToMerge: ranked.slice(1).map((record) => record.id),
        exactLinkedinId,
        exactLinkedinUrl,
        exactDomain,
        identityConflict,
        protectedIdConflict: protectedId.conflicting,
        parentOrSubsidiaryWarning,
        // The only class safe enough to merge unattended.
        autoEligible:
          exactLinkedinId &&
          !identityConflict &&
          !protectedId.conflicting &&
          !parentOrSubsidiaryWarning,
        // For the review message only. Protected IDs are reported as present
        // or absent, never printed.
        evidenceSummary: cluster
          .map((record) =>
            [
              record.id,
              `linkedin id ${record.linkedinId || "none"}`,
              `linkedin ${record.linkedinUrl || "none"}`,
              `domain ${record.domain || "none"}`,
              `protected ${record.protectedId === "" ? "no" : "yes"}`,
              `parent ${record.parentId || "none"}`,
            ].join(", "),
          )
          .join("\n"),
      };
    });

    if (!evidence.sourceFound) {
      return { status: "source_missing_or_changed" };
    }

    if (!evidence.hasDuplicates) {
      return { status: "no_duplicates" };
    }

    const score = scoring({
      criterias: [
        {
          name: "Exact LinkedIn company ID",
          value: evidence.exactLinkedinId,
          score: 60,
        },
        {
          name: "Exact LinkedIn company URL",
          value: evidence.exactLinkedinUrl,
          score: 25,
        },
        {
          name: "Exact non-generic domain",
          value: evidence.exactDomain,
          score: 15,
        },
      ],
    });

    if (score.score >= automaticMergeScore && evidence.autoEligible) {
      uses.crm.mergeRecords({
        objectType: "companies",
        primaryId: evidence.primaryId,
        idsToMerge: evidence.idsToMerge,
      });

      return {
        status: "merged_automatically",
        score: score.score,
        survivorId: evidence.primaryId,
        mergedIds: evidence.idsToMerge,
      };
    }

    // Everything else. The reviewer sees the score, every conflict that kept
    // the cluster out of the automatic class, and the evidence per record.
    const reviewed = humanReview(
      {
        connectorUuid: slack.uuid,
        channelId: reviewChannelId,
        title: `Review CRM account merge into ${evidence.primaryId}`,
        content: `Duplicate score: ${score.score}/100
Survivor: ${evidence.primaryId}
Records to merge: ${evidence.idsToMerge}
Identity conflict: ${evidence.identityConflict}
Protected ID conflict: ${evidence.protectedIdConflict}
Parent/subsidiary warning: ${evidence.parentOrSubsidiaryWarning}
Evidence:
${evidence.evidenceSummary}`,
        timeoutMilliseconds: reviewTimeoutMilliseconds,
        enableEditButton: false,
      },
      {
        approved: () => {
          uses.crm.mergeRecords({
            objectType: "companies",
            primaryId: evidence.primaryId,
            idsToMerge: evidence.idsToMerge,
          });
          return js(() => "merged_after_review");
        },
        // Decline and timeout share this path. It writes nothing.
        declined: () => js(() => "review_declined_or_timed_out"),
      },
    );

    return {
      status: reviewed,
      score: score.score,
      survivorId: evidence.primaryId,
      mergedIds: evidence.idsToMerge,
    };
  },
);

// A row is worth searching only when it carries the CRM record ID and at least
// one identity key. Company name is never one of them: two companies can share
// a name and never be the same record.
//
// Disabled, serial, and capped at 15 rows. This play merges CRM records, so the
// pilot stays small enough for a human to verify every survivor by hand, and
// only an approved pilot lifts any of the three.
export const deduplicateAccounts = definePlay("deduplicate_accounts", {
  model: crmAccounts,
  workflow: deduplicateCrmAccount,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.hs_object_id,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_id,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_page,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.domain,
            operator: "isNotEmpty",
          },
        ],
      },
    ],
  },
  limit: 15,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added", "updated"],
  schedule: { type: "cron", cron: "0 7 * * *" },
});
