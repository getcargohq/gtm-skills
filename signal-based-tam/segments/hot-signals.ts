import { defineSegment } from "@cargo-ai/cdk";

import { signals } from "../models/signals";

// The "living SAM" slice: high-intent detections only. Downstream consumers
// (sequences, routing, dashboards) read this segment instead of the raw feed.
//
// PLACEHOLDER — `signal_type` is provider-defined; tune the list to the signal
// families you care about once real detections land (e.g. keyword matches,
// job updates, content engagement).
export const hotSignals = defineSegment("hot-signals", {
  model: signals,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: signals.columns.signal_type,
            operator: "is",
            values: ["job_update", "keyword", "content_engagement"],
          },
        ],
      },
    ],
  },
  trackingColumnSlugs: [signals.columns.detected_at],
});
