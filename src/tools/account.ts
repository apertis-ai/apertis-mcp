import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";
import { toolError } from "../utils/error.js";
import { count, lines, usd, when } from "../utils/format.js";

const CheckQuotaInput = z.object({});

const GetUsageStatsInput = z.object({
  period: z
    .enum(["today", "week", "month"])
    .optional()
    .describe(
      "Accepted for compatibility; the gateway reports all-time totals for this key",
    ),
});

export async function registerAccountTools(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerTool(
    "check_quota",
    {
      description:
        "Check this API key's remaining quota, usage, status, and subscription details",
      inputSchema: CheckQuotaInput,
    },
    async () => {
      try {
        const t = await client.getTokenInfo();
        const key = lines([
          ["Name", t.name],
          ["Status", t.status],
          ["Created", when(t.created_at)],
          ["Last used", when(t.last_used_at)],
          ["Expires", when(t.expired_at)],
        ]);
        const quota = lines([
          [
            "Remaining",
            t.unlimited_quota ? "Unlimited" : usd(t.remain_quota_usd),
          ],
          ["Used", usd(t.used_quota_usd)],
          ["Monthly limit", usd(t.monthly_limit_usd)],
          ["Monthly used", usd(t.monthly_used_usd)],
        ]);
        const sub = t.subscription
          ? lines([
              ["Plan", t.subscription.plan],
              ["Status", t.subscription.status],
              ["Expires", when(t.subscription.expiry)],
            ])
          : [];
        let info = "API Key:\n" + (key.join("\n") || "  (no details)");
        info += "\n\nQuota:\n" + (quota.join("\n") || "  (no details)");
        info += "\n\nSubscription:\n" + (sub.join("\n") || "  None");
        return { content: [{ type: "text", text: info }] };
      } catch (error) {
        return toolError("checking quota", error);
      }
    },
  );

  server.registerTool(
    "get_usage_stats",
    {
      description:
        "Get all-time usage totals (tokens, requests, spend) for this API key",
      inputSchema: GetUsageStatsInput,
    },
    async (_args: z.infer<typeof GetUsageStatsInput>) => {
      try {
        const s = await client.getUsageStats();
        const body = lines([
          ["Key", s.token_name],
          ["Total tokens", count(s.total_tokens)],
          ["Total requests", count(s.total_requests)],
          ["Total spend", usd(s.total_quota_usd, 4)],
          ["Used quota", usd(s.used_quota_usd, 4)],
          ["Remaining quota", usd(s.remain_quota_usd, 4)],
        ]);
        const output =
          "Usage Statistics (all time):\n" +
          (body.join("\n") || "  (no data)");
        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        return toolError("fetching usage stats", error);
      }
    },
  );
}
