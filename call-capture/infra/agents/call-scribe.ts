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
  // `repository` is OMITTED ENTIRELY, and there is nothing left to declare in
  // it. `repository`, `defaultBranch`, `rootDirectory` and the GitHub
  // `connector` are filled by plan and deploy from the git origin of the
  // checkout they run in, taking the connector from the project's own
  // `defineConnector`.
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
  // wrong until the first pull request opens against a stranger's repo. Add a
  // `repository` block only to override the checkout — a different repo, or a
  // base branch that is not `main`.
  //
  // No `env` either, which is the other half of the same idea: the collector
  // needs two choices and one secret, and none of the three belongs in a
  // deployed spec.
  //
  //   - the recorder and the internal domain live in
  //     scripts/call-capture/collect/config.ts. They are choices, not secrets.
  //     In code the compiler checks the recorder slug against the registry, a
  //     reviewer sees both in the diff, and an edit reaches the next run as
  //     soon as it merges — the harness clones this repository every morning,
  //     while a value in this spec would need a redeploy to change.
  //   - CALL_RECORDER_API_KEY is a workspace environment variable, created
  //     once with the CLI and written down nowhere in this project:
  //
  //       export CALL_RECORDER_API_KEY=…   # not committed, not persisted
  //       cargo-ai workspaceManagement envVar create \
  //         --key CALL_RECORDER_API_KEY --secret \
  //         --description "Call recorder API key read by scripts/call-capture"
  //
  //     (omitting --value reads the exported variable, which keeps the key out
  //     of argv and out of shell history). A harness agent inherits the whole
  //     workspace catalog, so the sandbox shell reads it like any other
  //     variable. The name is deliberately not the vendor's, and where a
  //     recorder issues two values — Gong's access key and secret, Clari
  //     Copilot's key and password — the entry holds `<first>:<second>` and
  //     the adapter splits it, so one variable covers every recorder.
  //
  // A `secret()` here would work and is the wrong trade: it resolves from the
  // DEPLOYING machine's environment at apply time, so the key has to exist in
  // a local shell or a .env for every deploy, by whoever deploys, and rotating
  // it needs a re-apply to land. And `workspaceEnv()` is not accepted in a
  // harness env block at all — the type says so, because a pointer there could
  // only restate a variable the sandbox already reads. It is for credential
  // fields on OTHER resources, like a connector's access token.
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
