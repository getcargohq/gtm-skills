# Verify the Account model prerequisite

This cookbook requires one existing global Account unification and an audit importer. It does not
create or modify the Account model.

## Verify the existing foundation

Inspect the consumer project and confirm that a CRM-backed Account model and a global
`unifyAccounts` model already exist. Confirm that the audit importer emits the canonical Account ID
and verified CRM record IDs. Stop if this foundation is missing. Two Account models split canonical
identity.

## Required identity evidence

The importer must provide the canonical Account ID and the CRM record IDs used to identify each
candidate. It must reject empty IDs, duplicate IDs, reverse-uniqueness conflicts, and identity
conflicts before candidates reach the deduplication play.

Global unification keys should be documented in the consumer's existing model. This cookbook does
not weaken or replace those keys.
