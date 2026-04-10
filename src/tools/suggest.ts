import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient, Model } from "../client.js";
import { toolError } from "../utils/error.js";

const SuggestModelInput = z.object({
  task: z
    .string()
    .describe(
      'Description of what you want to do (e.g., "code generation", "translation", "image analysis")',
    ),
  budget: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe(
      "Budget tier: low (<$0.001 per 1M), medium (<$0.01 per 1M), high (any price)",
    ),
});

interface ScoredModel {
  model: Model;
  score: number;
  reasoning: string;
}

export async function registerSuggestTool(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerTool(
    "suggest_model",
    {
      description:
        "Get model recommendations based on your task and budget. Uses cached model catalog.",
      inputSchema: SuggestModelInput,
    },
    async ({ task, budget = "medium" }: z.infer<typeof SuggestModelInput>) => {
      try {
        const models = await client.getModels();
        const taskLower = task.toLowerCase();

        const capabilityKeywords: Record<string, string[]> = {
          coding: [
            "code",
            "programming",
            "debug",
            "write code",
            "refactor",
            "test",
          ],
          translation: [
            "translate",
            "language",
            "multilingual",
            "convert language",
          ],
          image: ["image", "vision", "visual", "picture", "photo", "ocr"],
          math: ["math", "calculate", "equation", "numerical", "calculus"],
          reasoning: [
            "reason",
            "think",
            "logic",
            "analysis",
            "complex",
            "problem solving",
          ],
          cheap: ["cheap", "budget", "fast", "simple", "quick"],
          advanced: [
            "advanced",
            "powerful",
            "state-of-art",
            "sota",
            "best",
            "latest",
          ],
        };

        const scoredModels: ScoredModel[] = models
          .filter((m) => {
            if (!m.pricing?.input_per_million) return false;
            const inputCost = m.pricing.input_per_million;
            if (budget === "low" && inputCost > 0.001) return false;
            if (budget === "medium" && inputCost > 0.01) return false;
            return true;
          })
          .map((m) => {
            let score = 0;
            const reasoning: string[] = [];
            const modelLower =
              `${m.id} ${m.name} ${m.description || ""}`.toLowerCase();

            for (const [capability, keywords] of Object.entries(
              capabilityKeywords,
            )) {
              const matches = keywords.filter(
                (k) => modelLower.includes(k) || taskLower.includes(k),
              );
              if (matches.length > 0) {
                if (taskLower.includes(capability)) {
                  score += matches.length * 3;
                  reasoning.push(`Strong ${capability} match`);
                } else if (modelLower.includes(capability)) {
                  score += matches.length;
                  reasoning.push(`Has ${capability} capabilities`);
                }
              }
            }

            if (
              (taskLower.includes("long") || taskLower.includes("document")) &&
              m.context_window &&
              m.context_window > 100000
            ) {
              score += 2;
              reasoning.push("Excellent context window");
            }

            if (taskLower.includes("bulk") || taskLower.includes("many")) {
              const inputCost = m.pricing?.input_per_million || 0;
              score += (0.01 - inputCost) * 100;
              reasoning.push("Cost-effective for bulk operations");
            }

            if ((budget === "low" || taskLower.includes("free")) && m.is_free) {
              score += 5;
              reasoning.push("Free tier available");
            }

            return {
              model: m,
              score,
              reasoning:
                reasoning.length > 0
                  ? reasoning.join(", ")
                  : "Matches your criteria",
            };
          })
          .sort((a, b) => b.score - a.score);

        if (scoredModels.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No models found matching "${task}" with budget tier "${budget}". Try a higher budget tier or more general task description.`,
              },
            ],
          };
        }

        const topRecommendations = scoredModels.slice(0, 3);
        let output = `Top Recommendations for: "${task}" (${budget} budget)\n\n`;

        topRecommendations.forEach((rec, i) => {
          const m = rec.model;
          output += `${i + 1}. **${m.name || m.id}** (${m.provider})
   ID: ${m.id}
   Input: $${m.pricing?.input_per_million?.toFixed(6) || "N/A"}/1M tokens
   Output: $${m.pricing?.output_per_million?.toFixed(6) || "N/A"}/1M tokens
   Context: ${m.context_window ? `${(m.context_window / 1000).toFixed(0)}K tokens` : "N/A"}
   Why: ${rec.reasoning}
   Free: ${m.is_free ? "Yes" : "No"}

`;
        });

        output += `Use 'get_model_info' to see full details for any model.`;
        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        return toolError("suggesting models", error);
      }
    },
  );
}
