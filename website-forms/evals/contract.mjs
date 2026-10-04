import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resetRegistry, resources } from "@cargo-ai/cdk";

// The boundaries CDK schema validation cannot express, checked against the
// compiled registry. `cargo-cdk check` proves the resources are well formed;
// this proves they are still the inbound flow this skill describes after an
// agent has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
const resourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return resourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });

resetRegistry();
const stamp = Date.now();
for (const file of resourceFiles(fileURLToPath(new URL("../infra", import.meta.url))))
  await import(`${pathToFileURL(file).href}?contract=${stamp}`);

const all = resources();
const byId = (id) => all.find((resource) => resource.id === id);

// The shared models, exactly as every pipeline declares them.
const accounts = byId("model:gtm_accounts");
const contacts = byId("model:gtm_contacts");
assert.ok(accounts && contacts, "gtm_accounts and gtm_contacts must be declared");
assert.equal(accounts.spec.extractorSlug, "defineAccount");
assert.equal(accounts.spec.name, "GTM accounts");
assert.equal(contacts.spec.extractorSlug, "defineContact");
assert.equal(contacts.spec.name, "GTM contacts");
for (const column of contacts.spec.additionalColumns ?? [])
  assert.doesNotMatch(
    column.slug,
    /^cargo_/,
    "columns added to a shared model take plain names, never a cargo_ prefix",
  );

const tool = byId("tool:inbound_form");
assert.ok(tool, "defineTool(inbound_form) must exist");
assert.equal(
  tool.spec.folderUuid?.resourceId,
  "folder:website_forms_tools",
  "the tool must be filed in the website_forms_tools folder",
);

// The public form: on, for exactly the site's origin, no secret in code.
const form = tool.spec.publicForm;
assert.equal(form?.isEnabled, true, "the public form must be enabled");
assert.equal(form.allowedOrigins.length, 1, "exactly one allowed origin: the site's");
assert.match(
  form.allowedOrigins[0],
  /^https:\/\/[a-z0-9.-]+$/i,
  "the allowed origin is the site's HTTPS origin, no path, no trailing slash, never *",
);
assert.ok(
  form.spam.captchaSecret === null || /^\$\{[A-Z0-9_]+\}$/.test(form.spam.captchaSecret),
  "a CAPTCHA secret comes from env(), never a literal in the repository",
);
assert.ok(form.spam.minFillMillis > 0, "the time-trap stays on");

// The workflow: company enrichment, the two shared models, Slack. Nothing
// that looks a person up, and no write anywhere else.
const actions = tool.spec.nodes.filter((node) => node.actionSlug !== undefined);
const flow = new Set(["start", "end", "branch"]);
const allowed = new Set(["enrichCompanyFromDomain", "modelUpsert", "postMessage", ...flow]);
for (const node of actions)
  assert.ok(
    allowed.has(node.actionSlug),
    `the workflow calls ${node.actionSlug}: only company enrichment, the shared models and Slack`,
  );
const upserts = actions.filter((node) => node.actionSlug === "modelUpsert");
assert.deepEqual(
  upserts.map((node) => node.config.modelUuid?.resourceId).sort(),
  [accounts.id, contacts.id],
  "the workflow writes exactly gtm_accounts and gtm_contacts",
);
const contactUpsert = upserts.find((node) => node.config.modelUuid.resourceId === contacts.id);
assert.match(
  JSON.stringify(contactUpsert.config.mappings.find((m) => m.columnSlug === "account_id")),
  /modelUpsert/,
  "the contact's account_id is read back from the account upsert, never invented",
);

// The form's fields are the workflow's input.
const fields = tool.spec.formFields.map((field) => field.slug ?? field.name);
for (const field of ["email", "first_name", "last_name", "consent"])
  assert.ok(fields.includes(field), `the form asks for ${field}`);

console.log("ok: website-forms contract");
