# Company website: engineering notes

The package follows the same distribution contract as the other GTM pipelines:
Cargo supplies the Manifest shell, and this folder supplies the resources and
instructions. The registry installer places `infra/` under
`infra/company-website/`, `scripts/` under `scripts/company-website/`, and the
remaining files under the project's skills directories. The local installer
supports a fork before its changes reach upstream and preserves existing files.
Neither path ships a workspace state file or a root deployment workflow.

For a new environment, use the [terminal setup guide](references/terminal-setup.md).
Its explicit bootstrap creates a separate company project and adapts the fresh
Manifest CI. The normal cookbook installer does not alter an existing project's
release workflow. The bootstrap stops before deploying the maintainer or website.

## Why these resources exist

- The public Vite app is the customer-facing output. Keeping its package under
  `infra/apps/website/` preserves paths when Cargo moves the resource directory.
  Its package boundary prevents CDK discovery from executing browser code.
- The local coding harness reads the skill and prepares changes without a
  Cargo agent. This is the default.
- Opt-in Snitcher models collect actual visiting companies and sessions. The
  tracker is captured from Cargo, reviewed, and loaded only after browser consent.
  See [visitor tracking](references/visitor-tracking.md).
- The optional Claude Code maintainer uses GitHub to prepare a branch and PR.
  Its Anthropic connector supplies the model. Both connector declarations adopt
  existing defaults; the placing agent rewires existing project declarations.
- Separate app and agent folders make workspace ownership visible. Neither is
  declared if its corresponding resource is disabled.
- Publication, visitor tracking and the hosted maintainer start disabled. There is no custom timer,
  synthetic lead model, wrapper tool or second context resource to maintain.

## Source, design and release

`site.json` separates starter content from layout and tokens. Vite renders text
and metadata into initial HTML, so the one-page starter can be read without JS.
The design reference connects company evidence to actual CSS/components. A
supplied repository should replace the neutral starter where appropriate.

`website-build.json` identifies the sorted source files used by the build. The
verification helper requires Cargo's promoted deployment and a matching marker
from an anonymous HTTPS request. It also rejects workspace/repository mismatches.
This detects a stale served build, but does not attest that the code is correct:
browser QA, content review and form-delivery evidence remain separate checks.

The helper deliberately does not create state or deploy. The consuming
repository's existing release workflow is the authority. Adapt it using
[fork and release](references/fork-and-release.md); prompt instructions alone
cannot replace GitHub branch protection or separation of release credentials.

## Validation

From the distribution root, run `node --import tsx company-website/evals/contract.mjs`.
The contract compares local placement with the installed CDK's real placement
function, installs into an isolated project, checks its actual resource graph,
tests repeat installation and target/state guards, and rejects stale deployments.
It makes no Cargo writes. The acceptance scenarios cover the browser and hosted
steps that deterministic checks cannot establish.

Current limitations: no verified custom-domain support, no connected form,
no multi-page routing implementation, and no live deployment/hosted-agent outcome
claim. Visitor tracking requires explicit setup and a reviewed privacy disclosure.
The pipeline does not supply a legal privacy policy or guarantee company matches.
The pinned CDK's UTF-8 upload cannot preserve raw binary assets. Release checks
reject incompatible bytes and app-local `.env` files; source recreations must
adapt those assets to reviewed text-safe representations or approved external
origins before publication. See [build and review](references/build-and-review.md).
