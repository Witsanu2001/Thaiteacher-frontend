import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useLocation } from "react-router-dom";
import { auth } from "../../config/firebase";
import { visitorConsent } from "../funtion/visitorConsent";

const api = import.meta.env.VITE_API_URL ?? "";
const inFlight = new Set<string>();
const sent = new Set<string>();
let memoryVisitor = "";
let memorySession: { id: string; at: number } | null = null;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function identifiers() {
  let visitor = memoryVisitor ||= crypto.randomUUID();
  try {
    const saved = localStorage.getItem("thaiteacher-visitor");
    if (saved && uuid.test(saved)) visitor = saved;
    else localStorage.setItem("thaiteacher-visitor", visitor);
  } catch { /* Storage may be blocked in private browsing. */ }
  memoryVisitor = visitor;
  try {
    const saved = JSON.parse(sessionStorage.getItem("thaiteacher-visit-session") || "null");
    if (saved && uuid.test(saved.id) && Number.isFinite(saved.at) && Date.now() - saved.at < 30 * 60_000)
      memorySession = saved;
  } catch { /* Use the in-memory session. */ }
  if (!memorySession || Date.now() - memorySession.at >= 30 * 60_000)
    memorySession = { id: crypto.randomUUID(), at: Date.now() };
  memorySession.at = Date.now();
  try { sessionStorage.setItem("thaiteacher-visit-session", JSON.stringify(memorySession)); } catch { /* Optional storage. */ }
  return { visitorId: visitor, sessionId: memorySession.id };
}
function source() {
  if (!document.referrer) return "direct";
  try {
    const host = new URL(document.referrer).hostname;
    if (host === location.hostname) return "internal";
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google";
    if (/(^|\.)(facebook\.com|fb\.com)$/.test(host)) return "facebook";
    if (/(^|\.)(line\.me|line-apps\.com)$/.test(host)) return "line";
  } catch { /* Unknown source. */ }
  return "other";
}
export default function WebsiteVisitTracker() {
  const { pathname } = useLocation();
  const [consent, setConsent] = useState(visitorConsent);
  useEffect(() => {
    const changed = () => setConsent(visitorConsent());
    window.addEventListener("thaiteacher:visitor-consent", changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("thaiteacher:visitor-consent", changed);
      window.removeEventListener("storage", changed);
    };
  }, []);
  useEffect(() => onAuthStateChanged(auth, user => {
    if (!consent || user || navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const page = pathname === "/" ? "home" : pathname.startsWith("/invite") ? "invite"
      : pathname === "/billing" ? "billing" : pathname.startsWith("/finance") ? "demo" : "other";
    const ids = identifiers();
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const key = `${ids.sessionId}:${page}:${day}`;
    let saved = false;
    try { saved = sessionStorage.getItem(`thaiteacher-visit-sent:${key}`) === "1"; } catch { /* Optional storage. */ }
    if (saved || sent.has(key) || inFlight.has(key)) return;
    inFlight.add(key);
    const ua = navigator.userAgent;
    const device = /iPad|Tablet/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
      ? "tablet" : /Mobile|iPhone|Android/i.test(ua) ? "mobile" : "desktop";
    void fetch(`${api}/api/v1/users/visitors`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "omit", body: JSON.stringify({ ...ids, page, device, source: source() }),
      signal: AbortSignal.timeout(10_000),
    }).then(response => {
      if (!response.ok) return;
      sent.add(key);
      try { sessionStorage.setItem(`thaiteacher-visit-sent:${key}`, "1"); } catch { /* Optional storage. */ }
    }).catch(() => undefined).finally(() => inFlight.delete(key));
  }), [pathname, consent]);
  return null;
}
