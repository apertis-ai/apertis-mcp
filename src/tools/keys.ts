import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";
import { formatTable } from "../utils/table.js";
import { toolError } from "../utils/error.js";

const ListApiKeysInput = z.object({});

const CreateApiKeyInput = z.object({
  name: z.string().describe("Name for the new API key"),
  quota: z.number().optional().describe("Optional quota limit for the key"),
});

function maskKey(key: string): string {
  if (!key || key.length < 8) return "****";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

export async function registerKeyTools(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerTool(
    "list_api_keys",
    {
      description:
        "List all your API keys with status and quota information (keys are masked for security)",
      inputSchema: ListApiKeysInput,
    },
    async () => {
      try {
        const tokens = await client.getTokens();

        if (tokens.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No API keys found. Create one with create_api_key.",
              },
            ],
          };
        }

        const headers = [
          "Name",
          "Key",
          "Status",
          "Remaining Quota",
          "Created",
          "Last Used",
        ];
        const rows = tokens.map((t) => [
          t.name,
          maskKey(t.key || ""),
          t.status || "active",
          t.remaining_quota ? t.remaining_quota.toLocaleString() : "Unlimited",
          t.created_at ? new Date(t.created_at).toLocaleDateString() : "N/A",
          t.last_used ? new Date(t.last_used).toLocaleDateString() : "Never",
        ]);
        const table = formatTable(headers, rows);
        return {
          content: [
            {
              type: "text",
              text: `Found ${tokens.length} API key(s):\n\n${table}`,
            },
          ],
        };
      } catch (error) {
        return toolError("listing API keys", error);
      }
    },
  );

  server.registerTool(
    "create_api_key",
    {
      description:
        "Create a new API key with optional quota limit. The full key is shown only once.",
      inputSchema: CreateApiKeyInput,
    },
    async ({ name, quota }: z.infer<typeof CreateApiKeyInput>) => {
      try {
        const newToken = await client.createToken(name, quota);
        const info = `
API Key Created Successfully!

Name: ${newToken.name}
Key: ${newToken.key}
Status: ${newToken.status || "active"}
Quota: ${quota ? `${quota.toLocaleString()} tokens` : "Unlimited"}
Created: ${newToken.created_at || new Date().toISOString()}

Save this key now — it won't be shown again!
Use it in your requests with: Authorization: Bearer ${newToken.key}
`.trim();
        return { content: [{ type: "text", text: info }] };
      } catch (error) {
        return toolError("creating API key", error);
      }
    },
  );
}
