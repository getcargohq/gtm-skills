import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { slack } from "../connectors/slack";
import { signals } from "../models/signals";

// The per-signal automation, deployed as the play's release. For each new
// detection: draft an outreach angle grounded in the signal, then alert the
// team. `uses.slack` pins the base Slack connector by handle, so the CDK orders
// the deploy and injects its uuid.
const qualifySignal = defineWorkflow(
  "qualify-signal",
  {
    input: z.object({
      signal_type: z.string(),
      lead: z.any(),
      company: z.any(),
      interaction_data: z.any(),
    }),
    output: z.object({ angle: z.string() }),
    uses: { slack },
  },
  ({ input, uses, ai }) => {
    const angle = ai(
      `A "${input.signal_type}" buying signal was detected on ${input.company.name} (${input.company.domain}).
Lead: ${input.lead.first_name} ${input.lead.last_name}, ${input.lead.position}.
Signal details: ${input.interaction_data}.
Draft a one-line outreach angle that references the signal without being creepy.`,
    );

    uses.slack.postMessage({
      channelId: "C0000000000", // PLACEHOLDER — your alerts channel ID
      format: "markdown",
      body: `:satellite: New *${input.signal_type}* signal on *${input.company.name}* — ${angle}`,
    });

    return { angle };
  },
);

// Fires on every new row of the signal feed, in realtime. Signals arrive in
// 15-minute batches (the extractor's auto-fetch), so expect bursts. To act only
// on high-intent detections, add the same `signal_type` filter the
// `hot-signals` segment uses.
export const signalToOutreach = definePlay("signal-to-outreach", {
  model: signals,
  workflow: qualifySignal,
  changeKinds: ["added"],
  runCreationRule: "always",
  schedule: { type: "cron", cron: "0 9 * * *" },
});
