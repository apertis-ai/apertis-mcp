# Apertis MCP Server — Quick Start Guide

## 1-Minute Setup

### For Claude Code Users

1. Get your Apertis API key from https://apertis.ai/settings/keys
2. Add this to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "apertis": {
      "command": "apertis-mcp",
      "env": {
        "APERTIS_API_KEY": "sk-your-actual-key-here"
      }
    }
  }
}
```

3. Restart Claude Code
4. Start asking: "What models are available?" or "Check my quota"

### For OpenClaw Users

1. Get your Apertis API key
2. Add this to `openclaw.json`:

```json
{
  "mcpServers": {
    "apertis": {
      "command": "apertis-mcp",
      "env": {
        "APERTIS_API_KEY": "sk-your-actual-key-here"
      }
    }
  }
}
```

3. Restart OpenClaw
4. Ask away!

### For Local Development

```bash
git clone https://github.com/yourusername/apertis-mcp.git
cd apertis-mcp
npm install
export APERTIS_API_KEY="sk-your-actual-key-here"
npm run dev
```

## Available Commands

### Model Discovery
```
"list models that are free"
"show me models for coding"
"compare gpt-4o and claude-opus"
"what's the best model for translation with a tight budget?"
```

### Account Management
```
"check my remaining quota"
"how much have I spent this month?"
"what's my subscription status?"
```

### API Key Management
```
"list my API keys"
"create a new API key for my app"
"show me all my keys"
```

### Smart Recommendations
```
"suggest a model for image analysis"
"recommend a cheap model for text classification"
"what's best for math problems?"
```

### Detailed Info
```
"tell me about gpt-4o pricing"
"compare 5 different vision models"
"what's the context window for claude-opus?"
```

## What It Does

This MCP server connects your AI agent to your Apertis account. You can:

- **Browse Models**: List 500+ models from 30+ providers with live pricing
- **Check Balance**: See your account balance and subscription status instantly
- **Manage Keys**: Create and list API keys without leaving the chat
- **Get Stats**: Check daily, weekly, or monthly usage by model
- **Smart Suggestions**: Get AI-powered model recommendations based on your task and budget

## Pricing Display

All prices are shown in **USD per 1M tokens** (standard unit):

```
Input: $0.003 per 1M tokens
Output: $0.015 per 1M tokens
```

This means:
- 1 million input tokens = $0.003
- 1 million output tokens = $0.015

## Security Notes

✅ **Your API key is secure**
- Stored locally in settings.json (you control the file)
- Never transmitted to Claude or our servers
- Only used for requests to Apertis API

✅ **Keys are masked in output**
- When listing keys, you see: `sk-ab...xyzt` (first 4 + last 4)
- Full key only shown once when creating

✅ **No data collection**
- This server only talks to Apertis API
- Conversations with Claude are separate

## Troubleshooting

### "APERTIS_API_KEY environment variable is required"
Make sure you've set the API key in your settings.json or `.env` file.

### "Failed to fetch models"
Check that:
- Your API key is valid (starts with `sk-`)
- You have internet connection
- Apertis API is reachable (api.apertis.ai)

### "Bearer token authentication failed"
Your API key may be invalid or revoked. Generate a new one at https://apertis.ai/settings/keys

## Next Steps

1. **Explore models**: "list all free models"
2. **Check your account**: "check my quota"
3. **Get a recommendation**: "suggest a model for coding with low budget"
4. **Dive deeper**: "compare the top 3 coding models"

## Documentation

- **Full README**: See `README.md` for detailed API documentation
- **Build Details**: See `BUILD_SUMMARY.md` for technical architecture
- **Source Code**: Everything is in `src/` — well-commented and type-safe

## Support

Questions or issues? Visit https://apertis.ai/docs or create an issue on GitHub.

Enjoy exploring the Apertis ecosystem!
