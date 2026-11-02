import { quote } from "./cargo";

export const hasText = (value: string | null | undefined): value is string => {
  return value !== null && value !== undefined && value !== "";
};

// Every read the cockpit makes, in one file. The storage SQL leaves a NULL
// column out of the row entirely, so every nullable field below is optional
// and is read with `hasText`, never compared to null alone. Tables are
// `<dataset>.<model>` in `object`, the workspace's native dataset. Accounts are
// read only from Unify Accounts (`object.accounts`): the fit tier and the
// readiness score are columns on it, and the companies tam-building sourced
// show through it as `ai_ark___tam_companies___<column>`. Check those names with
// `cargo-ai storage model get` on Unify Accounts before the first deploy.

export type HotAccount = {
  domain: string;
  name: string;
  linkedin_url?: string | null;
  tier?: string | null;
  tier_reason?: string | null;
  tier_evidence_url?: string | null;
  tiered_at?: string | null;
  unified_account_id?: string | null;
  readiness_score?: number | null;
  readiness_stage?: string | null;
};

// An account is open to claim when nobody holds it: never claimed, released,
// or passed on timing and past its date.
const isOpen = `(c.status IS NULL OR c.status = 'released'
    OR (c.status = 'passed' AND CAST(c.parked_until AS TIMESTAMP) < CURRENT_TIMESTAMP()))`;

// tam-building's company columns as Unify Accounts exposes them:
// `<dataset>___<model>___<column>`.
const tam = "a.ai_ark___tam_companies___";

// Hot accounts: unified accounts that are ready now or warming
// (readiness-scoring), best fit first (account-scoring's tier, on the same
// row), and open to claim. An account with no tier yet still shows, after the
// tiered ones: readiness alone is a reason to look.
export const hotAccountsQuery = `
SELECT
  a.domain AS domain,
  COALESCE(${tam}name, a.gtm_accounts___name, a.domain) AS name,
  ${tam}linkedin_url AS linkedin_url,
  a.custom__tier AS tier,
  a.custom__tier_reason AS tier_reason,
  a.custom__tier_evidence_url AS tier_evidence_url,
  CAST(a.custom__tiered_at AS STRING) AS tiered_at,
  a.id AS unified_account_id,
  a.metric__readiness_score AS readiness_score,
  a.computed__readiness_stage AS readiness_stage
FROM object.accounts a
LEFT JOIN object.cockpit_claims c ON c.account_domain = a.domain
WHERE a.computed__readiness_stage IN ('ready_now', 'warming')
  AND a.domain IS NOT NULL
  AND (a.custom__tier IS NULL OR a.custom__tier IN ('A', 'B'))
  AND ${isOpen}
ORDER BY
  CASE a.custom__tier WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END,
  a.metric__readiness_score DESC
LIMIT 200`;

export type Signal = {
  domain: string;
  signal: string;
  occurred?: string | null;
  summary?: string | null;
  source?: string | null;
};

// The Signals column: the three events adding most to each account's readiness today,
// from readiness-scoring's Account Events. The same rows the score sums, so
// the list can never disagree with the stage next to it.
export const signalsQuery = (domains: string[]): string => {
  return `
SELECT domain, signal, occurred, summary, source FROM (
  SELECT
    a.domain AS domain,
    COALESCE(JSON_VALUE(e.properties, '$.signal_type'), e.event_name, e.model_slug) AS signal,
    CAST(DATE(CAST(e.occurred_at AS TIMESTAMP)) AS STRING) AS occurred,
    COALESCE(JSON_VALUE(e.properties, '$.summary'), JSON_VALUE(e.properties, '$.title'), JSON_VALUE(e.properties, '$.description')) AS summary,
    e.event_name AS source,
    ROW_NUMBER() OVER (
      PARTITION BY a.domain ORDER BY e.computed__readiness_contribution DESC
    ) AS signal_rank
  FROM object.accounts a
  JOIN object.account_events e ON e.account_id = a.id
  WHERE a.domain IN (${domains.map(quote).join(", ")})
    AND e.model_slug != 'gtm_activities'
    AND e.computed__readiness_contribution > 0
)
WHERE signal_rank <= 3
ORDER BY domain, signal_rank`;
};

// Every event on one account, newest first: what the account page lists as
// its signals. The team's own touches (gtm_activities) are left out: the
// Activity tab lists them. The Hot accounts row shows only the three that count most.
export const accountSignalsQuery = (domain: string): string => {
  return `
SELECT
  a.domain AS domain,
  COALESCE(JSON_VALUE(e.properties, '$.signal_type'), e.event_name, e.model_slug) AS signal,
  CAST(DATE(CAST(e.occurred_at AS TIMESTAMP)) AS STRING) AS occurred,
  COALESCE(JSON_VALUE(e.properties, '$.summary'), JSON_VALUE(e.properties, '$.title'), JSON_VALUE(e.properties, '$.description')) AS summary,
  e.event_name AS source
FROM object.accounts a
JOIN object.account_events e ON e.account_id = a.id
WHERE a.domain = ${quote(domain)}
  AND e.model_slug != 'gtm_activities'
ORDER BY e.occurred_at DESC
LIMIT 100`;
};

