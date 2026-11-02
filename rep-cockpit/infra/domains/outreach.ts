import { defineDomain } from "@cargo-ai/cdk";

// PLACEHOLDER: the sending domain the reps' mailboxes live on. A mailbox can
// only be created on a domain the workspace already owns and that is active.
//
// `adopt: true` binds a domain bought in the Cargo UI, and `destroy` then
// releases it rather than cancelling a registration the deploy never paid for.
// Drop `adopt` only when the plan is meant to register a new domain: that
// charges workspace credits, is not refundable, and shows as
// `+ create domain:…` in `cargo-ai project plan`.
//
// Never your primary domain: cold first touches from it put the domain your
// customers' mail comes from at risk.
export const outreach = defineDomain("example-outreach.com", { adopt: true });
