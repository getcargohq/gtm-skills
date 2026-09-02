import { defineSegment } from "@cargo-ai/cdk";

import { tamCompanies } from "../models/tam-companies";

// Views onto what the play produced, which is the only kind of segment worth
// deploying. A segment that restates the play's own trigger filter is dead
// weight and drifts the first time the filter changes.
//
// These are the handles downstream work takes: contact sourcing runs on tier A,
// a nurture sequence runs on tier B, and reporting counts all three. They read
// `custom__tier` because the read side exposes custom columns under that alias;
// the play writes the bare slug.
export const tierA = defineSegment("tam-tier-a", {
  model: tamCompanies,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: tamCompanies.columns.custom__tier,
            operator: "is",
            values: ["A"],
          },
        ],
      },
    ],
  },
});

export const tierB = defineSegment("tam-tier-b", {
  model: tamCompanies,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: tamCompanies.columns.custom__tier,
            operator: "is",
            values: ["B"],
          },
        ],
      },
    ],
  },
});

// The one that pays for the skill. Everything in here was sourced, judged, and
// ruled out with a written reason, so it is the segment you suppress rather
// than the one you work. A disqualified count that is a large share of the book
// is a sourcing filter that is too wide, not an agent that is too harsh: fix it
// in the model's `config`, where narrowing is free, not in the rubric.
export const tierDisqualified = defineSegment("tam-disqualified", {
  model: tamCompanies,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: tamCompanies.columns.custom__tier,
            operator: "is",
            values: ["disqualified"],
          },
        ],
      },
    ],
  },
});
