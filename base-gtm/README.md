# base-gtm

The shared foundation every other cookbook builds on. It is not a use case on
its own: it defines the pieces the other cookbooks reuse, so they stack together
instead of clashing.

## What it does

- Defines **two data models**, `accounts` and `contacts`, as the shared schema,
  linked by a one-account-to-many-contacts **relationship**.
- Adopts a **standard set of connectors** (Slack, enrichment, Cargo's database,
  an LLM) so cookbooks import them by name instead of redefining their own.

Every other cookbook imports these by handle, so keep this folder in your
project.

## It deploys with zero configuration

`accounts` and `contacts` are **native** models: workspace-owned tables with no
external source, so base-gtm needs no connector credential and **no environment
variable**. Install it on a fresh workspace and it deploys.

The CRM lives in its own cookbook, [`crm-sync`](../crm-sync/README.md), and is
pulled in only by the cookbooks that actually read from or write back to a CRM.
That is deliberate: importing a file **is** registration in the CDK, so a CRM
connector sitting here would force a HubSpot token on someone installing the
research agent.

The models start empty. Fill them by installing a sourcing cookbook
(`tam-building`, `contact-sourcing`), or source them from your CRM instead:
install `crm-sync` and swap the model for a connector-backed one. The exact
shape is written out in the comment at the top of `models/accounts.ts`.

## What's inside

| File                      | Resource             | Role                                                         |
| ------------------------- | -------------------- | ------------------------------------------------------------ |
| `connectors/slack.ts`     | `defineConnector`    | alerts (connect Slack in the UI once)                        |
| `connectors/waterfall.ts` | `defineConnector`    | enrichment: runs on Cargo credits, zero config               |
| `connectors/cargo.ts`     | `defineConnector`    | Cargo's prospect and business database: credits, zero config |
| `connectors/openai.ts`    | `defineConnector`    | LLM provider for agents                                      |
| `folders/gtm.ts`          | `defineFolder`       | folders for models and agents                                |
| `models/accounts.ts`      | `defineModel`        | the account list (native): `domain` is the identity key      |
| `models/contacts.ts`      | `defineModel`        | the people list (native): `email` is the identity key        |
| `models/relationships.ts` | `defineRelationship` | links one account to its many contacts                       |

## Done when

`accounts` and `contacts` show up as models in your workspace, filed under the
GTM folder, with no credential configured.
