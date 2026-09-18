# Optional hosted maintainer

Use this only when the operator explicitly wants to request updates inside Cargo.
Set `maintainer: true`, configure its scoped GitHub and model access with
`references/terminal/configure.mjs connect`, then follow these steps.
The default local harness workflow needs none of these resources.

## 3. Deploy the maintainer from the terminal

From the company project root, review the brief, configuration and actual plan:

```bash
cat context/global/company.md context/global/website-brief.md
cat infra/company-website/website.json
node scripts/company-website/website.mjs doctor
node scripts/company-website/website.mjs plan
git status --short
```

The first plan should adopt the two connectors and create the maintainer folder,
agent and company context. With `publish: false`, it should contain **no app**.
Unexpected deletions or another workspace mean stop and fix the binding.

After reviewing that plan, dispatch CI for the clean, reviewed main commit:

```bash
test -z "$(git status --porcelain)"
test "$(git branch --show-current)" = main
git pull --ff-only
gh workflow run cargo-deploy.yml --ref main \
  -f expected_sha="$(git rev-parse HEAD)"
gh run list --workflow cargo-deploy.yml --limit 3
gh run watch --exit-status
```

Select the new run when prompted. If it has not appeared yet, rerun the last two
commands. `gh run view --log-failed` shows a failed run's logs. The workflow rejects
another branch or a main SHA that moved before its revision check. Deployments are
serialized. No production deployment runs on the local terminal.

After success, read the created agent ID from the workspace-held state:

```bash
mkdir -p scratch
node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {getApi} from '@cargo-ai/cdk/cli';
import {statePath} from '@cargo-ai/cdk/deploy';
const pointer=JSON.parse(readFileSync(statePath('infra'),'utf8'));
const {state}=await getApi().workspaceManagement.state.get(pointer.stateUuid);
const agent=state.contents.resources?.['agent:company-website-maintainer'];
if(!agent?.uuid) throw Error('Maintainer missing from deployed state. Inspect the failed release.');
writeFileSync('scratch/website-agent-uuid',agent.uuid+'\n');
console.log('Maintainer UUID: '+agent.uuid);
JS
node scripts/company-website/website.mjs doctor
```

At this point the maintainer is deployed. There is still no public website URL.

## 4. Run the first audit/brief through the terminal

This is one billed, on-demand agent request. It asks for a bounded brief, not an
implementation or publication. The skill and prompt instruct it to prefer supplied
source code and capture design tokens, components, responsive rules and assets.

```bash
node --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
writeFileSync('scratch/website-message.json',JSON.stringify([{type:'text',text:
  'Use the local company-website skill. Read AGENTS.md, plan, cadence and company context. '+
  'Prepare the website brief, sitemap and design-system capture plan from context/global/website-brief.md. '+
  'For a supplied repository, inspect its actual code, license and commit before reconstructing anything. '+
  'Audit the supplied live pages. Mark observed, inferred and proposed design rules. '+
  'Put the draft brief and design evidence in one PR. Ask only for missing decisions. '+
  'Do not implement the website, merge, change publish/CI/state/workspace, or deploy. Stop after the reviewable brief.'
}]));
JS
npx --no-install cargo-ai ai message create \
  --agent-uuid "$(cat scratch/website-agent-uuid)" \
  --parts "$(cat scratch/website-message.json)" \
  --max-steps 30 --wait-until-finished \
  > scratch/website-first-run.json
cat scratch/website-first-run.json
gh pr list
```

Inspect the returned message status, reported failures and PR. A successful API
submission alone does not prove the job completed. Review a PR by its number:

```bash
read -r -p 'Brief PR number: ' brief_pr
gh pr view "$brief_pr"
gh pr diff "$brief_pr"
gh pr checks "$brief_pr" --watch
```

Answer missing decisions, correct the brief and merge only when it is acceptable.
Keep the same chat UUID from the message response for related follow-ups by using
`--chat-uuid` instead of `--agent-uuid`. Replace the text in
`scratch/website-message.json` with the concrete approved brief and ask for one
implementation PR, local preview, actual-source reconstruction where applicable,
design evidence and QA. Keep `publish: false` through that implementation PR.
No prompt can supply missing company facts or authorize assets by itself.
