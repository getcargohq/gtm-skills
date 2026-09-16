// Coercion. CRM properties arrive as whatever the API felt like sending, so
// every value is coerced before it is compared to another one.

import { parkedDomains } from "./policy";

export const asText = (value: unknown) => {
  return value === null || value === undefined ? "" : String(value).trim();
};

export const asNumber = (value: unknown) => {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

export const asDomain = (value: unknown) => {
  return asText(value)
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?/, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
};

export const asHandle = (value: unknown) => {
  return asText(value)
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
};

/** A domain that names one company, rather than a host that names none. */
export const identifiesOneCompany = (domain: string) => {
  return domain !== "" && !parkedDomains.includes(domain);
};
