#!/usr/bin/env node
// Checks deterministic contracts for cookbook-account-enrichment only.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cookbookRoot = join(root, "cookbook-account-enrichment");
if (!existsSync(join(cookbookRoot, "SKILL.md"))) process.exit(0);

const enrichmentPlay = readFileSync(
  join(cookbookRoot, "infra", "account-enrichment.ts"),
  "utf8",
);
const workflowBody = enrichmentPlay.slice(
  enrichmentPlay.indexOf("const enrichAccountWorkflow = defineWorkflow("),
);
const placeholderGuard = workflowBody.indexOf("if (hasPlaceholderFields)");
const providerCall = workflowBody.indexOf("uses.linkedin.enrichCompany");
const linkedInBranch = workflowBody.indexOf("if (input.linkedinUrl)");
const domainBranch = workflowBody.indexOf("else if (input.domain)");

assert.match(enrichmentPlay, /unification:\s*\{ source: "integration" \}/);
assert.match(enrichmentPlay, /defineModel\("crm_accounts"/);
assert.match(enrichmentPlay, /defineModel\("accounts"/);
assert.match(enrichmentPlay, /defineTool\("account_enrichment"/);
assert.match(enrichmentPlay, /defineWorkflow\(\s*"enrich_account_row"/);
assert.match(enrichmentPlay, /definePlay\("enrich_accounts"/);
assert.match(enrichmentPlay, /model:\s*crmAccounts/);
assert.match(
  enrichmentPlay,
  /crmRecordId:\s*z\.string\(\)\.trim\(\)\.min\(1\)/,
);
assert.equal(
  [...enrichmentPlay.matchAll(/skipIfExist:\s*true/g)].length,
  12,
  "cookbook-account-enrichment: every selected business field is blank-only in both provider routes",
);
assert.match(enrichmentPlay, /skipped_unconfigured_fields/);
assert.ok(
  placeholderGuard >= 0 && providerCall >= 0 && placeholderGuard < providerCall,
  "cookbook-account-enrichment: placeholders stop before paid calls",
);
assert.ok(
  linkedInBranch >= 0 && domainBranch >= 0 && linkedInBranch < domainBranch,
  "cookbook-account-enrichment: LinkedIn URL precedes domain fallback",
);
assert.match(enrichmentPlay, /isEnabled:\s*false/);
assert.match(enrichmentPlay, /limit:\s*15/);
assert.match(enrichmentPlay, /runCreationRule:\s*"noConcurrency"/);
assert.match(enrichmentPlay, /changeKinds:\s*\["added"\]/);
assert.match(enrichmentPlay, /value:\s*"6 months"/);
assert.equal(
  [
    ...enrichmentPlay.matchAll(
      /columnSlug:\s*crmAccounts\.columns\[crmFields\.last_enriched_at\]/g,
    ),
  ].length,
  2,
  "cookbook-account-enrichment: the freshness filter uses the audited CRM property column",
);
assert.match(enrichmentPlay, /operator:\s*"isNull"/);
assert.match(enrichmentPlay, /cron:\s*"0 6 \* \* \*"/);
assert.doesNotMatch(enrichmentPlay, /changeKinds:\s*\[[^\]]*"updated"/);
assert.doesNotMatch(enrichmentPlay, /accountEnrichmentTargets/);
assert.doesNotMatch(enrichmentPlay, /accountSourceIdClaims/);
assert.doesNotMatch(enrichmentPlay, /defineSegment/);

process.stdout.write("ok: cookbook contracts/cookbook-account-enrichment\n");
