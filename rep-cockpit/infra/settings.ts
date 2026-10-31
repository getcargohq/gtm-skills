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
