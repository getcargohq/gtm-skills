import { defineAgent } from "@cargo-ai/cdk";

import { callScribePrompt } from "./call-scribe.prompt";
import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";

// The scribe: a Claude Code harness agent, not a streamText agent.
//
// `harnessSlug: "claudeCode"` swaps the LLM loop for the coding runtime, and
// that is what makes this skill possible. The output of a call is not a column
// value; it is a diff across the repo — a raw capture, a log entry, an
// objection file that just gained its second occurrence. Only an agent with a
// working tree can produce one, and only a pull request makes it reviewable
// before it becomes what every other agent believes.
//
// `connector` and `languageModel` are required even here. The harness does not
// bring its own model: it runs against Cargo's LLM proxy, which bills this
// connector and meters usage against this slug. Any Anthropic model works with
// `claudeCode`; see `../connectors/anthropic.ts`.
//
// This replaces a scheduled CI workflow that launched a hosted agent. One
// resource now holds the schedule, the credentials, the repository binding and
// the instructions, and it is declared in the same project as everything else
// the workspace runs.
export const callScribe = defineAgent("call-scribe", {
  name: "Call scribe",
  description:
    "Collects yesterday's call recordings into the cadence layer, scribes them, and opens one reviewable pull request.",
  color: "blue",
  harness: "claudeCode",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  repository: {
    // Deliberately partial. `repository`, `defaultBranch`, `rootDirectory` and
    // the GitHub `connector` are all OMITTED so plan and deploy fill them from
    // the git origin of the checkout they run in, taking the connector from the
    // project's own `defineConnector`.
    //
    // `rootDirectory` resolves to the directory whose package.json declares
    // `@cargo-ai/cdk` — where node_modules is, and therefore the only place the
    // agent's `npx tsx …/collect/calls.ts` resolves. In the scaffolded layout
    // that is the repository root, which is also where cadence/ and context/
    // live. `cargo-ai cdk check` prints what it resolved; verify it names the
    // repository root and not `infra/`.
    //
    // That is not laziness, it is the correct binding: the repository holding
    // context/ and cadence/ IS the repository this CDK project lives in. An
    // `owner/name` placeholder here would be the one value nobody notices is
    // wrong until the first pull request opens against a stranger's repo. Set a
    // field only to override the checkout — a different repo, or a base branch
    // that is not `main`.
    //
    // Only what the harness needs ON TOP OF the workspace environment
    // variables, which a harness agent inherits in full. So the two values
    // here are the two that belong in code — a choice and a domain, both
    // public, both reviewable in a diff — and the credential is not here at
    // all.
    //
    // CALL_RECORDER_API_KEY is a workspace environment variable, created once
    // with the CLI and never written down in this project:
    //
    //   export CALL_RECORDER_API_KEY=…   # not committed, not persisted
    //   cargo-ai workspaceManagement envVar create \
    //     --key CALL_RECORDER_API_KEY --secret \
    //     --description "Call recorder API key read by scripts/call-capture"
    //
    // (omitting --value reads the exported variable, which keeps the key out
    // of argv and out of shell history). The harness shell then reads it like
    // any other variable, so nothing in the collector changes.
    //
    // The name is deliberately not the vendor's, so swapping recorder changes
    // that one entry and CALL_RECORDER below, not this wiring. Where a
    // recorder issues two values — Gong's access key and secret, Clari
    // Copilot's key and password — the entry holds `<first>:<second>` and the
    // adapter splits it, so one variable still covers every recorder.
    //
    // A `secret()` reference would work here and is the wrong trade: it
    // resolves from the DEPLOYING machine's environment at apply time and
    // sends that value, so the key has to exist in a local shell or a .env for
    // every deploy, by whoever deploys, and rotating it needs a re-apply to
    // land. The catalog entry is read server-side on every run, so a rotation
    // reaches tomorrow's run with no deploy at all.
    //
    // `workspaceEnv("CALL_RECORDER_API_KEY")` is not accepted here, and the
    // type says so: a pointer in this block could only restate a variable the
    // harness shell already reads. It is for credential fields on OTHER
    // resources — a connector's access token — where nothing inherits.
    env: {
      // PLACEHOLDER — which recorder records your calls, as one of the slugs
      // in scripts/call-capture/collect/recorders/index.ts. Nine ship;
      // `npx tsx scripts/call-capture/collect/calls.ts --list` prints them.
      //
      // There is no default in the collector, and this is why: unset, it stops
      // rather than picking one. A wrong-but-valid slug reads the wrong API
      // successfully and captures nothing, and a morning that reports a clean
      // empty run is the failure nobody notices for a month.
      //
      // Declared here rather than in the catalog because it is the decision
      // this pipeline is built around: in code it is in the diff, in review,
      // and deployed together with the adapter it names. Set it in both places
      // and you own the precedence question.
      CALL_RECORDER: "avoma",
      // PLACEHOLDER — your own email domain. It is how the collector tells an
      // internal call from a customer one, for every recorder alike. Most do
      // not flag it at all, and the ones that do cannot be trusted to agree:
      // Avoma's `is_internal` is false on every meeting in some workspaces.
      // Public, so a plain string rather than a secret.
      CALL_CAPTURE_INTERNAL_DOMAIN: "example.com",
    },
  },
  triggers: [
    {
      type: "cron",
      name: "daily",
      // 07:00 UTC: after the recorder has finished processing yesterday's
      // calls, before anyone reads the repo in the morning. Anything still
      // processing at this minute is picked up by tomorrow's run, which is why
      // the collector's window is three days wide and not one.
      cron: "0 7 * * *",
      text: "Run the daily call capture. Follow your system prompt exactly and open one pull request.",
    },
  ],
  systemPrompt: callScribePrompt,
  folder: agentsFolder,
});
