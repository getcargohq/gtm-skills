import { defineDomain } from "@cargo-ai/cdk";

// PLACEHOLDER — the sending domain this mailbox lives on. A mailbox can only
// be created on a domain the workspace already owns and that is active.
//
// `adopt: true` is the common path: the domain was bought in the Cargo UI (or
// by an earlier deploy whose state file was lost), and this declaration binds
// to it. `destroy` then releases it rather than cancelling a registration the
// deploy never paid for. Drop `adopt` only when the plan is meant to register
// a new domain — that charges workspace credits and is not refundable, and a
// `+ create domain:…` line in `cargo-ai cdk plan` is the signal.
//
// `dnsRecords` is deliberately omitted. Declaring it REPLACES the whole zone,
// including the records the registrar wrote at purchase. Leave the zone alone
// unless you mean to own DNS from this file.
export const outreach = defineDomain("example-outreach.com", { adopt: true });
