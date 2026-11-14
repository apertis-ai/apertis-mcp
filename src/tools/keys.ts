import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";
import { formatTable } from "../utils/table.js";
import { usd, when } from "../utils/format.js";
import { toolError } from "../utils/error.js";

const ListApiKeysInput = z.object({});

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
                text: "No API keys found. Create one in the Apertis dashboard.",
              },
            ],
          };
        }

        const headers = [
          "Name",
          "Key",
          "Status",
          "Remaining",
          "Used",
          "Created",
          "Last Used",
        ];
        const rows = tokens.map((t) => [
          t.name || "(unnamed)",
          t.key || "****",
          t.status || "unknown",
          t.unlimited_quota ? "Unlimited" : usd(t.remain_quota_usd) || "-",
          usd(t.used_quota_usd) || "-",
          when(t.created_at) || "-",
          when(t.last_used_at) || "Never",
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
}
