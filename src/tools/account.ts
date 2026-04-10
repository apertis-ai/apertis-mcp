import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";
import { formatTable } from "../utils/table.js";
import { toolError } from "../utils/error.js";

const CheckQuotaInput = z.object({});

const GetUsageStatsInput = z.object({
  period: z
    .enum(["today", "week", "month"])
    .optional()
    .describe("Time period for usage stats"),
});

export async function registerAccountTools(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerTool(
    "check_quota",
    {
      description:
        "Check your account balance, remaining quota, subscription status, and plan details",
      inputSchema: CheckQuotaInput,
    },
    async () => {
      try {
        const user = await client.getUserSelf();
        const info = `
Account Information:
  Email: ${user.email}
  Name: ${user.name || "N/A"}

Balance & Quota:
  Balance: $${user.balance?.toFixed(2) || "N/A"}

Subscription:
  Plan: ${user.subscription_plan || "None"}
  Status: ${user.subscription_status || "N/A"}
  Expires: ${user.subscription_expiry || "N/A"}
`.trim();
        return { content: [{ type: "text", text: info }] };
      } catch (error) {
        return toolError("checking quota", error);
      }
    },
  );

  server.registerTool(
    "get_usage_stats",
    {
      description: "Get usage statistics by model and time period",
      inputSchema: GetUsageStatsInput,
    },
    async ({ period = "today" }: z.infer<typeof GetUsageStatsInput>) => {
      try {
        const stats = await client.getUsageStats(period);
        let output = `Usage Statistics (${period.toUpperCase()})\n`;

        if (
          stats.total_tokens !== undefined ||
          stats.total_cost !== undefined
        ) {
          output += `\nSummary:
  Total Tokens: ${stats.total_tokens?.toLocaleString() || "N/A"}
  Total Cost: $${stats.total_cost?.toFixed(2) || "N/A"}
`;
        }

        if (stats.models && stats.models.length > 0) {
          output += "\nBy Model:\n";
          const rows = stats.models.map((m) => [
            m.model,
            m.tokens.toLocaleString(),
            `$${m.cost.toFixed(4)}`,
          ]);
          output += formatTable(["Model", "Tokens", "Cost"], rows);
        }

        if (stats.daily_breakdown && stats.daily_breakdown.length > 0) {
          output += "\n\nDaily Breakdown:\n";
          const rows = stats.daily_breakdown.map((d) => [
            d.date,
            d.tokens.toLocaleString(),
            `$${d.cost.toFixed(4)}`,
          ]);
          output += formatTable(["Date", "Tokens", "Cost"], rows);
        }

        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        return toolError("fetching usage stats", error);
      }
    },
  );
}
