import { defineAgent } from "@cargo-ai/cdk";

import { plannerPrompt } from "./planner.prompt";
import { agentsFolder } from "../folders";

// The planner: a Claude Code harness agent, not a streamText agent.
//
// `harness: "claudeCode"` swaps the LLM loop for the coding runtime, and that
// is what makes this skill possible. The output of a week is not a column
// value; it is one or more diffs — a raw dump plus one recommendation file
// per active initiative (or one workspace file when there are none). Only an
// agent with a working tree can produce those diffs, and only a pull request
// makes a recommendation reviewable before it is next week's work. There is
// no `connector` / `languageModel` here on purpose: the harness brings its
// own model.
//
// `platform` is the workspace operating surface (cargo#5815): list and query
// runs, query models, credit usage. Same tools as the platform MCP.
// It is not in @cargo-ai/cdk 1.0.68's Capability union yet; the wire payload
// is still `{ slug, config }`. Drop the assertion once types catch up. This
// recap is read-only against it — execute_action is how a planner starts
// spending, and recommendations are markdown a human merges, not a deploy.
export const planner = defineAgent("weekly-planning", {
  name: "Weekly planning",
  description:
    "Ranks last week's GTM work against active initiatives, declared infra, and live runs, and opens one reviewable pull request per initiative (or one workspace pull request when there are none).",
  color: "blue",
  harness: "claudeCode",
  // @ts-expect-error TS2322: "platform" is not in this package's Capability union yet (cargo#5815)
  capabilities: [{ slug: "platform", config: {} }],
  repository: {
    // Deliberately partial. `repository`, `defaultBranch`, `rootDirectory` and
    // the GitHub `connector` are all OMITTED so plan and deploy fill them from
    // the git origin of the checkout they run in, taking the connector from the
    // project's own `defineConnector`.
    //
    // `rootDirectory` resolves to the directory whose package.json declares
    // `@cargo-ai/cdk` — where node_modules is, and therefore the only place the
    // agent's `npx tsx …/collect/week.ts` resolves. In the scaffolded layout
    // that is the repository root, which is also where cadence/ and
    // initiatives/ live. `cargo-ai cdk check` prints what it resolved; verify
    // it names the repository root and not `infra/`.
    env: {
      // IANA timezone the recapped ISO week is computed in. Public, so a
      // plain string rather than a secret. The cron is Monday 15:00 UTC,
      // which is 8am here during PDT; change both together if you move it.
      PLANNING_TIMEZONE: "America/Los_Angeles",
    },
  },
  triggers: [
    {
      type: "cron",
      name: "weekly",
      // 15:00 UTC Monday: 8am PT during PDT, 7am PT during PST. Recaps the
      // ISO week that just ended. A Sunday run recaps an incomplete week;
      // keep the cron on Monday.
      cron: "0 15 * * 1",
      text: "Run weekly planning. Follow your system prompt exactly: write the dump, then open one pull request per active initiative, or one workspace pull request if there are none.",
    },
  ],
  systemPrompt: plannerPrompt,
  folder: agentsFolder,
});
