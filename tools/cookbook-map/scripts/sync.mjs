// Builds src/cookbooks.json, the only data the map reads: every cookbook on
// origin/main plus every cookbook an open pull request adds or changes.
//
//   npm run sync                    origin/main and open PRs of the canonical clone
//   npm run sync -- --no-prs        skip the pull requests (offline, or gh not signed in)
//
// Reads the git repository this tool lives in (GTM_SKILLS_REPO overrides it).
// Everything comes from git objects, so the working tree and branch you have
// checked out do not matter: the map always shows origin/main plus open PRs.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const repo =
  process.env.GTM_SKILLS_REPO ??
  fileURLToPath(new URL("../../..", import.meta.url));
const withPrs = !process.argv.includes("--no-prs");
const git = (...a) =>
  execFileSync("git", ["-C", repo, ...a], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const tryGit = (...a) => {
  try {
    return git(...a);
  } catch {
    return null;
  }
};

git("fetch", "origin", "main", "--quiet");
const MAIN = "origin/main";
const approvals = JSON.parse(
  tryGit("show", `${MAIN}:.github/data/approvals.json`) ?? "{}",
);

/** A cookbook as it exists at `ref`, or null when `dir` is not a cookbook there. */
function readCookbook(ref, dir) {
  const text = tryGit("show", `${ref}:${dir}/SKILL.md`);
  if (!text) return null;
  const end = text.indexOf("\n---", 3);
  const fm = parseYaml(text.slice(4, end)) ?? {};
  if (fm.metadata?.source !== "cookbook") return null;
  const body = text.slice(end + 4);
  const files = (
    tryGit("ls-tree", "-r", "--name-only", ref, `${dir}/infra`) ?? ""
  )
    .split("\n")
    .filter(Boolean);
  // Only the resource files themselves: infra/<kind>/<file>.ts and infra/<file>.ts.
  // An app's own source tree (infra/apps/inbox/src/...) is not a resource.
  const infra = {};
  for (const f of files) {
    const parts = f.slice(`${dir}/infra/`.length).split("/");
    if (!parts.at(-1).endsWith(".ts") || parts.length > 2) continue;
    const kind = parts.length === 2 ? parts[0] : ".";
    (infra[kind] ??= []).push(parts.at(-1));
  }
  return {
    name: dir,
    job:
      String(fm.description ?? "")
        .split(/\.\s+Triggers:/)[0]
        .replace(/,? powered by Cargo/, "")
        .trim() + ".",
    composesInto: slugs(section(body, "Composes into")),
    infra,
  };
}

function section(body, title) {
  const m = body.match(new RegExp(`^(#{2,3}) ${title}\\s*$`, "m"));
  if (!m) return "";
  const rest = body.slice(m.index + m[0].length);
  const next = rest.search(new RegExp(`^#{1,${m[1].length}} `, "m"));
  return next === -1 ? rest : rest.slice(0, next);
}

const slugs = (s) => [
  ...new Set([...s.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)].map((m) => m[1])),
];

// ── main ────────────────────────────────────────────────────────────────
const cookbooks = new Map();
for (const dir of git("ls-tree", "--name-only", "-d", MAIN).split("\n")) {
  const c = readCookbook(MAIN, dir);
  if (c)
    cookbooks.set(dir, {
      ...c,
      status: "main",
      state: approvals[dir]?.state ?? "to-be-approved",
      reviews: [],
    });
}

// ── open pull requests ──────────────────────────────────────────────────
let prCount = 0;
if (withPrs) {
  const prs = JSON.parse(
    execFileSync(
      "gh",
      [
        "pr",
        "list",
        "--repo",
        "getcargohq/gtm-skills",
        "--state",
        "open",
        "--limit",
        "100",
        "--json",
        "number,title,isDraft,url,author",
      ],
      { encoding: "utf8" },
    ),
  ).sort((a, b) => a.number - b.number);
  for (const pr of prs) {
    const ref = `refs/remotes/origin/pr/${pr.number}`;
    git("fetch", "--quiet", "origin", `+pull/${pr.number}/head:${ref}`);
    const dirs = new Set(
      git("diff", "--name-only", `${MAIN}...${ref}`)
        .split("\n")
        .filter((f) => f.includes("/"))
        .map((f) => f.split("/")[0]),
    );
    const review = {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      isDraft: pr.isDraft,
      author: pr.author?.login,
    };
    for (const dir of dirs) {
      const c = readCookbook(ref, dir);
      if (!c) continue;
      prCount++;
      const existing = cookbooks.get(dir);
      // The lowest-numbered PR that introduces a cookbook owns its card; a
      // stacked PR that carries it along shows up as a further review.
      if (existing) existing.reviews.push(review);
      else
        cookbooks.set(dir, {
          ...c,
          status: "pr",
          state: "in review",
          reviews: [review],
        });
    }
  }
}

const out = {
  source: `${MAIN} @ ${git("rev-parse", "--short", MAIN)}`,
  syncedAt: new Date().toISOString(),
  cookbooks: [...cookbooks.values()],
};
writeFileSync(
  new URL("../src/cookbooks.json", import.meta.url),
  JSON.stringify(out, null, 2) + "\n",
);
const inPr = out.cookbooks.filter((c) => c.status === "pr").length;
console.log(
  `synced ${out.cookbooks.length} cookbooks from ${out.source}: ${out.cookbooks.length - inPr} on main, ${inPr} only in open PRs` +
    (withPrs ? ` (${prCount} PR touches)` : " (PRs skipped)"),
);
