import type { Api, Orchestration } from "@cargo-ai/api";

// account-scoring re-tiers a company whose `tiered_at` stamp is empty on its
// next hourly run. A play's workflow cannot be run on one record directly, so
// a rescore is the stamp cleared on the company's row, found by its slug.
const tamCompaniesSlug = "tam_companies";

export const queueRescore = async (
  api: Api,
  companyId: string,
): Promise<void> => {
  const { models } = await api.storage.model.all();
  const tamCompanies = models.find((model) => model.slug === tamCompaniesSlug);
  if (tamCompanies === undefined) {
    throw new Error("No tam_companies model in this workspace to rescore.");
  }
  const action: Orchestration.Action = {
    kind: "native",
    actionSlug: "modelCustomColumn",
  };
  await api.orchestration.action.execute({
    action,
    data: {
      modelUuid: tamCompanies.uuid,
      id: companyId,
      mappings: [{ columnSlug: "tiered_at", value: null }],
    },
  });
};
