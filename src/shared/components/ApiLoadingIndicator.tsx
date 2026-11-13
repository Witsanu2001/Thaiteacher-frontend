import { useSyncExternalStore } from "react";
import { isApiLoadingVisible, subscribeApiLoading } from "../funtion/apiLoading";

export default function ApiLoadingIndicator() {
  const visible = useSyncExternalStore(subscribeApiLoading, isApiLoadingVisible);
  if (!visible) return null;
  return (
    <div role="status" aria-label="กำลังโหลดข้อมูล" className="pointer-events-none fixed inset-0 z-[120] grid place-items-center print:hidden">
      <div className="grid size-20 place-items-center rounded-3xl border border-blue-400/30 bg-slate-900/95 shadow-2xl shadow-slate-950/30">
        <span aria-hidden="true" className="size-10 motion-safe:animate-spin rounded-full border-[3px] border-blue-200/40 border-t-sky-300" />
      </div>
    </div>
  );
}

