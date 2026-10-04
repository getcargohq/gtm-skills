# Website forms

The website's demo form, wired to a Cargo tool: each submission is qualified, lands in the shared
GTM accounts and contacts, is posted to Slack, and is answered on the page.

```text
visitor submits /contact/ (headless form SDK, the site's own markup)
  -> public form API: origin, honeypot, time-trap, rate limit
  -> tool inbound_form: personal email? -> company from LinkedIn -> ICP rules
       -> gtm_accounts + gtm_contacts -> Slack
  <- booking link or thank-you, in the same request
```

## Why it is built this way

**A tool, not a backend.** Cargo tools take a public form: the workflow's input is the field list,
`publicForm` holds the origin allow-list and the spam guards, and each submission runs the
workflow. Nothing else to host.

**The shared GTM models.** The account and the contact land in `gtm_accounts` and `gtm_contacts`,
declared exactly as every pipeline declares them, so the worked example deploys on a bare
workspace and other pipelines read the same inbound contacts. A CRM is the `crm-backed` variation.

**Cheapest refusal first.** A personal email is refused before the paid company lookup; the lookup
comes before any write. The company is enriched, never the person.

**Rules, not a model call.** Headcount band and countries from the ICP: free, explainable, the
same answer twice. An agent judgement is a variation.

**The SDK loads on first focus.** It sets a first-party id cookie and captures UTMs when it loads;
a visitor who never touches the form gets neither, and the time-trap counts real filling time.

## Placeholders (edit before deploy)

1. **ICP rules**: `icpMinEmployees`, `icpMaxEmployees`, `icpCountries` in `infra/tools/inbound-form.ts`.
2. **Booking link**: `bookingUrl`.
3. **Slack channel**: `slackChannelId`.
4. **Origin**: `publicForm.allowedOrigins`, the site's canonical origin.

## Files

| Path                               | What it is                                                 |
| ---------------------------------- | ---------------------------------------------------------- |
| `infra/tools/inbound-form.ts`      | The tool, its workflow and its public form                 |
| `infra/models/gtm-accounts.ts`     | The shared GTM accounts model                              |
| `infra/models/gtm-contacts.ts`     | The shared GTM contacts model, with the inbound columns    |
| `infra/connectors/linkedin.ts`     | LinkedIn company data on Cargo's credits                   |
| `infra/connectors/slack.ts`        | The Slack workspace the inbound channel lives in           |
| `site/components/inbound-form.tsx` | The form, headless, loading the SDK on first focus         |
| `site/app/contact/page.tsx`        | The page that holds it                                     |
| `references/form.md`               | Wiring the site, the spam checks, privacy                  |
| `references/data.md`               | The rows, querying, the `crm-backed` mapping               |
| `evals/contract.mjs`               | Graph contract                                             |

## Verify

```sh
node --import tsx website-forms/evals/contract.mjs
```
