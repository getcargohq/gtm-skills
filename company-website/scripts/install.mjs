#!/usr/bin/env node
import {
  copyFileSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// For a checked-out fork or unmerged branch. The registry's `cdk add` fetches
// upstream main; this copies the reviewed local folder with the same layout.
// No shell files, state or credentials are distributed by this pipeline.
export function filesToInstall(source) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        ["node_modules", "dist", ".git", ".DS_Store"].includes(entry.name) ||
        entry.name.startsWith(".env") ||
        entry.name.endsWith(".tsbuildinfo") ||
        entry.name === "cargo.state.json"
      )
        continue;
      const file = join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Pipeline sources must not contain symlinks.");
      if (entry.isDirectory()) walk(file);
      else files.push(file);
    }
  }
  walk(source);
  return files.flatMap((file) => {
    const path = relative(source, file);
    const [root, ...rest] = path.split(/[\\/]/);
    const targets = ["infra", "scripts"].includes(root)
      ? [join(root, "company-website", ...rest)]
      : [".claude/skills", ".agents/skills"].map((dir) =>
          join(dir, "company-website", path),
        );
    return targets.map((target) => ({ source: file, target }));
  });
}

export function install(source, project) {
  project = realpathSync(project);
  if (
    !existsSync(join(project, "package.json")) ||
    !existsSync(join(project, "infra"))
  )
    throw new Error(
      "Initialize a separate Manifest project before installing this pipeline.",
    );
  const planned = filesToInstall(source);
  for (const file of planned) {
    let parent = join(project, file.target);
    while (!existsSync(parent)) parent = dirname(parent);
    const resolved = realpathSync(parent);
    const path = relative(project, resolved);
    if (
      path === ".." ||
      path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
      isAbsolute(path)
    )
      throw new Error(
        "Install destination escapes the project through a symlink.",
      );
    if (
      existsSync(join(project, file.target)) &&
      !lstatSync(join(project, file.target)).isFile()
    )
      throw new Error("Install destination is not a regular file.");
  }
  const written = [],
    skipped = [];
  for (const file of planned) {
    const target = join(project, file.target);
    if (existsSync(target)) {
      skipped.push(file.target);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file.source, target, constants.COPYFILE_EXCL);
    written.push(file.target);
  }
  return { written, skipped, remoteChanges: false };
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values } = parseArgs({ options: { project: { type: "string" } } });
    if (!values.project)
      throw new Error(
        "Usage from your gtm-skills fork: node company-website/scripts/install.mjs --project /absolute/path/to/manifest",
      );
    console.log(
      JSON.stringify(
        install(
          fileURLToPath(new URL("../", import.meta.url)),
          resolve(values.project),
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
