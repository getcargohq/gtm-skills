# Adapt the play to another CRM

The checked example is HubSpot. Salesforce and Attio adapt the same play file;
they do not add a branch beside it. One CRM shape per project. Five things
change together, and changing four of them is the usual failure:

1. the connector (`infra/connectors/crm.ts`): the `integration` slug
2. the account lookup: object, matching field, and how the domain is matched
3. the routing signal: what says "customer" and what says "open deal"
4. the contact lookup and write: object, LinkedIn field, company link
5. the task: object, owner field, and how it is attached to the account

What does not change: the Sales Navigator model, the company enrichment, the
domain guard, the person lookup before the routes split, the qualifier and its
gate, the email lookup, the rule that a contact already on the account stops
the run, and the known-account route adding the contact without a task. Run `evals/contract.mjs` after adapting; it
reads the integration from the compiled graph, not from this file.

Before writing a single mapping, read the live schema. Field names on
Salesforce and Attio vary per org far more than on HubSpot:

```sh
cargo-ai connection connector autocomplete --connector-uuid <crm-uuid> \
  --slug listObjectFields --params '{"objectType":"Account"}'
```

## Salesforce

**Every lookup is `findRecords` or `searchRecords`. Never `soqlQuery`.** Both
take a structured filter that Cargo validates against the object's fields and
turns into a query itself, so a field that does not exist fails loudly at
design time instead of returning nothing at run time, and the lookup stays
readable in the canvas. A hand-written SOQL string escapes neither: a
misspelled field or an unquoted domain becomes a run that looks successful and
routed every person down the wrong branch.

- `findRecords` takes `criterias` (`[{propertyName, value}]`, exact match, OR
  across criterias, empty values skipped). Use it for exact keys: a contact by
  its LinkedIn field, an account by an exact domain field when the org has one.
- `searchRecords` takes the same `filter` shape as HubSpot's and supports
  `contains`, `is`, `isNot`, numeric and null operators. Use it when the match
  is not exact, such as `Website contains <domain>`.

### The account lookup

Salesforce has no domain field by default; `Website` holds a URL in whatever
form a rep typed it. Match on it with `contains`:

```ts
const accounts = uses.crm.searchRecords({
  objectType: "Account",
  limit: 1,
  filter: {
    conjonction: "or",
    groups: [
      {
        conjonction: "and",
        conditions: [
          { propertyName: "Website", operator: "contains", values: [lookup.domain] },
        ],
      },
    ],
  },
});
```

The domain guard before this lookup is not optional on Salesforce: an empty
domain makes `contains` match every account in the org, and the first one wins.
`contains` also over-matches a short domain inside a longer one (`acme.com` in
`notacme.com`), so check the pilot's matches by eye.

If the org keeps a clean custom domain field, prefer
`findRecords({ objectType: "Account", criterias: [{ propertyName: "<Domain__c>", value: lookup.domainVariants }] })`.

### The routing signal: opportunities, not `Account.Type`

`Account.Type` is frequently empty in real orgs, and a switch built on it
routes nothing. Count the values before trusting it (`listObjectFields`, then a
`searchRecords` on `Account` filtered `Type isNotNull` with a small `limit`).
The dependable signal is the opportunities themselves:

```ts
const deals = uses.crm.searchRecords({
  objectType: "Opportunity",
  limit: 50,
  filter: {
    conjonction: "or",
    groups: [
      {
        conjonction: "and",
        conditions: [
          { propertyName: "AccountId", operator: "is", values: [accounts[0].Id] },
        ],
      },
    ],
  },
});
```

Then route on what came back:

- open opportunity: `deals.some((deal) => !deal.IsClosed)`
- customer: `deals.some((deal) => deal.IsWon)`
- known account, no open deal: neither

### Contacts

Salesforce has no LinkedIn field by default. Find the org's custom field
(often `LinkedIn_URL__c`, but it varies) with `listObjectFields` on `Contact`,
and if there is none, ask before creating one: it is the key that stops the
next sync from creating the same person twice.

- person lookup, before the routes split: `findRecords({ objectType: "Contact", criterias: [{ propertyName: "<LinkedIn field>", value: input.linkedin_profile_url }] })`
- same-account stop: the found contact's `AccountId` equals the account's `Id`
- write: `upsertRecords` on `Contact`, matching `Id` when the person was found
  (a mover is moved, not duplicated), else `Email` when the email was found,
  else the LinkedIn field, with `AccountId` set to the account
- new account: `upsertRecords` on `Account` matching `Website`, with `OwnerId`
  set to the owner the operator named

### Tasks

Salesforce tasks attach at insert, so the two `createAssociation` nodes go
away. `insertRecord` on `Task` with:

| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `Subject`     | the route's subject line                                               |
| `Description` | the route's body                                                       |
| `WhoId`       | the contact's `Id`                                                     |
| `WhatId`      | the open opportunity's `Id` on that route, the account's `Id` on others |
| `OwnerId` | the opportunity's `OwnerId` on that route; on customers the account's CSM field (often a custom user lookup), else the account's `OwnerId` |
| `Status`      | `Not Started`                                                          |
| `Priority`    | `High` or `Normal`                                                     |
| `ActivityDate` | today                                                                 |

On the open-opportunity route the task sits on the deal and goes to the deal
owner, which is where a rep working that deal will see it.

## Attio

Attio has `findRecords`, `searchRecords`, `upsertRecords`, `insertRecord` and
`createNote`, and no task action.

- the account lookup: `findRecords` on `companies` with criteria on `domains`
- the routing signal: Attio has no lifecycle stage; read the deal records
  linked to the company (the `deals` object and its stage attribute, whose
  names vary per workspace) or a company status attribute the team maintains
- contacts: `people`, found by the LinkedIn attribute before the routes split,
  and moved by updating their company relationship when they sit on another one
- the task: there is no task write, so the owner is told with `createNote` on
  the company record (title and markdown body from the route), or through the
  team's Slack connector. Say which one before deploying: a note on the record
  is visible, but nobody is notified of it

## After adapting

- `node --import tsx evals/contract.mjs`
- `cargo-ai cdk types && cargo-ai cdk check && cargo-ai cdk plan`
- one record through each route in the pilot, with the CRM record links in the
  report
