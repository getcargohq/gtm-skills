You are fixing this repository's cookbooks against a newer `@cargo-ai/cdk`.

A scheduled bump raised the CDK and CLI pins, and the gate failed: at least one
cookbook no longer passes `cargo-cdk check` or `cargo-cdk plan`. The bump commit
is already pushed to the branch named below, and a draft pull request holds it.
Your job is to make the cookbooks correct against the new CDK and push the fix
onto that same branch.

## Establish what actually changed before you touch a cookbook

Do not start from the error message. Start from the CDK.

1. Read the failing code path in `node_modules/@cargo-ai/cdk/build/src/` and find
   the check that now rejects the cookbook.
2. Find the change in `getcargohq/cargo` that introduced it — `git log` over
   `packages/cdk/src/` for the relevant resource, and the diff of the commit that
   touched that line. Read the whole commit, not just the CDK part.
3. Decide which of these you are looking at, and say which in the PR:
   - **A deliberate contract change.** The commit removed an exemption, added a
     required field, or renamed something, and it updated its own tests and
     `apps/documentation/` to match. The cookbook is stale. Fix the cookbook.
   - **A regression.** The commit changed behaviour with no test and no doc
     change, and the old shape is still documented as supported. Do not paper
     over it in the cookbook. Leave the branch as-is, write up what you found in
     the pull request, and stop.

The tell is usually in the same diff: a deliberate change updates the comment or
doc that promised the old behaviour. A regression leaves that promise in place.

## Fixing a cookbook

- Fix the declaration, not the symptom. If a field became required, work out what
  the correct value is from how the backend uses it, and set that. A value chosen
  only to make the check pass is worse than a red check, because it fails at
  deploy or at runtime instead, where nobody is watching.
- Update every place the old contract was asserted. A cookbook states its
  reasoning in comments, in `README.md` and in `SKILL.md` — including the
  `compatibility` string and the inputs table. A fix that leaves a comment
  explaining why the old shape was correct has not landed.
- Follow the house pattern already in the repo rather than inventing one. Other
  cookbooks under `*/infra/` have almost certainly solved the same problem.
- Keep the resource count in `README.md` honest if you added or removed one.

## Worked precedent

CDK 1.0.81 made `connector` and `languageModel` required on every `defineAgent`,
including harness agents. `call-capture` omitted both, with a comment saying the
harness brings its own model. It does not: Claude Code runs in the sandbox
against Cargo's LLM proxy, so the connector selects the proxy and pays for the
run and the model slug is what usage is metered against. The fix was to add an
adopted `anthropic` connector and a real model slug, and to delete the claim from
the agent comment, `README.md` and `SKILL.md`. The exemption removal was
deliberate — the same commit deleted the doc promising it and added a test.

## Before you push

Run all of these and make them pass:

```sh
npm ci --ignore-scripts
node scripts/check-pipelines.mjs
npm run typecheck
npx prettier --check .
node scripts/generate-llms-txt.ts --check
node scripts/build-catalog.mjs --check
```

`scripts/validate.ts` resolves slugs and prices against `getcargohq/cargo-skills`
and may be red for reasons unrelated to the bump. Run it, but do not try to fix a
failure it reports unless the bump caused it.

## Pushing

- Commit onto the branch named below. Do not rebase or force-push the bump commit
  that is already there; add commits after it.
- Do not change the pins back. Reverting the bump is not a fix.
- Update the pull request body: what changed in the CDK, which cookbooks you
  touched and why, and what you verified. Then mark it ready for review. Leave it
  a draft only if you concluded the CDK regressed.
- Do not merge it.
