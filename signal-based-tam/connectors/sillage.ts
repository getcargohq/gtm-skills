import { defineConnector } from "@cargo-ai/cdk";

// The signal provider. Sillage runs on Cargo credits (0.5 credit per signal) —
// no API key and no config: creating the connector is enough. The
// `listenSignals` extractor on `models/signals.ts` provisions a dedicated
// Sillage workspace from your TAM and streams its detections back.
export const sillage = defineConnector("sillage", {
  integration: "sillage",
  adopt: true,
});
