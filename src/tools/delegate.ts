import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { ApertisClient } from "../client.js";
import { toolError } from "../utils/error.js";

const DEFAULT_MODEL = process.env.APERTIS_COWORKER_MODEL || "deepseek-v4-flash";

const INTERN_SYSTEM =
  "You are a coworker model handling delegated grunt work for a senior engineer. " +
  "Follow the instruction exactly and return only the concise result. " +
  "Do not add preamble, restate the task, or pad the output.";

const DelegateInput = z.object({
  instruction: z
    .string()
    .describe("What the intern model should do with the files/content."),
  file_paths: z
    .array(z.string())
    .optional()
    .describe(
      "Local file paths the coworker reads itself; their content never enters your context.",
    ),
  content: z.string().optional().describe("Inline content to process."),
  model: z
    .string()
    .optional()
    .describe("Override the intern model (default: deepseek-v4-flash)."),
});

export async function registerDelegateTool(
  client: ApertisClient,
  server: McpServer,
) {
  server.registerTool(
    "delegate",
    {
      description:
        "Delegate bulk or grunt work — bulk file reads, boilerplate generation, " +
        "summarization — to a cheap intern model via the Apertis gateway. " +
        "Files named in file_paths are read by the coworker itself, so their bulk " +
        "content never enters your context; only the concise result is returned. " +
        "Keeps your Claude usage limit intact for the work that needs your judgement.",
      inputSchema: DelegateInput,
    },
    async ({
      instruction,
      file_paths,
      content,
      model,
    }: z.infer<typeof DelegateInput>) => {
      try {
        if (!instruction || instruction.trim() === "") {
          throw new Error("delegate requires a non-empty 'instruction'.");
        }

        const cwd = process.cwd();
        const parts: string[] = [`# Instruction\n${instruction}`];

        for (const p of file_paths ?? []) {
          const abs = resolve(cwd, p);
          const rel = relative(cwd, abs);
          if (rel.startsWith("..") || isAbsolute(rel)) {
            console.error(
              `[Apertis MCP] delegate: file path is outside the working directory: ${p}`,
            );
          }
          let fileContent: string;
          try {
            fileContent = await readFile(abs, "utf8");
          } catch (e) {
            throw new Error(
              `delegate: cannot read file '${p}': ${(e as Error).message}`,
            );
          }
          parts.push(`# File: ${p}\n${fileContent}`);
        }

        if (content && content.trim() !== "") {
          parts.push(`# Content\n${content}`);
        }

        const result = await client.chatCompletion(model ?? DEFAULT_MODEL, [
          { role: "system", content: INTERN_SYSTEM },
          { role: "user", content: parts.join("\n\n") },
        ]);

        return { content: [{ type: "text" as const, text: result }] };
      } catch (error) {
        return toolError("delegating work", error);
      }
    },
  );
}
