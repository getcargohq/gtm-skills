# LinkedIn content: draft LinkedIn posts every week from your own proof points

To keep a LinkedIn author posting from real material, draft from what your go-to-market repository
already says and let a person publish. Every Monday this cookbook's Claude Code harness agent writes
three drafts for one author from `context/` and the cadence log, cites the files behind each, and
opens one pull request; it never publishes anything.

```sh
cargo-ai project add cookbook/linkedin-content
```

## What it does

- Reads positioning, proof points, clients, insights, objections and alternatives under `context/`,
  plus the last two weeks of `cadence/log/` and the last eight weeks of drafts.
- Drafts three posts, one per kind: a proof point, an answer to an objection, and this week's lesson.
- Cites the files behind every draft, cuts any claim it cannot cite, and never names a customer
  without reference permission.
- Writes `cadence/content/<week>.md` and opens one pull request. A re-run that week finds that pull
  request by its title and stops; close it to ask for a redraft.

## What's inside

Adds 4 resources.

| File                                    | Resource                        | Role                                                        |
| --------------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| `infra/agents/content-writer.ts`        | `defineAgent` (claudeCode)      | the weekly cron, the author env var, the model              |
| `infra/agents/content-writer.prompt.ts` | (not a resource)                | what it reads, the three kinds, the citation rule, the PR   |
| `infra/connectors/git.ts`               | `defineConnector` (`github`)    | the clone, branch, push and pull request path               |
| `infra/connectors/anthropic.ts`         | `defineConnector` (`anthropic`) | the model the harness runs on                               |
| `infra/folders/index.ts`                | `defineFolder`                  | where the agent is filed                                    |
| `references/post.md`                    | (not a resource)                | the drafts file shape and the rules for a draft             |

## Why a pull request and not a post

Publishing as a person is that person's act. A draft that overstates a result costs a correction in
the comments, under their name. The pull request is where someone reads it first, and the agent has
no LinkedIn action that could skip that step.

## Why no context capability

The checkout already holds `context/`, so the agent reads it as files. A capability would add a
second path that can write the knowledge layer without the review every other pipeline goes through.

## Placeholders (edit before deploy)

1. **`CONTENT_AUTHOR`** in `infra/agents/content-writer.ts`: the person the posts are written as.
2. **`languageModel`**: any Anthropic model the workspace's connector can reach.
3. **The cron**: Monday 14:00 UTC, after `web-capture`'s Monday run.

## What it does not do

It does not post, like, comment, connect or message on LinkedIn, write under `context/`, read the
web or the CRM, or merge its own pull request.
