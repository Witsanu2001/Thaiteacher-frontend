import { NavLink } from "react-router-dom";

export default function AiHeaderButton({ to }: { to: string }) {
  return <NavLink
    to={to}
    aria-label="เปิดผู้ช่วย Gemini AI"
    title="ผู้ช่วย Gemini AI"
    className={({ isActive }) => `grid size-10 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${isActive ? "bg-violet-100 dark:bg-violet-950" : "hover:bg-violet-50 dark:hover:bg-slate-800"}`}
  >
    <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none">
      <defs><linearGradient id="gemini-header-gradient" x1="2" y1="3" x2="21" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#2684FF"/><stop offset="0.5" stopColor="#A05CFF"/><stop offset="1" stopColor="#F26DB2"/></linearGradient></defs>
      <path d="M12 1.8c1.1 5.2 4.9 9 10.2 10.2-5.3 1.2-9.1 5-10.2 10.2C10.9 17 7.1 13.2 1.8 12 7.1 10.8 10.9 7 12 1.8Z" fill="url(#gemini-header-gradient)"/>
    </svg>
  </NavLink>;
}
