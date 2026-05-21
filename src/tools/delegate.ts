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

export interface DelegateArgs {
  instruction: string;
  file_paths?: string[];
  content?: string;
  model?: string;
}

/** The chat-completion signature delegate depends on (a slice of ApertisClient). */
export type ChatFn = ApertisClient["chatCompletion"];

export interface DelegateDeps {
  chat: ChatFn;
  cwd?: string;
  warn?: (msg: string) => void;
}

/**
 * Core delegate logic: validate input, read any local files, build the
 * intern prompt, and run it on the cheap model. Pure enough to unit-test
 * with a mock `chat` — no MCP server or real ApertisClient required.
 */
export async function runDelegate(
  args: DelegateArgs,
  deps: DelegateDeps,
): Promise<string> {
  const cwd = deps.cwd ?? process.cwd();
  const warn =
    deps.warn ?? ((m: string) => console.error(`[Apertis MCP] ${m}`));

  if (!args.instruction || args.instruction.trim() === "") {
    throw new Error("delegate requires a non-empty 'instruction'.");
  }

  const parts: string[] = [`# Instruction\n${args.instruction}`];

  for (const p of args.file_paths ?? []) {
    const abs = resolve(cwd, p);
    const rel = relative(cwd, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      warn(`delegate: file path is outside the working directory: ${p}`);
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

  if (args.content && args.content.trim() !== "") {
    parts.push(`# Content\n${args.content}`);
  }

  return deps.chat(args.model ?? DEFAULT_MODEL, [
    { role: "system", content: INTERN_SYSTEM },
    { role: "user", content: parts.join("\n\n") },
  ]);
}

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
    async (args: z.infer<typeof DelegateInput>) => {
      try {
        const result = await runDelegate(args, {
          chat: client.chatCompletion.bind(client),
        });
        return { content: [{ type: "text" as const, text: result }] };
      } catch (error) {
        return toolError("delegating work", error);
      }
    },
  );
}
