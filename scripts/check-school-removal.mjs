import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../src/shared/funtion/scopedStorage.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const scope = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("removal cancels queued sync and clears only the removed account's cached data", async () => {
  const values = new Map();
  globalThis.localStorage = {
    get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k),
  };
  globalThis.window = { dispatchEvent() {} };
  let calls = 0;
  scope.setStorageUser("member", 2);
  scope.configureStorageSync(async () => { calls++; });
  scope.scopedStorage.setItem("school-test", "private-school-data");
  values.set("thaiteacher-conflict-backup:member:2:report", "old-data");
  values.set("thaiteacher-user:other:v2:report", "other-data");
  scope.configureStorageSync(null);
  scope.setViewingUser(null);
  scope.clearStorageForUser("member");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 0);
  assert.deepEqual([...values.entries()], [["thaiteacher-user:other:v2:report", "other-data"]]);
  assert.throws(() => scope.scopedStorage.getItem("school-test"));
});
