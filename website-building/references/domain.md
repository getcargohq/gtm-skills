# Serve the website on the company's domain

Cargo serves the app on its own `*.app.getcargo.run` hostname with `X-Robots-Tag: noindex`. The
company's own domain is what makes the site indexable. The example declares both halves:
`domains` on the app (`infra/apps/website.ts`) and a `defineDomain` (`infra/domains/website.ts`).
Both need `@cargo-ai/cdk` 1.0.89 or later.

## Decide: who holds the DNS

Ask which domain the site should use and where its DNS lives.

- **Another provider (Cloudflare, GoDaddy, Route 53…).** The usual case for an existing company
  domain. **Delete `infra/domains/website.ts`** and keep `domains` on the app. Cargo attaches the
  hostname and never writes the zone. See [External DNS](#external-dns).
- **Cargo.** A domain bought in the Cargo UI, or one to buy now, ideally dedicated to the
  website. Keep the file and choose adopt or purchase below.

Either way the app's hostname is `www.<domain>`, never the apex: a bare domain cannot CNAME to an
app, and the CDK refuses a hostname with fewer than three labels. Set `site.json` `canonicalUrl`
to `https://www.<domain>/`.

## Before adopting: the mailbox check

`dnsRecords` replaces the whole zone. A domain Cargo mailboxes send from would lose the MX, SPF,
DKIM and DMARC records they need, and mail would stop. Before keeping the domain file:

1. Run `cargo-ai mailboxManagement mailbox list` and look for any mailbox on the domain.
2. If one exists, do not adopt it. Use a dedicated website domain, or leave the DNS where it is
   and delete the domain file.
3. Record the check, with its output, in your copy of `SKILL.md` under `## Decisions`.

The check holds for the life of the domain: adding a mailbox to it later breaks the same way.

## Cargo DNS: adopt or purchase

- **Adopt (the example).** `adopt: true` binds a domain the workspace already owns. The deploy
  fails if it does not; adopting never falls back to buying.
- **Purchase.** Drop `adopt`. This registers the domain with workspace credits and is **not
  refundable**. Read the current price and the credit balance first. The plan's
  `+ create domain:<name>` line is the purchase: get explicit approval of that line, and never
  drop `adopt` on your own initiative.

What the release publishes:

- `website.domainRecords` expands at deploy to the `_cargo-verify` TXT, the
  certificate-validation CNAME and the `www` CNAME to the app, made zone-relative.
- Any other record the domain needs (verification for another tool, for instance) is listed in
  `dnsRecords` next to it; anything not listed is removed.
- `redirectUrl` forwards the apex to `https://www.<domain>`.

## External DNS

1. Delete `infra/domains/website.ts`. Keep `domains: ["www.<domain>"]` on the app.
2. Deploy (not a draft: a draft attaches no hostname). The deploy attaches the hostname and
   records its DNS records as the app's `domainRecords` output in the deploy state.
3. Read the records. `cargo-ai hosting app list` gives the app's UUID; the hosting API lists its
   hostnames with their records:

   ```bash
   curl "https://api.getcargo.io/v1/hosting/custom-domains/list?appUuid=<app-uuid>" \
     -H "authorization: Bearer $CARGO_API_TOKEN"
   ```

   Each entry has `verification` (the `_cargo-verify` TXT and the certificate-validation CNAME)
   and `cnameTarget` (the target of the `www` CNAME). If the validation CNAME is missing, wait a
   minute and call `POST /v1/hosting/custom-domains/<uuid>/refresh-status`. The `cargo-hosting`
   skill covers this API.

4. Add the three records at the provider, with names relative to the zone (`_cargo-verify.www`,
   the validation name, `www`).
5. Forward the apex to `https://www.<domain>` with the provider's redirect. Do not point the apex
   at the app with CNAME flattening or ALIAS.

Mail and other records are untouched, because Cargo never writes this zone.

## Verify before claiming it is live

The hostname serves nothing until its `_cargo-verify` TXT resolves, and the certificate is issued
only after its validation record resolves. That can take minutes to hours.

1. Call `refresh-status` on the hostname until it is `active`.
2. Open `https://www.<domain>/` anonymously: the reviewed pages, a valid certificate, canonical
   URLs on `https://www.<domain>/`. Check that the apex redirects to it.
3. If the domain carries mail at another provider, confirm it still delivers.
4. Record the domain, the path taken (adopted, purchased or external), the records and the
   results. Report a pending TXT or certificate as pending.

## Changing or removing the domain

- Removing a hostname from `domains` leaves it attached. A deploy never takes the live site off
  its name; detach it in Cargo deliberately.
- A removed `defineDomain` becomes a deletion candidate. An authorized prune or destroy
  **releases** an adopted domain and **cancels** a purchased one. Never prune a purchased domain
  without separate, explicit approval.
