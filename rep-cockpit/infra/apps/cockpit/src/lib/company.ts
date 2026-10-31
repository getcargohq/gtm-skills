import { hasText, type CompanyProfile } from "./queries";

// 25000000 -> "$25M", 1200000000 -> "$1.2B".
const money = (amount: string): string => {
  const value = Number(amount);
  if (Number.isNaN(value)) {
    return amount;
  }
  if (value >= 1e9) {
    return `$${Number((value / 1e9).toFixed(1))}B`;
  }
  if (value >= 1e6) {
    return `$${Number((value / 1e6).toFixed(1))}M`;
  }
  if (value >= 1e3) {
    return `$${Math.round(value / 1e3)}K`;
  }
  return `$${value}`;
};

// "SERIES_C" -> "Series C".
const titleCase = (value: string): string => {
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// "25000000-50000000" -> "$25M–$50M".
const revenueLabel = (revenue: string): string => {
  return revenue.split("-").map(money).join("–");
};

const fundingLabel = (profile: CompanyProfile): string | undefined => {
  if (!hasText(profile.funding_type)) {
    return undefined;
  }
  const parts = [titleCase(profile.funding_type)];
  if (hasText(profile.funding_amount)) {
    parts.push(money(profile.funding_amount));
  }
  if (hasText(profile.funding_date)) {
    parts.push(profile.funding_date.slice(0, 7));
  }
  return parts.join(", ");
};

export type Fact = { label: string; value: string };

// The firmographics worth a glance, in the order a rep reads them; a fact the
// source did not return is left out rather than shown empty.
export const factsOf = (profile: CompanyProfile): Fact[] => {
  const facts: Fact[] = [];
  if (hasText(profile.industry)) {
    facts.push({ label: "Industry", value: titleCase(profile.industry) });
  }
  if (hasText(profile.employee_count)) {
    facts.push({ label: "Employees", value: profile.employee_count });
  }
  const headquarters = [profile.city, profile.country].filter(hasText);
  if (headquarters.length > 0) {
    facts.push({ label: "Headquarters", value: headquarters.join(", ") });
  }
  if (hasText(profile.founded_year)) {
    facts.push({ label: "Founded", value: profile.founded_year });
  }
  if (hasText(profile.revenue)) {
    facts.push({ label: "Revenue", value: revenueLabel(profile.revenue) });
  }
  const funding = fundingLabel(profile);
  if (funding !== undefined) {
    facts.push({ label: "Last round", value: funding });
  }
  return facts;
};
