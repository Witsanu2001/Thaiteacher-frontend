import { scopedStorage } from './scopedStorage';
import type { ExportFormConfig } from './exportFormConfig';
import type { ReportLayout } from './reportPageLayout';
import type { BalanceRow as ArchivedRow } from './types';
export type ReportExportRecord={id:string;school:string;createdAt:string;format:'Excel'|'PDF'|'Word'|'Print';date:string;rows:ArchivedRow[];layout:ReportLayout|null;config:ExportFormConfig};
const key=(school:string)=>`school-report-exports:${school}`;
export const loadReportExports=(school:string):ReportExportRecord[]=>{try{const value=JSON.parse(scopedStorage.getItem(key(school))||'[]');return Array.isArray(value)?value:[]}catch{return []}};
export const recordReportExport=(entry:Omit<ReportExportRecord,'id'|'createdAt'>)=>{try{const next=[{...entry,id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,createdAt:new Date().toISOString()},...loadReportExports(entry.school)].slice(0,40);scopedStorage.setItem(key(entry.school),JSON.stringify(next));window.dispatchEvent(new Event('school-report-exported'))}catch{/* Export still succeeds when browser storage is full. */}};
export const removeReportExport=(school:string,id:string)=>{scopedStorage.setItem(key(school),JSON.stringify(loadReportExports(school).filter(item=>item.id!==id)));window.dispatchEvent(new Event('school-report-exported'))};

