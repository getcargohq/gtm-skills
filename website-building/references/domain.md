# Domain

Cargo serves the app on its own `*.app.getcargo.run` URL with `X-Robots-Tag: noindex`; the
company's domain is what search engines index. The app always takes `www.<domain>`: the apex
cannot CNAME to an app, and the CDK refuses a hostname with fewer than three labels. Set
`site.json` `canonicalUrl` to `https://www.<domain>/`.

## Who holds the DNS

Ask which domain the site uses and where its DNS lives.

- **Another provider**, the usual case for an existing company domain: delete
  `infra/domains/website.ts`, keep `domains` on the app, and follow [External DNS](#external-dns).
  Cargo never writes that zone.
- **Cargo**, ideally a domain dedicated to the website: keep the file, run the mailbox check, then
  adopt or purchase.

## The mailbox check

`dnsRecords` replaces the whole zone, so a domain Cargo mailboxes send from loses its MX, SPF,
DKIM and DMARC records and mail stops. Before keeping the domain file, run
`cargo-ai mailboxManagement mailbox list`. A mailbox on the domain means no adopt: give the website
a dedicated domain, or treat the DNS as external. Record the output under `## Decisions`. The rule
holds for the domain's life; a mailbox added to it later breaks the same way.

## Adopt or purchase

- **Adopt** (the example): `adopt: true` binds a domain the workspace already owns. The deploy
  fails if it does not; it never falls back to buying.
- **Purchase**: drop `adopt`. It charges workspace credits and is **not refundable**. Read the
  price and the credit balance first. The plan's `+ create domain:<name>` line is the purchase and
  needs its own explicit yes; never drop `adopt` on your own initiative.

On deploy, `website.domainRecords` expands to the `_cargo-verify` TXT, the certificate-validation
CNAME and the `www` CNAME. Any other record the domain needs goes in `dnsRecords` beside it;
anything unlisted is removed. `redirectUrl` forwards the apex to `https://www.<domain>`.

## External DNS

1. Delete `infra/domains/website.ts`; keep `domains: ["www.<domain>"]` on the app.
2. Deploy, not as a draft: a draft attaches no hostname.
3. Read the records. `cargo-ai hosting app list` gives the app's UUID, then:

   ```bash
   curl "https://api.getcargo.io/v1/hosting/custom-domains/list?appUuid=<app-uuid>" \
     -H "authorization: Bearer $CARGO_API_TOKEN"
   ```

   `verification` holds the `_cargo-verify` TXT and the certificate-validation CNAME;
   `cnameTarget` is the target of the `www` CNAME. If the validation CNAME is missing, wait a
   minute and call `POST /v1/hosting/custom-domains/<uuid>/refresh-status`.

4. Add the three records at the provider, with names relative to the zone (`_cargo-verify.www`,
   the validation name, `www`).
5. Forward the apex to `https://www.<domain>` with the provider's redirect, not CNAME flattening
   or ALIAS.

## Before calling it live

Nothing is served until `_cargo-verify` resolves, and the certificate follows its validation
record: minutes to hours. Call `refresh-status` until the hostname is `active`, then open
`https://www.<domain>/` in an anonymous session: the reviewed pages, a valid certificate,
canonicals on that origin, the apex redirecting to it, and mail at any other provider still
delivering. Record the path taken and the records; report anything pending as pending.

## Changing or removing

- Removing a hostname from `domains` leaves it attached; detach it in Cargo on purpose.
- A removed `defineDomain` is a deletion candidate: prune or destroy **releases** an adopted domain
  and **cancels** a purchased one. Never prune a purchased domain without its own explicit yes.
