# Sizing, naming, and availability

Phase one. Nothing here registers a domain, creates a mailbox, or spends anything. It ends at an
approval.

## 1. Derive what already exists

A fleet is usually extended, not started. Re-registering a domain the workspace already owns is
waste, and creating a second mailbox at an address that already exists fails.

```sh
cargo-ai mailboxManagement mailbox list
```

Group the result by domain and report it before asking anything. Every domain and mailbox that comes
back is `adopt: true` in the CDK, never a second purchase.

Derive the primary domain from the signed-in address (`cargo-ai whoami`) and confirm it in the plan
rather than asking. It is the redirect target, and it is the one domain that must never be in the
fleet.

Derive the senders from workspace members and present them for confirmation with real first and last
names. Do not ask the operator to type names the workspace already holds.

## 2. Size the fleet

One question does all the work: **how many cold emails a day does this fleet have to carry at steady
state?** Nothing can look that up.

Everything else is arithmetic:

```
mailboxes = ceil(target_daily_sends / 40)
domains   = ceil(mailboxes / mailboxes_per_domain)
```

- **40** is the per-mailbox daily ceiling at the end of warm-up. It is the maximum, not a target.
- **3** is the recommended `mailboxes_per_domain`. A domain that gets flagged takes every mailbox on
  it, so this is a blast-radius decision before it is a cost one. Going higher is a supported
  variation with a stated cost; going to one wastes a registration.

Work an example out loud for the operator, because the shape of the answer is what makes the number
defensible:

> 500 sends a day needs 13 mailboxes, so 5 domains at 3 each, which is 15 mailboxes and a ceiling of
> 600 a day. The 100 of headroom is the margin for a mailbox that has to be pulled.

Then state the two things the arithmetic does not say:

- **The ceiling arrives 45 days after warm-up starts, not on deploy day.** Give the calendar date.
- **The fleet must be bought before it is needed.** A fleet approved the week the campaign launches
  carries 5 sends a day that week.

## 3. Generate candidate names

Generate roughly twice as many candidates as domains needed, because availability will remove some.

Build them from the brand, not near it:

| Pattern       | Example on `acme.com`     | Note                                              |
| ------------- | ------------------------- | ------------------------------------------------- |
| verb prefix   | `tryacme`, `useacme`      | Reads as a product page, which is what it becomes |
| preposition   | `withacme`, `joinacme`    | Natural English compound                          |
| suffix        | `acmehq`, `acmeteam`      | Reads as the company, not a campaign              |
| verb compound | `workwithacme`, `runacme` | Longer, and the most obviously owned              |

Rules that are not taste:

- **Stay on `.com`.** Alternative TLDs carry worse default reputation at several filters, and `.com`
  is what a human expects from a company. A cheaper TLD is not a saving.
- **No hyphens and no digits.** `get-acme.com` and `acme01.com` are spam-filter patterns.
- **No near-typos of the primary.** `acmme.com` and `acrne.com` read as phishing, because that is
  what phishing uses. The fleet should look owned, not almost-right.
- **Say the name out loud.** If it cannot be dictated on a phone call, a prospect cannot repeat it.

Where the operator already holds a list, pasted or as a CSV of names, take it and skip generation.
Availability and spend approval still apply to every name on it.

## 4. Check availability and price

Every candidate gets checked. Never present a name without knowing it can be bought.

```
GET /v1/domainManagement/domains/search?name=<domain>
Authorization: Bearer <accessToken>
selected-workspace-uuid: <workspace uuid>

-> { "name": "tryacme.com", "available": true, "priceCredits": <live> }
```

There is no `cargo-ai domainManagement` command surface yet, so this is a direct API call against
the token in `~/.config/cargo-ai/credentials.json`. `priceCredits` is `null` when the domain is not
purchasable through Cargo, either unavailable or premium-priced beyond the configured ceiling; treat
`null` as unavailable rather than as free.

Check a name's history before committing to it. A domain that was previously registered and dropped
can arrive carrying someone else's reputation, and a fleet inherits it silently.

## 5. Present the quote and stop

One table, every candidate, availability and price together, with the recommended set marked. Then
two separate cost lines, because they have different shapes:

- **One-time:** the registrations, summed from the live checks.
- **Recurring monthly:** the mailboxes, from a live `cargo-ai mailboxManagement pricing get`,
  multiplied out to a year so the annual shape is visible.

Say plainly that a mailbox charge recurs every month until the mailbox is removed, that there is no
pause, and that domains renew annually.

End the phase by asking for approval of the exact domain list and that exact spend. Do not treat
silence as approval of the generated names, and do not proceed to CDK while approval is pending.
