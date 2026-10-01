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
- **Cargo**: keep the file, read [what the deploy changes](#what-the-deploy-changes-in-the-zone),
  then adopt or purchase.

## What the deploy changes in the zone

`dnsRecords` is merged into the zone as it stands. The MX, SPF, DKIM and DMARC records a sending
domain carries, and anything added in the Cargo UI, stay where they are, so a domain Cargo
mailboxes send from can carry the website too. Two things are replaced, not added:

- **`www`.** A name holds one CNAME, so the app's takes over whatever `www` pointed to.
- **The apex forward.** `redirectUrl` replaces it. A sending domain usually forwards its apex to
  the company's main site; after this it forwards to its own `www`.

`cargo-ai cdk plan` reads the live zone and prints the diff record by record (`+` added, `~`
changed, `-` deleted). Show it to the operator before the deploy, get a yes for every `~` and `-`,
and record it under `## Decisions`. A record edited by hand after the deploy published it makes the
plan stop and name both values; put the one to keep in the code.

## Adopt or purchase

- **Adopt** (the example): `adopt: true` binds a domain the workspace already owns. The deploy
  fails if it does not; it never falls back to buying.
- **Purchase**: drop `adopt`. It charges workspace credits and is **not refundable**. Read the
  price and the credit balance first. The plan's `+ create domain:<name>` line is the purchase and
  needs its own explicit yes; never drop `adopt` on your own initiative.

On deploy, `website.domainRecords` expands to the `_cargo-verify` TXT, the certificate-validation
CNAME and the `www` CNAME. Any other record the domain needs goes in `dnsRecords` beside it, and
dropping one from the list deletes it on the next deploy. Records the deploy did not write are never
touched. `redirectUrl` forwards the apex to `https://www.<domain>`.

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

- Removing a hostname from `domains` leaves it attached; detach it in Cargo on purpose. The
  deploy keeps the app's records current but never deletes them, so the records a detached
  hostname leaves behind are removed in Cargo too; `plan` names them.
- A removed `defineDomain` is a deletion candidate: prune or destroy **releases** an adopted domain
  and **cancels** a purchased one. Never prune a purchased domain without its own explicit yes.
