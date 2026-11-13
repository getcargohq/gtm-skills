# Custom attributes and live signals: the research prompt

Step 3 of the [scoring pass](scoring-pass.md) runs this on **your own company's domain** (the
seller, not a customer). It returns up to ten attributes specific to what you sell and up to ten
live signals. The scoring pass then enriches every attribute across the cohort and keeps only those
that separate Tier 1 from Tier 2; the signals go to the timing section of `scoring.md`, unscored.

The method behind it is the article
[How to operationalize custom datapoints & signals](https://www.getcargo.ai/blog/custom-datapoints-signals).
Read it as methodology; the company-specific facts come from the company's own pages.

Run it as written, with `{{domain}}` set. Research the pages with whatever the session has: its own
web search, or Cargo's `firecrawl` crawl and `linkup` search actions.

---

You are the Head of GTM Operations at the company identified by the domain provided by the user.

Input:

Domain: {{domain}}

Your task is to research the company and identify:

1. Up to 10 highly actionable custom account attributes.
2. Up to 10 relevant live sales signals.

The goal is to help our GTM team improve account segmentation, scoring, prioritization, and timing.

RESEARCH THE COMPANY

From the supplied domain, review the company website and relevant public sources.

Determine:

- What the company sells
- Its main value proposition
- Its likely target customers
- Its primary users and buyers
- Its main use cases
- Its likely competitors
- The conditions that make an account a strong fit

Use the homepage, product pages, solution pages, pricing, documentation, customer stories, careers,
blog, job postings, public repositories, engineering content, press releases, and other relevant
public sources.

Do not rely only on the homepage.

If information is unclear, state that it is inferred and explain the uncertainty.

DEFAULT ASSUMPTION

Assume the goal is net-new prospecting.

The companies being evaluated may:

- Not be customers
- Never have used the product
- Have no first-party activity
- Have never visited the website

Therefore, prioritize attributes and signals that can be found or inferred externally.

Do not recommend product usage, activation, billing, renewal, customer health, or other
first-party-only datapoints unless clearly separated as unavailable for net-new accounts.

CUSTOM ATTRIBUTES

A custom attribute is a structured company-level characteristic that helps us determine fit,
potential value, readiness, or competitive opportunity.

A strong attribute must:

- Be specific to the company's product and market
- Be obtainable for net-new accounts
- Be publicly observable, commercially available, or defensibly inferred
- Help improve segmentation, scoring, or prioritization
- Be more useful than a generic CRM field
- Apply to a meaningful share of the target market

Only include attributes that would materially change how we evaluate an account.

For each attribute, provide:

### [Attribute name]

Definition: what the attribute measures.

Example values: structured values, ranges, categories, or scores.

Rationale: why this attribute matters specifically for this company.

Likely sources: where the information could be found.

Availability, one of:

- Publicly observable
- Detectable through public technical evidence
- Available through a commercial data provider
- Inferred from multiple public signals
- First-party only
- Not reliably available

Expected coverage: High, Medium, or Low.

Confidence notes: how reliable the attribute is and when it should be marked Unknown.

For inferred attributes, do not present the value as confirmed.

Never treat one employee's tool usage or one job-posting mention as proof of company-wide adoption.

When identifying technology or competitor usage, distinguish between:

- Individual usage
- Team usage
- Pilot or evaluation
- Approved company tool
- Company-wide standard
- Historical usage
- Unknown

For developer tools, AI coding products, IDEs, DevOps products, or engineering platforms, consider
attributes such as:

- Estimated software engineer headcount
- Engineering growth or decline
- Engineering seniority mix
- Primary programming languages
- IDEs or editors in use
- AI coding tools in use
- Git hosting platform
- CI/CD stack
- Code review and static analysis tools
- Platform engineering or developer productivity team
- Cloud provider
- Repository structure and activity
- Open-source activity
- Remote or distributed engineering model
- Security and compliance requirements
- Refactor, migration, or modernization initiatives
- Relevant technical hiring

Do not assume these attributes are available.

LIVE SALES SIGNALS

A sales signal is a recent event or meaningful change that indicates increased relevance, urgency,
budget, pain, or buying readiness.

Signals must represent a change, not a static characteristic.

Prioritize signals from the last 6–9 months.

Examples include:

- Relevant executive hire
- Team growth or decline
- New technical initiative
- AI adoption initiative
- Platform migration
- Major refactor or modernization
- New security or compliance requirement
- Competitor adoption or removal
- Tool consolidation
- Funding
- Acquisition
- Geographic expansion
- Reorganization
- New team creation
- Significant changes in job postings
- New open-source initiative
- Significant repository activity change

For each signal, provide:

### [Signal name]

Definition: the exact event or change.

Rationale: why it matters specifically for this company.

How it can be detected: the public sources or evidence that could reveal it.

Freshness: how recent the event should be to remain useful.

Reliability: High, Medium, or Low, with a brief explanation.

OUTPUT

## Company GTM Profile

Company, main product, core value proposition, primary users, likely buyers, likely ICP, main use
cases, likely competitors, research confidence.

## Custom Attributes

Return up to 10, ranked by relevance, actionability, detectability, and expected coverage.

## Live Sales Signals

Return up to 10, ranked by relevance, urgency, detectability, and reliability.

## Operator Summary

State the three most important attributes and the three most important signals our GTM team should
prioritize.

QUALITY RULES

- Be specific to the researched company.
- Prioritize net-new account data.
- Exclude first-party-only fields from the main list.
- Separate static attributes from live signals.
- State when information is inferred or unavailable.
- Do not recommend generic fields unless they are genuinely important.
- Do not fabricate technology usage or company initiatives.
- Focus on the attribute or signal and its rationale.
