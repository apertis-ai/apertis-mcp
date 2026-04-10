import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";

export async function registerAccountResource(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerResource(
    "apertis://account",
    "apertis://account",
    {},
    async (uri: URL) => {
      try {
        const user = await client.getUserSelf();

        const data = {
          id: user.id,
          email: user.email,
          name: user.name,
          balance: user.balance,
          subscription: {
            plan: user.subscription_plan,
            status: user.subscription_status,
            expiry: user.subscription_expiry,
          },
          retrieved_at: new Date().toISOString(),
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(data, null, 2),
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
            },
          ],
        };
      }
    },
  );
}
