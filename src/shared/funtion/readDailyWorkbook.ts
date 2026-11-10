import * as XLSX from 'xlsx';
import type { BalanceRow, DailyReport } from './types';
export type ImportedRow = BalanceRow;
export type ImportedReport = DailyReport;
const value = (v:unknown) => {const n=Number(String(v??'').replaceAll(',','').trim());return Number.isFinite(n)&&n>=0?Math.round((n+Number.EPSILON)*100)/100:0};
const sheetDate = (name:string) => {const m=name.trim().match(/^(\d{2})(\d{2})(\d{2})$/);if(!m)return null;const year=2500+Number(m[3])-543,month=Number(m[2]),day=Number(m[1]);const date=new Date(year,month-1,day);return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?`${year}-${m[2]}-${m[1]}`:null};
export async function readDailyWorkbook(file:File):Promise<{school:string;reports:ImportedReport[];skipped:string[]}> {
 const book=XLSX.read(await file.arrayBuffer(),{type:'array'});const reports:ImportedReport[]=[];const skipped:string[]=[];let school='';
 for(const sheetName of book.SheetNames){const date=sheetDate(sheetName);if(!date){skipped.push(sheetName);continue}const cells:unknown[][]=XLSX.utils.sheet_to_json(book.Sheets[sheetName],{header:1,defval:'',raw:true});const header=cells.findIndex(r=>String(r[0]).trim()==='ประเภท'&&String(r[1]).includes('เงินสด'));if(header<0){skipped.push(sheetName);continue}if(!school)school=String(cells[0]?.[0]??'').trim();const rows:ImportedRow[]=[];
 const sourceRows=cells.slice(header+1);for(const r of sourceRows){const raw=String(r[0]??'');const name=raw.trim();if(/รวมทั้งสิ้น/.test(name))break;if(!name||/^(ลงชื่อ|คณะกรรมการ|ตำแหน่ง)/.test(name))continue;const dash=raw.match(/^\s*-([ \t]*)/);const level=dash?dash[1].length>=3?2:1:0;rows.push({name:name.replace(/^-\s*/,''),cash:value(r[1]),bank:value(r[2]),government:value(r[3]),note:String(r[5]??'').trim(),level})}
 for(let i=0;i<rows.length-1;i++){if((rows[i+1].level??0)>(rows[i].level??0))rows[i].group=true}
 if(rows.length)reports.push({date,rows});else skipped.push(sheetName)
 }
 if(!reports.length)throw new Error('ไม่พบชีตวันที่รูปแบบ ววปปพพ เช่น 051169 พร้อมหัวตารางประเภทและเงินสด');return {school,reports:reports.sort((a,b)=>a.date.localeCompare(b.date)),skipped};
}

