import axios, { type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { activeDataVersion } from "./scopedStorage";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Manual refresh and financial restore checks must read the server. */
    thaiTeacherFresh?: boolean;
  }
}

type CachedRead = {
  path: string;
  pending?: Promise<AxiosResponse>;
  response?: AxiosResponse;
  expires: number;
};
const reads = new Map<string, CachedRead>();
let installed = false;

export function clearApiReadCache() { reads.clear(); }
export function invalidateApiReads(prefix: string) {
  for (const [key, entry] of reads) if (entry.path.startsWith(prefix)) reads.delete(key);
}
function cacheTime(path: string) {
  if (path.startsWith("/api/v1/customer/") || path.endsWith("/notifications")) return 0;
  if (path.startsWith("/api/v1/schools/finance/") || path === "/api/v1/budget-reports" || path === "/api/v1/users/app-state") return 15_000;
  if (path === "/api/v1/users" || path === "/api/v1/users/admin" || path === "/api/v1/users/admin/analytics" || path === "/api/v1/users/legal/acceptance" || path.startsWith("/api/v1/system/")) return 60_000;
  if (path === "/api/v1/payments" || path === "/api/v1/payments/admin") return 15_000;
  return undefined;
}
function invalidateForWrite(path: string) {
  if (path === "/api/v1/users/activity") return;
  if (path.startsWith("/api/v1/customer/")) { invalidateApiReads("/api/v1/customer/"); return; }
  if (path.startsWith("/api/v1/system/")) { invalidateApiReads("/api/v1/system/"); return; }
  if (path.includes("/notifications")) { invalidateApiReads("/api/v1/users/notifications"); return; }
  if (path === "/api/v1/users/onboarding") { invalidateApiReads("/api/v1/users"); return; }
  // Financial records affect other ledgers/reports; payment/user changes affect
  // entitlements and impersonation. Never reuse those reads after a mutation.
  clearApiReadCache();
}
function copyResponse(response: AxiosResponse, config: InternalAxiosRequestConfig): AxiosResponse {
  return { ...response, config, headers: { ...response.headers }, data: structuredClone(response.data) };
}

/** Deduplicate GETs only. No financial write or payment approval is retried/merged. */
export function installApiRequestCache() {
  if (installed) return;
  installed = true;
  axios.interceptors.request.use(config => {
    let url: URL;
    try { url = new URL(axios.getUri(config), window.location.href); } catch { return config; }
    if (!url.pathname.startsWith("/api/")) return config;
    const adapter: AxiosAdapter = axios.getAdapter(config.adapter || axios.defaults.adapter);
    const method = (config.method || "get").toLowerCase();
    if (method !== "get") {
      invalidateForWrite(url.pathname);
      config.adapter = async request => {
        try { return await adapter(request); }
        finally { invalidateForWrite(url.pathname); }
      };
      return config;
    }
    const ttl = cacheTime(url.pathname);
    if (ttl === undefined || config.signal || config.cancelToken || (config.responseType && config.responseType !== "json")) return config;
    url.searchParams.sort();
    const key = JSON.stringify([url.href, config.headers.get("Authorization") || "public", config.headers.get("X-Data-Version") || activeDataVersion(), config.timeout]);
    config.adapter = async request => {
      const existing = reads.get(key);
      if (existing?.pending) return copyResponse(await existing.pending, request);
      if (!request.thaiTeacherFresh && existing?.response && existing.expires > Date.now()) return copyResponse(existing.response, request);
      // Keep only a bounded, in-memory cache. Nothing is saved to localStorage.
      if (reads.size >= 128) for (const [oldKey, entry] of reads) { if (!entry.pending) { reads.delete(oldKey); break; } }
      const entry: CachedRead = { path: url.pathname, expires: 0 };
      reads.set(key, entry);
      entry.pending = Promise.resolve().then(() => adapter(request)).then(response => {
        if (reads.get(key) === entry) {
          entry.pending = undefined;
          if (ttl > 0 && response.status >= 200 && response.status < 300) {
            entry.response = copyResponse(response, request);
            entry.expires = Date.now() + ttl;
          } else reads.delete(key);
        }
        return response;
      }, error => {
        if (reads.get(key) === entry) reads.delete(key);
        throw error;
      });
      return copyResponse(await entry.pending, request);
    };
    return config;
  });
}
