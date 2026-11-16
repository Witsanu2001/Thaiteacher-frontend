import axios from "axios";
import { useEffect, useState } from "react";
let cached = 9,
  expires = 0,
  pending: Promise<number> | null = null;
export function setPublicTrialDays(days: number) {
  cached = days;
  expires = Date.now() + 60000;
  window.dispatchEvent(new Event("trial-settings-updated"));
}
function load() {
  if (expires > Date.now()) return Promise.resolve(cached);
  if (pending) return pending;
  pending = axios
    .get<{ trialDays: number }>(
      `${import.meta.env.VITE_API_URL ?? ""}/api/v1/system/trial`,
      { timeout: 15000 },
    )
    .then(({ data }) => {
      if (
        Number.isInteger(data.trialDays) &&
        data.trialDays >= 1 &&
        data.trialDays <= 365
      )
        cached = data.trialDays;
      expires = Date.now() + 60000;
      return cached;
    })
    .catch(() => cached)
    .finally(() => {
      pending = null;
    });
  return pending;
}
export function useTrialDays() {
  const [days, setDays] = useState(cached);
  useEffect(() => {
    let active = true;
    void load().then((value) => {
      if (active) setDays(value);
    });
    const update = () => setDays(cached);
    window.addEventListener("trial-settings-updated", update);
    return () => {
      active = false;
      window.removeEventListener("trial-settings-updated", update);
    };
  }, []);
  return days;
}
