# Company website: terminal setup from a fresh environment

This installs this pipeline into a **new, separate company Manifest project**.
It can create the Cargo workspace, creates a private GitHub repository, and
installs the skill plus a manual GitHub Actions release. The first release
uses the resources selected by the operator. The public website is released
after its brief, design and implementation are reviewed.

Validated against Cargo CLI 1.0.96, CDK 1.0.81 and Node 22.23.2 on 2026-09-16.
The local setup/build and offline resource tests are checked. Workspace creation,
token-based GitHub connection, Actions deployment and hosted agent execution still
require live acceptance in the new workspace. This is an unmerged pilot, not a
claim of a completed production installation.

## 1. Prerequisites

Use Bash on macOS or Linux (including WSL). Start outside any existing project.
You need `git`, `curl`, `node` >=22.18, `npm` and `gh`, plus network access to
GitHub, npm and Cargo.

On macOS with Homebrew:

```bash
brew install git gh node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
```

On Ubuntu/Debian, install the OS tools and an official Node binary:

```bash
sudo apt-get update
sudo apt-get install -y git gh curl ca-certificates xz-utils
case "$(uname -m)" in
  x86_64) node_arch=x64 ;;
  aarch64|arm64) node_arch=arm64 ;;
  *) echo 'Use a supported Node installation for this architecture'; exit 1 ;;
esac
node_version=22.23.2
node_archive="node-v${node_version}-linux-${node_arch}.tar.xz"
node_download="$(mktemp -d)"
cd "$node_download"
curl --fail --show-error --location --remote-name "https://nodejs.org/dist/v${node_version}/${node_archive}"
curl --fail --show-error --location --remote-name "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt"
awk -v file="$node_archive" '$2 == file' SHASUMS256.txt > selected-checksum.txt
test -s selected-checksum.txt
sha256sum --check selected-checksum.txt
node_install="$HOME/.local/share/node-v${node_version}"
mkdir -p "$node_install"
tar -xJf "$node_archive" --strip-components=1 -C "$node_install"
export PATH="$node_install/bin:$PATH"
cd "$HOME"
```

Keep that Node directory on PATH in later shells. Verify:

```bash
node --version
npm --version
git --version
gh --version
```

Have these credentials available before running the bootstrap:

- **Cargo email access.** The CLI emails a login code; no Cargo browser login is
  needed. A workspace with the requested name is reused; choose a new name for
  a new workspace. The operator needs permission to manage connectors and tokens.
- **GitHub operator token:** a classic PAT with `repo`, `read:org`, and `workflow`
  access for the owner creating the private repository. The bootstrap saves this
  to GitHub CLI authentication, never to project files.
- **Only if the hosted maintainer is selected, GitHub maintainer token:** a separate fine-grained token with repository
  **Contents: read/write**, **Pull requests: read/write**, and **Metadata: read**.
  It must cover the new repository (for example, a dedicated account/organization
  token covering its repositories). Do not grant Actions, Workflows or
  Administration permissions. Organization access/SSO must already be authorized.
- **Only if the hosted maintainer is selected, model access:** an existing default Anthropic connector, an Anthropic API key,
  or Cargo credits. Blank API-key input uses the existing default, or creates a
  credits-backed connector when none exists. An existing connector is reused
  without replacing its credentials. The script selects a currently advertised
  Claude Code-compatible Sonnet model, falling back to another compatible model;
  inspect its printed selection and pricing before running it. Set `WEBSITE_MODEL`
  before bootstrap to require a particular advertised slug.

GitHub does not let an unauthenticated terminal mint its first personal access
token. Credentials must be supplied; the setup itself makes no browser-dependent
OAuth calls. Hosted maintainer requests consume model usage. Hosting/build usage
depends on the workspace's plan.

## 2. Install the reviewed PR and create the project

Until PR #37 merges, `project add cookbook/company-website` does not install this
branch. Clone the PR revision explicitly. If the operator supplied a reviewed
commit SHA, check it out before running the script.

```bash
mkdir -p "$HOME/cargo-projects"
cd "$HOME/cargo-projects"
git clone --branch feat/company-website-pipeline --single-branch \
  https://github.com/getcargohq/gtm-skills.git gtm-skills-website
cd gtm-skills-website
git log -1 --oneline

# Run the script from this distribution; give it a SEPARATE project directory,
# for example /home/you/cargo-projects/my-company-gtm.
bash company-website/references/terminal-bootstrap.sh
```

The terminal prompts collect company context, CTA, optional source repository and
URL, workspace name, GitHub repository and credentials. Enter a source repository
for a reconstruction: the coding harness should use its actual code and capture its
design system. Source reuse authorization, pages and detailed design remain part
of the reviewed brief.

The bootstrap performs these steps:

1. Authenticates GitHub and Cargo, creates/selects the named workspace and prints
   `https://app.getcargo.io/workspaces/<actual-uuid>`.
2. Runs Cargo's Manifest initializer in an unused directory. This command itself
   creates the workspace-held deployment state; it does not deploy resources.
3. Pins the tested CLI/CDK, installs the Cargo skill pack and copies this pipeline
   with the same placement as the registry installer.
4. Creates the company's private GitHub repository, real company context and
   workspace configuration. `publish` remains `false`.
5. Asks separately about the optional hosted maintainer and visitor tracking, both
   defaulting to no. Only hosted mode configures Cargo GitHub/Anthropic access.
   Tracking opt-in records the public site URL and inspects current pricing; it
   does not install a browser tracker during bootstrap.
6. Fixes the fresh template's CI secret/state conventions. PRs run offline checks;
   a manual release uses `CARGO_API_TOKEN` and the existing root state pointer.
   It updates the new project's AGENTS.md to match that release process.
