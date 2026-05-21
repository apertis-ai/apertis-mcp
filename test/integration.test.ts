import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "dist", "index.js");

interface JsonRpcMessage {
  id?: number;
  result?: { tools?: { name: string }[] } & Record<string, unknown>;
}

test("MCP handshake lists delegate and tools/call round-trips through Apertis", async () => {
  // Mock the Apertis /v1/chat/completions endpoint.
  const mock = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: "INTERN_RESULT_OK" } }],
        }),
      );
    });
  });
  mock.listen(0);
  await once(mock, "listening");
  const port = (mock.address() as { port: number }).port;

  const proc = spawn("node", [serverPath], {
    env: {
      ...process.env,
      APERTIS_API_KEY: "test-key",
      APERTIS_BASE_URL: `http://localhost:${port}`,
    },
  });
  let out = "";
  proc.stdout.on("data", (d) => (out += d.toString()));

  const send = (m: unknown) => proc.stdin.write(JSON.stringify(m) + "\n");

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "integration-test", version: "0" },
    },
  });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  await new Promise((r) => setTimeout(r, 400));
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  await new Promise((r) => setTimeout(r, 400));
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "delegate", arguments: { instruction: "do something" } },
  });
  await new Promise((r) => setTimeout(r, 700));

  proc.kill();
  mock.close();

  const msgs: JsonRpcMessage[] = out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const toolsList = msgs.find((m) => m.id === 2);
  const toolCall = msgs.find((m) => m.id === 3);

  assert.ok(
    toolsList?.result?.tools?.some((t) => t.name === "delegate"),
    "tools/list should expose the delegate tool",
  );
  assert.match(
    JSON.stringify(toolCall?.result),
    /INTERN_RESULT_OK/,
    "tools/call delegate should return the intern model result",
  );
});
