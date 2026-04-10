import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";

export async function registerUsageResource(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerResource(
    "apertis://usage/today",
    "apertis://usage/today",
    {},
    async (uri: URL) => {
      try {
        const stats = await client.getUsageStats("today");

        const data = {
          period: "today",
          summary: {
            total_tokens: stats.total_tokens,
            total_cost: stats.total_cost,
          },
          by_model: stats.models,
          daily: stats.daily_breakdown,
          retrieved_at: new Date().toISOString(),
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(data, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: message }, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      }
    },
  );
}
