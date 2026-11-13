import type { User } from "firebase/auth";
import { onDisconnect, onValue, push, ref, remove, serverTimestamp, set } from "firebase/database";
import { realtimeDb } from "../firebase";

type PresenceConnection = { connectedAt?: number };
type PresenceMap = Record<string, PresenceConnection>;

function isOnline(value: unknown): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function connect(path: string): () => void {
  if (!realtimeDb) return () => undefined;
  const connection = push(ref(realtimeDb, path));
  let active = true;
  const unsubscribe = onValue(ref(realtimeDb, ".info/connected"), snapshot => {
    if (!active || snapshot.val() !== true) return;
    void onDisconnect(connection).remove()
      .then(() => active ? set(connection, { connectedAt: serverTimestamp() }) : undefined)
      .catch(error => console.error("Support presence unavailable", error));
  });
  return () => {
    active = false;
    unsubscribe();
    void remove(connection).catch(() => undefined);
    void onDisconnect(connection).cancel().catch(() => undefined);
  };
}

export const connectUserPresence = (user: User) => connect(`supportPresence/users/${user.uid}`);
export const connectStaffPresence = (user: User) => connect(`supportPresence/team/${user.uid}`);

function subscribe(path: string, onChange: (online: boolean) => void): () => void {
  if (!realtimeDb) return () => undefined;
  return onValue(ref(realtimeDb, path), snapshot => onChange(isOnline(snapshot.val())), error => {
    console.error("Support presence listener unavailable", error);
    onChange(false);
  });
}

export const subscribeStaffPresence = (onChange: (online: boolean) => void) => subscribe("supportPresence/team", onChange);
export const subscribeUserPresence = (uid: string, onChange: (online: boolean) => void) => subscribe(`supportPresence/users/${uid}`, onChange);

export function subscribeAllUserPresence(onChange: (onlineUids: Set<string>) => void): () => void {
  if (!realtimeDb) return () => undefined;
  return onValue(ref(realtimeDb, "supportPresence/users"), snapshot => {
    const users = (snapshot.val() ?? {}) as Record<string, PresenceMap>;
    onChange(new Set(Object.entries(users).filter(([, connections]) => isOnline(connections)).map(([uid]) => uid)));
  }, error => console.error("Support presence list unavailable", error));
}
