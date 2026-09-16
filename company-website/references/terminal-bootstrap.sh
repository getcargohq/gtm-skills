#!/usr/bin/env bash
# New project only. Run this file from a reviewed gtm-skills checkout.
set -euo pipefail
set +x

pipeline_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for command in node npm git gh; do
  command -v "$command" >/dev/null || { echo "Install $command first. See terminal-setup.md." >&2; exit 1; }
done
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22 || (major===22 && minor<18)) throw Error("Node >=22.18 required")'

ask() {
  local value
  read -r -p "$2" value </dev/tty
  test -n "$value" || { echo "$1 is required." >&2; exit 1; }
  printf -v "$1" '%s' "$value"
  export "$1"
}
secret() {
  local value
  read -r -s -p "$2" value </dev/tty
  printf '\n' >/dev/tty
  printf -v "$1" '%s' "$value"
  export "$1"
}

echo 'This creates a private GitHub project, a Cargo workspace if the name is new,'
echo 'its deployment state, connector bindings and a GitHub Actions release token.'
echo 'It stops before deploying or running the maintainer. It does not publish a website.'
echo 'Existing directories are refused. Keep the resulting project if a later step fails.'

if test -z "${GH_TOKEN:-}"; then
  secret GH_TOKEN 'GitHub operator token (repo, read:org, workflow): '
