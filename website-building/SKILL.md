---
name: website-building
description: 'Build the company website on Cargo and serve it on your own domain: a statically exported Next.js app, one defineApp with its www hostname, and a defineDomain that publishes the records and forwards the apex, changed only through reviewed pull requests. Triggers: "build our company website", "recreate our website on Cargo", "host our marketing site on Cargo", "put our website on our own domain", "capture our design system for the website", "keep our website updated through pull requests". Cargo CDK, defineApp, defineDomain, domainRecords, Next.js, Tailwind, shadcn/ui. Skip when: you are researching another company''s website, which is research-account; or you want a generic hosted app, dashboard or webhook, which is cargo-hosting in the Cargo skill pack.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.92 or later (app `domains`, `domainRecords`, and `dnsRecords` merged into the live zone), Node.js 22.18 or later, and a Cargo workspace."
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

The company website lives in the company's repository, is hosted by Cargo, and answers on the
company's own name. Every change, from a typo to a new page, is a pull request someone reviewed
before it deploys. Your coding agent writes those pull requests; nothing is deployed to do it.

Three resources make the site:

1. **An app.** `defineApp` uploads the Next.js package in `infra/apps/website/`, and Cargo runs
   its build: every page is exported as HTML with its own URL, title and description. The starter
   has home and about pages, `robots.txt`, a sitemap, a theme toggle and shadcn/ui on Tailwind,
   with the copy in `site.json`.
2. **A hostname on the app.** `domains: ["www.example.com"]`. Cargo's own `*.app.getcargo.run`
   URL is `noindex`; the company's `www` host is what search engines index.
3. **A domain, when Cargo holds its DNS.** `defineDomain` publishes the app's records and forwards
   the apex to `www`. When the DNS lives at another provider, the file is deleted and the same
   records are added there.

**Two things worth knowing before you start.** `dnsRecords` is merged into the live zone: the
deploy adds the app's records and leaves mail and everything else it did not write where it is, but
the `www` CNAME takes over whatever `www` pointed to, and `redirectUrl` replaces the apex forward.
The plan prints that diff record by record. And a hostname serves nothing until its `_cargo-verify`
TXT resolves, so a successful deploy is not yet a live site.

## Example

> Build our company website on Cargo from our brand guide and serve it on www.fabrikam.example. Our DNS is hosted elsewhere.

Illustrative output, fictional records:

```text
PR #12  Website: home, about and pricing from the brand guide        merged after review

app:website   deployed   Routing: static
  https://website-1a2b3c4d.app.getcargo.run/pricing/    Pricing | Fabrikam
  www.fabrikam.example                                  pending: _cargo-verify not resolved

DNS is hosted elsewhere, so infra/domains/website.ts was deleted. Add at the provider:
  TXT    _cargo-verify.www   cargo-verify=9c1e4a…
  CNAME  _3f2a91.www         _7b0c44.acm-validations.aws
  CNAME  www                 d1x2y3z4.cloudfront.net
  apex   fabrikam.example  → https://www.fabrikam.example   (provider redirect)
```

Once the TXT resolves, `www.fabrikam.example` serves the reviewed pages with their own canonical
URLs, and the next change to the site is another pull request.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-project` skill is in your session it carries the long form of this,
including CI that plans every pull request and deploys on merge; if not, this is enough.

1. **Install it — the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/website-building` writes this example to
   `infra/website-building/` and this procedure to `.claude/skills/website-building/`. No project
   yet? `cargo-ai cdk init <dir> --cookbook website-building && cd <dir> && npm install` does
   both; this folder never ships a shell. **If you are reading this from the project's
   `.claude/skills/`, the install already happened — start at step 2.**