7. Runs the build, lint, typecheck, identity checks and deployment plan, commits and
   pushes the project, then stores a dedicated Cargo deployment token as the
   repository's `CARGO_API_TOKEN` Actions secret. That token can deploy workspace
   resources; it is not supplied to the maintainer or the website.

The script stops before deployment. It refuses an existing directory on rerun.
If it fails after creating the project, keep that directory, repository and state;
resume at the failed command after fixing the error. Never use `init --force` or
replace the state to get past an error. Connector/token setup is reusable:

```bash
cd /absolute/path/to/my-company-gtm
node .agents/skills/company-website/references/terminal/configure.mjs connect
node .agents/skills/company-website/references/terminal/configure.mjs ci-token
```

If the failed step had not pushed yet, run the checks below, commit and push before
deploying. If credential input is needed again, use Bash `read -rs` and export
`WEBSITE_GITHUB_TOKEN` or `WEBSITE_ANTHROPIC_API_KEY`; do not paste tokens into git
or command arguments. `prepare` is a one-time fresh-project operation.

## 3. Brief and build with your terminal coding harness

Start your installed coding harness from the company project root and give it:

```text
Use the company-website skill. Read AGENTS.md, plan, cadence and company context.
Prepare the brief, sitemap and design-system capture from website-brief.md.
If source code was supplied, use that repository and record its license and commit.
Ask only for missing decisions. Confirm whether visitor tracking is wanted.
Show the brief before implementation, then build the approved scope on a branch.
Show a local preview and record browser QA. Open a reviewable PR. Do not deploy yet.
```

`maintainer` defaults to `false`. Your terminal harness reads the skill and works
with local source; the website does not need an agent deployed inside Cargo.
If you explicitly selected hosted requests, follow
[optional maintainer](optional-maintainer.md) instead for that part of the flow.

If visitor tracking was selected, inspect the live integration and costs with
`node scripts/company-website/visitors.mjs inspect`. Follow
[visitor tracking](visitor-tracking.md) for its two release phases. It creates
native company/session models, not another agent. If the public URL is not known
yet, publish the reviewed website first and opt in in a later PR.

## 4. Inspect the implementation locally

Check out the implementation PR and run its actual app:

```bash
read -r -p 'Implementation PR number: ' implementation_pr
gh pr checkout "$implementation_pr"
npm ci --ignore-scripts
npm ci --prefix infra/company-website/apps/website
npm run lint
npm run typecheck
node scripts/company-website/website.mjs check
npm run dev --prefix infra/company-website/apps/website -- --host 127.0.0.1
```

The last command prints the local preview URL and keeps serving until Ctrl-C.
On a server with no GUI, use headless browser screenshots and interaction tests
from the terminal. Inspect the generated screenshots before accepting visual
fidelity; curl/build results cannot establish it. Follow the installed
`references/qa-checklist.md`. For reconstruction, compare source and rebuild at
the same desktop, mobile and intermediate widths and interaction states.

Record tests that actually ran and gaps, particularly image loading, navigation,
keyboard access, page metadata and real form delivery. Raw binary assets are
blocked by this CDK version's text-only upload: convert them to reviewed text-safe
representations or use approved asset URLs as described in `build-and-review.md`.
Custom domains/DNS and form backends require separate verified setup.

## 5. Publish the reviewed website

After the implementation is reviewed and merged, create a release PR from current
main. The next commands explicitly mark the reviewed site ready for publication:

```bash
git switch main
git pull --ff-only
git switch -c release/company-website
node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const save=(file,data)=>writeFileSync(file,JSON.stringify(data,null,2)+'\n');
const siteFile='infra/company-website/apps/website/site.json';
const configFile='infra/company-website/website.json';
const site=JSON.parse(readFileSync(siteFile,'utf8'));
const config=JSON.parse(readFileSync(configFile,'utf8'));
save(siteFile,{...site,status:'ready'});
save(configFile,{...config,publish:true});
JS
node scripts/company-website/website.mjs check
npm run lint
npm run typecheck
node scripts/company-website/website.mjs plan
git add infra/company-website
git commit -m 'Publish reviewed company website'
git push -u origin release/company-website
gh pr create --base main --title 'Publish reviewed company website' \
  --body 'Enable the reviewed company website. See the implementation PR for content, design and browser QA; review the Cargo plan before release.'
```

Draft starter content still fails the readiness guard. Do not bypass it. After
the release PR checks and review pass, merge it and dispatch the release:

```bash
gh pr checks --watch
gh pr merge --squash
git switch main
git pull --ff-only
gh workflow run cargo-deploy.yml --ref main \
  -f expected_sha="$(git rev-parse HEAD)"
gh run list --workflow cargo-deploy.yml --limit 3
gh run watch --exit-status
node scripts/company-website/website.mjs verify
```

`verify` prints the **actual deployed HTTPS URL**, workspace URL, deployment UUID,
anonymous HTTP result and reviewed-source match. It fails for a missing,
unpromoted or stale build. Finish browser/form QA against that URL and archive the
release evidence in a new dated `outputs/` entry with `outcome:`.

## 6. Subsequent updates and recovery

Use the existing project, app slug and state. Ask the terminal harness for a bounded
update PR, review it, merge it and dispatch the same CI workflow. For the optional hosted maintainer, also test a retry and confirm it updates the same PR.

For a broken release, prepare a PR restoring the last known-good app source and
lockfile, review its plan, merge and dispatch CI again. Preserve state throughout.
Do not recreate the project or delete state as a rollback. The actual previous
deployment's status and URL must be inspected before claiming recovery.

This manual release only runs when an operator dispatches it. Keep maintainer
credentials unable to edit workflows or dispatch Actions. Add your organization's
branch protection and approval rules before delegating broader repository access;
the agent's prompt does not enforce GitHub permissions.
