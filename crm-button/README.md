# CRM button

Run a Cargo tool from any CRM record, with one click.

## What it does

- Puts a custom button on your CRM's company (or contact, or deal) pages.
- A rep clicks it and a Cargo tool runs **for that exact record**: enrich it,
  source contacts for it, refresh its score, build a brief.
- The result is written straight back onto the record they are looking at.

## How it works

1. **The tool defines the work.** A workflow that takes a record id as input. The
   input schema **is** the form: `recordId` is what the CRM passes in.
2. **`publicForm` turns the tool into a URL.** The tool's form is served publicly,
   locked to your CRM's origin.
3. **The CRM button points at that URL.** Follow [Embed in CRM, step
   5](https://docs.getcargo.ai/tools/embed-in-crm#step-5-add-a-custom-button-to-your-accounts-interface).
4. **The rep clicks. The record updates.**

## The write-back is the whole point

A tool that enriches but does not write back is a demo: the rep clicks, watches a
spinner, then copies values across by hand. The value here is that the record
they are staring at changes while they watch. If you adapt this skill, keep
the write-back step.

## What's inside

Adds one tool, and uses the CRM connector in `connectors/hubspot.ts`.

| File                     | Resource     | Role                                                  |
| ------------------------ | ------------ | ----------------------------------------------------- |
| `tools/enrich-record.ts` | `defineTool` | reads the record, enriches it, writes the result back |

This is the first skill in the repo to use `publicForm`, which is what makes a
tool reachable from outside Cargo.

## Placeholders (edit before deploy)

1. **`allowedOrigins`** in `tools/enrich-record.ts`: lock it to your CRM's origin.
   This is the security control that matters. An empty or wildcard origin list
   means anyone who finds the URL can run this tool against your workspace, on
   your credits.
2. **`objectType`**: `companies`, `contacts`, or `deals`. It appears in both the
   read and the write.
3. **The write-back properties** (`industry`, `numberofemployees`,
   `description`): map them to properties that actually exist in your CRM.
4. **What the button does.** Enrichment is the example. Swap the middle of the
   workflow to source contacts, refresh a score, or build a brief: the button, the
   form, and the write-back stay the same.

## Done when

Clicking the button on a test record shows a run in Cargo, and the record updates
in the CRM without the rep touching a field.

## Composes into

Any skill can become a button: `research-agent` (brief this account),
`contact-sourcing` (find me the buyers here), `account-scoring` (rescore this
one).
