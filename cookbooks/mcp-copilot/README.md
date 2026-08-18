# MCP copilot

Expose your GTM stack to any AI assistant as tools, behind a single MCP endpoint.

## What it does

- Bundles what the other cookbooks built — the research tool and agent,
  enrichment lookups, and the base models — into one MCP server.
- Gives you a single endpoint that Claude Code, Cursor, claude.ai, or any MCP
  client can connect to.
- Defines almost nothing new: you build capabilities once as CDK resources, and
  this makes them portable to every AI assistant.

## How it works

1. **Bundle the capabilities.** `gtm-copilot` gathers existing resources into one
   `uses` array: the research tool and agent, the `enrichContact` and
   `verifyEmail` actions, and the accounts/contacts models (read-only).
2. **Deploy the server.** `defineMcpServer` publishes them behind a single MCP
   endpoint.
3. **Any client connects.** Claude Code, Cursor, claude.ai, or any MCP client
   points at the endpoint and can call all of those tools.

Adds 1 resource (`defineMcpServer`) and requires the `research-agent` cookbook
(keep both folders in the project root).

| File         | Resource          | Role                                |
| ------------ | ----------------- | ----------------------------------- |
| `mcp/gtm.ts` | `defineMcpServer` | one `uses` array → one MCP endpoint |

## Placeholders

None of its own — it inherits `research-agent`'s and `base-gtm`'s (context
files, LLM connector); the enrichment actions run on Cargo credits.

## Done when

Deploy, grab the server's endpoint from the workspace's MCP servers page, and
add it to an MCP client (e.g. `claude mcp add`). The client lists the tools
above; asking it to "brief me on attio.com" calls `account-brief` and returns a
brief grounded in your context files, and the models are queryable read-only.

## Composes into

The AE copilot story for DevRel demos, and the tool surface the rep cockpit
(#11) and AI SDR (#10) will reuse.
