import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient } from "../client.js";
import { toolError } from "../utils/error.js";

const RecommendModelInput = z.object({
  task: z
    .enum(["coding", "long-context", "fast-chat", "reasoning", "vision"])
    .describe(
      "Task type: 'coding' for code generation/debugging, 'long-context' for large files/codebases (1M+ tokens), 'fast-chat' for Q&A/support, 'reasoning' for math/logic, 'vision' for image understanding",
    ),
  budget: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe(
      "Budget tier: 'low' picks the cheapest valid candidate, 'medium' (default) picks the curated editorial pick, 'high' picks the most capable",
    ),
});

export async function registerRecommendTool(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerTool(
    "recommend_model",
    {
      description:
        "Get the opinionated Apertis model recommendation for a task with live pricing. Prefer this over 'suggest_model' when your task fits one of the 5 task types — it returns a single curated pick plus alternatives with current prices.",
      inputSchema: RecommendModelInput,
    },
    async ({
      task,
      budget = "medium",
    }: z.infer<typeof RecommendModelInput>) => {
      try {
        const rec = await client.getRecommendation(task, budget);

        let output = `Recommended for ${task} (${budget} budget):\n\n`;
        output += `**${rec.model}**\n`;
        output += `Input: $${rec.input_price_per_1m.toFixed(2)}/1M tokens\n`;
        output += `Output: $${rec.output_price_per_1m.toFixed(2)}/1M tokens\n`;
        output += `Why: ${rec.reason}\n`;

        if (rec.alternatives.length > 0) {
          output += `\nAlternatives:\n`;
          rec.alternatives.forEach((alt) => {
            output += `- ${alt.model} ($${alt.input_price_per_1m.toFixed(2)}/1M) — ${alt.note}\n`;
          });
        }

        output += `\nUse '${rec.model}' directly as the model ID in your API calls.`;

        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        return toolError("getting recommendation", error);
      }
    },
  );
}
