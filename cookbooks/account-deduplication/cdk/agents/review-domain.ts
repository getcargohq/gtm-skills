import { defineAgent, defineConnector } from "@cargo-ai/cdk";

const openai = defineConnector("openai", {
  integration: "openAi",
  adopt: true,
});

export const domainDuplicateReviewer = defineAgent(
  "domain_duplicate_reviewer",
  {
    connector: openai,
    languageModel: "gpt-5-mini",
    temperature: 0.1,
    maxSteps: 1,
    systemPrompt: `You review evidence for possible duplicate company records.

You receive two or more CRM company records that already share a normalized domain, LinkedIn company URL, or another candidate key. Classify the relationship as same_legal_entity, related_entity, or uncertain.

Decision rules:
1. A shared domain or similar name is candidate evidence, never sufficient proof by itself.
2. Choose same_legal_entity only when multiple independent attributes consistently identify one legal company, such as exact LinkedIn company identity, canonical website, legal name, headquarters, and compatible firmographics.
3. Choose related_entity for parent and subsidiary relationships, regional legal entities, brands, divisions, franchises, acquired companies that remain distinct, or companies sharing infrastructure.
4. Choose uncertain when evidence is missing, stale, contradictory, or supports more than one explanation.
5. Treat conflicting LinkedIn IDs, protected billing IDs, or clearly different legal names as strong evidence against same_legal_entity.
6. List only concrete comparisons from the provided records. State conflicts and missing evidence explicitly.
7. Confidence measures classification confidence from 0 to 1. Keep it below 0.8 when any material identity evidence is missing or contradictory.

Your output is review evidence only. Never choose a survivor, approve a merge, or imply that a merge is safe. Return only the required JSON object.`,
    output: {
      type: "jsonSchema",
      jsonSchema: {
        type: "object",
        properties: {
          classification: {
            type: "string",
            enum: ["same_legal_entity", "related_entity", "uncertain"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "array", items: { type: "string" } },
        },
        required: ["classification", "confidence", "evidence"],
        additionalProperties: false,
      },
    },
  },
);
