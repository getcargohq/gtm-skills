# Warm-up

Phase three, and the phase that actually produces sending capacity.

**The CDK does not model warm-up.** `defineMailbox` creates the inbox; nothing in `cargo-ai cdk
deploy` starts the ramp. A fleet that is deployed and never warmed is pinned at **5 sends a day,
forever**, and nothing reports it. The plan is green, every mailbox is `active`, and the capacity
never arrives.

This is the single most common way this cookbook fails.

## The ramp

Warm-up runs the provider's own dummy traffic against the mailbox and climbs the Cargo send
allowance alongside it: **5 sends a day on day one, 40 a day at day 45.** `dailyLimit` is not a
setting. It is derived from how long warm-up has been running, which is why there is no way to
shorten this and why the fleet has to be bought before it is needed.

The 45 days double as domain aging, which is convenient rather than coincidental: a domain
registered this morning is treated with suspicion by filters regardless of how it is configured.

## Step 1: get every mailbox to `active`

A newly created mailbox returns `status: "pending"` until the provider issues credentials.
**`start-warmup` against a `pending` mailbox returns success and starts nothing.** A script that
deploys and then immediately warms up will report a clean exit having warmed almost none of the
fleet.

Poll until nothing is pending, rather than sleeping a fixed time:

```python
for _ in range(4):
    pending = [m for m in mailboxes() if m["status"] == "pending"]
    if not pending:
        break
    for m in pending:
        cli("mailboxManagement", "mailbox", "refresh-status", m["uuid"])
    time.sleep(60)
```

Three rounds about a minute apart clears a fleet of a couple of dozen. Some mailboxes go active on
their own within five minutes; some need the refresh.

## Step 2: start warm-up on every active mailbox

```sh
cargo-ai mailboxManagement mailbox start-warmup <uuid> --daily-target 40
```

`--daily-target` is the provider's dummy traffic at full ramp, 1 to 40, and it is **not** your send
allowance. Leave it at 40 unless there is a reason.

Skip any mailbox already warming. Skip any mailbox outside this fleet: an unrelated inbox that
someone paused deliberately should not be restarted by a fleet script.

## Step 3: verify by counting, never by exit code

This command family returns exit 0 on work it did not do. The only honest check is a count of
states:

```sh
cargo-ai mailboxManagement mailbox list | tr -d '\r' | python3 -c "
import sys, json, collections
s = sys.stdin.read().replace('Loading...', '').strip()
ms = json.loads(s[s.index('{'):])['mailboxes']
print(dict(collections.Counter(m['status'] for m in ms)))
print(dict(collections.Counter(m['warmupStatus'] for m in ms)))"
```

Every mailbox in the fleet should be `status: active` and `warmupStatus: active` or `pending`. Any
`disabled` in the fleet is a mailbox that is not ramping, whatever the script reported.

Once traffic is flowing, `get-warmup-stats` reports whether it is landing:

```sh
cargo-ai mailboxManagement mailbox get-warmup-stats <uuid>
```

`inboxRate` and `spamRate` are about the provider's dummy traffic, not your outreach.
`get-send-allowance` is the other number and answers a different question: how many real sends
remain today. Do not read one as the other.

## Never do this

- **`stop-warmup` resets the Cargo send ramp.** The mailbox drops back to 5 a day and starts the 45
  days again. Use `update-warmup --status paused` unless a reset is genuinely what is wanted.
- **Do not spread one campaign across the fleet to clear volume a single mailbox's ramp would not
  allow.** That is the evasion case in `cargo-gtm/references/acceptable-use.md`, not a configuration
  question. The fleet is sized for steady-state volume, and the allowance is a ceiling.
- **Do not treat `remainingCount` as a quota to fill.** It is the maximum that may be sent, not a
  target that should be.

## The report

Close the phase with four things:

1. The fleet: domains, mailboxes, and how many are ramping.
2. The daily ceiling at full ramp: mailboxes times 40.
3. **The calendar date that ceiling arrives**, 45 days out. This is the number the operator plans
   campaigns against.
4. The reminder that the ramp is a ceiling and not a target.