fi
gh api user >/dev/null
printf '%s\n' "$GH_TOKEN" | env -u GH_TOKEN -u GITHUB_TOKEN gh auth login --hostname github.com --git-protocol https --with-token
gh auth setup-git --hostname github.com
ask WEBSITE_REPOSITORY 'New private GitHub repository (owner/name): '
[[ "$WEBSITE_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo 'Use owner/name for the GitHub repository.' >&2; exit 1; }
ask WEBSITE_PROJECT 'New project directory (absolute path, outside this checkout): '
case "$WEBSITE_PROJECT" in /*) ;; *) echo 'Use an absolute project path.' >&2; exit 1;; esac
case "$WEBSITE_PROJECT/" in "$pipeline_dir/"*|"$(dirname "$pipeline_dir")/"*) echo 'Create a separate company project, outside the distribution.' >&2; exit 1;; esac
test ! -e "$WEBSITE_PROJECT" || { echo 'Directory already exists; continue there instead of rerunning bootstrap.' >&2; exit 1; }
mkdir -p "$(dirname "$WEBSITE_PROJECT")"
if git -C "$(dirname "$WEBSITE_PROJECT")" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo 'Choose a project directory outside every existing Git checkout.' >&2
  exit 1
fi
ask WEBSITE_EMAIL 'Cargo login email: '
ask WEBSITE_WORKSPACE_NAME 'New Cargo workspace name (an existing name is reused): '
ask WEBSITE_COMPANY 'Company name: '
ask WEBSITE_AUDIENCE 'Primary audience: '
ask WEBSITE_OFFERING 'What the company offers: '
ask WEBSITE_GOAL 'Website goal: '
ask WEBSITE_CTA 'Primary CTA destination (https://... or mailto:...): '
ask WEBSITE_MODE 'Mode (new website / faithful recreation / redesign): '
read -r -p 'Source repository URL, optional: ' WEBSITE_SOURCE_REPOSITORY </dev/tty
read -r -p 'Existing website URL, optional: ' WEBSITE_SOURCE_URL </dev/tty
export WEBSITE_SOURCE_REPOSITORY WEBSITE_SOURCE_URL
secret WEBSITE_GITHUB_TOKEN 'Maintainer GitHub token (Contents + Pull requests write; no Actions/Workflows/Admin): '
test -n "$WEBSITE_GITHUB_TOKEN" || { echo 'A maintainer GitHub token is required.' >&2; exit 1; }
secret WEBSITE_ANTHROPIC_API_KEY 'Anthropic API key, or Enter to use a default connector/Cargo credits: '

tools_dir="$(mktemp -d "${TMPDIR:-/tmp}/website-setup-tools.XXXXXX")"
npm install --prefix "$tools_dir" --ignore-scripts --no-audit --no-fund @cargo-ai/cli@1.0.96 @cargo-ai/cdk@1.0.81
cargo_bin="$tools_dir/node_modules/.bin/cargo-ai"
"$cargo_bin" login --help >/dev/null
"$cargo_bin" project init --help >/dev/null

# Explicitly authenticate before init: init itself creates this project's state.
# Avoid an inherited environment token selecting a different workspace.
unset CARGO_API_TOKEN CARGO_API_KEY CARGO_WORKSPACE_UUID CARGO_BASE_URL
"$cargo_bin" login --email "$WEBSITE_EMAIL" </dev/null
secret WEBSITE_LOGIN_CODE 'Code from the Cargo email: '
printf '%s\n' "$WEBSITE_LOGIN_CODE" | "$cargo_bin" login --email "$WEBSITE_EMAIL" --code - --workspace-name "$WEBSITE_WORKSPACE_NAME"
unset WEBSITE_LOGIN_CODE
WEBSITE_WORKSPACE_UUID="$("$cargo_bin" whoami | node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;console.log(JSON.parse(s).workspace.uuid)')"
export WEBSITE_WORKSPACE_UUID
printf '\nWorkspace: https://app.getcargo.io/workspaces/%s\n\n' "$WEBSITE_WORKSPACE_UUID"

"$cargo_bin" project init "$WEBSITE_PROJECT" --name "${WEBSITE_REPOSITORY#*/}" </dev/null
cd "$WEBSITE_PROJECT"
node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const p=JSON.parse(readFileSync('package.json','utf8'));
p.dependencies['@cargo-ai/cdk']='1.0.81';
p.devDependencies['@cargo-ai/cli']='1.0.96';
writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
JS
npm install --ignore-scripts --no-audit --no-fund
# The pinned init's automatic skills installation can fail; do it explicitly.
npx --yes skills add getcargohq/cargo-skills --skill '*' --agent codex claude-code --yes
node "$pipeline_dir/scripts/install.mjs" --project "$WEBSITE_PROJECT"

git branch -M main
WEBSITE_OWNER="$(gh api user --jq .login)"
github_user_id="$(gh api user --jq .id)"
export WEBSITE_OWNER
git config user.name "$WEBSITE_OWNER"
git config user.email "$github_user_id+$WEBSITE_OWNER@users.noreply.github.com"
gh repo create "$WEBSITE_REPOSITORY" --private --description 'Company GTM context and Cargo website'
git remote add origin "https://github.com/$WEBSITE_REPOSITORY.git"
WEBSITE_PIPELINE_REVISION="$(git -C "$pipeline_dir" rev-parse HEAD)"
export WEBSITE_PIPELINE_REVISION
setup_file="$pipeline_dir/references/terminal/configure.mjs"
node "$setup_file" prepare
node "$setup_file" connect
unset WEBSITE_GITHUB_TOKEN WEBSITE_ANTHROPIC_API_KEY

# Init normally binds state. Only fill the generated unbound pointer in this
# genuinely new project; missing/foreign state is an error, never replaced.
state_needs_binding="$(node --input-type=module <<'JS'
import {readStateFile} from '@cargo-ai/cdk/deploy';
const state=readStateFile('infra');
if(state.kind!=='pointer') throw Error('Expected the fresh CLI-generated pointer. Recover it before continuing.');
console.log(state.stateUuid ? 'no' : 'yes');
JS
)"
if test "$state_needs_binding" = yes; then
  npx --no-install cargo-ai project state create --dir infra
fi

npm ci --prefix infra/company-website/apps/website
node scripts/company-website/website.mjs doctor
node scripts/company-website/website.mjs check
git add .
npm run lint
npm run typecheck
node scripts/company-website/website.mjs plan
git commit -m 'Set up company website cookbook and manual Cargo release'
git push -u origin main
gh repo edit "$WEBSITE_REPOSITORY" --default-branch main
node "$setup_file" ci-token

printf '\nSetup complete. Project: %s\n' "$WEBSITE_PROJECT"
printf 'Repository: https://github.com/%s\n' "$WEBSITE_REPOSITORY"
printf 'Workspace: https://app.getcargo.io/workspaces/%s\n' "$WEBSITE_WORKSPACE_UUID"
echo 'No maintainer or website was deployed. Continue with terminal-setup.md, section 3.'
echo 'On later terminals: cd to this project; authenticate gh and Cargo, then run doctor.'
