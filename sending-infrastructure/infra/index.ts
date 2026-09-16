import { defineDomain, defineMailbox } from "@cargo-ai/cdk";
import { mailboxesFolder } from "./folders";

// Worked example: a fleet of cold-outreach sending domains for `acme.com`.
//
// The fleet is generated from two tables rather than written out mailbox by
// mailbox. That is deliberate. A fleet's whole job is to be uniform, and a
// hand-written list drifts: one domain ends up with four mailboxes, one sender
// ends up with a different local-part shape, and the pattern that made the
// addresses look human is the thing that breaks.
//
// PLACEHOLDER: every value in both tables, plus PRIMARY_DOMAIN and SIGNATURE.

// The brand these domains point back at. It is never in DOMAINS: sending cold
// volume from the primary domain is what the fleet exists to avoid.
const PRIMARY_DOMAIN = "acme.com";

// PLACEHOLDER: the domains to register, and the DMARC report mailbox.
//
// Sized from the target daily volume, not picked by taste:
//   domains = ceil(target_sends_per_day / (MAILBOXES_PER_DOMAIN * 40))
// 40 is the per-mailbox daily ceiling at the end of warm-up. See references/plan.md.
const DOMAINS = ["tryacme.com", "acmehq.com", "withacme.com"];

// PLACEHOLDER: real people who will really send. Every From header on this
// fleet is one of these humans. A fabricated sender is refused under acceptable
// use, and a prospect who searches the name and finds nobody is a
// deliverability problem before it is an ethical one.
//
// `local` is the address's local part. Keep one shape across the whole fleet:
// `jane@` everywhere, or `jane.doe@` everywhere, never a mix. An address whose
// shape changes per domain reads as generated, because it is.
const SENDERS = [
  { local: "jane", firstName: "Jane", lastName: "Doe" },
  { local: "sam", firstName: "Sam", lastName: "Patel" },
  { local: "rosa", firstName: "Rosa", lastName: "Kim" },
];

// PLACEHOLDER: a real signature with a real company identity behind it.
const signatureFor = (firstName: string, lastName: string) =>
  `<p>${firstName} ${lastName}<br/>Acme<br/><a href="https://${PRIMARY_DOMAIN}">${PRIMARY_DOMAIN}</a></p>`;

// A lookalike domain that serves nothing is a parked page, and a parked page is
// a signal in its own right. `redirectUrl` forwards the apex to the real site,
// so a prospect who types the domain out of the From header lands on the
// company. It is one line and it is the difference between a domain that looks
// owned and one that looks bought.
//
// DMARC starts at `none` with a reporting mailbox. `none` is not weakness: it
// publishes the record and collects `rua=` reports while the fleet has no
// sending history to judge. Tighten to `quarantine` and then `reject` once the
// reports are clean, which is a deliberate later change, not a launch setting.
//
// `dnsRecords` is deliberately NOT declared. Declaring it REPLACES the entire
// live zone, including the MX and DKIM records the registrar wrote at purchase
// and the mailboxes need. Omitted, the registrar's zone stands and Cargo adds
// the DMARC record and the redirect around it.
export const domains = DOMAINS.map((name) =>
  defineDomain(name, {
    redirectUrl: `https://${PRIMARY_DOMAIN}`,
    dmarcEmail: `dmarc@${PRIMARY_DOMAIN}`,
    dmarcPolicy: "none",
  }),
);

// One mailbox per sender per domain. The slug is stable and derived, so a
// re-plan after editing the tables shows the real diff instead of a teardown
// and a rebuild under new names.
//
// `type: "google"` is the default recommendation because it is the flavour
// whose deliverability most recipients' filters already trust. `shared` and
// `private` cost less; read the live figures with
// `cargo-ai mailboxManagement pricing get` before choosing.
const slugify = (value: string) => value.replace(/\./g, "-");

export const mailboxes = domains.flatMap((domain) =>
  SENDERS.map((sender) =>
    // A slug takes lowercase letters, digits, hyphens and underscores, so the
    // dots in a `jane.doe` local part and in the domain both become hyphens.
    // The address itself keeps its dots: `username` is what is sent from.
    defineMailbox(`${slugify(sender.local)}-${slugify(domain.name)}`, {
      domain,
      type: "google",
      username: sender.local,
      firstName: sender.firstName,
      lastName: sender.lastName,
      signature: signatureFor(sender.firstName, sender.lastName),
      folder: mailboxesFolder,
    }),
  ),
);

// The fleet's ceiling once warm-up finishes, in sends per day. Deploy does not
// produce this number: warm-up does, 45 days later, and only if it was started.
// The CDK does not model warm-up. See references/warmup.md.
export const dailyCeilingAtFullRamp = mailboxes.length * 40;
