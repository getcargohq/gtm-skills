// The ICP gates, applied the same way to every company whatever source found
// it. Deterministic on purpose: the classifier labels the company, this code
// decides what the label means for the TAM, so the same company always lands
// with the same status.

import { defineScript } from "@cargo-ai/cdk";

import {
  countries,
  inScopeCategories,
  maxEmployees,
  minEmployees,
  subsidiaryThreshold,
  unknownCategory,
} from "../settings";

type Judgment = {
  status: "in_scope" | "out_of_scope" | "needs_review";
  exclusionReason: string;
};

export const judgeCompany = defineScript(
  ({
    category,
    subsidiaryProbability,
    employeeCount,
    hqCountry,
  }: {
    category: string;
    subsidiaryProbability: number;
    employeeCount: number;
    hqCountry: string;
  }): Judgment => {
    // A thin page is a coverage gap, not a verdict: kept for a human to read.
    if (category === unknownCategory || category === "") {
      return {
        status: "needs_review",
        exclusionReason: "not_enough_information",
      };
    }
    // Unknown is unknown: a missing headcount or country is a gap in the
    // data, never a reason to drop the company.
    if (typeof employeeCount !== "number" || !hqCountry) {
      return {
        status: "needs_review",
        exclusionReason: "missing_size_or_country",
      };
    }
    if (!inScopeCategories.includes(category)) {
      return {
        status: "out_of_scope",
        exclusionReason: `category: ${category}`,
      };
    }
    // A country page or an acquired brand on a parent's domain looks like a
    // company and is not one: it would reach a rep as a new account.
    if (subsidiaryProbability >= subsidiaryThreshold) {
      return {
        status: "out_of_scope",
        exclusionReason: "subsidiary_or_country_page",
      };
    }
    if (employeeCount < minEmployees || employeeCount > maxEmployees) {
      return {
        status: "out_of_scope",
        exclusionReason: `size: ${employeeCount}`,
      };
    }
    if (!countries.includes(hqCountry)) {
      return {
        status: "out_of_scope",
        exclusionReason: `country: ${hqCountry}`,
      };
    }
    return { status: "in_scope", exclusionReason: "" };
  },
);
