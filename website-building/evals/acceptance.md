# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- The brief, sitemap and `context/global/design.md` were agreed, and `site.json` carries only
  facts the operator approved.
- `npm ci && npm run check && npm run build` in `infra/website-building/apps/website/` writes
  `dist/index.html`, `dist/about/index.html`, `dist/robots.txt` and `dist/sitemap.xml`. Each page's
  initial HTML carries its own title and description, and a draft carries `noindex`. The build
  output, `node_modules/` and `next-env.d.ts` are deleted afterwards.
- The DNS path is recorded: Cargo-held (domain file kept) or external (domain file deleted). For a
  Cargo-held domain, the plan's DNS diff is recorded: the app's records are added, and every `~` or
  `-` was approved by the operator.
- `site.json` `canonicalUrl` is `https://www.<domain>/` before `status` is `ready`.
- `node --import tsx evals/contract.mjs` passes against the adapted graph.
- `cargo-ai cdk types && cargo-ai cdk check && cargo-ai cdk plan` pass in the consumer project. The
  plan shows the app folder, the app and the domain as an adopt; a `+ create domain:…` line was
  approved explicitly as a non-refundable purchase, or is absent.

## Local preview

Serve `dist/` with any static server and keep a screenshot of each check.

- Open `/about` directly, without the trailing slash: the about page loads with its own title, not
  the home page.
- From the home page, the header's About link reaches `/about/`, and browser back returns home.
- Toggle the theme, reload: the choice holds.
- At 390 pixels wide, no page scrolls horizontally and the header stays usable.
- Tab through a page: every link and button is reachable, with visible focus.
- The console shows no errors and the network panel no failed requests.

## After deploy

- The Cargo URL serves `/`, `/about` and `/about/` directly, each with its own title.
- A missing page (`/does-not-exist`) returns the site's not-found page with status 404.
- The hostname reaches `active` once `_cargo-verify` resolves (`refresh-status`, see
  [domain](../references/domain.md)). Until then it is reported as pending.
- For external DNS, the three records read from the hosting API were added at the provider, and the
  apex redirect is configured there.
- In an anonymous session, `https://www.<domain>/` serves the reviewed pages with a valid
  certificate, the apex redirects to it, and the canonical URLs point at it.
- If the domain carries mail at another provider, mail still delivers.

## Updates

- A content-only change reaches the site through one reviewed pull request: the plan shows the same
  app with a new content hash, and nothing is recreated.
- Repeating the same request updates the open pull request instead of opening a second.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/`, and no nested
  `SKILL.md` exists.
- The infra declares one folder, one app and at most one domain.
- `dist/` carries no Cargo token, login, private context or `.env` value.
- No credential, deployment command, or customer data is in this repository.
- No relative import leaves the skill.
