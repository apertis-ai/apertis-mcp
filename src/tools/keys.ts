import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";
import { formatTable } from "../utils/table.js";
import { usd, when } from "../utils/format.js";
import { toolError } from "../utils/error.js";

const ListApiKeysInput = z.object({});

/**
 * The gateway already masks the key (a short prefix plus "..."). If it ever
 * returns anything longer, cut it here so a full key is never printed.
 */
export function maskKey(key: string | undefined): string {
  if (!key) return "****";
  if (key.length <= 12 && key.endsWith("...")) return key;
  return `${key.slice(0, 8)}...`;
}

export async function registerKeyTools(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerTool(
    "list_api_keys",
    {
      description:
        "Show the API key this server is using: name, masked key, status and quota. The gateway reports only the calling key, never the account's other keys",
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
                text: "The gateway returned no key details. API keys are created and listed in the Apertis dashboard.",
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
          maskKey(t.key),
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
              text: `This API key:\n\n${table}`,
            },
          ],
        };
      } catch (error) {
        return toolError("listing API keys", error);
      }
    },
  );
}
