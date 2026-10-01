---
name: website-building
description: 'Build the company website on Cargo and serve it on your own domain: a statically exported Next.js app, one defineApp with its www hostname, and a defineDomain that publishes the records and forwards the apex, changed only through reviewed pull requests. Triggers: "build our company website", "recreate our website on Cargo", "host our marketing site on Cargo", "put our website on our own domain", "capture our design system for the website", "keep our website updated through pull requests". Cargo CDK, defineApp, defineDomain, domainRecords, Next.js, Tailwind, shadcn/ui. Skip when: you are researching another company''s website, which is research-account; or you want a generic hosted app, dashboard or webhook, which is cargo-hosting in the Cargo skill pack.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.89 or later (app `domains` and `domainRecords`), Node.js 22.18 or later, and a Cargo workspace."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/website-building
metadata:
  author: getcargo
  source: cookbook
  personas:
    - marketing
    - gtm-engineering
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/gtm-skills
---

# Website building

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

The company website lives in the company's own repository, is hosted by Cargo, and answers on the
company's own name. Every change, from a typo to a new page, is a pull request someone reviewed
before it deploys. Your coding agent writes those pull requests; nothing is deployed to do it.

Three resources make the site:

1. **An app.** `defineApp` uploads the Next.js package in `infra/apps/website/`. Cargo runs its
   build, which exports every page as prerendered HTML, so each page has its own URL, title and
   description and reads without JavaScript. The starter has home and about pages, `robots.txt`,
   a sitemap, a theme toggle and Tailwind with shadcn/ui, all driven by `site.json`.
2. **A hostname on the app.** `domains: ["www.example.com"]` attaches the company's `www` host.
   Cargo's own `*.app.getcargo.run` URL is `noindex`; the company domain is what search engines
   index.
3. **A domain, when Cargo holds its DNS.** `defineDomain` publishes the app's records and forwards
   the apex to `www`. When the DNS lives at Cloudflare, GoDaddy or any other provider, that file
   is deleted and the same records are added at the provider instead.

**Two failure modes worth knowing before you start.** `dnsRecords` replaces the whole zone, so
adopting a domain that Cargo mailboxes send from deletes their mail records and outreach stops.
And a hostname serves nothing until its `_cargo-verify` TXT record resolves, so a deploy that
succeeded is not yet a live site.

## Example

> Build our company website on Cargo from our brand guide, and serve it on www.fabrikam.example — our DNS is at Cloudflare.

Illustrative output, fictional records:

```text
PR #12  Website: home, about, pricing from the brand guide   (reviewed, merged)

app:website      deployed   Routing: static (pages found as <route>/index.html)
  live           https://website-1a2b3c4d.app.getcargo.run/pricing/   → Pricing | Fabrikam
  hostname       www.fabrikam.example   pending  (_cargo-verify not resolved yet)

Add at Cloudflare (DNS lives there, so infra/domains/website.ts was deleted):
  TXT    _cargo-verify.www   cargo-verify=9c1e…
  CNAME  _x1.www             _y1.acm-validations.aws
  CNAME  www                 d123.cloudfront.net
  apex   fabrikam.example  → https://www.fabrikam.example   (Cloudflare redirect rule)
```

Once the TXT resolves, `www.fabrikam.example` serves the reviewed pages with their own canonical
URLs, and the next change to the site is another pull request.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-project` skill is in your session it carries the long form of this,
including the CI that plans every pull request and deploys on merge; if not, install it with
`npx skills add getcargohq/cargo-skills`. This section is enough for the website itself.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/website-building` writes this example to
   `infra/website-building/` and this procedure to `.claude/skills/website-building/`. No project
   yet? `cargo-ai cdk init <dir> --cookbook website-building && cd <dir> && npm install` does
   both; this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened — start at step 2.**
