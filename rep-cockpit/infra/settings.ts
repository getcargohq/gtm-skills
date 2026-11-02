// The settings an operator changes without touching the graph. Edit here, run
// `cargo-ai project plan`, and read what moved.

// How many people a claim sources at the account. Each one is a people-search
// row, an email lookup and a draft, so this is the per-claim cost ceiling.
export const contactsPerClaim = 3;

// Who a claim sources: the buying committee you sell to, as the people search
// filters it. Values are AI Ark's own enums (`c_suite`, `vp`, `director`,
// `head`, `manager`; `sales`, `marketing`, `operations`, `finance`,
// `engineering`…). Keep at least one value in each: the search refuses an
// empty list.
export const committeeSeniorities = ["c_suite", "vp", "director", "head"];
export const committeeDepartments = ["sales", "marketing", "operations"];

// How long a sent email waits for a reply before the writer drafts the next
// touch, in hours. The wait is one play run per sent email, so a reply that
// lands later than this, after the last touch, is not logged on the account.
export const followUpAfterHours = 96;

// How many emails one person gets in all, the first touch included. The play
// drafts a follow-up while a person is under it, and marks them no_reply at it.
// Every follow-up is still a draft: the rep reads it and clicks Send.
export const touchesPerContact = 2;
