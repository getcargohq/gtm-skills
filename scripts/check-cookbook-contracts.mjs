#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const crms = ["hubspot", "salesforce", "attio"];
const enrichmentRoot = join(root, "cookbooks", "account-enrichment");
const deduplicationRoot = join(root, "cookbooks", "account-deduplication");
const hasEnrichment = existsSync(join(enrichmentRoot, "SKILL.md"));
const hasDeduplication = existsSync(join(deduplicationRoot, "SKILL.md"));
const candidateContractPath = join(
  deduplicationRoot,
  "cdk",
  "context",
  "candidate-contract.ts",
);
if (hasEnrichment) {
  const enrichmentPlay = readFileSync(
    join(enrichmentRoot, "cdk", "play", "account-enrichment.ts"),
    "utf8",
  );
  const workflowBody = enrichmentPlay.slice(
    enrichmentPlay.indexOf("const enrichAccountWorkflow = defineWorkflow("),
  );

  assert.match(enrichmentPlay, /unification:\s*\{ source: "integration" \}/);
  assert.match(enrichmentPlay, /defineModel\("accounts"/);
  assert.match(enrichmentPlay, /defineTool\("account_enrichment"/);
  assert.match(enrichmentPlay, /model:\s*crmAccounts/);
  assert.match(
    enrichmentPlay,
    /crmRecordId:\s*z\.string\(\)\.trim\(\)\.min\(1\)/,
  );
  assert.equal(
    [...enrichmentPlay.matchAll(/skipIfExist:\s*true/g)].length,
    12,
    "account-enrichment: every selected business field is blank-only in both provider routes",
  );
  assert.match(enrichmentPlay, /skipped_unconfigured_fields/);
  assert.ok(
    workflowBody.indexOf("if (hasPlaceholderFields)") <
      workflowBody.indexOf("uses.linkedin.enrichCompany"),
    "account-enrichment: placeholders stop before paid calls",
  );
  assert.ok(
    workflowBody.indexOf("if (input.linkedinUrl)") <
      workflowBody.indexOf("else if (input.domain)"),
    "account-enrichment: LinkedIn URL precedes domain fallback",
  );
  assert.match(enrichmentPlay, /isEnabled:\s*false/);
  assert.match(enrichmentPlay, /limit:\s*15/);
  assert.match(enrichmentPlay, /runCreationRule:\s*"noConcurrency"/);
  assert.match(enrichmentPlay, /changeKinds:\s*\["added"\]/);
  assert.match(enrichmentPlay, /value:\s*"6 months"/);
  assert.match(enrichmentPlay, /cron:\s*"0 6 \* \* \*"/);
  assert.doesNotMatch(enrichmentPlay, /changeKinds:\s*\[[^\]]*"updated"/);
  assert.doesNotMatch(enrichmentPlay, /accountEnrichmentTargets/);
  assert.doesNotMatch(enrichmentPlay, /accountSourceIdClaims/);
  assert.doesNotMatch(enrichmentPlay, /defineSegment/);
  process.stdout.write("ok: cookbook contracts/account-enrichment\n");
}

if (hasDeduplication) {
  const candidateContractSource = readFileSync(candidateContractPath, "utf8");
  const domainReviewer = readFileSync(
    join(deduplicationRoot, "cdk", "agents", "review-domain.ts"),
    "utf8",
  );

  assert.match(domainReviewer, /languageModel: "gpt-5-mini"/);
  assert.match(domainReviewer, /temperature: 0\.1/);
  assert.match(
    domainReviewer,
    /shared domain or similar name is candidate evidence/,
  );
  assert.match(domainReviewer, /Never choose a survivor, approve a merge/);
  assert.doesNotMatch(candidateContractSource, /defineTool/);
}

const candidate = (overrides = {}) => ({
  id: "record-a",
  isCustomer: false,
  openOpportunities: 0,
  contacts: 0,
  activities: 0,
  populatedProperties: 0,
  createdAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

for (const crm of crms) {
  if (hasDeduplication) {
    const contract = await import(pathToFileURL(candidateContractPath));

    assert.equal(
      contract.normalizeDomain("https://www.Example.com.:443/path?x=1"),
      "example.com",
      `${crm}: normalize domains before clustering`,
    );
    assert.equal(
      contract.normalizeLinkedInHandle(
        "https://www.linkedin.com/company/Acme/?trk=public_profile",
      ),
      "acme",
      `${crm}: normalize LinkedIn company URLs before clustering`,
    );
    assert.throws(
      () => contract.classifyCluster([candidate()]),
      /at least two records/,
      `${crm}: reject one-record clusters`,
    );
    assert.throws(
      () =>
        contract.classifyCluster([
          candidate({ id: "" }),
          candidate({ id: "record-b" }),
        ]),
      /non-empty record ID/,
      `${crm}: reject empty source IDs`,
    );
    assert.throws(
      () =>
        contract.classifyCluster([
          candidate({ id: "record-a" }),
          candidate({ id: "record-a" }),
        ]),
      /distinct source record IDs/,
      `${crm}: reject repeated source IDs`,
    );

    const exact = contract.classifyCluster([
      candidate({ id: "record-a", linkedinId: "123", domain: "acme.com" }),
      candidate({ id: "record-b", linkedinId: "123", domain: "acme.com" }),
    ]);
    assert.equal(exact.matchClass, "exact_unique_linkedin");

    const urlReview = contract.classifyCluster([
      candidate({
        id: "record-a",
        linkedinUrl: "https://linkedin.com/company/acme/",
      }),
      candidate({
        id: "record-b",
        linkedinUrl: "https://www.linkedin.com/company/acme?trk=one",
      }),
    ]);
    assert.equal(urlReview.matchClass, "linkedin_url_review");

    const domainReview = contract.classifyCluster([
      candidate({ id: "record-a", domain: "https://acme.com" }),
      candidate({ id: "record-b", domain: "www.acme.com/" }),
    ]);
    assert.equal(domainReview.matchClass, "domain_review");

    const junkDomain = contract.classifyCluster([
      candidate({ id: "record-a", domain: "example.com", isJunkDomain: true }),
      candidate({ id: "record-b", domain: "example.com" }),
    ]);
    assert.equal(junkDomain.matchClass, "junk_domain_review");

    const relatedEntities = contract.classifyCluster([
      candidate({
        id: "record-a",
        linkedinId: "123",
        parentOrSubsidiaryWarning: true,
      }),
      candidate({ id: "record-b", linkedinId: "123" }),
    ]);
    assert.equal(relatedEntities.matchClass, "parent_or_subsidiary_review");

    const protectedWinner = contract.selectSurvivor([
      candidate({ id: "protected", protectedId: "billing-1" }),
      candidate({
        id: "busy-customer",
        isCustomer: true,
        openOpportunities: 10,
      }),
    ]);
    assert.equal(protectedWinner.id, "protected");

    const protectedConflict = contract.classifyCluster([
      candidate({ id: "record-a", protectedId: "billing-1" }),
      candidate({ id: "record-b", protectedId: "billing-2" }),
    ]);
    assert.equal(protectedConflict.matchClass, "conflict");
    assert.equal(protectedConflict.protectedIdConflict, true);
  }

  const dedupPlay = hasDeduplication
    ? readFileSync(
        join(
          root,
          "cookbooks",
          "account-deduplication",
          "cdk",
          "plays",
          crm,
          "deduplicate-accounts.ts",
        ),
        "utf8",
      )
    : "";

  if (hasDeduplication) {
    assert.match(dedupPlay, /approvedForMerge:\s*false/g);
    assert.match(dedupPlay, /source_model_slug/);
    assert.doesNotMatch(dedupPlay, /approvedForMerge:\s*true/);
    assert.match(dedupPlay, /runCreationRule:\s*"noConcurrency"/);
    assert.match(dedupPlay, /isEnabled:\s*false/);
    assert.match(dedupPlay, /limit:\s*15/);
    assert.doesNotMatch(dedupPlay, /mergeRecords\s*\(/);
    assert.doesNotMatch(dedupPlay, /defineSegment/);
  }

  if (hasDeduplication) process.stdout.write(`ok: cookbook contracts/${crm}\n`);
}
