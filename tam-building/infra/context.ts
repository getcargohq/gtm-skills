import { defineContext } from "@cargo-ai/cdk";

// The workspace context repository, as code: the git-backed GTM knowledge base
// the tiering agent reads its rubric from. This is what makes "edit the rubric,
// not the prompt" true — `context/tiering-rubric.md` is versioned, reviewable,
// and changes what tier A means on the next run with no deploy.
//
// It is a per-workspace SINGLETON, so exactly one file in a project may call
// defineContext. If the project already has one, move the two markdown files
// under ./context into that directory and delete this file: the agent's
// `context` capability reads whatever the workspace context holds, wherever it
// is declared.
//
// The directory is resolved from THIS file rather than from the project root,
// the same way `defineWorker` and `defineApp` locate their bundles. A relative
// path would be read against the process's working directory, which is
// wherever `plan` was run from, so it would break the moment this folder is
// installed into a project under a different prefix.
export const context = defineContext({
  dir: new URL("./context", import.meta.url).pathname,
});
