#!/usr/bin/env node
// Clean-install smoke test: pack this package, install the tarball into an
// empty directory (no lockfile, empty npm cache), start the installed bin and
// check that tools/list answers over stdio. Fails if the bin cannot start.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "apertis-mcp-smoke-"));
const cache = join(tmp, "npm-cache");
const packDir = join(tmp, "pack");
const installDir = join(tmp, "install");
let child;

function cleanup() {
  if (child && child.exitCode === null) child.kill("SIGKILL");
  rmSync(tmp, { recursive: true, force: true });
}

function fail(msg) {
  console.error(`SMOKE FAIL: ${msg}`);
  cleanup();
  process.exit(1);
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: cache },
  });
  if (r.status !== 0) {
    fail(`${cmd} ${args.join(" ")} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout;
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => fail(`interrupted by ${sig}`));
}

try {
  if (!process.env.SMOKE_SKIP_BUILD) run("npm", ["run", "build"], root);
  spawnSync("mkdir", ["-p", packDir, installDir]);
  run("npm", ["pack", "--pack-destination", packDir], root);
  const tarball = readdirSync(packDir).find((f) => f.endsWith(".tgz"));
  if (!tarball) fail("npm pack produced no tarball");
  writeFileSync(join(installDir, "package.json"), '{"name":"smoke","private":true}');
  run("npm", ["install", "--no-audit", "--no-fund", join(packDir, tarball)], installDir);

  const bin = join(installDir, "node_modules", ".bin", "apertis-mcp");
  child = spawn(bin, [], {
    cwd: installDir,
    env: { ...process.env, APERTIS_API_KEY: "sk-smoke-dummy", npm_config_cache: cache },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.on("error", (e) => fail(`could not start ${bin}: ${e.message}`));
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  const exited = new Promise((r) => child.on("exit", (code) => r(code)));

  const send = (m) => child.stdin.write(JSON.stringify(m) + "\n");
  const reply = (id) =>
    out
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((m) => m && m.id === id);

  async function waitFor(id, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const m = reply(id);
      if (m) return m;
      if (child.exitCode !== null) fail(`server exited ${child.exitCode}\n${err}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    fail(`no reply to request ${id} within ${ms} ms\n${err}`);
  }

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0" },
    },
  });
  const init = await waitFor(1, 20000);
  if (!init.result) fail(`initialize failed: ${JSON.stringify(init)}`);
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const list = await waitFor(2, 20000);
  const names = (list.result?.tools ?? []).map((t) => t.name);

  const expected = [
    "list_models",
    "get_model_info",
    "compare_models",
    "check_quota",
    "get_usage_stats",
    "list_api_keys",
    "suggest_model",
    "recommend_model",
    "delegate",
  ];
  const missing = expected.filter((n) => !names.includes(n));
  if (missing.length) fail(`tools/list is missing: ${missing.join(", ")} (got ${names.join(", ")})`);
  if (names.includes("create_api_key")) fail("create_api_key must not be listed");

  console.log(`SMOKE OK: ${names.length} tools listed: ${names.join(", ")}`);
  child.kill("SIGKILL");
  await exited;
  cleanup();
  process.exit(0);
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
}
