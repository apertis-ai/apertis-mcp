import { test } from "node:test";
import assert from "node:assert/strict";
import { toolError } from "../src/utils/error.ts";

test("toolError sets isError true and formats an Error", () => {
  const r = toolError("doing X", new Error("boom"));
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Error doing X: boom/);
});

test("toolError sets isError true for non-Error values", () => {
  const r = toolError("doing Y", "plain string");
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Error doing Y: plain string/);
});
