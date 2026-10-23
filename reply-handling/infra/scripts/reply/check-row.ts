// The row guard, before anything is written or sent. A malformed address
// bounces and costs the domain reputation; a row with no fact gets a first
// touch with nothing true to say, which is the shape of spam. Neither costs a
// model call to refuse.

import { defineScript } from "@cargo-ai/cdk";

export const checkRow = defineScript(
  ({ email, fact }: { email: string; fact: string }) => {
    const address = String(email || "").trim();
    const at = address.indexOf("@");
    const hasDomain = at > 0 && address.indexOf(".", at) > at + 1;
    if (!hasDomain || address.indexOf(" ") >= 0) {
      return { ok: false, reason: "not an email address: " + address };
    }
    if (String(fact || "").trim().length === 0) {
      return { ok: false, reason: "no fact on the row" };
    }
    return { ok: true, reason: "" };
  },
);
