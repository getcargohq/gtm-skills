import { defineConnector } from "@cargo-ai/cdk";

// Sales Navigator. Adopted: no key, no config, and (importantly) no LinkedIn
// seat, user, or cookie. Cargo's Sales Nav extraction is cookieless: it works
// from the search URL alone.
//
// It lives in base-gtm alongside the other adopted connectors (slack, linkedin,
// waterfall, cargo) because more than one cookbook needs it: tam-building
// searches companies, list-building searches people. A connector slug can only
// be declared once, so keeping it inside tam-building would force list-building
// to depend on tam-building purely to borrow the connection, which is a
// dependency that describes nothing real.
export const salesNav = defineConnector("sales_navigator", {
  integration: "salesNavigator",
  adopt: true,
});
