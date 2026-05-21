import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDelegate, type ChatFn } from "../src/tools/delegate.ts";

test("runDelegate rejects an empty instruction", async () => {
  await assert.rejects(
    () =>
      runDelegate(
        { instruction: "   " },
        { chat: (async () => "x") as ChatFn },
      ),
    /instruction/,
  );
});

test("runDelegate uses the default model and forwards the instruction", async () => {
  let seenModel = "";
  let seenMessages: { role: string; content: string }[] = [];
  const chat: ChatFn = async (model, messages) => {
    seenModel = model;
    seenMessages = messages;
    return "done";
  };
  const out = await runDelegate({ instruction: "summarize X" }, { chat });
  assert.equal(out, "done");
  assert.equal(seenModel, "deepseek-v4-flash");
  assert.match(seenMessages[1].content, /summarize X/);
});

test("runDelegate honors the model override", async () => {
  let seenModel = "";
  const chat: ChatFn = async (model) => {
    seenModel = model;
    return "ok";
  };
  await runDelegate({ instruction: "x", model: "kimi-k2" }, { chat });
  assert.equal(seenModel, "kimi-k2");
});

test("runDelegate reads file_paths into the prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coworker-"));
  try {
    await writeFile(join(dir, "a.txt"), "FILE_BODY_123");
    let seen: { role: string; content: string }[] = [];
    const chat: ChatFn = async (_m, messages) => {
      seen = messages;
      return "r";
    };
    await runDelegate(
      { instruction: "read it", file_paths: ["a.txt"] },
      { chat, cwd: dir },
    );
    assert.match(seen[1].content, /FILE_BODY_123/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runDelegate throws on an unreadable file path", async () => {
  await assert.rejects(
    () =>
      runDelegate(
        { instruction: "x", file_paths: ["definitely-missing.txt"] },
        { chat: (async () => "x") as ChatFn },
      ),
    /cannot read file/,
  );
});

test("runDelegate warns on a file path outside the working directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coworker-"));
  try {
    await writeFile(join(dir, "a.txt"), "BODY");
    const warnings: string[] = [];
    const chat: ChatFn = async () => "r";
    await runDelegate(
      { instruction: "x", file_paths: [join(dir, "a.txt")] },
      { chat, cwd: process.cwd(), warn: (m) => warnings.push(m) },
    );
    assert.ok(warnings.some((w) => /outside the working directory/.test(w)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runDelegate injects inline content", async () => {
  let seen: { role: string; content: string }[] = [];
  const chat: ChatFn = async (_m, messages) => {
    seen = messages;
    return "r";
  };
  await runDelegate({ instruction: "x", content: "INLINE_ABC" }, { chat });
  assert.match(seen[1].content, /INLINE_ABC/);
});
