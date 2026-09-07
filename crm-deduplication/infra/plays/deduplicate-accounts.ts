import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { crm } from "../connectors/crm";
import { manualReview } from "../connectors/slack";
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
// Two nodes below are `js(...)` scripts. Their bodies are shipped to the engine
// as source and read sibling node outputs from its `nodes` global, so they name
// the slugs the compiler assigned: `nodes.hubspot` is the CRM search, and
// `nodes.script.result` is what the first script returned. Inserting a
// connector or script node ahead of either one renames those slugs, so
// `evals/contract.mjs` executes both bodies against the slugs they expect.
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
      const found: any[] = Array.isArray(nodes.hubspot) ? nodes.hubspot : [];

      const text = (value: unknown) =>
        value === null || value === undefined ? "" : String(value).trim();
      const count = (value: unknown) =>
        Number.isFinite(Number(value)) ? Number(value) : 0;
      const domainOf = (value: unknown) =>
        text(value)
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split(/[/?#]/)[0]
          .replace(/:\d+$/, "")
          .replace(/\.$/, "");
      const handleOf = (value: unknown) =>
        text(value)
          .toLowerCase()
          .replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\//, "")
          .replace(/[?#].*$/, "")
          .replace(/\/+$/, "");

      // Domains thousands of unrelated companies share. One of these is never
      // evidence of anything, so it can neither pair two records nor score.
      const parkedDomains = [
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
      const identifies = (domain: string) =>
        domain !== "" && !parkedDomains.includes(domain);

      const normalized = found
        .map((record) => {
          const properties = (record && record.properties) || {};
          return {
            id: text(record && record.id),
            linkedinId: text(properties.linkedin_company_id),
            linkedinUrl: handleOf(properties.linkedin_company_page),
            domain: domainOf(properties.domain),
            protectedId: text(properties.protected_business_id),
            parentId: text(properties.parent_company_id),
            isCustomer:
              text(properties.lifecyclestage).toLowerCase() === "customer",
            openDeals: count(properties.hs_num_open_deals),
            contacts: count(properties.num_associated_contacts),
            activities: count(properties.hs_num_engagements),
            filledProperties: Object.values(properties).filter(
              (value) => value !== null && value !== undefined && value !== "",
            ).length,
            lastActivityAt: text(properties.notes_last_updated),
            createdAt: text(properties.createdate),
          };
        })
        .filter(
          (record, index, all) =>
            record.id !== "" &&
            all.findIndex((other) => other.id === record.id) === index,
        );

      // The enrolled row as the CRM holds it now. Its absence means an earlier
      // merge already absorbed it, and nothing below may emit a merge ID.
      const sourceId = text(nodes.start.hs_object_id);
      const source = normalized.find((record) => record.id === sourceId);

      const cluster = normalized.filter(
        (record) =>
          source !== undefined &&
          (record.id === source.id ||
            (source.linkedinId !== "" &&
              record.linkedinId === source.linkedinId) ||
            (source.linkedinUrl !== "" &&
              record.linkedinUrl === source.linkedinUrl) ||
            (identifies(source.domain) && record.domain === source.domain)),
      );
      const duplicates = cluster.filter((record) => record.id !== sourceId);

      const distinct = (values: string[]) =>
        values.filter(
          (value, index, all) => value !== "" && all.indexOf(value) === index,
        );
      const linkedinIds = cluster.map((record) => record.linkedinId);
      const linkedinUrls = cluster.map((record) => record.linkedinUrl);
      const domains = cluster.map((record) => record.domain);
      const protectedIds = cluster.map((record) => record.protectedId);

      // "Exact" means every record in the cluster carries the key and they all
      // agree. One blank is enough to disqualify the automatic class.
      const sharedByAll = (values: string[]) =>
        duplicates.length > 0 &&
        values.every((value) => value !== "") &&
        distinct(values).length === 1;

      const exactLinkedinId = sharedByAll(linkedinIds);
      const exactLinkedinUrl = sharedByAll(linkedinUrls);
      const exactDomain = sharedByAll(domains) && identifies(domains[0]);

      const identityConflict =
        distinct(linkedinIds).length > 1 ||
        distinct(linkedinUrls).length > 1 ||
        distinct(domains).length > 1;
      const protectedIdConflict = distinct(protectedIds).length > 1;
      const clusterIds = cluster.map((record) => record.id);
      const parentOrSubsidiaryWarning = cluster.some(
        (record) =>
          record.parentId !== "" && clusterIds.includes(record.parentId),
      );

      return {
        sourceFound: source !== undefined,
        hasDuplicates: duplicates.length > 0,
        duplicateCount: duplicates.length,
        cluster,
        exactLinkedinId,
        exactLinkedinUrl,
        exactDomain,
        identityConflict,
        protectedIdConflict,
        parentOrSubsidiaryWarning,
        // The only class safe enough to merge unattended.
        autoEligible:
          exactLinkedinId &&
          !identityConflict &&
          !protectedIdConflict &&
          !parentOrSubsidiaryWarning,
        evidenceSummary: cluster
          .map(
            (record) =>
              `${record.id} - linkedinId: ${record.linkedinId || "none"}, linkedin: ${record.linkedinUrl || "none"}, domain: ${record.domain || "none"}, protected: ${record.protectedId !== "" ? "yes" : "no"}, parent: ${record.parentId || "none"}`,
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

    // Which record survives is policy, not evidence: the most connected record
    // wins, ties break towards the oldest, and the last tiebreak is the record
    // ID so two runs over the same cluster can never disagree.
    const survivor = js(({ nodes }) => {
      const cluster: any[] = Array.isArray(nodes.script.result.cluster)
        ? nodes.script.result.cluster
        : [];
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
        primaryId: ranked.length > 0 ? ranked[0].id : "",
        idsToMerge: ranked.slice(1).map((record) => record.id),
      };
    });

    if (score.score >= automaticMergeScore && evidence.autoEligible) {
      uses.crm.mergeRecords({
        objectType: "companies",
        primaryId: survivor.primaryId,
        idsToMerge: survivor.idsToMerge,
      });

      return {
        status: "merged_automatically",
        score: score.score,
        survivorId: survivor.primaryId,
        mergedIds: survivor.idsToMerge,
      };
    }

    // Everything else. The reviewer sees the score, every conflict that kept
    // the cluster out of the automatic class, and the evidence per record.
    const reviewed = humanReview(
      {
        connectorUuid: manualReview.uuid,
        channelId: reviewChannelId,
        title: `Review CRM account merge into ${survivor.primaryId}`,
        content: `Duplicate score: ${score.score}/100
Survivor: ${survivor.primaryId}
Records to merge: ${survivor.idsToMerge}
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
            primaryId: survivor.primaryId,
            idsToMerge: survivor.idsToMerge,
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
      survivorId: survivor.primaryId,
      mergedIds: survivor.idsToMerge,
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
