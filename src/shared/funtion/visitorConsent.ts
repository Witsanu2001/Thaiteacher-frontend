export const visitorConsentKey = "thaiteacher-visitor-consent-v1";
export function visitorConsent() {
  try { return localStorage.getItem(visitorConsentKey) === "1"; } catch { return false; }
}
export function setVisitorConsent(allowed: boolean) {
  try { localStorage.setItem(visitorConsentKey, allowed ? "1" : "0"); } catch { return; }
  window.dispatchEvent(new Event("thaiteacher:visitor-consent"));
}
