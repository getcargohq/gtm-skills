import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { statePath, writeStatePointer } from "@cargo-ai/cdk/deploy";
import { install, filesToInstall } from "../scripts/install.mjs";
import { assertStateBound, inspectLive, readConfig, repositoryFromOrigin, verifyConnectors, verifyIdentity, verifyPublic } from "../scripts/lifecycle.mjs";
import { assertReady, assertUploadable, escapeHtml, sourceHash } from "../infra/apps/website/build-support.mjs";

// Compare our pre-merge/fork installer with the real installed CDK algorithm.
// This internal API belongs only in the distribution's executable contract.
const { planFiles } = await import(new URL("./cli/commands/add.js", import.meta.resolve("@cargo-ai/cdk")));
const source = fileURLToPath(new URL("../", import.meta.url));
const repo = fileURLToPath(new URL("../../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "company-website-contract-"));
const project = join(temp, "company-project");
const infra = join(project, "infra/company-website");
const app = join(infra, "apps/website");
const configFile = join(infra, "website.json");
const uuid = "11111111-1111-4111-8111-111111111111";
let passed = 0;
function test(name, fn) {
  return Promise.resolve().then(fn).then(() => { passed++; console.log(`ok ${passed}: ${name}`); });
}
function json(file) { return JSON.parse(readFileSync(file, "utf8")); }
function save(file, value) { writeFileSync(file, JSON.stringify(value, null, 2) + "\n"); }
function git(args) { return execFileSync("git", args, { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
function check() {
  try { return JSON.parse(execFileSync(join(repo, "node_modules/.bin/cargo-cdk"), ["check", "--dir", join(project, "infra"), "--json"], { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })); }
  catch (error) { if (error.stdout) return JSON.parse(error.stdout); throw error; }
}
function validGraph(result) { assert.deepEqual(result.loadErrors, []); assert.deepEqual(result.compile.errors, []); }

try {
  mkdirSync(join(project, "infra"), { recursive: true });
  save(join(project, "package.json"), { name: "website-fixture", private: true, type: "module", dependencies: { "@cargo-ai/cdk": "*" } });
  git(["init", "-q"]);
  git(["remote", "add", "origin", "https://github.com/fixture-owner/company-project.git"]);
  git(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
  symlinkSync(resolve(repo, "node_modules"), join(project, "node_modules"), "dir");

  await test("fork installer matches Cargo's actual placement and ships no state", () => {
    const ours = filesToInstall(source).map(f => f.target).sort();
    const cargo = planFiles(source, "company-website").map(f => f.target).sort();
    assert.deepEqual(ours, cargo);
    assert.ok(ours.includes("infra/company-website/apps/website/package-lock.json"));
    assert.ok(ours.includes("scripts/company-website/package.json"));
    assert.ok(ours.includes(".agents/skills/company-website/SKILL.md"));
    assert.ok(!ours.some(f => /cargo\.state|(^|\/)\.env/.test(f)));
    const rootPackage = readFileSync(join(project, "package.json"), "utf8");
    assert.equal(install(source, project).written.length, ours.length);
    assert.equal(readFileSync(join(project, "package.json"), "utf8"), rootPackage);
  });

  await test("installed CDK loads the maintainer and adopts connectors without loading app or scripts", () => {
    const graph = check();
    validGraph(graph);
    assert.equal(graph.nodes.length, 4);
    const agent = graph.nodes.find(n => n.kind === "agent");
    assert.equal(agent.spec.repository.repository, "fixture-owner/company-project");
    assert.equal(agent.spec.repository.rootDirectory, ".");
    assert.equal(agent.spec.harnessSlug, "claudeCode");
    assert.deepEqual(agent.spec.triggers, []);
    assert.deepEqual(agent.spec.repository.env ?? {}, {});
    assert.ok(graph.nodes.filter(n => n.kind === "connector").every(n => n.spec.adopt === true));
    assert.ok(!graph.nodes.some(n => n.kind === "app"));
  });

  const config = { ...readConfig(infra), workspaceUuid: uuid, repository: "fixture-owner/company-project", appSlug: "fixture-website" };
  save(configFile, config);
  await test("repeat install preserves configured fork, edited content and existing state bytes", () => {
    const content = json(join(app, "site.json"));
    content.companyName = "Fixture company";
    save(join(app, "site.json"), content);
    const stateFile = join(project, "infra/cargo.state.json");
    // Synthetic offline fixture, never a real Cargo state binding.
    const stateBytes = JSON.stringify({ version: 1, workspaceUuid: uuid, resources: {} }) + "\n";
    writeFileSync(stateFile, stateBytes);
    const result = install(source, project);
    assert.deepEqual(result.written, []);
    assert.equal(json(join(app, "site.json")).companyName, "Fixture company");
    assert.deepEqual(json(configFile), config);
    assert.equal(readFileSync(stateFile, "utf8"), stateBytes);
    assert.equal(assertStateBound(project, join(project, "infra")), stateFile);
  });

  await test("workspace and consuming-fork mismatches fail, including a wrong GitHub origin", () => {
    assert.equal(repositoryFromOrigin("git@github.com:fixture-owner/company-project.git"), config.repository);
    assert.equal(repositoryFromOrigin("https://github.com/fixture-owner/company-project.git"), config.repository);
    assert.throws(() => repositoryFromOrigin("https://github.com.evil.invalid/owner/repo"));
    verifyIdentity(config, { workspace: { uuid } }, config.repository);
    assert.throws(() => verifyIdentity(config, { workspace: { uuid: "other-workspace" } }, config.repository), /workspaceUuid/);
    assert.throws(() => verifyIdentity(config, { workspace: { uuid } }, "upstream/distribution"), /consuming fork/);
    const connectors = ["github", "anthropic"].map(integrationSlug => ({ integrationSlug, isDefault: true, workspaceUuid: uuid }));
    verifyConnectors(config, { connectors });
    assert.throws(() => verifyConnectors(config, { connectors: connectors.slice(0, 1) }), /anthropic/);
    assert.throws(() => verifyConnectors(config, { connectors: connectors.map(c => ({ ...c, workspaceUuid: "other" })) }), /github/);
    assert.throws(() => verifyConnectors(config, { connectors: connectors.map(c => ({ ...c, isDefault: false, default: true })) }), /github/);
  });

  await test("installer CLI also runs through an absolute symlink and preserves the existing installation", () => {
    const entry = join(temp, "install-entry.mjs");
    symlinkSync(join(source, "scripts/install.mjs"), entry);
    const result = JSON.parse(execFileSync(process.execPath, [entry, "--project", project], { encoding: "utf8" }));
    assert.deepEqual(result.written, []);
    assert.ok(result.skipped.length > 0);
    assert.equal(result.remoteChanges, false);
  });

  await test("missing committed state requires recovery and is never silently recreated", () => {
    const file = join(project, "infra/cargo.state.json");
    git(["add", "-f", "infra/cargo.state.json"]);
    git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Synthetic state fixture"]);
    rmSync(file);
    assert.throws(() => assertStateBound(project, join(project, "infra")), /committed state pointer is missing/);
    assert.equal(existsSync(file), false);
  });

  await test("fresh Manifest uses the actual CDK root pointer and a missing root cannot fall back to legacy state", () => {
    const fresh = join(temp, "fresh-manifest");
    const freshInfra = join(fresh, "infra");
    mkdirSync(freshInfra, { recursive: true });
    execFileSync("git", ["init", "-q"], { cwd: fresh });
    writeFileSync(join(freshInfra, "context.ts"), 'import { defineContext } from "@cargo-ai/cdk";\n');
    writeStatePointer(freshInfra, uuid);
    const rootPointer = join(fresh, "cargo.state.json");
    assert.equal(statePath(freshInfra), rootPointer);
    assert.equal(assertStateBound(fresh, freshInfra), rootPointer);
    assert.deepEqual(json(rootPointer), { stateUuid: uuid });
    execFileSync("git", ["add", "cargo.state.json"], { cwd: fresh });
    execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Synthetic root pointer"], { cwd: fresh });
    rmSync(rootPointer);
    save(join(freshInfra, "cargo.state.json"), { stateUuid: "other" });
    assert.throws(() => assertStateBound(fresh, freshInfra), /committed state pointer is missing/);
  });

  await test("enabling publication with distributed draft content fails the real CDK load", () => {
    save(configFile, { ...config, publish: true });
    const result = check();
    assert.ok(result.loadErrors.some(e => /reviewed site.json|draft company content/.test(e.message)));
    assert.ok(!result.nodes.some(n => n.kind === "app"));
    const content = json(join(app, "site.json"));
    assert.throws(() => assertReady({ ...content, status: "ready" }), /draft company content/);
  });

  let publishedGraph;
  await test("ready app is public, self-contained, foldered and targets the consuming repository", () => {
    const site = json(join(app, "site.json"));
    save(join(app, "site.json"), { ...site, status: "ready", companyName: "Fixture company", headline: "A shared checklist", description: "One checklist for the operations team.", cta: { label: "Contact", href: "mailto:team@fixture.test" } });
    publishedGraph = check();
    validGraph(publishedGraph);
    const node = publishedGraph.nodes.find(n => n.kind === "app");
    assert.equal(node.id, "app:fixture-website");
    assert.equal(realpathSync(node.spec.path), realpathSync(app));
    assert.ok(existsSync(join(node.spec.path, "package-lock.json")));
    assert.deepEqual(node.spec.env, {});
    assert.equal(node.spec.folderUuid.resourceId, "folder:company-website-apps");
    assert.equal(publishedGraph.nodes.find(n => n.kind === "agent").spec.repository.repository, config.repository);
  });

  await test("content updates change the app hash while preserving resource IDs and update existing state", () => {
    const before = publishedGraph.nodes.find(n => n.kind === "app");
    const content = json(join(app, "site.json"));
    const changed = { ...content, headline: "The improved shared checklist" };
    save(join(app, "site.json"), changed);
    const next = check();
    validGraph(next);
    assert.deepEqual(next.nodes.map(n => n.id).sort(), publishedGraph.nodes.map(n => n.id).sort());
    assert.notEqual(next.nodes.find(n => n.id === before.id).spec.contentHash, before.spec.contentHash);
    const state = { version: 1, workspaceUuid: uuid, resources: Object.fromEntries(publishedGraph.compile.plan.map(entry => [entry.id, { uuid, hash: entry.hash, spec: publishedGraph.nodes.find(n => n.id === entry.id).spec }])) };
    save(join(project, "infra/cargo.state.json"), state);
    const plan = check();
    validGraph(plan);
    assert.equal(plan.compile.plan.find(e => e.id === before.id).change, "update");
    assert.ok(plan.compile.plan.filter(e => e.id !== before.id).every(e => e.change === "noop"));
  });

  await test("website-only mode removes unused agent dependencies from a fresh graph", () => {
    rmSync(join(project, "infra/cargo.state.json"));
    save(configFile, { ...config, publish: true, maintainer: false });
    const graph = check();
    validGraph(graph);
    assert.deepEqual(graph.nodes.map(n => n.kind).sort(), ["app", "folder"]);
  });

  await test("source marker ignores outputs and local secrets; changed source changes identity", () => {
    const first = sourceHash(app);
    mkdirSync(join(app, "dist"), { recursive: true });
    writeFileSync(join(app, "dist/generated.txt"), "output");
    writeFileSync(join(app, ".env.local"), "SYNTHETIC_TEST_ONLY=ignored");
    assert.equal(sourceHash(app), first);
    writeFileSync(join(app, "src/extra.css"), ":root { color-scheme: light; }");
    assert.notEqual(sourceHash(app), first);
    assert.equal(escapeHtml('<script a="b">&'), "&lt;script a=&quot;b&quot;&gt;&amp;");
  });

  await test("real Cargo transport corrupts raw binary assets and the release guard blocks them", async () => {
    const { readBundle } = await import(new URL("./resources/bundle.js", import.meta.resolve("@cargo-ai/cdk")));
    const transported = join(temp, "transported-starter");
    for (const file of readBundle(join(source, "infra/apps/website"))) {
      const target = join(transported, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content, "utf8");
    }
    assert.equal(sourceHash(transported), sourceHash(join(source, "infra/apps/website")));
    const assets = join(temp, "transport-fixture");
    mkdirSync(assets);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=", "base64");
    const file = join(assets, "logo.png");
    writeFileSync(file, png);
    const uploaded = readBundle(assets).find(f => f.path === "logo.png");
    assert.equal(png.equals(Buffer.from(uploaded.content, "utf8")), false);
    assert.throws(() => assertUploadable(assets), /text upload cannot preserve logo.png/);
    rmSync(file);
    writeFileSync(join(assets, "logo.ts"), `export default "data:image/png;base64,${png.toString("base64")}";`);
    assertUploadable(assets);
    writeFileSync(join(assets, ".env.local"), "SYNTHETIC_TEST_ONLY=never-upload");
    assert.throws(() => assertUploadable(assets), /app-local .env/);
  });

  await test("live checks reject wrong workspace, duplicate apps and failed/unpromoted deployments", () => {
    const liveApp = { uuid: "app-id", slug: config.appSlug, workspaceUuid: uuid, url: "https://fixture.cargo.app" };
    const deployment = { uuid: "deploy-id", appUuid: "app-id", status: "success", promotedAt: "2026-09-16T00:00:00Z" };
    const cargo = (apps, dep) => args => args[1] === "app" ? { apps } : { deployment: dep };
    assert.equal(inspectLive(config, cargo([liveApp], deployment)).deploymentUuid, "deploy-id");
    assert.throws(() => inspectLive(config, cargo([{ ...liveApp, workspaceUuid: "other" }], deployment)));
    assert.throws(() => inspectLive(config, cargo([liveApp, liveApp], deployment)));
    assert.throws(() => inspectLive(config, cargo([liveApp], { ...deployment, status: "failed" })));
    assert.throws(() => inspectLive(config, cargo([liveApp], { ...deployment, promotedAt: null })));
    assert.throws(() => inspectLive(config, cargo([liveApp], { ...deployment, appUuid: "other" })));
  });

  await test("anonymous verification rejects non-HTML, missing and stale markers", async () => {
    const live = { url: "https://fixture.cargo.app" };
    const request = (html, marker) => async (url, options) => {
      assert.equal(options.redirect, "error");
      assert.equal(options.headers, undefined);
      return String(url).includes("website-build.json") ? marker.clone() : html.clone();
    };
    const html = new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
    const marker = Response.json({ version: 1, sourceSha256: "current" });
    assert.equal((await verifyPublic(live, "current", request(html, marker))).sourceMatch, true);
    await assert.rejects(verifyPublic(live, "current", request(new Response("denied", { status: 401 }), marker)));
    await assert.rejects(verifyPublic(live, "current", request(html, new Response("missing", { status: 404 }))));
    await assert.rejects(verifyPublic(live, "changed", request(html, marker)), /does not match/);
  });
  console.log(`Passed ${passed} company-website contract checks (offline; no Cargo writes).`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
