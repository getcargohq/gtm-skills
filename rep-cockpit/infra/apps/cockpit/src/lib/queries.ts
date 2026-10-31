import { quote } from "./cargo";

// Every read the cockpit makes, in one file. Tables are `<dataset>.<model>`:
// `object` is the workspace's native dataset, `ai_ark` the dataset of the
// connector tam-building sources through. Check both with
// `cargo-ai storage dataset list` before the first deploy.

export type HotLead = {
  domain: string;
  name: string;
  tier: string | null;
  tier_reason: string | null;
  readiness_score: number | null;
  readiness_stage: string | null;
};

// Hot leads: accounts that are ready now or warming (readiness-scoring, on
// Unify Accounts), best fit first (account-scoring's tier on tam_companies),
// and nobody has claimed or passed. An account with no tier yet still shows,
// after the tiered ones: readiness alone is a reason to look.
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
  AND (c.status IS NULL OR c.status = 'released')
GROUP BY a.domain, a.metric__readiness_score, a.computed__readiness_stage
HAVING MAX(t.custom__tier) IS NULL OR MAX(t.custom__tier) IN ('A', 'B')
ORDER BY
  CASE MAX(t.custom__tier) WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END,
  a.metric__readiness_score DESC
LIMIT 50`;

export type Claim = {
  account_domain: string;
  account_name: string;
  account_id: string | null;
  status: string;
  sourcing_status: string | null;
  contacts_found: number | null;
  status_at: string | null;
};

export const myClaimsQuery = (repEmail: string): string => {
  return `
SELECT account_domain, account_name, account_id, status, sourcing_status,
  contacts_found, CAST(status_at AS STRING) AS status_at
FROM object.cockpit_claims
WHERE rep_email = ${quote(repEmail)} AND status = 'claimed'
ORDER BY status_at DESC
LIMIT 200`;
};

export const claimQuery = (domain: string): string => {
  return `
SELECT account_domain, account_name, account_id, status, sourcing_status,
  contacts_found, CAST(status_at AS STRING) AS status_at
FROM object.cockpit_claims
WHERE account_domain = ${quote(domain)}
LIMIT 1`;
};

export type Draft = {
  contact_id: string;
  contact_name: string;
  contact_title: string | null;
  contact_email: string | null;
  linkedin_url: string | null;
  subject: string;
  body: string;
  why_now: string | null;
  status: string;
};

export const draftsQuery = (domain: string): string => {
  return `
SELECT contact_id, contact_name, contact_title, contact_email, linkedin_url,
  subject, body, why_now, status
FROM object.cockpit_drafts
WHERE account_domain = ${quote(domain)}
ORDER BY contact_name`;
};
