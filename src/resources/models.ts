import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";

export async function registerModelsResource(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerResource(
    "apertis://models",
    "apertis://models",
    {},
    async (uri: URL) => {
      try {
        const models = await client.getModels();

        const data = {
          total: models.length,
          retrieved_at: new Date().toISOString(),
          models: models.map((m) => ({
            id: m.id,
            name: m.name,
            provider: m.provider,
            pricing: m.pricing,
            context_window: m.context_window,
            is_free: m.is_free,
            capabilities: m.capabilities,
          })),
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
