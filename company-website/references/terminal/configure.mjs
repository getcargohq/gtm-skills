// Run from a newly scaffolded consumer project, never the distribution root.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const project = process.cwd();
const configFile = "infra/company-website/website.json";
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const save = (file, value) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const gh = (args, input) =>
  execFileSync("gh", args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  });
const required = (name) => {
  if (!process.env[name]?.trim()) throw new Error(`Set ${name}.`);
  return process.env[name].trim();
};
const doc = (title, description, body) =>
  `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n${body}\n`;

async function sdk() {
  const require = createRequire(resolve(project, "package.json"));
  return import(pathToFileURL(require.resolve("@cargo-ai/cdk/cli")).href);
}

async function main() {
  if (!existsSync(configFile))
    throw new Error("Run from the installed company's Manifest project root.");
  const command = process.argv[2];
  const config = read(configFile);
  if (command === "prepare") {
    if (config.workspaceUuid || config.repository || config.publish)
      throw new Error(
        "prepare is only for a fresh, unconfigured installation. Preserve existing company configuration and release rules.",
      );
    if (existsSync("company-website-setup.json"))
      throw new Error(
        "Setup already prepared. Continue in this project; do not scaffold or replace its state.",
      );
    const repository = required("WEBSITE_REPOSITORY");
    const workspaceUuid = required("WEBSITE_WORKSPACE_UUID");
    const company = required("WEBSITE_COMPANY");
    const audience = required("WEBSITE_AUDIENCE");
    const offering = required("WEBSITE_OFFERING");
    const goal = required("WEBSITE_GOAL");
    const cta = required("WEBSITE_CTA");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
      throw new Error("Repository must be owner/name.");
    if (!/^[0-9a-f-]{36}$/i.test(workspaceUuid))
      throw new Error("Invalid workspace UUID.");
    if (!/^(https:\/\/|mailto:)/.test(cta))
      throw new Error("CTA must be HTTPS or mailto:.");
    const date = new Date().toISOString().slice(0, 10);
    const sourceRepo = process.env.WEBSITE_SOURCE_REPOSITORY || "Not supplied";
    const sourceUrl = process.env.WEBSITE_SOURCE_URL || "Not supplied";
    const mode = process.env.WEBSITE_MODE || "new website";
    const owner = process.env.WEBSITE_OWNER || repository.split("/")[0];
    save(configFile, {
      ...config,
      workspaceUuid,
      repository,
      defaultBranch: "main",
      appSlug: `website-${workspaceUuid.slice(0, 8)}`,
      publish: false,
      maintainer: process.env.WEBSITE_MAINTAINER === "yes",
      visitors: {
        enabled: process.env.WEBSITE_VISITORS === "yes",
        siteUrl:
          process.env.WEBSITE_VISITORS === "yes"
            ? required("WEBSITE_VISITOR_URL")
            : "",
        connectorUuid: "",
        snitcherWorkspaceUuid: "",
      },
    });
    const ts = read("tsconfig.json");
    ts.exclude = [
      ...new Set([
        ...(ts.exclude ?? []),
        "infra/company-website/apps/website/**",
      ]),
    ];
    save("tsconfig.json", ts);
    writeFileSync(".nvmrc", "22.23.2\n");
    writeFileSync(
      ".gitignore",
      readFileSync(".gitignore", "utf8") +
        "\n# Local builds and Cargo state working files, never the committed pointer.\ndist/\n*.tsbuildinfo\ncargo.state.cache.json\ncargo.state.lock\ncargo.state.bak.json\ncargo.state.audit.jsonl\n",
    );

    // Vendor documentation has its own style. Company prose remains checked.
    const lintFile = "scripts/ci/check-copy.ts";
    const lint = readFileSync(lintFile, "utf8");
    const anchor = ".filter((f) => !SKIP.has(f) && !BINARY_EXT.test(f));";
    if (!lint.includes(anchor))
      throw new Error(
        "Manifest copy linter changed; review its vendor exclusion before continuing.",
      );
    writeFileSync(
      lintFile,
      lint.replace(
        anchor,
        ".filter((f) => !/^\\.agents\\/skills\\/cargo(?:-[^/]+)?\\//.test(f))\n  " +
          anchor,
      ),
    );
    for (const file of ["cargo-plan.yml", "cargo-deploy.yml"]) {
      copyFileSync(new URL(file, import.meta.url), `.github/workflows/${file}`);
    }
    // Replace the fresh template's duplicate/stale checks with cargo-plan.yml.
    for (const file of ["lint.yml", "typecheck.yml"])
      rmSync(`.github/workflows/${file}`, { force: true });
    const agents = readFileSync("AGENTS.md", "utf8");
    const workflowStart = agents.indexOf("## Workflow");
    const workflowEnd = agents.indexOf("## Rules", workflowStart);
    if (workflowStart < 0 || workflowEnd < 0)
      throw new Error(
        "Manifest AGENTS.md changed; reconcile the release policy before continuing.",
      );
    writeFileSync(
      "AGENTS.md",
      agents.slice(0, workflowStart) +
        `## Workflow\n\n1. Work on a branch. Run npm run lint, npm run typecheck and the company website helper's check before a PR.\n2. Review the diff and run the helper's plan against the configured workspace. PR checks run without deployment credentials.\n3. The operator merges reviewed changes, then explicitly dispatches cargo-deploy.yml for the full reviewed main SHA. Merging alone does not publish. Never deploy production locally.\n4. Keep cargo.state.json generated by Cargo. The hosted maintainer must not merge, publish, edit CI/state, or change workspace bindings.\n\n` +
        agents.slice(workflowEnd) +
        "\n## Company website setup\n\nRead context/global/company.md and context/global/website-brief.md for the operator's facts. Remaining ACME-marked template history is fictional and is not company evidence. The brief and design require review before building or publishing.\n",
    );
    mkdirSync("context/global", { recursive: true });
    writeFileSync(
      "context/global/company.md",
      doc(
        company,
        "Company facts supplied by the operator during setup.",
        `Recorded: ${date}\n\nAudience: ${audience}\n\nOffering: ${offering}\n\nWebsite goal: ${goal}\n\nPrimary CTA destination: ${cta}\n\nProof, customer names, prices and performance claims have not been supplied. Do not invent them.`,
      ),
    );
    writeFileSync(
      "context/global/website-brief.md",
      doc(
        "Website brief",
        "Initial operator inputs; the detailed brief and design are awaiting review.",
        `Recorded: ${date}\n\nMode: ${mode}\n\nSource repository: ${sourceRepo}\n\nSource website: ${sourceUrl}\n\nGoal: ${goal}\n\nAudience: ${audience}\n\nPrimary CTA: ${cta}\n\nRequired pages, branding, source reuse authorization, form backend and design direction: resolve before implementation. Prefer the supplied repository for recreation. Record its license and commit. Capture sourced design tokens and components in context/global/design.md. No publication is approved by this initial brief.`,
      ),
    );
    writeFileSync(
      "plan/company-plan.md",
      doc(
        "Company website plan",
        "The first outcome for this new project.",
        `Goal: ${goal}\n\nOwner: ${owner}\n\nStarted: ${date}\n\nScope: prepare and review the company website brief, design system and source implementation.`,
      ),
    );
    writeFileSync(
      "plan/strategy.md",
      doc(
        "Website strategy",
        "How this project serves the initial website goal.",
        `Audience: ${audience}\n\nOffering: ${offering}\n\nUse confirmed company context and the approved design. Deliver the website through reviewed pull requests and an explicit CI release.`,
      ),
    );
    writeFileSync(
      "plan/outcomes.md",
      doc(
        "Website outcomes",
        "Observable completion criteria for the first website.",
        `## O1. Reviewed company website\n\n- Owner: ${owner}\n- Measure: approved brief and design, passing desktop/mobile QA, working primary CTA, and verified public deployment.\n- Becomes: infra/company-website/resources.ts (the public app and any explicitly selected visitor models).\n- Release date: to be agreed before publication.`,
      ),
    );
    const log = `cadence/log/${date}.md`;
    if (!existsSync(log))
      writeFileSync(
        log,
        doc(
          "Website setup",
          "Initial focus for the new project.",
          `Date: ${date}\n\nCurrent priority: review the company website brief and design. The ACME examples predate this project and are fictional.`,
        ),
      );
    const out = `outputs/${date}-company-website-setup`;
    mkdirSync(out, { recursive: true });
    writeFileSync(
      `${out}/README.md`,
      `---\ntitle: Company website setup\ndescription: Installation provenance and initial scope.\noutcome: "none: project prepared; no website or hosted maintainer outcome verified yet"\n---\n\nRepository: https://github.com/${repository}\n\nWorkspace: https://app.getcargo.io/workspaces/${workspaceUuid}\n\nPipeline revision: ${process.env.WEBSITE_PIPELINE_REVISION || "local checkout"}\n\nCompany brief: context/global/website-brief.md\n\nPublication starts disabled. Record subsequent tests and releases in new output entries.\n`,
    );
    save("company-website-setup.json", {
      version: 1,
      date,
      repository,
      workspaceUuid,
      pipelineRevision:
        process.env.WEBSITE_PIPELINE_REVISION || "local checkout",
    });
    console.log(
      "Prepared company context, workspace binding, checks and manual CI release.",
    );
  } else if (command === "connect") {
    const { getApi } = await sdk();
    const identity = JSON.parse(
      execFileSync("node_modules/.bin/cargo-ai", ["whoami"], {
        encoding: "utf8",
      }),
    );
    if (identity.workspace.uuid !== config.workspaceUuid)
      throw new Error("Cargo login does not match the project's workspace.");
    if (config.visitors?.enabled && !config.visitors.connectorUuid) {
      const api = getApi();
      const { connectors } = await api.connection.connector.list({
        integrationSlug: "snitcher",
      });
      const defaults = connectors.filter((c) => c.isDefault);
      if (defaults.length > 1 || (!defaults.length && connectors.length > 1))
        throw new Error(
          "Choose the Cargo-managed Snitcher connector in website.json before continuing.",
        );
      const selected = defaults[0] ?? connectors[0];
      if (selected) {
        const schema = await api.connection.connector.getDynamicSchema({
          connectorUuid: selected.uuid,
          slug: "getUrl",
          params: {},
        });
        if (schema.uiSchema?.["ui:widget"] === "hidden")
          throw new Error(
            "Existing Snitcher connector uses BYO credentials. Select a Cargo-managed connector instead.",
          );
        config.visitors.connectorUuid = selected.uuid;
        save(configFile, config);
        console.log(
          `Reusing Cargo-managed Snitcher connector ${selected.uuid}.`,
        );
      }
      execFileSync(
        "node",
        ["scripts/company-website/visitors.mjs", "inspect"],
        { stdio: "inherit" },
      );
      console.log(
        "Review visitor usage pricing and disclosure before the first data-model release.",
      );
    }
    if (!config.maintainer) {
      console.log(
        "Local harness mode: no Cargo GitHub or model connector required.",
      );
      return;
    }
    if (process.env.WEBSITE_GITHUB_TOKEN) {
      execFileSync("gh", ["api", `repos/${config.repository}`], {
        env: { ...process.env, GH_TOKEN: process.env.WEBSITE_GITHUB_TOKEN },
        stdio: ["ignore", "ignore", "pipe"],
      });
    }
    const api = getApi();
    async function connector(integrationSlug, token) {
      const { connectors } = await api.connection.connector.list({
        integrationSlug,
      });
      const defaults = connectors.filter((c) => c.isDefault);
      if (defaults.length > 1 || (!defaults.length && connectors.length > 1))
        throw new Error(
          `Select one default ${integrationSlug} connector before continuing.`,
        );
      let selected = defaults[0] ?? connectors[0];
      if (!selected) {
        if (integrationSlug === "github" && !token)
          throw new Error(
            "Set WEBSITE_GITHUB_TOKEN to the maintainer's GitHub token.",
          );
        const result = await api.connection.connector.create({
          name: `Company website ${integrationSlug}`,
          slug: `company_website_${integrationSlug}`,
          integrationSlug,
          ...(token
            ? {
                config: {
                  apiKey: {
                    type: "encryption",
                    isEncrypted: false,
                    value: token,
                  },
                },
              }
            : {}),
        });
        selected = result.connector;
      }
      if (!selected.isDefault)
        await api.connection.connector.update({
          uuid: selected.uuid,
          isDefault: true,
        });
      console.log(`Using ${integrationSlug} connector ${selected.uuid}.`);
      return selected;
    }
    await connector("github", process.env.WEBSITE_GITHUB_TOKEN);
    const anthropic = await connector(
      "anthropic",
      process.env.WEBSITE_ANTHROPIC_API_KEY,
    );
    const { languageModels } = await api.connection.connector.getLanguageModels(
      { connectorUuid: anthropic.uuid },
    );
    const compatible = languageModels.filter((m) =>
      m.harnesses?.includes("claudeCode"),
    );
    const selected = process.env.WEBSITE_MODEL
      ? compatible.find((m) => m.slug === process.env.WEBSITE_MODEL)
      : (compatible.find((m) => /sonnet/i.test(m.slug)) ?? compatible[0]);
    if (!selected)
      throw new Error(
        "No requested Claude Code model is available. Inspect the Anthropic connector's model list and set WEBSITE_MODEL.",
      );
    save(configFile, { ...config, languageModel: selected.slug });
    console.log(
      JSON.stringify(
        {
          model: selected.slug,
          pricing: selected.credits ?? "Consult your Anthropic billing",
          workspaceUrl: `https://app.getcargo.io/workspaces/${config.workspaceUuid}`,
        },
        null,
        2,
      ),
    );
  } else if (command === "ci-token") {
    const { getApi } = await sdk();
    const api = getApi();
    const name = `company-website-ci:${config.repository}`;
    const identity = JSON.parse(
      execFileSync("node_modules/.bin/cargo-ai", ["whoami"], {
        encoding: "utf8",
      }),
    );
    if (identity.workspace.uuid !== config.workspaceUuid)
      throw new Error("Cargo login does not match the project's workspace.");
    const { tokens } = await api.workspaceManagement.token.all();
    let token = tokens.find((t) => t.name === name && !t.deletedAt);
    if (!token)
      ({ token } = await api.workspaceManagement.token.create({
        name,
        description: "Manual company website release in GitHub Actions",
        permissions: null,
      }));
    if (!token.token)
      throw new Error(
        "Existing CI token value is unavailable. Rotate it deliberately; do not create duplicates.",
      );
    gh(
      ["secret", "set", "CARGO_API_TOKEN", "--repo", config.repository],
      token.token,
    );
    console.log(
      `Saved CARGO_API_TOKEN to ${config.repository}; token UUID ${token.uuid}. No token value was printed.`,
    );
  } else throw new Error("Usage: node configure.mjs prepare|connect|ci-token");
}

try {
  await main();
} catch (error) {
  // SDK errors may contain request headers/config. Never print the raw object.
  console.error(error instanceof Error ? error.message : "Setup failed.");
  process.exitCode = 1;
}
