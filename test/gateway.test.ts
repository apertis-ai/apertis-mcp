import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ApertisClient, MODELS_MAX_PAGES } from "../src/client.ts";
import { registerAccountTools } from "../src/tools/account.ts";
import { maskKey, registerKeyTools } from "../src/tools/keys.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeFetch(handler: (url: URL) => Response): string[] {
  const seen: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = new URL(String(input));
    seen.push(url.pathname + url.search);
    return handler(url);
  }) as typeof fetch;
  return seen;
}

const entry = (id: string) => ({
  model_id: id,
  display_name: id,
  provider: "p",
  category: "llm",
  charge_type: "token",
  input_price: 1,
  output_price: 2,
  context_length: 1000,
  features: [],
  tasks: [],
  description: null,
  is_enabled: true,
  is_deprecated: false,
});

type Handler = (args: unknown) => Promise<{
  content: { text: string }[];
  isError?: boolean;
}>;

async function tools(register: typeof registerAccountTools, client: ApertisClient) {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _cfg: unknown, h: Handler) =>
      handlers.set(name, h),
  };
  await register(client, server as never);
  return handlers;
}

test("getModels walks pages by offset until has_more is false", async () => {
  // The fake gateway serves 2 models per page whatever limit is asked for,
  // as the real one does when it clamps, and repeats one model across pages.
  const catalog = ["a", "b", "c", "c", "d"].map(entry);
  const served = 2;
  const seen = fakeFetch((url) => {
    const offset = Number(url.searchParams.get("offset"));
    return json({
      success: true,
      data: {
        models: catalog.slice(offset, offset + served),
        pagination: {
          total: catalog.length,
          limit: served,
          offset,
          has_more: offset + served < catalog.length,
        },
      },
    });
  });
  const client = new ApertisClient("k", "http://gw.test");
  const models = await client.getModels();
  assert.deepEqual(models.map((m) => m.id), ["a", "b", "c", "d"]);
  assert.deepEqual(seen, [
    "/api/v2/models/?limit=100&offset=0",
    "/api/v2/models/?limit=100&offset=2",
    "/api/v2/models/?limit=100&offset=4",
  ]);
  await client.getModels(); // cached: no further requests
  assert.equal(seen.length, 3);
});

test("getModels does not cache a walk that failed part way", async () => {
  let failSecond = true;
  const seen = fakeFetch((url) => {
    const offset = Number(url.searchParams.get("offset"));
    if (offset === 1 && failSecond) return new Response("no", { status: 502 });
    return json({
      data: {
        models: [entry(offset === 0 ? "a" : "b")],
        pagination: { limit: 1, has_more: offset === 0 },
      },
    });
  });
  const client = new ApertisClient("k", "http://gw.test");
  await assert.rejects(() => client.getModels(), /502/);
  failSecond = false;
  const models = await client.getModels();
  assert.deepEqual(models.map((m) => m.id), ["a", "b"]);
  assert.equal(seen.length, 4);
});

test("getModels raises a tool error naming the page cap", async () => {
  const seen = fakeFetch(() =>
    json({
      data: { models: [entry("x")], pagination: { has_more: true } },
    }),
  );
  const client = new ApertisClient("k", "http://gw.test");
  await assert.rejects(
    () => client.getModels(),
    new RegExp(`${MODELS_MAX_PAGES}-page cap`),
  );
  assert.equal(seen.length, MODELS_MAX_PAGES);
});

test("check_quota prints gateway fields and never undefined", async () => {
  fakeFetch(() =>
    json({
      success: true,
      data: {
        id: 7,
        name: "ci-key",
        status: "active",
        created_at: 1760000000,
        last_used_at: 1760100000,
        expired_at: -1,
        unlimited_quota: false,
        remain_quota_usd: 12.5,
        used_quota_usd: 3.25,
        subscription: { plan: "pro", status: "active", expiry: 1790000000 },
      },
    }),
  );
  const h = await tools(registerAccountTools, new ApertisClient("k", "http://gw.test"));
  const out = (await h.get("check_quota")!({})).content[0].text;
  assert.match(out, /ci-key/);
  assert.match(out, /\$12\.50/);
  assert.match(out, /\$3\.25/);
  assert.match(out, /pro/);
  assert.doesNotMatch(out, /undefined|NaN|Email/);
});

test("check_quota omits fields the gateway does not return", async () => {
  fakeFetch(() =>
    json({
      success: true,
      data: { id: 1, name: "k", status: "active", unlimited_quota: true },
    }),
  );
  const h = await tools(registerAccountTools, new ApertisClient("k", "http://gw.test"));
  const out = (await h.get("check_quota")!({})).content[0].text;
  assert.match(out, /Unlimited/);
  assert.doesNotMatch(out, /undefined|NaN|\$/);
});

test("get_usage_stats prints gateway fields and never undefined", async () => {
  const seen = fakeFetch(() =>
    json({
      success: true,
      data: {
        token_name: "ci-key",
        total_quota_usd: 3.25,
        total_tokens: 123456,
        total_requests: 42,
        remain_quota_usd: 12.5,
        used_quota_usd: 3.25,
      },
    }),
  );
  const h = await tools(registerAccountTools, new ApertisClient("k", "http://gw.test"));
  const out = (await h.get("get_usage_stats")!({ period: "week" })).content[0].text;
  assert.match(out, /123,456/);
  assert.match(out, /42/);
  assert.match(out, /\$3\.2500/);
  assert.doesNotMatch(out, /undefined|NaN/);
  assert.deepEqual(seen, ["/v1/token/usage"]);
});

test("get_usage_stats with an empty data object prints no undefined", async () => {
  fakeFetch(() => json({ success: true, data: {} }));
  const h = await tools(registerAccountTools, new ApertisClient("k", "http://gw.test"));
  const out = (await h.get("get_usage_stats")!({})).content[0].text;
  assert.doesNotMatch(out, /undefined|NaN/);
});

test("list_api_keys prints gateway fields and never undefined", async () => {
  fakeFetch(() =>
    json({
      success: true,
      data: [
        {
          id: 7,
          name: "ci-key",
          key: "sk-abcde...",
          status: "active",
          created_at: 1760000000,
          last_used_at: 0,
          unlimited_quota: false,
          remain_quota_usd: 12.5,
          used_quota_usd: 3.25,
        },
        { id: 8, name: "open", key: "sk-zzzzz...", status: "active", unlimited_quota: true },
      ],
    }),
  );
  const h = await tools(registerKeyTools, new ApertisClient("k", "http://gw.test"));
  const out = (await h.get("list_api_keys")!({})).content[0].text;
  assert.match(out, /ci-key/);
  assert.match(out, /sk-abcde\.\.\./);
  assert.match(out, /\$12\.50/);
  assert.match(out, /Unlimited/);
  assert.doesNotMatch(out, /undefined|NaN|Invalid/);
  assert.deepEqual([...h.keys()], ["list_api_keys"]);
});

test("maskKey never passes a full key through", () => {
  assert.equal(maskKey("sk-abcde..."), "sk-abcde...");
  assert.equal(maskKey("sk-0123456789abcdef0123456789abcdef"), "sk-01234...");
  assert.equal(maskKey("sk-0123456789abcdef0123456789abc..."), "sk-01234...");
  assert.equal(maskKey(undefined), "****");
});
