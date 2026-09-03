import { defineAgent, secret } from "@cargo-ai/cdk";

import { callScribePrompt } from "./call-scribe.prompt";
import { agentsFolder } from "../folders/call-capture";

// The scribe: a Claude Code harness agent, not a streamText agent.
//
// `harnessSlug: "claudeCode"` swaps the LLM loop for the coding runtime, and
// that is what makes this skill possible. The output of a call is not a column
// value; it is a diff across the repo — a raw capture, a log entry, an
// objection file that just gained its second occurrence. Only an agent with a
// working tree can produce one, and only a pull request makes it reviewable
// before it becomes what every other agent believes. There is no `connector` /
// `languageModel` here on purpose: the harness brings its own model.
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
    env: {
      // The collector's credential. `secret()` is read from the deploying
      // environment at apply time and excluded from the content hash, so the
      // plaintext never enters git and rotating it does not read as drift.
      // The agent never handles it: only scripts/collect/avoma.ts reads it.
      //
      // The name is deliberately not the vendor's, so swapping recorder changes
      // the value and the adapter file, not this wiring.
      CALL_RECORDER_API_KEY: secret("CALL_RECORDER_API_KEY"),
      // PLACEHOLDER — your own email domain. It is how the collector tells an
      // internal call from a customer one: Avoma's `is_internal` is false on
      // every meeting in some workspaces, so a vendor flag cannot be trusted.
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
