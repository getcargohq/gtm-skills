import { quote } from "./cargo";

export const hasText = (value: string | null | undefined): value is string => {
  return value !== null && value !== undefined && value !== "";
};

// Every read the cockpit makes, in one file. The storage SQL leaves a NULL
// column out of the row entirely, so every nullable field below is optional
// and is read with `hasText`, never compared to null alone. Tables are `<dataset>.<model>`:
// `object` is the workspace's native dataset, `ai_ark` the dataset of the
// connector tam-building sources through. Check both with
// `cargo-ai storage dataset list` before the first deploy.

export type HotLead = {
  domain: string;
  name: string;
  tier?: string | null;
  tier_reason?: string | null;
  readiness_score?: number | null;
  readiness_stage?: string | null;
};

// An account is open to claim when nobody holds it: never claimed, released,
// or passed on timing and past its date.
const isOpen = `(c.status IS NULL OR c.status = 'released'
    OR (c.status = 'passed' AND CAST(c.parked_until AS TIMESTAMP) < CURRENT_TIMESTAMP()))`;

// Hot leads: accounts that are ready now or warming (readiness-scoring, on
// Unify Accounts), best fit first (account-scoring's tier on tam_companies),
// and open to claim. An account with no tier yet still shows, after the tiered
// ones: readiness alone is a reason to look.
export const hotLeadsQuery = `
SELECT
  a.domain AS domain,
  COALESCE(MAX(t.name), a.domain) AS name,
  MAX(t.custom__tier) AS tier,
  MAX(t.custom__tier_reason) AS tier_reason,
  a.metric__readiness_score AS readiness_score,
  a.computed__readiness_stage AS readiness_stage
FROM object.accounts a
LEFT JOIN ai_ark.tam_companies t ON t.domain = a.domain
LEFT JOIN object.cockpit_claims c ON c.account_domain = a.domain
WHERE a.computed__readiness_stage IN ('ready_now', 'warming')
  AND a.domain IS NOT NULL
  AND ${isOpen}
GROUP BY a.domain, a.metric__readiness_score, a.computed__readiness_stage
HAVING MAX(t.custom__tier) IS NULL OR MAX(t.custom__tier) IN ('A', 'B')
ORDER BY
  CASE MAX(t.custom__tier) WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END,
  a.metric__readiness_score DESC
LIMIT 50`;

export type Signal = {
  domain: string;
  signal: string;
  occurred?: string | null;
};

// Why now: the three events adding most to each account's readiness today,
// from readiness-scoring's Account Events. The same rows the score sums, so
// the list can never disagree with the stage next to it.
export const signalsQuery = (domains: string[]): string => {
  return `
SELECT domain, signal, occurred FROM (
  SELECT
    a.domain AS domain,
    COALESCE(JSON_VALUE(e.properties, '$.signal_type'), e.event_name, e.model_slug) AS signal,
    CAST(DATE(CAST(e.occurred_at AS TIMESTAMP)) AS STRING) AS occurred,
    ROW_NUMBER() OVER (
      PARTITION BY a.domain ORDER BY e.computed__readiness_contribution DESC
    ) AS signal_rank
  FROM object.accounts a
  JOIN object.account_events e ON e.account_id = a.id
  WHERE a.domain IN (${domains.map(quote).join(", ")})
    AND e.computed__readiness_contribution > 0
)
WHERE signal_rank <= 3
ORDER BY domain, signal_rank`;
};

// What the queue knows about one domain, for an account a rep adds by hand:
// its name and tier when tam-building has it, its readiness when it is scored.
export const accountLookupQuery = (domain: string): string => {
  return `
SELECT
  ${quote(domain)} AS domain,
  COALESCE(MAX(t.name), ${quote(domain)}) AS name,
  MAX(t.custom__tier) AS tier,
  MAX(t.custom__tier_reason) AS tier_reason,
  MAX(a.metric__readiness_score) AS readiness_score,
  MAX(a.computed__readiness_stage) AS readiness_stage
FROM (SELECT 1) AS one
LEFT JOIN ai_ark.tam_companies t ON t.domain = ${quote(domain)}
LEFT JOIN object.accounts a ON a.domain = ${quote(domain)}`;
};

export type Claim = {
  account_domain: string;
  account_name: string;
  account_id?: string | null;
  account_context?: string | null;
  rep_email?: string | null;
  status: string;
  sourcing_status?: string | null;
  contacts_found?: number | null;
  status_at?: string | null;
};

export type MyClaim = Claim & {
  replies?: number | null;
  follow_ups?: number | null;
};

// The rep's accounts, with what waits for them on each: replies to read and
// follow-ups to send.
export const myClaimsQuery = (repEmail: string): string => {
  return `
SELECT c.account_domain, c.account_name, c.account_id, c.status,
  c.sourcing_status, c.contacts_found,
  CAST(c.status_at AS STRING) AS status_at,
  d.replies, d.follow_ups
FROM object.cockpit_claims c
LEFT JOIN (
  SELECT account_domain,
    COUNTIF(status = 'replied') AS replies,
    COUNTIF(status = 'follow_up') AS follow_ups
  FROM object.cockpit_drafts
  GROUP BY account_domain
) d ON d.account_domain = c.account_domain
WHERE c.rep_email = ${quote(repEmail)} AND c.status = 'claimed'
ORDER BY d.replies DESC, d.follow_ups DESC, c.status_at DESC
LIMIT 200`;
};

export const claimQuery = (domain: string): string => {
  return `
SELECT account_domain, account_name, account_id, account_context, rep_email,
  status, sourcing_status, contacts_found,
  CAST(status_at AS STRING) AS status_at
FROM object.cockpit_claims
WHERE account_domain = ${quote(domain)}
LIMIT 1`;
};

export type Draft = {
  contact_id: string;
  contact_name: string;
  contact_title?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  linkedin_url?: string | null;
  rep_name?: string | null;
  subject: string;
  body: string;
  why_now?: string | null;
  status: string;
  drafted_at?: string | null;
  rfc_message_id?: string | null;
  touches?: number | null;
  reply_snippet?: string | null;
  replied_at?: string | null;
};

export const draftsQuery = (domain: string): string => {
  return `
SELECT contact_id, contact_name, contact_title, contact_email, contact_phone,
  linkedin_url, rep_name, subject, body, why_now, status,
  CAST(drafted_at AS STRING) AS drafted_at, rfc_message_id,
  touches, reply_snippet, CAST(replied_at AS STRING) AS replied_at
FROM object.cockpit_drafts
WHERE account_domain = ${quote(domain)}
ORDER BY contact_name`;
};

export type Activity = {
  occurred_at: string;
  kind: string;
  subject?: string | null;
  body?: string | null;
  owner_email?: string | null;
  contact_name?: string | null;
};

// Everything logged on the account, by any pipeline: the cockpit's emails and
// replies, and the meetings, calls and notes others write to gtm_activities.
export const timelineQuery = (accountId: string): string => {
  return `
SELECT CAST(a.occurred_at AS STRING) AS occurred_at, a.kind, a.subject,
  a.body, a.owner_email, c.name AS contact_name
FROM object.gtm_activities a
LEFT JOIN object.gtm_contacts c ON c.id = a.contact_id
WHERE a.account_id = ${quote(accountId)}
ORDER BY a.occurred_at DESC
LIMIT 50`;
};
