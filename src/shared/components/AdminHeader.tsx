import { useState } from "react";
import { Bell, Menu, Moon, ShieldCheck, Sun } from "lucide-react";

export default function AdminHeader({ title, onMenu, dark, onToggleDark }: { title: string; onMenu: () => void; dark: boolean; onToggleDark: () => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  return <header className="shrink-0 border-b border-blue-100 bg-gradient-to-r from-white via-white to-sky-50/70 px-4 py-3 shadow-sm shadow-blue-100/40 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 dark:shadow-none sm:px-6 lg:py-4">
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <button type="button" onClick={onMenu} aria-label="เปิดเมนู" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 motion-safe:transition-colors hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"><Menu size={22} /></button>
      <div className="min-w-0"><p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300"><ShieldCheck size={14} /> supperAdmin</p><h1 className="flex items-center gap-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl"><span aria-hidden="true" className="h-7 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />{title}</h1></div>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="relative"><button type="button" onClick={() => setNotificationsOpen(open => !open)} aria-label="การแจ้งเตือน" aria-expanded={notificationsOpen} className="grid size-10 place-items-center rounded-xl motion-safe:transition-all hover:-translate-y-0.5 hover:bg-blue-50 dark:hover:bg-slate-800"><Bell size={20} /></button>{notificationsOpen && <div className="absolute right-0 top-12 z-40 w-60 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">ไม่มีการแจ้งเตือนใหม่</div>}</div>
        <button type="button" onClick={onToggleDark} aria-label="เปลี่ยนธีม" className="grid size-10 place-items-center rounded-xl motion-safe:transition-all hover:-rotate-12 hover:bg-blue-50 dark:hover:bg-slate-800">{dark ? <Sun size={20} /> : <Moon size={20} />}</button>
      </div>
    </div>
  </header>;
}