2. **Reconcile it with what is already declared.** An app or website domain the project already
   has is rewired to, not duplicated. A domain another skill already declares (for example
   `agentic-engagement`'s sending domain) is one resource: add `website.domainRecords` and the
   redirect to that `defineDomain` and delete this one.
3. **Brief, then build.** Follow [build and review](references/build-and-review.md): agree the
   brief, capture the design ([design-system capture](references/design-system-capture.md)), edit
   `infra/website-building/apps/website/`, and build and preview it locally.
4. **Choose the DNS path.** Follow [domain](references/domain.md): which domain, who holds its DNS,
   what already answers on it, adopt or purchase.
5. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about (say what breaks, then do it if they still want it); _What you can change_ is what you
   offer unprompted; _What you will be asked_ is the floor, and you derive before you ask. Record
   what you changed and why under a `## Decisions` section in your copy of this file.
6. **Plan, then stop.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai cdk plan` from the project root, show the diff, and deploy only on
   an explicit yes: `cargo-ai cdk deploy`. The first deploy's plan cannot list the app's records,
   so when `www` already answers, deploy in two steps ([domain](references/domain.md#the-first-deploy)). A
   `+ create domain:…` line is a non-refundable purchase, not an adopt. If the project deploys
   from CI, the merged pull request is the deploy; do not also deploy from a laptop.
7. **Verify.** Walk _Done when_ line by line and report each with evidence. A deploy whose TXT
   record is still pending is reported as pending, not live.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                                                                              | Kind  | How it is answered                                                                                                                                 | Why it matters                                                                                                                              |
| ---------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| company, audience, offering, proof                                                 | value | **derived**: `context/` and the existing site or brand guide; ask only for what is missing                                                         | The pages say only what the company approved. Placeholder copy and invented proof never ship.                                               |
| pages, call to action, design direction                                            | asked | propose a brief from the context and let the operator correct it                                                                                   | The brief is the scope every later pull request is reviewed against.                                                                        |
| source                                                                             | asked | a new site, a recreation of an authorized repository or live site, or a redesign                                                                   | A supplied repository is built from; a screenshot is no substitute for it.                                                                  |
| domain and who holds its DNS (`infra/apps/website.ts`, `infra/domains/website.ts`) | asked | the domain, and Cargo or another provider. **derived**: what the zone serves on `www` and the apex today, from the DNS diff in `cargo-ai cdk plan` | Decides between adopting into Cargo and adding records at the provider, and surfaces a `www` record or apex forward the site would replace. |

Checked before moving on, not after the deploy:

- the brief, sitemap and `context/global/design.md` are agreed, and `site.json` carries only
  approved facts
- the plan's DNS diff for the domain adds the app's records and changes nothing else the operator
  did not approve, or the domain file is deleted
- `node --import tsx evals/contract.mjs` passes against the adapted graph

## What you can change

The code is a worked example. These reshapes are expected, and the agent offers them rather than
waiting to be asked. Every one costs something.

| Variation           | When it is right                                                              | How                                                                                                                                                   | What it costs                                                                                                |
| ------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `external-dns`      | The domain's DNS is at another provider, as for most existing company domains | Delete `infra/domains/website.ts`, keep `domains` on the app, add the records at the provider after the first deploy ([domain](references/domain.md)) | Three records and an apex redirect kept by hand; Cargo cannot correct them.                                  |
| `register-domain`   | The company wants a new domain for the website, bought through Cargo          | Drop `adopt: true` in `infra/domains/website.ts` and the contract's adopt assertion                                                                   | Workspace credits, not refundable; the plan's `+ create domain:…` line is the purchase.                      |
| `source-recreation` | An authorized repository or live site already exists                          | Port its pages and assets into the app, keeping attribution ([build and review](references/build-and-review.md#recreate-an-existing-site))            | Dependency migration, inherited defects to separate from new ones, binary assets to adapt for a text upload. |
| `redesign`          | The current site does not fit the company it describes                        | Approve new tokens, structure and copy instead of matching the old pages                                                                              | More design decisions, and no old page to compare against.                                                   |
| `more-pages`        | The brief needs pricing, landing or legal pages                               | `app/<route>/page.tsx` with `pageMetadata`, plus the route in `app/sitemap.ts`                                                                        | Metadata and sitemap to keep current per page.                                                               |
| `working-form`      | A demo or contact form has to deliver                                         | Post it to an approved destination and test a real submission                                                                                         | A backend outside this static app, with its own consent and cost.                                            |

## What should not change

However far you adapt, these hold. Ask for one anyway and the agent tells you what breaks, then does
it if you still want it, and records why under `## Decisions` in your copy of this file.

- **Read the DNS diff before a deploy touches the domain.** (`infra/domains/website.ts`) Records
  the deploy did not write stay, mail included, but a `~` on `www` or a new `redirectUrl` replaces
  what the domain served before, and a `-` deletes a record an earlier deploy published. Each of
  those needs the operator's yes.
- **The site is served on `www`, never the apex.** (`infra/apps/website.ts`) The apex cannot
  CNAME to an app; it forwards to `https://www.<domain>`, and `site.json` `canonicalUrl` is
  `https://www.<domain>/`, so search engines index one origin.
- **`dnsRecords` includes `website.domainRecords`.** (`infra/domains/website.ts`) Without it the
  zone has no `_cargo-verify` TXT and no `www` CNAME, and the hostname never verifies.
- **The app stays a static export.** (`infra/apps/website/next.config.ts`) `output: "export"`
  and `trailingSlash: true`. Without the trailing slash, `/about` serves the home page.
- **Only reviewed content publishes.** (`infra/apps/website/site.json`) `status` stays `draft`
  (noindex, robots disallow) until the operator approved the pages. No invented customers,
  numbers, prices or testimonials.
- **The app is a public bundle.** (`infra/apps/website/`) No Cargo token, login, private context
  or `.env` in it: everything in the build is readable by anyone, so check `dist/`, not just git.
- **The app slug and the domain stay stable.** Renaming either is a destroy plus a new resource.
- **No credentials, deploy commands, or customer data in this repository.**

## Done when

- `node --import tsx evals/contract.mjs` passes: one app in the `website-building-apps` folder
  with a `www` hostname and a static-export build, and either no domain or an adopted domain whose
  `dnsRecords` holds the app's `domainRecords` and whose apex forwards to `www`
- `npm ci && npm run check && npm run build` in the app writes `dist/index.html`,
  `dist/about/index.html`, `dist/robots.txt` and `dist/sitemap.xml`, each page with its own title,
  description and canonical in the initial HTML
- the operator reviewed the local preview: every changed page at 1440 and 390 pixels wide with no
  horizontal scroll, reachable by keyboard with visible focus, readable in both themes, with no
  console errors or failed requests
- the plan's DNS diff is recorded and every `~` or `-` in it was approved, or the domain file was
  deleted
- `cargo-ai cdk plan` shows the folder, the app and the domain (or no domain) as an adopt, not a
  create, and the operator approved it
- the deploy log says `Routing: static`, and the Cargo URL serves `/about` and `/about/` directly
- `https://www.<domain>/` serves the site in an anonymous session with a valid certificate, the
  apex redirects to it, and pages carry it as their canonical URL; a pending TXT is reported as
  pending
- `site.json` is `ready` only for approved content, and a content change reaches the site through
  one reviewed pull request whose plan shows the same app with a new content hash

## What it costs

Each merge is one deployment of a static app; read the workspace's current hosting usage before
the first deploy, and say what you found. Adopting a domain the workspace owns adds no charge.
Registering one (`register-domain`) charges workspace credits once and is **not refundable**: read
the current price and the credit balance before proposing it, and quote both with the plan. A
working form adds whatever its backend costs. Nothing in the workspace runs on a schedule; your
coding agent's usage is the rest.

## Composes into

`call-capture` (the customer language it collects is what the pages should say), `account-scoring`
and `tam-building` (the ICP they write down is who the site speaks to), `agentic-engagement` (when
its sending domain carries the site, both sets of records go on its one `defineDomain`).
