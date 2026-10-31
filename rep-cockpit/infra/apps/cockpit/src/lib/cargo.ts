import type { Api, Orchestration } from "@cargo-ai/api";

// The three ways this app talks to Cargo: SQL to read, a tool run to do
// something that takes steps, and a native record write for a single click.

const toMappings = (
  values: Record<string, unknown>,
): { columnSlug: string; value: unknown }[] => {
  return Object.entries(values).map(([columnSlug, value]) => ({
    columnSlug,
    value,
  }));
};

export const sql = async <T>(api: Api, query: string): Promise<T[]> => {
  const result = await api.storage.query.execute({ query });
  return result.rows as T[];
};

// A value inside a SQL string literal. The only values interpolated are
// domains and emails, but a quote in either must never end the literal.
export const quote = (value: string): string => {
  return `'${value.replace(/'/g, "''")}'`;
};

const pause = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const startTool = async (
  api: Api,
  toolUuid: string,
  data: Record<string, unknown>,
): Promise<string> => {
  const action: Orchestration.Action = { kind: "tool", toolUuid };
  const { run } = await api.orchestration.action.execute({ action, data });
  return run.uuid;
};

// Polls a run until it ends. A failed run throws its own error message, which
// for a refused send is the reason (recipientSuppressed, dailyLimitReached…).
// With `stepSlug`, it returns once that step succeeds: a send is done when the
// message is out, and the writes that follow it finish on their own.
export const waitForRun = async (
  api: Api,
  runUuid: string,
  attempts: number,
  stepSlug?: string,
): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { run } = await api.orchestration.run.get(runUuid);
    if (run.status === "success") {
      return;
    }
    if (run.status === "error" || run.status === "cancelled") {
      if (run.errorMessage === null) {
        throw new Error(run.status);
      }
      throw new Error(run.errorMessage);
    }
    if (stepSlug !== undefined && hasStepSucceeded(run.executions, stepSlug)) {
      return;
    }
    await pause(2000);
  }
  throw new Error("Still running: check again in a minute.");
};

// Node slugs carry a suffix when a step appears twice (sendEmail_2).
const hasStepSucceeded = (
  executions: { nodeSlug: string; status: string }[],
  stepSlug: string,
): boolean => {
  return executions.some(
    (execution) =>
      execution.nodeSlug.startsWith(stepSlug) && execution.status === "success",
  );
};

// One row written by the native modelUpsert action. Submitted, not awaited:
// a native write takes seconds to a minute, and the UI already shows the click.
export const submitUpsert = async (
  api: Api,
  modelUuid: string,
  matchingColumnSlug: string,
  matchingValue: string,
  values: Record<string, unknown>,
): Promise<void> => {
  const action: Orchestration.Action = {
    kind: "native",
    actionSlug: "modelUpsert",
  };
  await api.orchestration.action.execute({
    action,
    data: {
      modelUuid,
      matchingColumnSlug,
      matchingValue,
      mappings: toMappings(values),
    },
  });
};

// One new row, by the native modelInsert action, submitted like an upsert.
export const submitInsert = async (
  api: Api,
  modelUuid: string,
  values: Record<string, unknown>,
): Promise<void> => {
  const action: Orchestration.Action = {
    kind: "native",
    actionSlug: "modelInsert",
  };
  await api.orchestration.action.execute({
    action,
    data: { modelUuid, mappings: toMappings(values) },
  });
};
