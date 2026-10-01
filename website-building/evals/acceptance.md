# Acceptance

Walk every line. A checked template without an evidence-backed consumer adaptation is incomplete.

## Before deploy

- The brief, sitemap and design guide were agreed, and `site.json` carries only facts the
  operator approved. A fictional test brief is labeled as test data and never published.
- `cd infra/website-building/apps/website && npm ci && npm run build` writes
  `dist/index.html`, `dist/about/index.html`, `dist/robots.txt` and `dist/sitemap.xml`; each
  page carries its own title, description and content, and a draft carries `noindex`. `out/`
  and `next-env.d.ts` are deleted afterwards.
- The [QA checklist](../references/qa-checklist.md) was walked on the local preview at desktop,
  mobile and intermediate widths, with keyboard and both themes.
- The DNS path is recorded: Cargo-held (domain file kept) or external (domain file deleted).
- For a Cargo-held domain, `cargo-ai mailboxManagement mailbox list` shows no mailbox on it, and
  the output is recorded. A domain with mailboxes is never adopted.
- `site.json` `canonicalUrl` is `https://www.<domain>/` before `status` is `ready`.
- `node --import tsx evals/contract.mjs` passes against the adapted graph.
- `cargo-ai cdk types && cargo-ai cdk check && cargo-ai cdk plan` pass in the consumer project.
  The plan shows the app folder, the app and the domain as an adopt; a `+ create domain:…` line
  was approved explicitly as a non-refundable purchase, or is absent.

## After deploy

- The deploy log says `Routing: static`.
- The Cargo URL serves `/`, `/about` and `/about/` directly, each with its own title.
- The hostname reaches `active` once `_cargo-verify` resolves (`refresh-status`, see
  [domain](../references/domain.md)). Until then it is reported as pending.
- For external DNS, the three records read from the hosting API were added at the provider, and
  the apex redirect is configured there.
- `https://www.<domain>/` serves the reviewed pages with a valid certificate, the apex redirects
  to it, and the canonical URLs point at it.
- If the domain carries mail at another provider, mail still delivers.

## Updates

- A content-only change reaches the site through one reviewed pull request: the plan shows the
  same app with a new content hash, and nothing is recreated.
- Repeating the same request updates the open pull request instead of opening a second.
- Removing a hostname from `domains` leaves it attached until it is detached in Cargo on purpose.

## Isolation

- This is one root skill. Its supporting Markdown lives under `references/`, and no nested
  `SKILL.md` exists.
- The infra declares one folder, one app and at most one domain: no agent, connector, model or
  worker.
- The app bundle carries no Cargo token, login, private context or `.env` file.
- No credential, deployment command, or customer data is in this repository.
- No relative import leaves the skill.

## Browser check

`evals/browser.mjs` copies the app, runs `npm ci` and the package's own build, checks the
exported pages, then serves `dist/` the way Cargo's static routing does through intercepted
browser requests. It covers client navigation, direct `/about` entry, the theme control and
overflow at 390px, and prints the evidence directory with a screenshot. From the repository root:

```sh
website_browser_tools="$(mktemp -d)"
npm install --prefix "$website_browser_tools" --no-save playwright@1.63.0
"$website_browser_tools/node_modules/.bin/playwright" install chromium
WEBSITE_PLAYWRIGHT_MODULE="$website_browser_tools/node_modules/playwright/index.mjs" \
node website-building/evals/browser.mjs
```

An existing Chrome binary can be selected with `WEBSITE_CHROME`. The fixture is local: it proves
the export and the routing shape, not a live deployment.
