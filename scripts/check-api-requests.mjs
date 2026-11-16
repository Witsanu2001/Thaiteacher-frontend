import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import axios from "axios";

// Exercise the real TypeScript cache and scoped storage without starting Firebase
// or making network requests. Temporary JS is removed after the test process.
const root = fileURLToPath(new URL("../", import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "thaiteacher-api-requests-"));
const require = createRequire(import.meta.url);
const axiosUrl = pathToFileURL(path.join(path.dirname(require.resolve("axios/package.json")), "index.js")).href;
function compile(name, source) {
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const dest = path.join(temp, `${name}.mjs`);
  fs.writeFileSync(dest, output);
  return pathToFileURL(dest).href;
}
const storageValues = new Map();
globalThis.localStorage = {
  getItem: key => storageValues.get(key) ?? null,
  setItem: (key, value) => storageValues.set(key, String(value)),
  removeItem: key => storageValues.delete(key),
  key: index => [...storageValues.keys()][index] ?? null,
  get length() { return storageValues.size; },
};
globalThis.window = { location: { href: "http://localhost:5173/" }, dispatchEvent() {} };
const storageUrl = compile("scopedStorage", fs.readFileSync(path.join(root, "src/shared/funtion/scopedStorage.ts"), "utf8"));
const storage = await import(storageUrl);
const cacheUrl = compile("apiRequestCache", fs.readFileSync(path.join(root, "src/shared/funtion/apiRequestCache.ts"), "utf8").replace('from "axios"', `from ${JSON.stringify(axiosUrl)}`).replace('from "./scopedStorage"', `from ${JSON.stringify(storageUrl)}`));
const cache = await import(cacheUrl);
cache.installApiRequestCache();
const finance = "/api/v1/schools/finance/projects";
const headers = { Authorization: "Bearer test-account-A" };
const result = (config, data = {}) => ({ data, status: 200, statusText: "OK", headers: {}, config });
const tick = () => new Promise(resolve => setImmediate(resolve));
const get = (url = finance, config = {}) => axios.get(url, { headers, ...config });
beforeEach(() => { cache.clearApiReadCache(); storage.configureStorageSync(null); storage.setViewingUser(null); storage.setStorageUser(null); storageValues.clear(); });
after(() => fs.rmSync(temp, { recursive: true, force: true }));

test("concurrent GETs share one request; callers receive independent data", async () => {
  let calls = 0, finish;
  axios.defaults.adapter = config => { calls++; return new Promise(resolve => { finish = () => resolve(result(config, { rows: [1] })); }); };
  const first = get(), second = get();
  await tick(); assert.equal(calls, 1); finish();
  const [a, b] = await Promise.all([first, second]);
  a.data.rows.push(2);
  assert.deepEqual(b.data.rows, [1]);
  assert.deepEqual((await get()).data.rows, [1]);
  assert.equal(calls, 1);
});

test("cached reads expire and explicit refresh bypasses settled cache", async () => {
  let calls = 0;
  axios.defaults.adapter = async config => result(config, { revision: ++calls });
  await get(); await get(); assert.equal(calls, 1);
  await get(finance, { thaiTeacherFresh: true }); assert.equal(calls, 2);
  const now = Date.now;
  Date.now = () => now() + 20_000;
  try { await get(); assert.equal(calls, 3); } finally { Date.now = now; }
});

test("cache is isolated by authorization, viewed account and data version", async () => {
  let calls = 0;
  axios.defaults.adapter = async config => result(config, { revision: ++calls });
  await get();
  await get(finance, { headers: { Authorization: "Bearer test-account-B" } });
  await get(finance, { params: { viewAsUid: "school-A" } });
  await get(finance, { params: { viewAsUid: "school-B" } });
  storage.setStorageUser("test", 2); await get();
  assert.equal(calls, 5);
  cache.clearApiReadCache(); await get(); assert.equal(calls, 6);
});

test("financial writes invalidate reads; writes are never merged", async () => {
  let reads = 0, writes = 0;
  axios.defaults.adapter = async config => result(config, { revision: config.method === "get" ? ++reads : ++writes });
  await get(); await get();
  await Promise.all([axios.post(finance, { amount: 99 }, { headers }), axios.post(finance, { amount: 99 }, { headers })]);
  await get();
  assert.equal(reads, 2); assert.equal(writes, 2);
});

test("a read started before mutation cannot repopulate the cache with stale data", async () => {
  let reads = 0, finish;
  axios.defaults.adapter = config => {
    if (config.method !== "get") return Promise.resolve(result(config));
    reads++;
    if (reads === 1) return new Promise(resolve => { finish = () => resolve(result(config, { revision: 1 })); });
    return Promise.resolve(result(config, { revision: reads }));
  };
  const old = get(); await tick();
  await axios.put(finance, { amount: 99 }, { headers });
  assert.equal((await get()).data.revision, 2);
  finish(); await old;
  assert.equal((await get()).data.revision, 2); assert.equal(reads, 2);
});

test("failures are not cached and are not retried automatically", async () => {
  let calls = 0;
  axios.defaults.adapter = async config => {
    calls++;
    if (calls === 1) throw new axios.AxiosError("unavailable", "ERR_NETWORK", config);
    return result(config);
  };
  await assert.rejects(get()); assert.equal(calls, 1);
  await get(); assert.equal(calls, 2);
});

test("live chat and notification reads are deduplicated only while in flight", async () => {
  for (const url of ["/api/v1/customer/messages", "/api/v1/users/notifications"]) {
    let calls = 0;
    axios.defaults.adapter = async config => { calls++; await tick(); return result(config, []); };
    await Promise.all([get(url), get(url)]); assert.equal(calls, 1);
    await get(url); assert.equal(calls, 2);
  }
});

test("requests with caller-owned cancellation remain independent", async () => {
  let calls = 0;
  axios.defaults.adapter = async config => { calls++; return result(config); };
  await Promise.all([get(finance, { signal: new AbortController().signal }), get(finance, { signal: new AbortController().signal })]);
  assert.equal(calls, 2);
});

test("unchanged preferences do not generate repeated API writes", async () => {
  let calls = 0, finish;
  storage.setStorageUser("teacher");
  storage.configureStorageSync(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const key = "school-selected-fiscal-year:test";
  storage.scopedStorage.setItem(key, "2570"); storage.scopedStorage.setItem(key, "2570");
  await tick(); assert.equal(calls, 1); finish(); await tick();
  storage.scopedStorage.setItem(key, "2570"); await tick(); assert.equal(calls, 1);
  storage.scopedStorage.setItem(key, "2571"); await tick(); assert.equal(calls, 2); finish(); await tick();
  storage.scopedStorage.removeItem(key); storage.scopedStorage.removeItem(key); await tick(); assert.equal(calls, 3); finish(); await tick();
});

test("an explicit retry of an unchanged failed preference still works", async () => {
  let calls = 0;
  storage.setStorageUser("teacher");
  storage.configureStorageSync(async () => { calls++; if (calls === 1) throw new Error("offline"); });
  storage.scopedStorage.setItem("school-preference", "value"); await tick();
  storage.scopedStorage.setItem("school-preference", "value"); await tick();
  assert.equal(calls, 2);
});
