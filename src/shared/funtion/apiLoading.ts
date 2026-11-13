import axios, { type InternalAxiosRequestConfig } from "axios";

type TrackedConfig = InternalAxiosRequestConfig & { thaiTeacherLoading?: boolean };

let pending = 0;
let visible = false;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let installed = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const setVisible = (value: boolean) => {
  if (visible === value) return;
  visible = value;
  notify();
};
const begin = () => {
  pending++;
  if (hideTimer) clearTimeout(hideTimer);
  if (!visible && !showTimer) {
    showTimer = setTimeout(() => {
      showTimer = undefined;
      if (pending > 0) setVisible(true);
    }, 220);
  }
};
const end = () => {
  pending = Math.max(0, pending - 1);
  if (pending > 0) return;
  if (showTimer) clearTimeout(showTimer);
  showTimer = undefined;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideTimer = undefined;
    if (pending === 0) setVisible(false);
  }, 160);
};
const isAppApi = (url?: string) => {
  if (!url) return false;
  try {
    return new URL(url, window.location.href).pathname.startsWith("/api/");
  } catch { return false; }
};

export const subscribeApiLoading = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const isApiLoadingVisible = () => visible;

export function installApiLoading() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    if (isAppApi(config.url)) {
      (config as TrackedConfig).thaiTeacherLoading = true;
      begin();
    }
    return config;
  });
  axios.interceptors.response.use(
    (response) => {
      if ((response.config as TrackedConfig).thaiTeacherLoading) end();
      return response;
    },
    (error: unknown) => {
      if (axios.isAxiosError(error) && (error.config as TrackedConfig | undefined)?.thaiTeacherLoading) end();
      return Promise.reject(error);
    },
  );

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!isAppApi(url)) return nativeFetch(input, init);
    begin();
    try { return nativeFetch(input, init).finally(end); }
    catch (error) { end(); throw error; }
  };
}
