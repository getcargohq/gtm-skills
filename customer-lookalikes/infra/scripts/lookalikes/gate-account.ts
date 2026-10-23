// The account gate: the qualifier's scores against the floors in
// `infra/settings.ts`. The qualifier judges; this decides, so moving the bar is
// a settings diff and the agent cannot wave its own candidates through.

import { defineScript } from "@cargo-ai/cdk";

import { accountFitFloor, situationFloor } from "../../settings";

type AccountScore = {
  account_fit?: number;
  situation?: number;
  tier?: string;
};

export const gateAccount = defineScript(
  ({ account }: { account: AccountScore }) => {
    const accountFit = Number(account.account_fit || 0);
    const situation = Number(account.situation || 0);
    const tier = String(account.tier || "reject");

    let reason = "";
    if (tier === "reject") {
      reason = "tier reject";
    } else if (accountFit < accountFitFloor) {
      reason = "account fit " + accountFit + " below " + accountFitFloor;
    } else if (situation < situationFloor) {
      reason = "situation " + situation + " below " + situationFloor;
    }

    if (reason.length > 0) {
      return { viable: false, verdict: "not_viable", reason: reason };
    }
    return { viable: true, verdict: "viable", reason: "" };
  },
);
