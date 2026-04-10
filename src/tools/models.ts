import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { ApertisClient, Model } from "../client.js";
import { formatTable } from "../utils/table.js";
import { toolError } from "../utils/error.js";

const ListModelsInput = z.object({
  filter: z
    .object({
      free_only: z.boolean().optional(),
      capability: z.string().optional(),
    })
    .optional(),
});

const GetModelInfoInput = z.object({
  model_id: z.string().describe("The model ID to fetch"),
});

const CompareModelsInput = z.object({
  models: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2-5 model IDs to compare"),
});

function formatModelTable(models: Model[]): string {
  if (models.length === 0) return "No models found.";
  const headers = [
    "Model ID",
    "Name",
    "Provider",
    "Context",
    "Input $/1M",
    "Output $/1M",
  ];
  const rows = models.map((m) => [
    m.id,
    m.name || m.id,
    m.provider || "N/A",
    m.context_window ? `${m.context_window.toLocaleString()}` : "N/A",
    m.pricing?.input_per_million?.toFixed(4) || "N/A",
    m.pricing?.output_per_million?.toFixed(4) || "N/A",
  ]);
  return formatTable(headers, rows);
}

export async function registerModelTools(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerTool(
    "list_models",
    {
      description:
        "List all available models with optional filtering by free/paid or capability",
      inputSchema: ListModelsInput,
    },
    async ({ filter }: z.infer<typeof ListModelsInput>) => {
      try {
        const models = await client.getModels();
        let filtered = models;
        if (filter?.free_only) {
          filtered = filtered.filter((m) => m.is_free === true);
        }
        if (filter?.capability) {
          const cap = filter.capability.toLowerCase();
          filtered = filtered.filter(
            (m) =>
              m.capabilities?.some((c) => c.toLowerCase().includes(cap)) ||
              m.name.toLowerCase().includes(cap) ||
              m.id.toLowerCase().includes(cap),
          );
        }
        const table = formatModelTable(filtered);
        return {
          content: [
            {
              type: "text",
              text: `Found ${filtered.length} models:\n\n${table}`,
            },
          ],
        };
      } catch (error) {
        return toolError("listing models", error);
      }
    },
  );

  server.registerTool(
    "get_model_info",
    {
      description:
        "Get detailed information about a specific model including pricing, context window, and provider",
      inputSchema: GetModelInfoInput,
    },
    async ({ model_id }: z.infer<typeof GetModelInfoInput>) => {
      try {
        const model = await client.getModelInfo(model_id);
        const info = `
Model: ${model.name || model.id}
ID: ${model.id}
Provider: ${model.provider || "Unknown"}
Description: ${model.description || "N/A"}

Pricing:
  Input: $${model.pricing?.input_per_million?.toFixed(6) || "N/A"} per 1M tokens
  Output: $${model.pricing?.output_per_million?.toFixed(6) || "N/A"} per 1M tokens
  Cache Read: $${model.pricing?.cache_read_per_million?.toFixed(6) || "N/A"} per 1M tokens
  Cache Write: $${model.pricing?.cache_write_per_million?.toFixed(6) || "N/A"} per 1M tokens

Context Window: ${model.context_window ? model.context_window.toLocaleString() + " tokens" : "N/A"}
Free Tier: ${model.is_free ? "Yes" : "No"}
Group: ${model.group || "N/A"}
Capabilities: ${model.capabilities?.join(", ") || "N/A"}
`.trim();
        return { content: [{ type: "text", text: info }] };
      } catch (error) {
        return toolError("fetching model info", error);
      }
    },
  );

  server.registerTool(
    "compare_models",
    {
      description:
        "Compare 2-5 models side by side for pricing, context, and capabilities",
      inputSchema: CompareModelsInput,
    },
    async ({ models }: z.infer<typeof CompareModelsInput>) => {
      try {
        const allModels = await client.getModels();
        const modelData = models
          .map((id) => allModels.find((m) => m.id === id))
          .filter((m): m is Model => m !== undefined);

        if (modelData.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `None of the requested models were found: ${models.join(", ")}`,
              },
            ],
          };
        }

        const headers = [
          "Model",
          "Provider",
          "Context",
          "Input $/1M",
          "Output $/1M",
          "Free?",
        ];
        const rows = modelData.map((m) => [
          m.name || m.id,
          m.provider || "N/A",
          m.context_window ? `${m.context_window / 1000}K` : "N/A",
          m.pricing?.input_per_million?.toFixed(4) || "N/A",
          m.pricing?.output_per_million?.toFixed(4) || "N/A",
          m.is_free ? "Yes" : "No",
        ]);
        const table = formatTable(headers, rows);
        return { content: [{ type: "text", text: table }] };
      } catch (error) {
        return toolError("comparing models", error);
      }
    },
  );
}
