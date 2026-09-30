# Serve the website on the company's domain

Cargo serves a published app on a Cargo-owned hostname with `X-Robots-Tag:
noindex`. The company's own domain is what makes the site indexable and puts
its authority in the company's name. This module is off by default and needs
`@cargo-ai/cdk` 1.0.89 or later.

## Decide: Cargo DNS or external DNS

Ask which domain the site should use and where its DNS lives. Confirm the
domain in the brief. Then set the `domain` block in
`infra/company-website/website.json`:

```json
"domain": { "name": "acme.com", "purchase": false, "dns": "cargo" }
```

- **`dns: "cargo"` (default; a missing `dns` means this).** Cargo holds the
  domain and publishes its whole zone. Use it for a domain bought through
  Cargo, typically a dedicated website domain. Choose adopt or purchase below.
- **`dns: "external"`.** The domain stays at the company's own DNS provider
  (GoDaddy, Cloudflare, Route 53…). Use it for the company's existing main
  domain. Cargo attaches `www.<name>` to the app and never touches the zone;
  the operator adds three records at the provider. See
  [External DNS](#external-dns).

## Cargo DNS: adopt or purchase

- **Adopt (default).** `purchase: false` binds a domain this workspace already
  owns in Cargo, for example one bought in the Cargo UI. The deploy fails if the
  workspace does not own it; adopting never falls back to buying.
- **Purchase.** `purchase: true` registers the domain through Cargo. This
  charges Cargo credits and is **not refundable**. Look up the current price
  and credit balance before proposing it. The `+ create domain:acme.com` line in
  `cargo-ai project plan` is the purchase approval. Get the operator's explicit
  approval of that plan line before the release; never set `purchase: true` on
  your own initiative.

`name` is the registrable domain (`acme.com`), without `www.` or a scheme.
An empty `name` turns the module off. The domain is declared together with the
app, so nothing happens while `publish` is false.

A domain whose DNS lives at another provider uses `dns: "external"`;
`purchase: true` with it is rejected, since Cargo can only buy a domain whose
DNS it holds.

## What a Cargo DNS release declares

```text
defineApp(..., { domains: ["www.acme.com"] })
defineDomain("acme.com", {
  adopt: true,                          // false only with purchase: true
  dnsRecords: [app.domainRecords],      // the whole zone
  redirectUrl: "https://www.acme.com",  // apex forwards to www
})
```

- **The site lives on `www`.** The app has no fixed IP address, and DNS allows
  no CNAME at the apex. The apex forwards to `https://www.<name>`.
- **`dnsRecords` is the whole zone.** Declaring it replaces every live record,
  including records the registrar wrote at purchase and any mail records. List
  the domain's MX, SPF, DKIM, DMARC and other verification records alongside
  `app.domainRecords` in `infra/company-website/resources.ts` before the first
  release. Read the live zone first and review the plan's record diff.
- **A domain that sends mail is refused.** `website.mjs doctor` and `plan`
  stop the release when any Cargo mailbox sends from the declared domain,
  because publishing the zone would remove the records those mailboxes need.
  Use a dedicated domain for the website — cold outreach reputation shouldn't
  touch it anyway. Buying a new one (`purchase: true`) never trips the check;
  adding a mailbox to it later makes the next release stop.
- **`app.domainRecords`** expands at deploy to the `_cargo-verify` TXT record,
  the certificate validation CNAME and the `www` CNAME to the app. One release
  attaches the hostname and publishes these records.
- Set `site.json` `canonicalUrl` to `https://www.<name>/`. The resource check
  rejects any other canonical origin once the domain is declared.

## External DNS

Use this when the company's domain is already registered and served by
another DNS provider. The release declares only the hostname on the app:

```text
defineApp(..., { domains: ["www.acme.com"] })   // no defineDomain
```

1. Set `"dns": "external"` with `"purchase": false`, and `site.json`
   `canonicalUrl` to `https://www.<name>/`.
2. Release (non-draft). This attaches `www.<name>` and stores its records.
3. Run `node scripts/company-website/website.mjs records`. It prints the
   records as JSON with each record's zone-relative `host`: the
   `_cargo-verify.www` TXT, the certificate-validation CNAME and the `www`
   CNAME to the app. A draft release stores none; run a non-draft release
   first. The CI release uploads the same output as `website-dns-records.json`.
4. Add the three records at the provider. The hostname goes active once the
   TXT resolves, which can take minutes to hours; the site is not served on
   `www.<name>` until then. The Cargo URL keeps working throughout, and
   `website.mjs verify` checks that URL, so the release does not wait on DNS.
5. **Apex.** The apex cannot CNAME to the app. Forward `acme.com` to
   `https://www.acme.com` with the provider's redirect. Even where the
   provider offers CNAME flattening or ALIAS at the apex, do not point the
   apex at the app; use the redirect.

Mail and other records are untouched because Cargo never writes this zone, so
the mailbox check does not apply. Removing the block later leaves the
hostname attached to the app, as below; delete the records at the provider
and detach it in Cargo deliberately.

## Verify before claiming it is live

The hostname serves nothing until its `_cargo-verify` TXT record resolves, and
the certificate is issued only after its validation record resolves. DNS can
take minutes to hours. After the release:

1. Check the hostname's status with the hosting skill; wait for it to be active.
2. Run `node scripts/company-website/website.mjs verify` and open
   `https://www.<name>/` anonymously. Check that the apex redirects to it.
3. Confirm mail still delivers if the domain carries mail.
4. Record the domain, mode (adopted, purchased or external), records and verification
   results in the output entry. Report a pending TXT or certificate honestly.

## Changing or removing the domain

- Removing `domain` (or a hostname from `domains`) leaves the hostname attached
  to the app. A deploy never takes the live site offline on its own; detach it
  in Cargo deliberately.
- The removed domain resource becomes a deletion candidate. Ordinary deploy
  retains it; an explicitly authorized prune or destroy **releases** an adopted
  domain and **cancels** a purchased one. Never prune a purchased domain without
  the operator's explicit, separate approval.
- Keep `purchase` unchanged after the first release. The flag describes how the
  domain entered state; it is not a switch to change later.
