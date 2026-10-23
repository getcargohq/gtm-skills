import { defineDomain } from "@cargo-ai/cdk";

// PLACEHOLDER: the sending domain the mailbox lives on. A mailbox can only be
// created on a domain the workspace owns and that is active.
//
// `adopt: true` is the common path: the domain was bought in the Cargo UI (or
// by an earlier deploy whose state file was lost), and this declaration binds
// to it. Drop `adopt` only when the plan is meant to register a new domain:
// that charges workspace credits, is not refundable, and shows as a
// `+ create domain:…` line in `cargo-ai project plan`.
//
// Buy it through Cargo. A domain connected from another registrar cannot host
// a Cargo mailbox: every mailbox type answers `providerNotSupported` on it.
//
// `dnsRecords` is omitted: the registrar writes the mail records (MX, SPF,
// DKIM, DMARC) and the mailbox needs every one of them. Declare it only for
// records this file should manage, such as a website's. It is merged into the
// live zone, so the mail records stay, and a record dropped from the list is
// deleted on the next deploy. Keep records out of the web app's DNS screen:
// in the build this example comes from, a record saved there republished the
// list as the whole zone and took the mail records with it. Check that MX,
// SPF and DKIM still resolve before the first send.
export const outreach = defineDomain("example-outreach.com", { adopt: true });
