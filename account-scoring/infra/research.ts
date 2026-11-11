// The research question and its answer schema, built from the model's research
// attributes when the project loads. Adding a research attribute to
// scoring.md and re-syncing the model changes both, with no workflow edit.
//
// The weights are never in the question. A researcher that knows which value
// scores best finds that value.

import { fitModel } from "./model";

const researchAttributes = fitModel.attributes.filter(
  (attribute) => attribute.get.kind === "research",
);

export const researchSchema = {
  type: "object",
  properties: Object.fromEntries(
    researchAttributes.flatMap((attribute) => [
      [
        attribute.slug,
        {
          type: "string",
          enum: [...(attribute.values ?? []), "unknown"],
          description: attribute.definition,
        },
      ],
      [
        `${attribute.slug}_evidence`,
        {
          type: "string",
          description: `The URL of the page that shows the ${attribute.label.toLowerCase()} value, or an empty string when the answer is unknown.`,
        },
      ],
    ]),
  ),
  required: researchAttributes.map((attribute) => attribute.slug),
};

export const researchBrief = [
  "For each attribute below, pick exactly one of its allowed values from public evidence about this company: its own website, product and pricing pages, app store listings, engineering posts and job posts.",
  "Answer 'unknown' when the evidence is not there. Never guess: a wrong label is worse than an unknown one.",
  "Give the URL of the page that shows each answer.",
  ...researchAttributes.map(
    (attribute) =>
      `${attribute.slug} (${attribute.label}): ${attribute.definition} Look at: ${attribute.get.how}.`,
  ),
].join(" ");
