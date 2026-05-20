<!-- ===== Apertis Coworker — routing rules ===== -->
<!-- Paste this block into your project's CLAUDE.md so Claude delegates automatically. -->

## Delegating grunt work to the Apertis Coworker

You have an MCP tool `delegate` backed by a cheap intern model. Use it to keep
your own context small and your Claude usage limit intact. The coworker reads
files itself, so delegated file content never enters your context.

**Delegate when the task is high-volume and low-judgement:**

1. **Bulk file reads** — when you need facts from large files but not the files
   themselves in context:
   `delegate(instruction: "List every exported function name and its line number",
   file_paths: ["src/big-module.ts"])`

2. **Boilerplate generation** — repetitive code/config with no design decisions:
   `delegate(instruction: "Generate a test skeleton with describe/it stubs for
   these 6 exported functions: ...")`

3. **Summarization / extraction** — condensing long output, logs, or docs:
   `delegate(instruction: "Summarize the errors in this build log in <=10 bullets",
   file_paths: ["build.log"])`

**Do NOT delegate** architecture decisions, debugging that needs judgement,
security-sensitive code, or anything where being wrong is expensive. Those are
your job as the senior engineer.

Keep `instruction` specific and ask for concise output — the coworker returns
whatever it produces straight back into your context.
<!-- ===== end Apertis Coworker ===== -->
