import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
const infra = await import(`../infra/index.ts?contract=${Date.now()}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

assert.deepEqual(
  new Set(byId.keys()),
  new Set([
    "connector:crm",
    "connector:manual_review",
    "model:crm_accounts",
    "model:crm_contacts",
    "play:deduplicate_accounts",
    "play:deduplicate_contacts",
  ]),
  "crm-deduplication must deploy only its CRM models, connectors, and deduplication plays",
);

const nodesFor = (id) => {
  const resource = byId.get(id);
  assert.ok(resource, `${id} must exist`);
  assert.ok(Array.isArray(resource.spec.nodes), `${id} must have workflow nodes`);
  return resource.spec.nodes;
};

const findOne = (nodes, predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};

const child = (nodes, node) =>
  nodes.find((candidate) => candidate.uuid === node.childrenUuids[0]);

for (const connectorId of ["connector:crm", "connector:manual_review"]) {
  assert.equal(
    byId.get(connectorId)?.spec.cacheTtlMilliseconds,
    15 * 24 * 60 * 60 * 1000,
    `${connectorId} must keep the maximum 15-day cache duration`,
  );
}

assert.equal(
  byId.has("model:account_duplicate_candidates"),
  false,
  "deduplication must not deploy a duplicate-candidate staging model",
);
assert.equal(
  byId.has("model:contact_duplicate_candidates"),
  false,
  "contact deduplication must not deploy a duplicate-candidate staging model",
);

const dedupNodes = nodesFor("play:deduplicate_accounts");
const dedupResource = byId.get("play:deduplicate_accounts");
assert.equal(
  dedupResource.spec.modelUuid.resourceId,
  "model:crm_accounts",
  "deduplicate_accounts must run directly on the CRM account model",
);

const duplicateSearch = findOne(
  dedupNodes,
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "findRecords",
  "deduplicate_accounts must search the CRM with one findRecords node",
);
const duplicateScore = findOne(
  dedupNodes,
  (node) => node.kind === "native" && node.actionSlug === "scoring",
  "deduplicate_accounts must score duplicate evidence with one native Scoring node",
);
assert.deepEqual(
  duplicateScore.config.criterias.map(({ name, score }) => [name, score]),
  [
    ["Exact LinkedIn company ID", 60],
    ["Exact LinkedIn company URL", 25],
    ["Exact non-generic domain", 15],
  ],
  "the native duplicate score must preserve the approved 60/25/15 policy",
);
const manualReview = findOne(
  dedupNodes,
  (node) => node.kind === "native" && node.actionSlug === "humanReview",
  "uncertain duplicate evidence must reach one native Human review node",
);
assert.equal(
  manualReview.config.connectorUuid.resourceId,
  "connector:manual_review",
  "human review must use the declared manual-review connector",
);

const mergeNodes = dedupNodes.filter(
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "mergeRecords",
);
assert.equal(
  mergeNodes.length,
  2,
  "deduplicate_accounts must expose automatic and human-approved CRM merge paths",
);
const automaticMergeGate = findOne(
  dedupNodes,
  (node) => node.slug === "automatic_merge_gate",
  "deduplicate_accounts must branch on the guarded automatic-merge policy",
);
assert.match(
  automaticMergeGate.config.condition.expression,
  /duplicate_score\.score >= 60.*autoEligible === true/,
  "automatic merge must require both the score threshold and exact-ID conflict guard",
);
assert.equal(
  child(dedupNodes, automaticMergeGate)?.slug,
  "merge_automatically",
  "the guarded yes path must merge automatically",
);
assert.equal(
  dedupNodes.find(
    (node) => node.uuid === automaticMergeGate.childrenUuids[1],
  )?.uuid,
  manualReview.uuid,
  "the guarded no path must request human review",
);
assert.equal(
  dedupNodes.find((node) => node.uuid === manualReview.childrenUuids[0])?.slug,
  "merge_after_review",
  "human approval must execute the reviewed merge",
);
assert.equal(
  dedupNodes.find((node) => node.uuid === manualReview.childrenUuids[1])?.slug,
  "review_declined",
  "human decline or timeout must keep records separate",
);
assert.equal(
  child(dedupNodes, duplicateSearch)?.slug,
  "prepare_duplicate_evidence",
  "CRM candidate search must continue into deterministic evidence preparation",
);
assert.equal(
  child(dedupNodes, duplicateScore)?.slug,
  "select_survivor",
  "duplicate scoring must feed deterministic survivor selection",
);
const survivorSelection = child(dedupNodes, duplicateScore);
assert.equal(
  survivorSelection.actionSlug,
  "script",
  "survivor selection must use the checked deterministic script",
);
assert.equal(
  survivorSelection.childrenUuids[0],
  automaticMergeGate.uuid,
  "survivor selection must feed the automatic merge gate",
);
for (const mergeNode of mergeNodes) {
  assert.match(
    mergeNode.config.primaryId.expression,
    /select_survivor\.result\.primaryId/,
    "every CRM merge must use the scored cluster's selected survivor",
  );
  assert.match(
    mergeNode.config.idsToMerge.expression,
    /select_survivor\.result\.idsToMerge/,
    "every CRM merge must use the selected non-survivor IDs",
  );
}
assert.match(
  manualReview.config.content.expression,
  /Identity conflict:.*Protected ID conflict:.*Parent\/subsidiary warning:.*Evidence:/,
  "manual review must show the score, conflicts, and candidate evidence",
);

const evidenceNode = child(dedupNodes, duplicateSearch);
assert.equal(
  evidenceNode.actionSlug,
  "script",
  "duplicate evidence preparation must use the checked deterministic script",
);
const prepareEvidence = new Function("nodes", evidenceNode.config.script);
const crmRecord = (id, properties = {}) => ({
  id,
  properties: {
    linkedin_company_id: "123",
    linkedin_company_page: "https://www.linkedin.com/company/acme",
    domain: "acme.com",
    lifecyclestage: "lead",
    hs_num_open_deals: 0,
    num_associated_contacts: 0,
    hs_num_engagements: 0,
    createdate: "2024-01-01T00:00:00.000Z",
    ...properties,
  },
});
const exactEvidence = prepareEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_companies: [
    crmRecord("source"),
    crmRecord("customer", { lifecyclestage: "customer" }),
  ],
});
assert.equal(exactEvidence.sourceFound, true, "the fresh source must be kept");
assert.equal(
  exactEvidence.autoEligible,
  true,
  "an exact shared LinkedIn ID without conflicts must reach the automatic gate",
);
assert.equal(
  exactEvidence.duplicateCount,
  1,
  "the evidence script must retain the duplicate candidate",
);
const selectSurvivor = new Function("nodes", survivorSelection.config.script);
const exactSurvivor = selectSurvivor({
  prepare_duplicate_evidence: { result: exactEvidence },
});
assert.equal(
  exactSurvivor.primaryId,
  "customer",
  "survivor selection must apply deterministic precedence after scoring",
);
assert.deepEqual(
  exactSurvivor.idsToMerge,
  ["source"],
  "survivor selection must return every non-survivor ID",
);

const conflictEvidence = prepareEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_companies: [
    crmRecord("source"),
    crmRecord("conflict", { domain: "other.example" }),
  ],
});
assert.equal(
  conflictEvidence.identityConflict,
  true,
  "conflicting non-null identity must be visible to the merge gate",
);
assert.equal(
  conflictEvidence.autoEligible,
  false,
  "an identity conflict must require human review",
);

const genericDomainEvidence = prepareEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_companies: [
    crmRecord("source", {
      linkedin_company_id: "",
      linkedin_company_page: "",
      domain: "google.com",
    }),
    crmRecord("other", {
      linkedin_company_id: "",
      linkedin_company_page: "",
      domain: "google.com",
    }),
  ],
});
assert.equal(
  genericDomainEvidence.duplicateCount,
  0,
  "a generic domain alone must never create a duplicate candidate",
);

const staleSourceEvidence = prepareEvidence({
  start: { hs_object_id: "already-merged" },
  find_duplicate_companies: [crmRecord("survivor")],
});
assert.equal(
  staleSourceEvidence.sourceFound,
  false,
  "an already-merged or changed source must stop before scoring",
);
assert.deepEqual(
  staleSourceEvidence.cluster,
  [],
  "a missing fresh source must never emit a mergeable cluster",
);

assert.equal(dedupResource.spec.isEnabled, false, "dedup play must be disabled");
assert.equal(dedupResource.spec.limit, 15, "dedup pilot must be limited to 15");
assert.equal(
  dedupResource.spec.runCreationRule,
  "noConcurrency",
  "dedup play must use noConcurrency",
);

const candidate = (id, overrides = {}) => ({
  id,
  linkedinId: "123",
  linkedinUrl: "https://www.linkedin.com/company/acme",
  domain: "https://www.acme.com/",
  isCustomer: false,
  openOpportunities: 0,
  contacts: 0,
  activities: 0,
  populatedProperties: 1,
  createdAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});
const classified = infra.classifyCluster([
  candidate("older"),
  candidate("customer", { isCustomer: true }),
]);
assert.equal(
  classified.matchClass,
  "exact_unique_linkedin",
  "an exact shared LinkedIn company ID must be classified deterministically",
);
assert.equal(
  classified.survivor.id,
  "customer",
  "the survivor policy must prefer a customer record",
);
assert.equal(
  infra.normalizeDomain("https://www.Acme.com/path"),
  "acme.com",
  "domain normalization must be stable",
);
assert.equal(
  infra.normalizeLinkedInHandle("linkedin.com/company/Acme/?trk=public"),
  "acme",
  "LinkedIn handles must normalize with or without a URL scheme",
);
assert.equal(
  infra.classifyCluster([
    candidate("one", { linkedinId: undefined }),
    candidate("two", { linkedinId: undefined }),
  ]).matchClass,
  "linkedin_url_review",
  "a shared LinkedIn URL without an exact ID must stay review-only",
);
assert.equal(
  infra.classifyCluster([
    candidate("one", { linkedinId: "123" }),
    candidate("two", { linkedinId: "456" }),
  ]).matchClass,
  "conflict",
  "conflicting LinkedIn company IDs must never merge automatically",
);
assert.throws(
  () => infra.classifyCluster([candidate("same"), candidate("same")]),
  /distinct source record IDs/,
  "duplicate source record IDs must be rejected",
);

const contactNodes = nodesFor("play:deduplicate_contacts");
const contactResource = byId.get("play:deduplicate_contacts");
assert.equal(
  contactResource.spec.modelUuid.resourceId,
  "model:crm_contacts",
  "deduplicate_contacts must run directly on the CRM contact model",
);

const contactSearch = findOne(
  contactNodes,
  (node) =>
    node.slug === "find_duplicate_contacts" &&
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "findRecords" &&
    node.config.objectType === "contacts",
  "deduplicate_contacts must search live CRM contacts with direct findRecords",
);
const transitiveContactSearch = findOne(
  contactNodes,
  (node) =>
    node.slug === "find_transitive_duplicate_contacts" &&
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "findRecords" &&
    node.config.objectType === "contacts",
  "deduplicate_contacts must expand live CRM contacts with transitive findRecords",
);
const contactStart = findOne(
  contactNodes,
  (node) => node.slug === "start" && node.actionSlug === "start",
  "deduplicate_contacts must have one start node",
);
const contactSearchVariants = child(contactNodes, contactStart);
assert.equal(
  contactSearchVariants.slug,
  "prepare_contact_search_variants",
  "contact deduplication must prepare normalized search variants before live CRM search",
);
assert.equal(
  child(contactNodes, contactSearchVariants)?.uuid,
  contactSearch.uuid,
  "contact search variants must feed the live CRM contact search",
);
assert.equal(
  contactSearch.config.criterias.filter(
    (criteria) => criteria.propertyName === "linkedin_url",
  ).length,
  4,
  "contact live search must query the four LinkedIn URL forms",
);
const transitiveSearchPrep = child(contactNodes, contactSearch);
assert.equal(
  transitiveSearchPrep.slug,
  "prepare_transitive_contact_search",
  "direct contact search must feed transitive search preparation",
);
assert.equal(
  child(contactNodes, transitiveSearchPrep)?.uuid,
  transitiveContactSearch.uuid,
  "transitive search preparation must feed the second live CRM contact search",
);
const contactEvidenceNode = child(contactNodes, transitiveContactSearch);
assert.equal(
  contactEvidenceNode.slug,
  "prepare_contact_duplicate_evidence",
  "transitive contact CRM search must feed deterministic evidence preparation",
);
const contactScore = findOne(
  contactNodes,
  (node) =>
    node.kind === "native" &&
    node.actionSlug === "scoring" &&
    node.slug === "contact_duplicate_score",
  "deduplicate_contacts must score contact evidence with one native Scoring node",
);
assert.deepEqual(
  contactScore.config.criterias.map(({ name, score }) => [name, score]),
  [
    ["Exact LinkedIn person ID", 60],
    ["Exact LinkedIn person URL without person-ID conflict", 60],
    ["Exact non-generic email without LinkedIn conflict", 60],
    ["Transitive high-confidence chain", 60],
  ],
  "contact scoring must preserve the approved high-confidence classes and chained class",
);
const contactPayload = child(contactNodes, contactScore);
assert.equal(
  contactPayload.slug,
  "prepare_contact_merge_payload",
  "contact scoring must feed deterministic survivor and write-back preparation",
);
const contactMergeGate = child(contactNodes, contactPayload);
assert.equal(
  contactMergeGate.slug,
  "contact_automatic_merge_gate",
  "contact payload preparation must feed the guarded merge gate",
);
assert.match(
  contactMergeGate.config.condition.expression,
  /contact_duplicate_score\.score >= 60.*autoEligible === true/,
  "contact automatic merge must require score and the three-class conflict guard",
);

const contactManualReviewEnabled = contactNodes.find(
  (node) => node.uuid === contactMergeGate.childrenUuids[1],
);
assert.equal(
  contactManualReviewEnabled?.slug,
  "contact_manual_review_enabled",
  "low-confidence contact evidence must not merge automatically",
);
const contactManualReview = contactNodes.find(
  (node) => node.uuid === contactManualReviewEnabled.childrenUuids[0],
);
assert.equal(
  contactManualReview?.actionSlug,
  "humanReview",
  "review-enabled low-confidence contact evidence must reach Human Review",
);
assert.equal(
  contactManualReview.config.connectorUuid.resourceId,
  "connector:manual_review",
  "contact Human Review must use the declared manual-review connector",
);
assert.equal(
  contactNodes.find(
    (node) => node.uuid === contactManualReviewEnabled.childrenUuids[1],
  )?.slug,
  "contact_low_confidence_not_reviewed",
  "review-disabled low-confidence contact evidence must end without a CRM write",
);
assert.equal(
  contactNodes.find((node) => node.uuid === contactManualReview.childrenUuids[0])
    ?.slug,
  "merge_contact_after_review",
  "contact Human Review approval must execute the reviewed merge",
);
assert.equal(
  contactNodes.find((node) => node.uuid === contactManualReview.childrenUuids[1])
    ?.slug,
  "contact_review_declined",
  "contact Human Review decline or timeout must keep records separate",
);

const contactMergeNodes = contactNodes.filter(
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "mergeRecords" &&
    node.config.objectType === "contacts",
);
assert.equal(
  contactMergeNodes.length,
  2,
  "deduplicate_contacts must expose automatic and human-approved CRM contact merge paths",
);
for (const mergeNode of contactMergeNodes) {
  assert.match(
    mergeNode.config.primaryId.expression,
    /prepare_contact_merge_payload\.result\.primaryId/,
    "every contact merge must use the selected canonical contact",
  );
  assert.match(
    mergeNode.config.idsToMerge.expression,
    /prepare_contact_merge_payload\.result\.idsToMerge/,
    "every contact merge must use the selected non-canonical contact IDs",
  );
}
const contactWriteBackNodes = contactNodes.filter(
  (node) =>
    node.kind === "connector" &&
    node.connectorUuid?.resourceId === "connector:crm" &&
    node.actionSlug === "updateRecords" &&
    node.config.objectType === "contacts",
);
assert.equal(
  contactWriteBackNodes.length,
  2,
  "contact enrichment write-back must exist only after automatic and approved merges",
);
for (const writeBackNode of contactWriteBackNodes) {
  assert.match(
    writeBackNode.config.matchingValue.expression,
    /prepare_contact_merge_payload\.result\.primaryId/,
    "contact write-back must target the selected canonical contact",
  );
  assert.match(
    writeBackNode.config.mappings.expression,
    /prepare_contact_merge_payload\.result\.writeBackMappings/,
    "contact write-back must use only prepared non-empty validated values",
  );
}
assert.equal(
  child(contactNodes, contactMergeNodes[0])?.slug,
  "write_back_contact_enrichment_after_auto_merge",
  "automatic contact merge must write back validated values after the native merge",
);
assert.equal(
  child(contactNodes, contactMergeNodes[1])?.slug,
  "write_back_contact_enrichment_after_review_merge",
  "review-approved contact merge must write back validated values after the native merge",
);
assert.match(
  contactManualReview.config.content.expression,
  /Serial merge steps:.*Conflicting LinkedIn person IDs:.*Generic or shared email:.*Records:/,
  "contact Human Review must show serial merge steps, conflicts, and formatted records",
);
assert.doesNotMatch(
  contactManualReview.config.content.expression,
  /JSON\.stringify\(nodes\.prepare_contact_duplicate_evidence\.result\.candidateEvidence\)/,
  "contact Human Review must not render raw JSON candidate evidence",
);
for (const key of [
  "connectorUuid",
  "channelId",
  "title",
  "content",
  "timeoutMilliseconds",
]) {
  assert.ok(
    key in contactManualReview.config,
    `contact Human Review config must include ${key}`,
  );
}

const prepareSearchVariants = new Function(
  "nodes",
  contactSearchVariants.config.script,
);
assert.deepEqual(
  prepareSearchVariants({
    start: { hs_object_id: "source", linkedin_url: "linkedin.com/in/Jack/" },
  }).linkedinUrlVariants,
  [
    "https://linkedin.com/in/jack",
    "https://linkedin.com/in/jack/",
    "https://www.linkedin.com/in/jack",
    "https://www.linkedin.com/in/jack/",
  ],
  "contact search variants must enumerate LinkedIn URL www/trailing-slash forms",
);

const prepareContactEvidence = new Function(
  "nodes",
  contactEvidenceNode.config.script,
);
const crmContact = (id, properties = {}) => ({
  id,
  properties: {
    email: "JACK@EXAMPLE.COM ",
    phone: "(415) 555-0101",
    linkedin_url: "https://www.linkedin.com/in/jack-smith/",
    linkedin_person_id: "person-123",
    jobtitle: "VP Sales",
    associatedcompanyid: "company-1",
    num_associated_deals: 0,
    num_contacted_notes: 0,
    hs_sales_email_last_replied: 0,
    createdate: "2024-01-01T00:00:00.000Z",
    lastmodifieddate: "2024-01-01T00:00:00.000Z",
    ...properties,
  },
});
const exactPersonEvidence = prepareContactEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_contacts: [
    crmContact("source", { email: "old@example.com" }),
    crmContact("history", {
      email: "new@example.com",
      num_associated_deals: 3,
      lastmodifieddate: "2024-02-01T00:00:00.000Z",
    }),
  ],
});
assert.equal(
  exactPersonEvidence.sourceFound,
  true,
  "contact evidence must retain the fresh source",
);
assert.equal(
  exactPersonEvidence.autoEligible,
  true,
  "same LinkedIn person ID must be a high-confidence contact duplicate",
);
assert.equal(
  exactPersonEvidence.duplicateCount,
  1,
  "contact evidence must retain duplicate candidates",
);

const prepareContactPayload = new Function("nodes", contactPayload.config.script);
const exactContactPayload = prepareContactPayload({
  prepare_contact_duplicate_evidence: { result: exactPersonEvidence },
});
assert.equal(
  exactContactPayload.primaryId,
  "history",
  "contact survivor selection must prefer stronger commercial history",
);
assert.deepEqual(
  exactContactPayload.idsToMerge,
  ["source"],
  "contact payload must return every non-canonical ID",
);
assert.deepEqual(
  exactContactPayload.writeBackMappings.map((mapping) => mapping.propertyName),
  [
    "email",
    "phone",
    "linkedin_url",
    "linkedin_person_id",
    "jobtitle",
    "associatedcompanyid",
  ],
  "contact write-back mappings must be limited to the six approved people fields",
);
assert.equal(
  exactContactPayload.writeBackMappings.find(
    (mapping) => mapping.propertyName === "email",
  )?.value,
  "new@example.com",
  "contact write-back must prefer the most recently modified approved non-empty value",
);

const multiContactPayload = prepareContactPayload({
  prepare_contact_duplicate_evidence: {
    result: prepareContactEvidence({
      start: { hs_object_id: "source" },
      find_duplicate_contacts: [
        crmContact("source", { num_associated_deals: 1 }),
        crmContact("canonical", { num_associated_deals: 5 }),
        crmContact("secondary", { num_associated_deals: 2 }),
      ],
    }),
  },
});
assert.deepEqual(
  multiContactPayload.mergeSteps,
  [
    { primaryId: "canonical", idToMerge: "secondary" },
    { primaryId: "canonical", idToMerge: "source" },
  ],
  "multi-contact groups must merge every secondary into one canonical contact without re-selection",
);

const transitiveEvidence = prepareContactEvidence({
  start: { hs_object_id: "a" },
  find_duplicate_contacts: [
    crmContact("a", {
      email: "",
      linkedin_url: "",
      linkedin_person_id: "person-1",
      num_associated_deals: 1,
    }),
    crmContact("b", {
      email: "",
      linkedin_url: "https://linkedin.com/in/shared",
      linkedin_person_id: "person-1",
      num_associated_deals: 3,
    }),
  ],
  find_transitive_duplicate_contacts: [
    crmContact("c", {
      email: "",
      linkedin_url: "https://www.linkedin.com/in/shared/",
      linkedin_person_id: "",
      num_associated_deals: 2,
    }),
  ],
});
assert.equal(
  transitiveEvidence.transitiveHighConfidence,
  true,
  "pairwise exact high-confidence keys must chain a contact cluster",
);
assert.equal(
  transitiveEvidence.autoEligible,
  true,
  "transitive high-confidence contact chains must be eligible for the guarded merge gate",
);
const transitivePayload = prepareContactPayload({
  prepare_contact_duplicate_evidence: { result: transitiveEvidence },
});
assert.deepEqual(
  transitivePayload.mergeSteps,
  [
    { primaryId: "b", idToMerge: "c" },
    { primaryId: "b", idToMerge: "a" },
  ],
  "transitive multi-contact chains must still merge into one canonical contact",
);

const urlEvidence = prepareContactEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_contacts: [
    crmContact("source", { linkedin_person_id: "" }),
    crmContact("url-match", { linkedin_person_id: "" }),
  ],
});
assert.equal(
  urlEvidence.exactLinkedinUrl,
  true,
  "same LinkedIn person URL without person-ID conflict must be high confidence",
);
assert.equal(urlEvidence.autoEligible, true);

const emailEvidence = prepareContactEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_contacts: [
    crmContact("source", { linkedin_person_id: "", linkedin_url: "" }),
    crmContact("email-match", { linkedin_person_id: "", linkedin_url: "" }),
  ],
});
assert.equal(
  emailEvidence.exactNonGenericEmail,
  true,
  "same exact non-generic email without LinkedIn conflict must be high confidence",
);
assert.equal(emailEvidence.autoEligible, true);

const phoneOnlyEvidence = prepareContactEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_contacts: [
    crmContact("source", {
      email: "",
      linkedin_person_id: "",
      linkedin_url: "",
    }),
    crmContact("phone-match", {
      email: "",
      linkedin_person_id: "",
      linkedin_url: "",
    }),
  ],
});
assert.equal(
  phoneOnlyEvidence.phoneOnly,
  true,
  "same phone only must be classified as low confidence",
);
assert.equal(
  phoneOnlyEvidence.autoEligible,
  false,
  "phone-only contact groups must never merge automatically",
);

const genericEmailEvidence = prepareContactEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_contacts: [
    crmContact("source", {
      email: "info@example.com",
      linkedin_person_id: "",
      linkedin_url: "",
      phone: "",
    }),
    crmContact("generic-email", {
      email: "INFO@example.com",
      linkedin_person_id: "",
      linkedin_url: "",
      phone: "",
    }),
  ],
});
assert.equal(
  genericEmailEvidence.genericOrSharedEmail,
  true,
  "role-based email addresses must be flagged as generic or shared",
);
assert.equal(
  genericEmailEvidence.autoEligible,
  false,
  "generic or shared email groups must never merge automatically",
);

const conflictingContactEvidence = prepareContactEvidence({
  start: { hs_object_id: "source" },
  find_duplicate_contacts: [
    crmContact("source"),
    crmContact("conflict", {
      linkedin_person_id: "different-person",
      linkedin_url: "https://linkedin.com/in/someone-else",
    }),
  ],
});
assert.equal(
  conflictingContactEvidence.conflictingLinkedinIdentity,
  true,
  "conflicting LinkedIn identity must be visible to the contact merge gate",
);
assert.equal(
  conflictingContactEvidence.autoEligible,
  false,
  "conflicting LinkedIn contact identity must never merge automatically",
);

const staleContactEvidence = prepareContactEvidence({
  start: { hs_object_id: "already-merged" },
  find_duplicate_contacts: [crmContact("survivor")],
});
assert.equal(
  staleContactEvidence.sourceFound,
  false,
  "an already-merged or changed contact source must stop before scoring",
);
assert.deepEqual(
  staleContactEvidence.cluster,
  [],
  "a missing fresh contact source must never emit merge IDs",
);

assert.equal(
  contactResource.spec.isEnabled,
  false,
  "contact dedup play must be disabled",
);
assert.equal(
  contactResource.spec.limit,
  15,
  "contact dedup pilot must be limited to 15",
);
assert.equal(
  contactResource.spec.runCreationRule,
  "noConcurrency",
  "contact dedup play must use noConcurrency",
);

const contactCandidate = (id, overrides = {}) => ({
  id,
  email: "jack@example.com",
  phone: "415-555-0101",
  linkedinUrl: "https://linkedin.com/in/jack-smith/",
  linkedinPersonId: "person-123",
  associatedDeals: 0,
  activities: 0,
  populatedProperties: 1,
  createdAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});
assert.equal(
  infra.classifyContactCluster([
    contactCandidate("older"),
    contactCandidate("commercial-history", { associatedDeals: 2 }),
  ]).survivor.id,
  "commercial-history",
  "contact survivor policy must prefer associated deal history",
);
assert.equal(
  infra.classifyContactCluster([
    contactCandidate("one", { linkedinPersonId: undefined }),
    contactCandidate("two", { linkedinPersonId: undefined }),
  ]).matchClass,
  "exact_linkedin_url",
  "shared LinkedIn person URL without person-ID conflict is high confidence",
);
assert.equal(
  infra.classifyContactCluster([
    contactCandidate("one", {
      linkedinPersonId: undefined,
      linkedinUrl: undefined,
    }),
    contactCandidate("two", {
      linkedinPersonId: undefined,
      linkedinUrl: undefined,
    }),
  ]).matchClass,
  "exact_non_generic_email",
  "shared non-generic email without LinkedIn conflict is high confidence",
);
assert.equal(
  infra.classifyContactCluster([
    contactCandidate("one", {
      email: "hello@example.com",
      linkedinPersonId: undefined,
      linkedinUrl: undefined,
      phone: undefined,
    }),
    contactCandidate("two", {
      email: "hello@example.com",
      linkedinPersonId: undefined,
      linkedinUrl: undefined,
      phone: undefined,
    }),
  ]).matchClass,
  "generic_or_shared_email_review",
  "role-based shared contact email must stay review-only",
);
assert.equal(
  infra.normalizeEmail(" JACK@Example.COM "),
  "jack@example.com",
  "contact email normalization must be stable",
);
assert.equal(
  infra.normalizeLinkedInPersonUrl(
    "https://www.linkedin.com/in/Jack-Smith/?trk=public",
  ),
  "jack-smith",
  "LinkedIn person URLs must normalize with or without a URL scheme",
);
assert.equal(
  infra.normalizePhone("(415) 555-0101"),
  "+14155550101",
  "US phone numbers must normalize when the country code is inferable",
);
assert.ok(
  infra.phoneMatchKeys("06 12 34 56 78").includes("+33612345678"),
  "French local phone numbers must expose an international match key",
);
assert.ok(
  infra.phoneMatchKeys("020 7946 0958").includes("+442079460958"),
  "UK local phone numbers must expose an international match key",
);
assert.ok(
  infra.phoneMatchKeys("0044 20 7946 0958").includes("+442079460958"),
  "00-prefixed phone numbers must expose an international match key",
);
assert.equal(
  infra.classifyContactCluster([
    contactCandidate("fr-local", {
      email: undefined,
      linkedinPersonId: undefined,
      linkedinUrl: undefined,
      phone: "06 12 34 56 78",
    }),
    contactCandidate("fr-e164", {
      email: undefined,
      linkedinPersonId: undefined,
      linkedinUrl: undefined,
      phone: "+33 6 12 34 56 78",
    }),
  ]).matchClass,
  "phone_only_review",
  "international phone-only contact matches must remain low-confidence",
);
assert.throws(
  () =>
    infra.classifyContactCluster([
      contactCandidate("same"),
      contactCandidate("same"),
    ]),
  /distinct source record IDs/,
  "duplicate contact source record IDs must be rejected",
);

console.log(
  "ok: crm-deduplication searches and scores CRM rows before guarded merge or human review",
);
