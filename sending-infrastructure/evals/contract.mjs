import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
await import(`../infra/index.ts?contract=${Date.now()}`);

const all = resources();
const domains = all.filter((resource) => resource.kind === "domain");
const mailboxes = all.filter((resource) => resource.kind === "mailbox");
const folders = all.filter((resource) => resource.kind === "folder");

assert.ok(domains.length > 0, "the fleet must declare at least one domain");
assert.ok(mailboxes.length > 0, "the fleet must declare at least one mailbox");

// The fleet exists so that a burned sending domain is a disposable one. The
// brand's own domain in the fleet defeats the entire point.
const redirects = new Set(
  domains.map((domain) => domain.spec.redirectUrl).filter(Boolean),
);
assert.equal(
  redirects.size,
  1,
  "every domain must redirect to the same primary domain",
);
const primary = [...redirects][0]
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
for (const domain of domains) {
  assert.notEqual(
    domain.spec.name,
    primary,
    `${domain.spec.name} is the primary domain and must never be in the fleet`,
  );
}

for (const domain of domains) {
  // A parked lookalike is a signal in its own right.
  assert.ok(
    domain.spec.redirectUrl,
    `${domain.spec.name} must forward its apex to the primary domain`,
  );
  // DMARC is published from the start; enforcement is tightened later.
  assert.ok(
    domain.spec.dmarcEmail,
    `${domain.spec.name} must name a mailbox to receive rua= reports`,
  );
  assert.ok(
    ["none", "quarantine", "reject"].includes(domain.spec.dmarcPolicy),
    `${domain.spec.name} must publish a DMARC policy`,
  );
  // Declaring the zone REPLACES it, including the MX and DKIM records the
  // registrar wrote at purchase. Domain and mailboxes stay active while mail
  // stops arriving, so this is enforced rather than documented.
  assert.equal(
    domain.spec.dnsRecords,
    undefined,
    `${domain.spec.name} must not declare dnsRecords: doing so replaces the live zone`,
  );
}

// A fleet's job is to be uniform. These two assertions are what a hand-written
// list drifts away from.
assert.equal(
  mailboxes.length % domains.length,
  0,
  "the fleet must be a full grid: every domain carries the same senders",
);
const perDomain = mailboxes.length / domains.length;

const shapeOf = (username) => (username.includes(".") ? "first.last" : "first");
const shapes = new Set(
  mailboxes.map((mailbox) => shapeOf(mailbox.spec.username)),
);
assert.equal(
  shapes.size,
  1,
  "every mailbox must use one local-part shape; a fleet that mixes them reads as generated",
);

for (const mailbox of mailboxes) {
  // A fabricated sender is refused under acceptable use.
  assert.ok(
    mailbox.spec.firstName && mailbox.spec.lastName,
    `${mailbox.spec.slug} must carry a real first and last name`,
  );
  assert.ok(
    mailbox.spec.signature,
    `${mailbox.spec.slug} must carry a signature`,
  );
  assert.ok(
    mailbox.spec.domainUuid,
    `${mailbox.spec.slug} must attach to a declared domain`,
  );
  // A slug that changes between plans reads as a teardown and a rebuild, and
  // the rebuild is a fresh mailbox with a fresh 45-day ramp.
  assert.ok(
    mailbox.spec.slug.includes(mailbox.spec.username.replace(/\./g, "-")),
    `${mailbox.spec.slug} must derive its slug from the sender`,
  );
}

assert.ok(
  folders.some((folder) => folder.spec.folderKind === "mailbox"),
  "the fleet must be filed under a mailbox folder",
);

console.log(
  `contract ok: ${domains.length} domains x ${perDomain} senders = ${mailboxes.length} mailboxes`,
);
