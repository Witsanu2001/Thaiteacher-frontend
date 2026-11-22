let currentUserId: string | null = null;
let currentDataVersion = 0;
let viewingUserId: string | null = null;
let viewingDataVersion = 0;
let syncChange: ((uid: string, key: string, value: string | null) => Promise<void>) | null = null;
let syncGeneration = 0;
const pendingWrites = new Map<string, Promise<void>>();

export function setViewingUser(userId: string | null, dataVersion = 0) {
  viewingUserId = userId;
  viewingDataVersion = dataVersion;
}

export function configureStorageSync(callback: typeof syncChange) { syncGeneration++; syncChange = callback; }

function effectiveScope() {
  return { uid: viewingUserId || currentUserId, version: viewingUserId ? viewingDataVersion : currentDataVersion };
}

export function activeDataVersion() { return effectiveScope().version; }

function prefix(uid: string, version: number) {
  return `thaiteacher-user:${uid}:${version ? `v${version}:` : ""}`;
}

function queueSync(key: string, value: string | null) {
  const { uid, version } = effectiveScope();
  if (!uid || !syncChange) return;
  const fullKey = prefix(uid, version) + key;
  const dirtyKey = `thaiteacher-dirty:${uid}:${version}:${key}`;
  localStorage.setItem(dirtyKey, "1");
  const callback = syncChange;
  const generation = syncGeneration;
  const prior = pendingWrites.get(fullKey) || Promise.resolve();
  const next = prior.catch(() => {}).then(() => generation === syncGeneration ? callback(uid, key, value) : undefined).then(() => {
    if (localStorage.getItem(fullKey) === value) localStorage.removeItem(dirtyKey);
  }).catch(() => { window.dispatchEvent(new Event("app-state-sync-error")); });
  pendingWrites.set(fullKey, next);
  void next.finally(() => { if (pendingWrites.get(fullKey) === next) pendingWrites.delete(fullKey); });
}

export function readScopedSnapshot(uid: string, version: number): Record<string, string> {
  const result: Record<string, string> = {};
  const base = prefix(uid, version);
  for (let i = 0; i < localStorage.length; i++) {
    const name = localStorage.key(i);
    if (name?.startsWith(base)) {
      const key = name.slice(base.length);
      if (version !== 0 || !/^v\d+:/.test(key)) result[key] = localStorage.getItem(name) || "";
    }
  }
  if (version === 0 && localStorage.getItem("thaiteacher-legacy-owner") === uid) {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (name?.startsWith("school-") && result[name] === undefined) result[name] = localStorage.getItem(name) || "";
    }
  }
  return result;
}

export function isScopedDirty(uid: string, version: number, key: string) {
  return localStorage.getItem(`thaiteacher-dirty:${uid}:${version}:${key}`) === "1";
}

export function clearScopedDirty(uid: string, version: number, key: string) {
  localStorage.removeItem(`thaiteacher-dirty:${uid}:${version}:${key}`);
}

export function replaceScopedSnapshot(uid: string, version: number, values: Record<string, string>) {
  const base = prefix(uid, version);
  const oldKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith(base) && (version !== 0 || !/^v\d+:/.test(key.slice(base.length)))));
  for (const key of oldKeys) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(values)) localStorage.setItem(base + key, value);
}

export function setStorageUser(userId: string | null, dataVersion = 0) {
  currentUserId = userId;
  currentDataVersion = dataVersion;
  if (userId && userId !== "public-demo" && dataVersion === 0 && !localStorage.getItem("thaiteacher-legacy-owner")) {
    localStorage.setItem("thaiteacher-legacy-owner", userId);
  }
}

function scopedKey(key: string) {
  const { uid, version } = effectiveScope();
  if (!uid) throw new Error("ต้องเข้าสู่ระบบก่อนใช้ข้อมูลการเงิน");
  return prefix(uid, version) + key;
}

export function clearStorageForUser(userId: string) {
  const prefix = `thaiteacher-user:${userId}:`;
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key));
  for (const key of keys) if (key.startsWith(prefix)
    || key.startsWith(`thaiteacher-dirty:${userId}:`)
    || key.startsWith(`thaiteacher-conflict-backup:${userId}:`)) localStorage.removeItem(key);
  if (localStorage.getItem("thaiteacher-legacy-owner") === userId) {
    for (const key of keys) if (key.startsWith("school-")) localStorage.removeItem(key);
    localStorage.removeItem("thaiteacher-legacy-owner");
  }
  if (currentUserId === userId) setStorageUser(null);
  if (viewingUserId === userId) setViewingUser(null);
}

export const scopedStorage = {
  getItem(key: string) {
    const saved = localStorage.getItem(scopedKey(key));
    if (saved !== null) return saved;
    return !viewingUserId && currentDataVersion === 0 && localStorage.getItem("thaiteacher-legacy-owner") === currentUserId
      ? localStorage.getItem(key)
      : null;
  },
  setItem(key: string, value: string) {
    const fullKey = scopedKey(key);
    const { uid, version } = effectiveScope();
    const dirty = uid && localStorage.getItem(`thaiteacher-dirty:${uid}:${version}:${key}`) === "1";
    // Rerenders and repeated page mounts often write the same preference. Keep
    // real retries after failure, but do not enqueue an unchanged successful or pending write.
    if (localStorage.getItem(fullKey) === value && (!dirty || pendingWrites.has(fullKey))) return;
    localStorage.setItem(fullKey, value);
    queueSync(key, value);
  },
  removeItem(key: string) {
    const fullKey = scopedKey(key);
    const { uid, version } = effectiveScope();
    const dirty = uid && localStorage.getItem(`thaiteacher-dirty:${uid}:${version}:${key}`) === "1";
    if (localStorage.getItem(fullKey) === null && (!dirty || pendingWrites.has(fullKey))) return;
    localStorage.removeItem(fullKey);
    queueSync(key, null);
  },
};
