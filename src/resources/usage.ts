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
        const stats = await client.getUsageStats();

        const data = {
          ...stats,
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
