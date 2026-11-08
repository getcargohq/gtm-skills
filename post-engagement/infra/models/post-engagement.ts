import {
  defineModel,
  type ModelAdditionalColumnSpec,
  type ModelUnificationSpec,
} from "@cargo-ai/cdk";

import { cargoSignals } from "../connectors/cargo-signals";
import { modelsFolder } from "../folders";

// PLACEHOLDER: the LinkedIn profiles whose posts you want watched, usually the
// founders and whoever posts for the company. Each one also needs an entry in
// `AUTHORS` in apps/engagement-board/src/config.ts, or its rows are dropped
// from the board with a warning.
const trackedProfiles = [
  "https://www.linkedin.com/in/dana-ruiz-fabrikam",
  "https://www.linkedin.com/in/sam-okafor",
];

// Rows unify onto your contacts by LinkedIn handle, then email, so an engager
// who is already in your CRM lands on that contact's timeline.
const asContactEvent: {
  additionalColumns: ModelAdditionalColumnSpec[];
  unification: ModelUnificationSpec;
} = {
  // Functions, not template strings: the CDK ships each one's source to the
  // warehouse and passes it the columns it reads as `record.<column>`.
  additionalColumns: [
    {
      kind: "computed",
      slug: "contact_linkedin_url",
      type: "string",
      label: "Contact LinkedIn URL",
      expression: (record) =>
        record.contact ? record.contact.linkedin_profile_url : null,
    },
    {
      kind: "computed",
      slug: "contact_email",
      type: "string",
      label: "Contact email",
      expression: (record) => (record.contact ? record.contact.email : null),
    },
  ],
  unification: {
    source: "custom",
    type: "contactEvent",
    uniqueColumns: [
      { slug: "computed__contact_linkedin_url", reference: "linkedinHandle" },
      { slug: "computed__contact_email", reference: "email" },
    ],
    timeColumnSlug: "last_signal_date",
  },
};

// One model per engagement type, so each one's volume and spend can be read on
// its own. `dailyLeadLimit` is the spend cap: Cargo Signals bills per row
// returned, and a single post that travels can draw hundreds of reactions.
// `duplicateHandling: "allow"` keeps every engagement, because the same person
// engaging again is exactly what the score counts.
function definePostEngagementModel(
  slug: string,
  spec: {
    name: string;
    engagementType: "likes" | "comments";
    dailyLeadLimit: number;
  },
) {
  return defineModel(slug, {
    connector: cargoSignals,
    name: spec.name,
    folder: modelsFolder,
    extractSlug: "listenInfluencerEngagement",
    config: {
      filters: {
        source: { linkedinUrls: trackedProfiles },
        engagement: {
          postedLimit: "month",
          engagementTypes: [spec.engagementType],
        },
      },
      advancedSettings: {
        dailyLeadLimit: spec.dailyLeadLimit,
        duplicateHandling: "allow",
      },
    },
    ...asContactEvent,
  });
}

export const postReactors = definePostEngagementModel("post_reactors", {
  name: "Post reactors",
  engagementType: "likes",
  dailyLeadLimit: 300,
});

export const postCommenters = definePostEngagementModel("post_commenters", {
  name: "Post commenters",
  engagementType: "comments",
  dailyLeadLimit: 300,
});
