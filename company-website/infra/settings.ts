/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// PLACEHOLDER: adapt website.json from the authenticated workspace, the fork's
// git origin and its default branch. Select an available Anthropic model.
// Keep publish false until the brief, preview and publication are approved.
export const settings: {
  version: number;
  workspaceUuid: string;
  repository: string;
  defaultBranch: string;
  appSlug: string;
  publish: boolean;
  maintainer: boolean;
  languageModel: string;
} = JSON.parse(
  readFileSync(new URL("./website.json", import.meta.url), "utf8"),
);

export const appPath = fileURLToPath(
  new URL("./apps/website", import.meta.url),
);
