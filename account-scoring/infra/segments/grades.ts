import { defineSegment } from "@cargo-ai/cdk";

import { tamCompanies } from "../models/tam-companies";

// Views onto what the plays produced, one per grade the code can compute, so
// no grade lands nowhere. They read `custom__fit_grade` because the read side
// exposes custom columns under that alias; the tools write the bare slug.
const gradeSegment = (slug: string, grade: string) =>
  defineSegment(slug, {
    model: tamCompanies,
    filter: {
      conjonction: "and",
      groups: [
        {
          conjonction: "and",
          conditions: [
            {
              kind: "string",
              columnSlug: tamCompanies.columns.custom__fit_grade,
              operator: "is",
              values: [grade],
            },
          ],
        },
      ],
    },
  });

// Work it now: the handle contact sourcing and engagement take.
export const strongFit = gradeSegment("strong_fit_accounts", "Strong");
// Worth a sequence, not a rep.
export const moderateFit = gradeSegment("moderate_fit_accounts", "Moderate");
// In the market, not in the motion.
export const weakFit = gradeSegment("weak_fit_accounts", "Weak");
// What everything else suppresses.
export const noFit = gradeSegment("no_fit_accounts", "No Fit");
