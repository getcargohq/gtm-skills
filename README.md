# Cargo GTM Skills

12 standalone agent skills, one job each. Install only the one you need — no account
required to read them, and a new Cargo account starts with **100 free credits, no card**.

```bash
npx skills add getcargohq/cargo-gtm-skills/<skill-name>
```

| Skill | Does |
|---|---|
| [`find-b2b-leads`](find-b2b-leads/SKILL.md) | Find B2B leads by job title, company, and keyword, and return them as a structured list. |
| [`build-tam-list`](build-tam-list/SKILL.md) | Build a total addressable market list of companies filtered by industry, headcount, and geography. |
| [`find-linkedin-url`](find-linkedin-url/SKILL.md) | Resolve a person's LinkedIn profile URL from their name and company, with an identity-validation gate that rejects wrong matches. |
| [`enrich-linkedin-profile`](enrich-linkedin-profile/SKILL.md) | Turn a LinkedIn profile URL into a full person profile plus a verified work email in a single call. |
| [`find-work-email`](find-work-email/SKILL.md) | Find a verified work email address from a person's name and company domain. |
| [`verify-email-list`](verify-email-list/SKILL.md) | Verify a list of email addresses so you stop sending to bounces. |
| [`enrich-company-data`](enrich-company-data/SKILL.md) | Enrich a list of companies with firmographics — industry, size, geography, founding year, and headquarters. |
| [`find-stakeholders`](find-stakeholders/SKILL.md) | Find the buying committee at a target account — every stakeholder matching a set of titles, seniorities, and departments. |
| [`track-job-changes`](track-job-changes/SKILL.md) | Detect which of your contacts have changed jobs, and where they went. |
| [`track-funding-rounds`](track-funding-rounds/SKILL.md) | Track which companies recently raised funding, with round, amount, and investors. |
| [`find-companies-using-tech`](find-companies-using-tech/SKILL.md) | Find companies by the technology they run or the roles they are hiring for. |
| [`find-portfolio-companies`](find-portfolio-companies/SKILL.md) | Find every portfolio company of an investor or accelerator, then the people inside them. |

## Want all of it?

These are slices of the full [Cargo skills pack](https://github.com/getcargohq/cargo-skills) — 17 skills covering the whole CLI,
with recipes, provider playbooks, and cost discipline built in. If you install the pack, you do not
need these: each one defers to `cargo-gtm` when it is present.

```bash
npx skills add getcargohq/cargo-skills
```

## Editing these

The markdown is the source — edit it directly. Copy is meant to be iterated on: reword a job,
add a trigger phrase, rewrite a CTA, tune the framing. That is the point of this repo being
separate from the pack.

Two things are not free-form, and CI enforces them:

**Slugs and prices are checked against the upstream playbooks.** Every `integrationSlug` /
`actionSlug` pair in a command must exist in the matching
[`cargo-gtm/provider-playbooks/`](https://github.com/getcargohq/cargo-skills/tree/main/cargo-gtm/provider-playbooks)
file, and every number in a cost table must match that playbook exactly. These skills run inside
agents we do not control, with no session refresh to save them — a stale price fails on a new
user's first command, which is the worst possible moment to be wrong.

**Every skill carries the same four blocks:** the `cargo-gtm` deference guard, the free-credits
line, the sample-before-you-spend rule, and the CTA back to the pack. Drop one and the build
goes red. Trigger phrases must also be unique across skills, or they fight for the same prompts.

```bash
node scripts/validate.ts                                            # against cargo-skills@main
node scripts/validate.ts --playbooks ../cargo-skills/cargo-gtm/provider-playbooks   # local checkout
node scripts/validate.ts --ref v1.18.1                              # pin to a tag
```

CI also runs this weekly on a cron. Upstream pricing can change without anyone touching this
repo, and that is exactly the drift nobody would otherwise notice.

`evals/routing.jsonl` holds one case per trigger phrase. Nothing runs it yet — the runner lives in
the pack (`.github/scripts/routing-eval.ts`) and is currently hardwired to that repo's layout.

