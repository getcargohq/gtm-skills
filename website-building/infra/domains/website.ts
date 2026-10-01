import { defineDomain } from "@cargo-ai/cdk";

import { website } from "../apps/website";

// PLACEHOLDER — the domain the website lives on, when Cargo holds its DNS.
//
// DNS somewhere else (Cloudflare, GoDaddy, Route 53…)? DELETE THIS FILE. Keep
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
// `dnsRecords` REPLACES THE WHOLE ZONE, every live record included. That is
// why this must never be a domain Cargo mailboxes send from: publishing the
// zone removes their MX, SPF, DKIM and DMARC records and mail stops. Check
// `cargo-ai mailboxManagement mailbox list` first, and give the website a
// dedicated domain. Any other record the domain needs goes in this list next
// to the app's.
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
