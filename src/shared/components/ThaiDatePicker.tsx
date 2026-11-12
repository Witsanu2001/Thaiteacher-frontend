import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { thaiDate } from "../funtion/thaiDate";

const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const weekdays = ["อา","จ","อ","พ","พฤ","ศ","ส"];
export default function ThaiDatePicker({value,onChange,availableDates}:{value:string;onChange:(iso:string)=>void;availableDates?:string[]}) {
  const selected=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const [open,setOpen]=useState(false);
  const pickerRef=useRef<HTMLDivElement>(null);
  const [view,setView]=useState(()=>({year:selected?Number(selected[1]):new Date().getFullYear(),month:selected?Number(selected[2])-1:new Date().getMonth()}));
  useEffect(()=>{
    if(!open)return;
    const closeOnOutsideClick=(event:PointerEvent)=>{
      if(event.target instanceof Node&&!pickerRef.current?.contains(event.target))setOpen(false);
    };
    document.addEventListener("pointerdown",closeOnOutsideClick);
    return ()=>document.removeEventListener("pointerdown",closeOnOutsideClick);
  },[open]);
  const move=(delta:number)=>{const date=new Date(view.year,view.month+delta,1);setView({year:date.getFullYear(),month:date.getMonth()})};
  const first=new Date(view.year,view.month,1).getDay();
  const days=new Date(view.year,view.month+1,0).getDate();
  const available=availableDates?new Set(availableDates):null;
  return <div ref={pickerRef} className="relative inline-block">
    <button type="button" aria-label={`เลือกวันที่ ${thaiDate(value)}`} aria-expanded={open} onClick={()=>{if(!open&&selected)setView({year:Number(selected[1]),month:Number(selected[2])-1});setOpen(!open)}} className="inline-flex h-12 min-w-44 items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium tabular-nums dark:border-slate-700 dark:bg-slate-900"><span>{thaiDate(value)}</span><CalendarDays size={18} className="text-blue-600"/></button>
    {open&&<div className="absolute left-0 top-full z-[80] mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between"><button type="button" aria-label="เดือนก่อน" onClick={()=>move(-1)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft size={18}/></button><strong className="text-sm">{months[view.month]} {view.year+543}</strong><button type="button" aria-label="เดือนถัดไป" onClick={()=>move(1)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight size={18}/></button></div><div className="grid grid-cols-7 gap-1 text-center text-sm">{weekdays.map(day=><span key={day} className="py-2 text-slate-500">{day}</span>)}{Array.from({length:first},(_,i)=><span key={`blank-${i}`}/>)}{Array.from({length:days},(_,i)=>{const day=i+1;const iso=`${view.year}-${String(view.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const disabled=available!==null&&!available.has(iso);return <button key={day} type="button" disabled={disabled} aria-label={thaiDate(iso)} onClick={()=>{onChange(iso);setOpen(false)}} className={`rounded-lg py-2.5 ${value===iso?'bg-blue-700 text-white':'hover:bg-blue-50 dark:hover:bg-slate-800'} disabled:cursor-not-allowed disabled:opacity-25`}>{day}</button>})}</div></div>}
  </div>;
}
