# New-hire detection

A Sales Navigator job-change search over your market, and one play that routes every new person
into the CRM by what the CRM already holds. This file explains why the design is the way it is;
[`SKILL.md`](SKILL.md) is the procedure.

```mermaid
flowchart TD
  search["Sales Navigator search<br/>titles x industry x headcount x region<br/>+ changed jobs, under a year in role"] --> person["New person in the model"]
  person --> enrich["Enrich the company<br/>LinkedIn"]
  enrich --> domain{"Domain?"}
  domain -->|no| stop1["Stop: no_domain"]
  domain -->|yes| lookup["Look the account up by domain"]
  lookup -->|not found| qualify["Qualifier agent<br/>reads context/icp.md"]
  qualify --> gate{"ICP?"}
  gate -->|no| stop2["Stop: not_icp"]
  gate -->|yes| create["Create account, find email,<br/>create contact"]
  create --> task1["Task for the named owner<br/>on account and contact"]
  lookup -->|found| known{"Person already<br/>a contact?"}
  known -->|yes| stop3["Stop: contact_already_in_crm"]
  known -->|no| contact["Find email, create contact"]
  contact --> stage{"Account state"}
  stage -->|open deal| task2["HIGH task for the owner:<br/>new decision-maker mid-deal"]
  stage -->|customer| task3["HIGH task for the owner:<br/>welcome before they form a view"]
  stage -->|known, no deal| task4["Task for the owner:<br/>a reason to reach out"]
```

## Resources

| Resource                 | Kind      | Purpose                                                                  |
| ------------------------ | --------- | ------------------------------------------------------------------------ |
| `new_hires`              | Model     | The Sales Navigator job-change search, one row per person                |
| `new-hire-icp-qualifier` | Agent     | Judges a company not in the CRM against `context/icp.md`                 |
| `route-new-hires`        | Play      | Routes each added person into the CRM and raises the owner's task        |
| `crm`, `linkedin`, `sales_navigator`, `anthropic` | Connectors | Bound to the workspace defaults; nothing is created          |
| Find Email               | Native tool | Cargo's email lookup, referenced by UUID after it is instantiated      |

## Why it is built this way

**The market, not the book.** The model starts from everyone who just took a target role in a
market slice, not from contacts you already hold. That is the difference from `track-job-changes`,
which asks whether your own people moved. Here most people are strangers to the CRM, which is why
the first question is always what the CRM knows about their company.

**The routes are the play.** One job-change event means four different things. A company you have
never heard of needs qualifying before anything is written. A company with an open deal needs its
owner told today. A customer needs a welcome before the new leader decides the tool they inherited
is the problem. A known account without a deal needs a reason to call. Collapsing them into one
path either pollutes the CRM or loses the urgent cases among the routine ones.

**Enrich, guard, then match.** A Sales Navigator lead carries a company URL. The CRM is matched on a
domain, so the company is enriched first, and a company without a domain stops there rather than
matching nothing (and being created again) or matching everything.

**Qualification only where it is needed, and as a gate.** Customers and accounts with a deal are
qualified already. On the new-account route the qualifier returns a verdict and a branch acts on it,
so a company the ICP rejects never reaches the CRM. An agent rather than a headcount filter, because
it reads the description and specialties and can apply exclusions no number can: competitors,
agencies, holding companies. It reads the ICP from the workspace context, the same file the search
was shaped from, so the two cannot drift apart.

**A known contact is not news.** On every account the CRM already holds, the play checks for the
person by LinkedIn URL before paying for an email. Someone the team already has does not deserve a
task, and re-finding their email on every sync is spend with no result.

**The contact key follows what was found.** With an email, the contact is matched on it, so it
merges with one a rep created by hand. Without one, it is matched on the LinkedIn URL, so the person
is still created, still reachable, and still deduped on the next sync.

**Every task has an owner and a place.** Tasks go to the account owner (or the named owner for new
accounts) and are associated to both the account and the contact. HubSpot cannot associate a task
when it creates it, so explicit association nodes follow each task; they continue on failure, so a
missing ID never undoes a run that already wrote the contact and the task.

**It stops at the CRM.** Nothing is drafted or sent. A person reads the task and decides, and the
team's own sequencer does the sending.

**The schedule is a cost decision.** The extractor re-buys the whole search on every sync, and
`changeKinds: ["added"]` makes only the new people create runs. Every two weeks is the default
trade between spend and how fresh a new hire is when the owner hears about it.

## Adapting to another CRM

HubSpot is the checked example. Salesforce and Attio adapt the same play, following
[`references/crm-adaptation.md`](references/crm-adaptation.md). On Salesforce, lookups are
`findRecords` and `searchRecords` only, never `soqlQuery`, and the routing signal is the
opportunities rather than `Account.Type`.
