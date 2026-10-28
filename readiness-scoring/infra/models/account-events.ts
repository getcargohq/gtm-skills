import { defineModel } from "@cargo-ai/cdk";

// Unify Account Events: one row per event on an account, from every model that
// unifies as an account event (the Cargo Signals feeds below, a CRM's
// activities, a product's usage events). The score reads this model and
// nothing else, so a new feed reaches the score by unifying here, with no edit
// to the query.
//
// ADOPTED, NOT CREATED. Every workspace has this model; a deploy finds it by
// its extractor and takes it over. It sets one thing on it: the schedule. A
// sync of Account Events first syncs the models that feed it, then rebuilds it,
// so this hourly cron is what moves a delivered signal into the score. It runs
// at :00; the score rebuilds at :10 and the play reads it at :20. A workspace
// that already syncs Account Events on its own cadence keeps that one: delete
// the schedule line and move the score's minute after it.
export const accountEvents = defineModel("account_events", {
  kind: "native",
  extractSlug: "unifyAccountEvents",
  schedule: { type: "cron", cron: "0 * * * *" },
});
