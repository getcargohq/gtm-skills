# Slack digest

The shape the standup agent posts, kept here so an adapter can change the header
without hunting through the system prompt. The prompt in
`infra/agents/standup.prompt.ts` is what the agent actually follows; if the two
drift, the prompt wins.

Cargo's `slack.postMessage` is called with `format: "markdown"`. Write Slack
mrkdwn (`*bold*`, `_italic_`, `•` bullets). `disableUnfurling` is locked on the
use, so a PR link in the last line stays a link.

## Shape (that shape, not this content)

```
:racing_car: *GTM - Sat Aug 1*
_Best expansion day of the month, and the first TAM run says the ICP is wrong._

:dart: *The initiative that actually moved*
• Named account did X, with the number and the date
• 12 dossiers drafted, 4 are waiting on a named person to send

:wrench: *Engine upkeep*
• Only when a teammate would notice its absence

:construction: *Stuck*
• The thing that did not resolve, with the evidence

:raising_hand: *Needs a human*
• Named person: the action, not the topic
```

Then one final line, appended only on the post, not in the log:

```
Full log: <PR URL>
```

## Rules

- Header is `:racing_car: *` then `STANDUP_TITLE` then ` - ` then the recapped
  day written like `Sat Aug 1` then `*`. Hyphen, not a dash. Compute the real
  weekday. Change the emoji in the prompt if two standups land in the same
  channel and the reader has to tell them apart from the first line.
- Second line is one italic sentence: what the day did to the goal, in the
  words a founder would say out loud. A quiet day says so here.
- At most four `:dart:` sections, only initiatives (or bodies of work) that
  actually moved. Never invent a label.
- Fleet volume is not news: never report PRs opened, PRs merged, or runs green
  as the story of the day.
- Skip a section that has nothing. Twelve bullets total at most.
- Do not invent a number. Drop a metrics line rather than estimate one. A number
  returned by a platform tool you actually called is evidence; a number the
  tool did not return is not.
- `channelId` is locked on the agent's `slack.postMessage` use. Do not post
  anywhere else, and do not call the Slack API with a token.