// One unified account by domain, for an account a rep adds by hand or opens:
// its name, tier and readiness when it has them, the domain alone when not.
export const accountLookupQuery = (domain: string): string => {
  return `
SELECT
  ${quote(domain)} AS domain,
  COALESCE(${tam}name, a.gtm_accounts___name, ${quote(domain)}) AS name,
  ${tam}linkedin_url AS linkedin_url,
  a.custom__tier AS tier,
  a.custom__tier_reason AS tier_reason,
  a.custom__tier_evidence_url AS tier_evidence_url,
  CAST(a.custom__tiered_at AS STRING) AS tiered_at,
  a.id AS unified_account_id,
  a.metric__readiness_score AS readiness_score,
  a.computed__readiness_stage AS readiness_stage
FROM (SELECT 1) AS one
LEFT JOIN object.accounts a ON a.domain = ${quote(domain)}`;
};

export type CompanyProfile = {
  domain: string;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  employee_count?: string | null;
  city?: string | null;
  country?: string | null;
  founded_year?: string | null;
  revenue?: string | null;
  funding_type?: string | null;
  funding_date?: string | null;
  funding_amount?: string | null;
};

// What tam-building sourced about the company, read off the unified account,
// for a rep deciding whether to claim it: the description and the
// firmographics the tier was judged on.
export const companyProfileQuery = (domain: string): string => {
  return `
SELECT a.domain AS domain, ${tam}website AS website, ${tam}industry AS industry,
  ${tam}description AS description,
  CAST(${tam}employee_count AS STRING) AS employee_count,
  ${tam}city AS city, ${tam}country AS country,
  CAST(${tam}founded_year AS STRING) AS founded_year,
  CAST(${tam}revenue AS STRING) AS revenue,
  JSON_VALUE(${tam}financial, '$.funding.type') AS funding_type,
  JSON_VALUE(${tam}financial, '$.funding.date') AS funding_date,
  JSON_VALUE(${tam}financial, '$.funding.last_amount') AS funding_amount
FROM object.accounts a
WHERE a.domain = ${quote(domain)}
LIMIT 1`;
};

export type Claim = {
  account_domain: string;
  account_name: string;
  gtm_account_id?: string | null;
  account_context?: string | null;
  rep_email?: string | null;
  status: string;
  sourcing_status?: string | null;
  contacts_found?: number | null;
  status_at?: string | null;
  status_at_ms?: number | string | null;
};

export type MyClaim = Claim & {
  linkedin_url?: string | null;
  replies?: number | null;
  follow_ups?: number | null;
  drafts?: number | null;
  no_email?: number | null;
};

// The rep's accounts, with their LinkedIn page and what waits on each:
// replies to read, follow-ups and drafts to send, emails to find.
export const myClaimsQuery = (repEmail: string): string => {
  return `
SELECT c.account_domain, c.account_name, c.status,
  c.sourcing_status, c.contacts_found,
  CAST(c.status_at AS STRING) AS status_at,
  d.replies, d.follow_ups, d.drafts, d.no_email,
  ${tam}linkedin_url AS linkedin_url
FROM object.cockpit_claims c
LEFT JOIN object.accounts a ON a.domain = c.account_domain
LEFT JOIN (
  SELECT account_domain,
    COUNTIF(status = 'replied') AS replies,
    COUNTIF(status = 'follow_up') AS follow_ups,
    COUNTIF(status = 'draft') AS drafts,
    COUNTIF(status = 'no_email') AS no_email
  FROM object.cockpit_drafts
  GROUP BY account_domain
) d ON d.account_domain = c.account_domain
WHERE c.rep_email = ${quote(repEmail)} AND c.status = 'claimed'
ORDER BY d.replies DESC, d.follow_ups DESC, d.drafts DESC, c.status_at DESC
LIMIT 200`;
};

// The claim on one account, and the GTM account it unified with: a meeting
// booked from a reply is logged against that one.
export const claimQuery = (domain: string): string => {
  return `
SELECT c.account_domain, c.account_name, c.account_context, c.rep_email,
  c.status, c.sourcing_status, c.contacts_found,
  CAST(c.status_at AS STRING) AS status_at,
  UNIX_MILLIS(CAST(c.status_at AS TIMESTAMP)) AS status_at_ms,
  a.gtm_accounts___id AS gtm_account_id
FROM object.cockpit_claims c
LEFT JOIN object.accounts a ON a.domain = c.account_domain
WHERE c.account_domain = ${quote(domain)}
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
  angle?: string | null;
  linkedin_note?: string | null;
  linkedin_status?: string | null;
  status: string;
  drafted_at?: string | null;
  message_uuid?: string | null;
  rfc_message_id?: string | null;
  touches?: number | null;
  reply_snippet?: string | null;
  replied_at?: string | null;
};

export const draftsQuery = (domain: string): string => {
  return `
SELECT contact_id, contact_name, contact_title, contact_email, contact_phone,
  linkedin_url, rep_name, subject, body, angle, linkedin_note,
  linkedin_status, status,
  CAST(drafted_at AS STRING) AS drafted_at, message_uuid, rfc_message_id,
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
// The activities hang off a GTM account, found through the unified account
// that domain matched.
export const timelineQuery = (domain: string): string => {
  return `
SELECT CAST(t.occurred_at AS STRING) AS occurred_at, t.kind, t.subject,
  t.body, t.owner_email, p.name AS contact_name
FROM object.accounts a
JOIN object.gtm_activities t ON t.account_id = a.gtm_accounts___id
LEFT JOIN object.gtm_contacts p ON p.id = t.contact_id
WHERE a.domain = ${quote(domain)}
ORDER BY t.occurred_at DESC
LIMIT 50`;
};
