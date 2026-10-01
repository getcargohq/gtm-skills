import { defineDomain } from "@cargo-ai/cdk";

import { website } from "../apps/website";

// PLACEHOLDER — the domain the website lives on, when Cargo holds its DNS.
//
// DNS hosted at another provider? DELETE THIS FILE. Keep
// `domains` on the app; after a release, read the records the hostname needs
// and add them at the provider (references/domain.md, "External DNS"). Cargo
// never writes a zone it does not hold.
//
// `adopt: true` binds a domain the workspace already owns (bought in the Cargo
// UI, or by an earlier deploy whose state was lost). It never falls back to
// buying: the deploy fails if the workspace does not own it. Drop `adopt` only
// to register a new domain. That charges workspace credits, is not
// refundable, and the plan's `+ create domain:…` line is the approval.
//
// `dnsRecords` is merged into the live zone: records this deploy did not
// write, mail records included, are left where they are. The `www` CNAME
// takes over whatever `www` pointed to and `redirectUrl` replaces the apex
// forward, so read the plan's DNS diff before deploying. Any other record the
// domain needs goes in this list next to the app's; dropping one deletes it.
//
// `website.domainRecords` expands at deploy to what the app's hostnames need:
// the `_cargo-verify` TXT, the certificate-validation CNAME and the `www`
// CNAME to the app. The apex cannot CNAME to the app, so `redirectUrl`
// forwards it to the www host.
export const websiteDomain = defineDomain("example.com", {
  adopt: true,
  dnsRecords: [website.domainRecords],
  redirectUrl: "https://www.example.com",
});
