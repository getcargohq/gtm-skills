/**
 * The one way the collectors reach Cargo: its own CLI, which the harness
 * checkout already has, signed in to the workspace the agent belongs to.
 *
 * `cargo-ai` if it is on PATH, otherwise `npx --yes @cargo-ai/cli`. Every
 * command prints progress lines ("Loading...") on stdout before one JSON
 * document, so the LAST non-empty line is the answer. Failures exit non-zero
 * with `{"errorMessage": ...}`, surfaced here as a `CliError` carrying the
 * message rather than a stack trace pointing into a spawn.
 */
import { execFileSync, spawnSync } from "node:child_process";

export class CliError extends Error {}

/**
 * Something about the run's configuration is wrong: no Cargo session, no
 * TheirStack connection, an unknown flag. Separate from every other error so an entry
 * point can print it as a message and exit 1.
 */
export class ConfigError extends Error {}

let resolved: string[] | undefined;

function command(): string[] {
  if (resolved !== undefined) return resolved;
  const probe = spawnSync("cargo-ai", ["--version"], { stdio: "ignore" });
  resolved =
    probe.status === 0 ? ["cargo-ai"] : ["npx", "--yes", "@cargo-ai/cli"];
  return resolved;
}

/** Run one `cargo-ai` command and parse the JSON it ends with. */
export function cargo<T = unknown>(args: string[]): T {
  const [bin, ...prefix] = command();
  let stdout: string;
  try {
    stdout = execFileSync(bin!, [...prefix, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const text = [err.stdout, err.stderr].filter(Boolean).join("\n");
    const message = lastJson(text)?.["errorMessage"];
    throw new CliError(
      typeof message === "string"
        ? message
        : `cargo-ai ${args.slice(0, 3).join(" ")} failed: ${(err.message ?? "").split("\n")[0]}`,
    );
  }
  const parsed = lastJson(stdout);
  if (parsed === undefined) {
    throw new CliError(
      `cargo-ai ${args.slice(0, 3).join(" ")} printed no JSON: ${stdout.slice(-200)}`,
    );
  }
  return parsed as T;
}

function lastJson(text: string): Record<string, unknown> | undefined {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]!;
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return undefined;
}

/** The active workspace, or a ConfigError that says how to get one. */
export function whoami(): { uuid: string; name: string } {
  let answer: { workspace?: { uuid?: string; name?: string } };
  try {
    answer = cargo(["whoami"]);
  } catch (error) {
    throw new ConfigError(
      `no Cargo session in this environment (${(error as Error).message}). ` +
        `Deployed, the harness is signed in to its workspace; by hand, run ` +
        `cargo-ai login first.`,
    );
  }
  const workspace = answer.workspace;
  if (workspace?.uuid === undefined || workspace.name === undefined) {
    throw new ConfigError("cargo-ai whoami returned no workspace");
  }
  return { uuid: workspace.uuid, name: workspace.name };
}

export type Connector = {
  uuid: string;
  slug: string;
  name: string;
  integrationSlug: string;
  isDefault: boolean;
  useCredits: boolean;
};

/** Every connector the workspace holds. */
export function connectors(): Connector[] {
  const answer = cargo<{ connectors?: Connector[] }>([
    "connection",
    "connector",
    "list",
  ]);
  return answer.connectors ?? [];
}

/**
 * Execute one connector action and return its output. `--wait-until-finished`
 * polls the run to a terminal status; the output of a single-node run is
 * `runContext.action`, and an errored run carries its reason there instead.
 */
export function execute<T = unknown>(
  integrationSlug: string,
  actionSlug: string,
  data: Record<string, unknown>,
): T {
  const answer = cargo<{
    run?: { status?: string; executions?: { title?: string }[] };
    runContext?: { action?: unknown };
  }>([
    "orchestration",
    "action",
    "execute",
    "--wait-until-finished",
    // The CLI polls every five seconds by default; a pull is a handful of
    // short calls, so that default would be most of the run time.
    "--polling-interval",
    "1000",
    "--action",
    JSON.stringify({ kind: "connector", integrationSlug, actionSlug }),
    "--data",
    JSON.stringify(data),
  ]);
  if (answer.run?.status !== "success") {
    const detail = JSON.stringify(answer.runContext?.action ?? {}).slice(
      0,
      400,
    );
    throw new CliError(
      `${integrationSlug}.${actionSlug} ended ${answer.run?.status ?? "unknown"}: ${detail}`,
    );
  }
  return answer.runContext?.action as T;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

/** Space out reads: a burst of calls is a 429 storm. */
export const PACE_MS = Number(process.env["CONTEXT_BUILDING_PACE_MS"] ?? "300");

/**
 * Every argument an entry point accepts, checked before anything runs. A flag
 * it does not know is a stop rather than something to ignore: `--dryrun` was a
 * real run, and `--persona x` without the `=` ran every pull, both while
 * looking exactly like the run that was asked for.
 */
export function checkFlags(argv: readonly string[], allowed: string[]): void {
  const unknown = argv.filter(
    (argument) =>
      !allowed.includes(argument) &&
      !allowed.some((flag) => flag.endsWith("=") && argument.startsWith(flag)),
  );
  if (unknown.length > 0) {
    throw new ConfigError(
      `unknown argument(s): ${unknown.join(", ")}\nthis takes ${allowed.join(", ")}.`,
    );
  }
}
