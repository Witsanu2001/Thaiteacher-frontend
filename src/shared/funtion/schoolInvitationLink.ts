const KEY = "thaiteacher:pending-school-invitation";
const MAX_AGE = 60 * 60 * 1000;
export const validInvitationToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
export function schoolInvitationLink(token: string, origin: string) {
 if (!validInvitationToken(token)) throw new Error("invalid_invitation_token");
 const url = new URL("/invite", origin);
 url.hash = new URLSearchParams({ token }).toString();
 return url.toString();
}
export function pendingSchoolInvitation(hash: string, storage: Pick<Storage, "getItem" | "removeItem">, now = Date.now()): string {
 if (hash) {
  const token = new URLSearchParams(hash.slice(1)).get("token") || "";
  if (validInvitationToken(token)) return token;
  try { storage.removeItem(KEY); } catch { /* Storage may be disabled. */ }
  return "";
 }
 try {
  const saved = JSON.parse(storage.getItem(KEY) || "null") as { token: string; createdAt: number } | null;
  if (saved && validInvitationToken(saved.token) && Number.isFinite(saved.createdAt) && now >= saved.createdAt && now - saved.createdAt < MAX_AGE) return saved.token;
  storage.removeItem(KEY);
 } catch { /* Invalid or unavailable session storage is not a valid invite. */ }
 return "";
}
export function rememberSchoolInvitation(token: string, storage: Pick<Storage, "setItem">, now = Date.now()) {
 if (!validInvitationToken(token)) return false;
 try { storage.setItem(KEY, JSON.stringify({ token, createdAt: now })); return true; } catch { return false; }
}
export function forgetSchoolInvitation(storage: Pick<Storage, "removeItem">) {
 try { storage.removeItem(KEY); } catch { /* Storage may be disabled. */ }
}
