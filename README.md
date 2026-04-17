# Apertis MCP Server

An MCP server for managing your Apertis AI API Gateway account. Query models, check quota, manage API keys, and get intelligent model recommendations — all from Claude Code, OpenClaw, or any MCP-compatible AI agent.

## Quick Start

### Installation

```bash
npm install @apertis/mcp-server
```

### Environment Setup

Set your Apertis API key:

```bash
export APERTIS_API_KEY="sk-..."
export APERTIS_BASE_URL="https://api.apertis.ai"  # Optional, defaults to api.apertis.ai
```

### Running

```bash
apertis-mcp
```

Or with npm:

```bash
npx @apertis/mcp-server
```

## Claude Code Integration

Add this to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "apertis": {
      "command": "npx",
      "args": ["@apertis/mcp-server"],
      "env": {
        "APERTIS_API_KEY": "sk-your-key-here"
      }
    }
  }
}
```

## OpenClaw Integration

Add this to your `openclaw.json`:

```json
{
  "mcpServers": {
    "apertis": {
      "command": "npx",
      "args": ["@apertis/mcp-server"],
      "env": {
        "APERTIS_API_KEY": "sk-your-key-here"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_models` | List all available models with optional filtering (free/paid, capability) |
| `get_model_info` | Get detailed info about a specific model (pricing, context, provider) |
| `compare_models` | Side-by-side comparison of 2-5 models |
| `check_quota` | Check your account balance, subscription status, and remaining quota |
| `get_usage_stats` | Get usage statistics by model and time period (today/week/month) |
| `list_api_keys` | List all your API keys with status and quota (keys are masked) |
| `create_api_key` | Create a new API key with optional quota limit |
| `suggest_model` | Freeform keyword-based model search over the full catalog |
| `recommend_model` | Get the curated Apertis pick for a task type (`coding`, `long-context`, `fast-chat`, `reasoning`, `vision`) with live pricing |

## Available Resources

| Resource | Description |
|----------|-------------|
| `apertis://account` | Current account info, balance, and subscription status |
| `apertis://models` | Full catalog of available models (cached 5 min) |
| `apertis://usage/today` | Today's usage summary by model |

## Examples

### Check Your Quota

```
Claude: check my remaining quota
MCP: Use the check_quota tool
→ Shows your account balance, subscription plan, and quota
```

### Find a Model for Your Task

```
Claude: what model should I use for coding on a tight budget?
MCP: Use recommend_model with task="coding" and budget="low"
→ Returns the curated pick (e.g. deepseek-v3) with live pricing and alternatives
```

For freeform keyword search over the full catalog (e.g. "something good at translation"), use `suggest_model` instead.

### Compare Models

```
Claude: compare gpt-4o and claude-opus-4
MCP: Use compare_models with models=["gpt-4o", "claude-opus-4"]
→ Side-by-side pricing, context window, and capability comparison
```

### Check Usage

```
Claude: how much have I used this week?
MCP: Use get_usage_stats with period="week"
→ Shows total tokens/cost and breakdown by model
```

### Manage API Keys

```
Claude: list my API keys
MCP: Use list_api_keys
→ Shows all keys with status and quota (masked for security)

Claude: create a new API key called "my-app" with 1M token quota
MCP: Use create_api_key with name="my-app" and quota=1000000
→ Shows the new key once (save it immediately!)
```

## Environment Variables

- `APERTIS_API_KEY` (required): Your Apertis API key (starts with `sk-`)
- `APERTIS_BASE_URL` (optional): API base URL, defaults to `https://api.apertis.ai`

## Security Notes

- All API keys in tool output are masked (first 4 + last 4 characters)
- When creating a new key, the full key is shown only once — save it immediately
- The MCP server requires your API key in the environment — keep it secure
- Use Claude Code environment variable expansion for credentials

## Pricing Information

All pricing is displayed in USD per 1M tokens (standard unit). The server shows:

- Input token price (cost per 1M input tokens)
- Output token price (cost per 1M output tokens)
- Optional cache read/write pricing (for supported models)

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development
npm run dev
```

## License

MIT
