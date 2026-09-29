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
_Expansion had its best day of the month; EU outbound is still not sending._

:dart: *Expansion into mid-market*
• Acme signed, $40k ARR, closed 3 weeks early
• 12 dossiers drafted; Sam sends 4 of them tomorrow

:dart: *EU outbound*
• Blocked: the sourcing play has not run since Tuesday (#212)

:zzz: *No movement:* Partner channel, PLG motion

:wrench: *Engine upkeep*
• Only when a teammate would notice its absence

:construction: *Stuck*
• EU outbound — the thing that did not resolve, with the evidence

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
- Second line is one italic sentence: the verdict on the active initiatives,
  in the words a founder would say out loud. A quiet day says so here.
- One `:dart:` section per active initiative (`status: active` under
  `initiatives/`) that moved or is blocked, labelled with its `title:`. Every
  active initiative that did nothing is named on the `:zzz: *No movement:*`
  line, so no bet silently drops out. Never invent a label. With no active
  initiatives, say so and group by the work, at most four sections.
- Voice: verdict first, plain words, a name, a number, a date. No file paths
  or slugs, no hedging, no filler ("worked on", "continued progress"). Bad
  news said plainly is the most useful line in the post.
- Fleet volume is not news: never report PRs opened, PRs merged, or runs green
  as the story of the day.
- Skip a section that has nothing. Twelve bullets total at most.
- Do not invent a number. Drop a metrics line rather than estimate one. A number
  returned by a CLI read you actually ran is evidence; a number no command
  returned is not.
- `channelId` is locked on the agent's `slack.postMessage` use. Do not post
  anywhere else, and do not call the Slack API with a token.