2. **Reconcile it with what is already declared.** An app folder or a website domain the project
   already has is rewired to, not duplicated. A domain another skill declares for mailboxes (for
   example `agentic-engagement`'s) is never the website's domain.
3. **Brief, then build.** Follow [build and review](references/build-and-review.md): read the
   company context, agree the pages, the call to action and the design direction, and capture the
   design with [design-system capture](references/design-system-capture.md). Then edit
   `infra/website-building/apps/website/`, run `npm ci && npm run build` there, preview `dist/`,
   and walk the [QA checklist](references/qa-checklist.md). Every change is a pull request.
4. **Choose the DNS path.** Follow [domain](references/domain.md): which domain, where its DNS
   lives, adopt or buy, and the mailbox check before any adopt.
5. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted; _What you will be asked_ is the floor, and you derive before you ask. Record
   what you changed and why under a `## Decisions` section in your copy of this file.
6. **Plan, then stop.** `node --import tsx evals/contract.mjs && npm run check && cargo-ai cdk plan`,
   show the diff, and deploy only on an explicit yes: `cargo-ai cdk deploy`. A
   `+ create domain:…` line is a non-refundable purchase, not an adopt. If the project deploys
   from CI, the merged pull request is the deploy; do not also deploy from a laptop.
7. **Verify.** Walk _Done when_ line by line and report each with evidence. A deploy that
   succeeded while the TXT record is still pending is reported as pending, not live.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                                                                                | Kind  | How it is answered                                                                                                                                                      | Why it matters                                                                                                          |
| ------------------------------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| company, audience, offering, proof                                                   | value | **derived**: read `context/` and the existing site or brand guide; ask only for what is missing                                                                         | The pages say only what the company has approved. Seed copy and invented proof never ship.                              |
| pages, call to action, design direction                                              | asked | propose a brief from the context and let the operator correct it                                                                                                        | The brief is the scope every later pull request is reviewed against.                                                    |
| source mode                                                                          | asked | a new site, a faithful recreation of a supplied repository or URL, or a redesign                                                                                        | A supplied repository is used as source; a screenshot is not a substitute for it.                                       |
| domain and where its DNS lives (`infra/apps/website.ts`, `infra/domains/website.ts`) | asked | the domain name, and whether Cargo or another provider holds its DNS. **derived**: whether Cargo mailboxes send from it, from `cargo-ai mailboxManagement mailbox list` | Decides between adopting into Cargo and adding records at the provider, and blocks the one adopt that would break mail. |

Checked before moving on, not after the deploy:

- the brief, sitemap and design guide are agreed, and `site.json` carries only approved facts
- `cargo-ai mailboxManagement mailbox list` shows no mailbox on the domain, or the domain file is
  deleted because the DNS lives elsewhere
- `site.json` `canonicalUrl` is `https://www.<domain>/` before `status` becomes `ready`
- `node --import tsx evals/contract.mjs` passes against the adapted graph

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something.

| Variation           | When it is right                                                                                           | How                                                                                                                                                   | What it costs                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `external-dns`      | The domain's DNS is at Cloudflare, GoDaddy, Route 53 or any other provider (most existing company domains) | Delete `infra/domains/website.ts`; keep `domains` on the app; add the records at the provider after the first deploy ([domain](references/domain.md)) | Three records and a redirect to maintain by hand at the provider; Cargo cannot fix them for you.                                                              |
| `register-domain`   | The company wants a new, dedicated website domain bought through Cargo                                     | Drop `adopt: true` in `infra/domains/website.ts`                                                                                                      | Workspace credits, not refundable. The plan's `+ create domain:…` line is the purchase, approved explicitly. Update the contract's adopt check and record it. |
| `source-recreation` | An authorized repository or live site already exists                                                       | Port its pages and assets into the app, keeping attribution ([build and review](references/build-and-review.md))                                      | Dependency migration, inherited defects to separate from new ones, and binary assets to adapt for a text-only upload.                                         |
| `redesign`          | The current site no longer fits the company                                                                | Approve new tokens, structure and copy instead of matching the old pixels                                                                             | More design decisions, and a new baseline for every comparison.                                                                                               |
| `more-pages`        | The brief needs pricing, landing or legal pages                                                            | Add `app/<route>/page.tsx` with `pageMetadata`, and list the route in `app/sitemap.ts`                                                                | Each page is metadata and sitemap to keep current.                                                                                                            |
| `working-form`      | The brief needs a demo or contact form that delivers                                                       | Point the form at an approved destination and test a real submission                                                                                  | A backend outside this static app, and its own consent and cost. A form with no destination is reported unfinished.                                           |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **Never adopt a domain Cargo mailboxes send from.** (`infra/domains/website.ts`) `dnsRecords`
  replaces the whole zone, so the MX, SPF, DKIM and DMARC records those mailboxes need disappear
  and mail stops. Run `cargo-ai mailboxManagement mailbox list` before any adopt; give the website
  a dedicated domain, or leave the DNS where it is and delete the domain file.
- **The site is served on `www`, never the apex.** (`infra/apps/website.ts`) The apex cannot
  CNAME to the app; it forwards to `https://www.<domain>`. The canonical URL in `site.json` is
  `https://www.<domain>/`, so search engines index one origin, not two.
- **`dnsRecords` includes `website.domainRecords`.** (`infra/domains/website.ts`) Without it the
  published zone has no `_cargo-verify` TXT and no `www` CNAME, and the hostname never verifies.
- **The app stays a static export.** (`infra/apps/website/next.config.ts`) `output: "export"`
  and `trailingSlash: true`. Without the trailing slash, `/about` serves the home page. Route
  handlers, middleware and image optimization do not survive the export.
- **Only reviewed content publishes.** (`infra/apps/website/site.json`) `status` stays `draft`
  (noindex, robots disallow) until the operator approved the pages; no invented customers,
  numbers, prices or testimonials.
- **The app is a public bundle.** (`infra/apps/website/`) No Cargo token, login, private
  context or secret in it: app variables are compiled into files anyone can read.
- **The app slug and the domain stay stable.** Renaming `website` or the domain is a destroy plus
  a new resource, and removing a hostname leaves it attached until someone detaches it in Cargo.
- **No credentials, deploy commands, or customer data in this repository.**

## Done when

- `node --import tsx evals/contract.mjs` passes: one app in the `website-building-apps` folder,
  a static export with `trailingSlash`, a `www` hostname, and either no domain or an adopted
  domain whose `dnsRecords` is the app's `domainRecords` and whose apex forwards to `www`
- `npm ci && npm run build` in the app writes `dist/index.html`, `dist/about/index.html`,
  `dist/robots.txt` and `dist/sitemap.xml`, each page with its own title and description
- the brief, the design guide and the [QA checklist](references/qa-checklist.md) results are
  recorded, and the operator reviewed the local preview
- the mailbox check was run and is recorded, or the domain file was deleted
- `cargo-ai cdk plan` shows the folder, the app and the domain (or no domain), adopt not create,
  and the operator approved it
- the deploy log says `Routing: static`, and the Cargo URL serves `/about/` directly
- `https://www.<domain>/` serves the site with a valid certificate once `_cargo-verify`
  resolves, the apex redirects to it, and pages carry it as their canonical URL; a pending TXT is
  reported as pending
- `site.json` is `ready` only for content the operator approved, and the change reached the
  default branch through a reviewed pull request

## What it costs

Hosting a static app is a deployment per merge; read the workspace's current hosting usage before
the first deploy, and say what you found. Adopting a domain the workspace already owns adds no
charge. Registering one (`register-domain`) charges workspace credits once and is **not
refundable**: read the current price in the Cargo UI and the credit balance before proposing it,
and quote both with the plan. A working form adds whatever its backend costs. Your coding agent's
own usage is the rest; nothing in the workspace runs on a schedule.

## Composes into

`call-capture` (the customer language it collects is what the pages should say), `account-scoring`
and `tam-building` (the ICP they write down is who the site speaks to), `agentic-engagement` (the
sending domain it adopts is never this one; the website keeps its own).
