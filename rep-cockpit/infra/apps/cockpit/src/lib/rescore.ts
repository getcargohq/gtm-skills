import type { Api, Orchestration } from "@cargo-ai/api";

// account-scoring re-tiers an account whose `tiered_at` stamp is empty on its
// next hourly run. A play's workflow cannot be run on one record directly, so
// a rescore is the stamp cleared on the unified account, found by its slug.
const accountsSlug = "accounts";

export const queueRescore = async (
  api: Api,
  accountId: string,
): Promise<void> => {
  const { models } = await api.storage.model.all();
  const accounts = models.find((model) => model.slug === accountsSlug);
  if (accounts === undefined) {
    throw new Error("No Unify Accounts model in this workspace to rescore.");
  }
  const action: Orchestration.Action = {
    kind: "native",
    actionSlug: "modelCustomColumn",
  };
  await api.orchestration.action.execute({
    action,
    data: {
      modelUuid: accounts.uuid,
      id: accountId,
      mappings: [{ columnSlug: "tiered_at", value: null }],
    },
  });
};
