# The card

One Slack post per external meeting, the moment it is booked. A line with nothing true to say is
omitted, never filled.

```text
:calendar: *<weekday, date, time in the event's time zone> · <title>* with *<company>* — <@organizer>
*Company* — <what they do, one line>; <employees>; <tier, if the account row carries one>
*Deal* — <stage>, <amount>, closes <date>, next step: <next step>
*Who's joining* — <name>, <title>, <LinkedIn URL | no profile on file> (<declined | not answered>)
*Last time* — <date>: "<the quoted line from the newest activity>"
*Recent* — <one public event from the last 90 days> (<link>)
*Call tip* — <two or three sentences that could only apply to this account>. Ask: "<one question>"
_Sources: <event link> · <every URL used>_
```

## In the card's thread

Only a material change speaks: the start or end moved, an outside attendee joined or left, or the
title changed.

```text
:arrows_counterclockwise: Moved: <old start> → <new start> <time zone>
:bust_in_silhouette: Joined: <name>, <title>, <LinkedIn URL | no profile on file>
:bust_in_silhouette: Left: <name>
:pencil2: Renamed: "<old title>" → "<new title>"
:x: Cancelled
```

A description edit, a room change, an internal attendee, an RSVP or a time-zone label that
changed while the actual time did not posts nothing.

Nothing is posted for a meeting that has already ended. For a recurring meeting, "Moved" is only
for the same occurrence: another occurrence of the series is never posted as a move. Once the
carded occurrence has passed, the next upcoming one may get one new card. At most one post per
turn.

## Rules for each line

- **Who's joining** lists outside attendees only. A LinkedIn URL is printed only when the contact
  row held it or a search returned it for that exact person.
- **Last time** is a quote, with its date. Paraphrase is how a rep repeats something the prospect
  never said.
- **Recent** is one event, not a news digest. Older than ninety days, it is omitted.
- **Call tip** is grounded in the workspace context: positioning, the ICP, known objections and
  competitors. A tip that would fit any company is rewritten.
- **Sources** lists every link the card relied on. A reader should be able to check any line.
