import { useCargoApi } from "@cargo-ai/app-sdk";
import { useQuery } from "@tanstack/react-query";

import {
  buildBoard,
  DATASET,
  type Engagement,
  MODELS,
  PAGE,
  SELECT,
  toEngagement,
  WHERE,
} from "./score";

export * from "./score";

type Api = ReturnType<typeof useCargoApi>;

async function rows(
  api: Api,
  query: string,
): Promise<Record<string, unknown>[]> {
  const result = await api.storage.query.execute({ query });
  return result.rows;
}

async function loadModel(
  api: Api,
  model: string,
  now: Date,
  warnings: string[],
): Promise<Engagement[]> {
  const [countRow] = await rows(
    api,
    `SELECT COUNT(*) AS n FROM ${DATASET}.${model} WHERE ${WHERE}`,
  );
  const expected = Number(countRow !== undefined ? countRow.n : 0);
  const fetched: Record<string, unknown>[] = [];
  for (let offset = 0; offset < expected; offset += PAGE) {
    fetched.push(
      ...(await rows(
        api,
        `SELECT ${SELECT} FROM ${DATASET}.${model} WHERE ${WHERE} ORDER BY _id LIMIT ${PAGE} OFFSET ${offset}`,
      )),
    );
  }
  if (fetched.length !== expected) {
    warnings.push(
      `${model}: expected ${expected} rows, loaded ${fetched.length}. The board is incomplete.`,
    );
  }
  const events: Engagement[] = [];
  let unknownAuthor = 0;
  for (const row of fetched) {
    const event = toEngagement(row, now);
    if (event === undefined) unknownAuthor += 1;
    else events.push(event);
  }
  if (unknownAuthor > 0) {
    warnings.push(
      `${model}: ${unknownAuthor} rows engage with a profile this board does not know. Add it to AUTHORS in config.ts.`,
    );
  }
  return events;
}

export function useBoard() {
  const api = useCargoApi();
  return useQuery({
    queryKey: ["engagement-board"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const now = new Date();
      const warnings: string[] = [];
      const perModel = await Promise.all(
        MODELS.map((model) => loadModel(api, model, now, warnings)),
      );
      return buildBoard(perModel.flat(), now, warnings);
    },
  });
}
