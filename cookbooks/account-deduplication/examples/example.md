# Example: HubSpot Account deduplication

This is a repository walkthrough, not a live CRM session. It starts with an existing global
Account model and audit importer.

1. Inspect the consumer CDK project. Confirm the HubSpot connector, global Account model, and
   audit importer already exist. Do not create another Account model here.
2. Audit account identity and normalize exact LinkedIn company IDs, LinkedIn URLs or handles, and
   domains. Use `cdk/context/candidate-contract.ts` in the audit importer, populate the candidate
   model from the selected HubSpot Account model, and write the concrete JSON and Markdown audit
   artifacts.
3. Apply protected-ID and survivor rules. Exact LinkedIn company ID is the only future automatic
   class when every record agrees and no conflict exists. URL, handle, domain, parent or
   subsidiary, and AI-reviewed candidates remain review-only.
4. Use `cdk/agents/review-domain.ts` for structured review when an approved LLM connector
   exists. AI can inform a proposal, but cannot authorize a merge.
5. Keep `cdk/plays/hubspot/deduplicate-accounts.ts` disabled, limited to 15 clusters, and set to
   `noConcurrency`. Preview proposal output only. Re-read live records and apply protected-ID
   guards before any consumer-side merge.
6. Run `npm run check:templates` in this repository. In the consumer project run
   `cargo-ai cdk check` and `cargo-ai cdk plan`. Stop before adding or executing a merge action.
