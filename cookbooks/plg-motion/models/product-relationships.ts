import { defineRelationship } from "@cargo-ai/cdk";

import { productEvents } from "./product-events";
import { productWorkspaces } from "./product-workspaces";

// One workspace has many product events. This is what lets the PQL segment/play
// count a workspace's events via an `occurrence` condition. Joined on the shared
// `workspace_id` key on both sides.
export const productWorkspaceEvents = defineRelationship(
  "product-workspace-events",
  {
    from: {
      model: productWorkspaces,
      column: productWorkspaces.columns.workspace_id,
    },
    to: { model: productEvents, column: productEvents.columns.workspace_id },
    relation: "oneToMany",
  },
);
