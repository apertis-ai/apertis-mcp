#!/usr/bin/env node

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { getConfig } from "./config.js";
import { ApertisClient } from "./client.js";
import { registerModelTools } from "./tools/models.js";
import { registerAccountTools } from "./tools/account.js";
import { registerKeyTools } from "./tools/keys.js";
import { registerSuggestTool } from "./tools/suggest.js";
import { registerRecommendTool } from "./tools/recommend.js";
import { registerAccountResource } from "./resources/account.js";
import { registerModelsResource } from "./resources/models.js";
import { registerUsageResource } from "./resources/usage.js";

async function main() {
  try {
    // Get configuration
    const config = getConfig();

    // Create MCP server
    const server = new McpServer(
      { name: "apertis", version: "0.3.0" },
      {
        instructions:
          "Apertis MCP Server for managing your AI API Gateway. Use check_quota before suggesting model switches. All tools are available for querying models, account info, usage stats, and API keys.",
      },
    );

    // Initialize client
    const client = new ApertisClient(config.apiKey, config.baseUrl);

    console.error("[Apertis MCP] Initializing server...");

    // Register all tools
    await registerModelTools(client, server);
    console.error("[Apertis MCP] Registered model tools");

    await registerAccountTools(client, server);
    console.error("[Apertis MCP] Registered account tools");

    await registerKeyTools(client, server);
    console.error("[Apertis MCP] Registered key tools");

    await registerSuggestTool(client, server);
    console.error("[Apertis MCP] Registered suggest tool");

    await registerRecommendTool(client, server);
    console.error("[Apertis MCP] Registered recommend tool");

    // Register all resources
    await registerAccountResource(client, server);
    console.error("[Apertis MCP] Registered account resource");

    await registerModelsResource(client, server);
    console.error("[Apertis MCP] Registered models resource");

    await registerUsageResource(client, server);
    console.error("[Apertis MCP] Registered usage resource");

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("[Apertis MCP] Server running on stdio");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Apertis MCP] Fatal error: ${message}`);
    process.exit(1);
  }
}

main();
