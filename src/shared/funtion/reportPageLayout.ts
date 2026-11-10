import { scopedStorage } from './scopedStorage';
import type { ReceiptDateMode } from './exportFormConfig';
export const defaultTableHeaders=['ประเภท','เงินสด','เงินฝากธนาคาร','เงินฝากส่วนราชการผู้เบิก','รวม','หมายเหตุ'];
export type ReportBlockType = 'text' | 'date' | 'signature' | 'divider' | 'table';
export type ReportBlock = { id: string; type: ReportBlockType; text?: string; name?: string; position?: string; dateMode?: ReceiptDateMode; manualDate?: string; align?: 'left' | 'center' | 'right'; bold?: boolean; italic?: boolean; underline?: boolean; signatureLabel?: string; signatureSuffix?: string; signatureTemplate?: string; tableHeaders?: string[]; tableHeaderAlign?: 'left' | 'center' | 'right'; tableHeaderColor?: 'white' | 'blue' | 'gray'; tableHeaderBold?: boolean; tableHeaderFontSize?: number; fontSize?: number; tableFontSize?: number; showSignatureLine?: boolean; showNameLine?: boolean };
export type ReportLayoutRow = { id: string; columns: 1 | 2 | 3; blocks: (ReportBlock | null)[] };
export type ReportLayoutPage = { id: string; rows: ReportLayoutRow[] };
export type ReportLayout = { pages: ReportLayoutPage[] };
export const newId = () => Math.random().toString(36).slice(2, 10);
const block=(type:ReportBlockType,text?:string,position?:string):ReportBlock=>({id:newId(),type,text,position,dateMode:'report',align:type==='text'&&text==='รายงานเงินคงเหลือประจำวัน'?'center':undefined});
const signature=(role:string):ReportBlock=>({...block('signature'),text:`ลงชื่อ............................................. ${role}\n(.............................................)\nตำแหน่ง .............................................`});
const row=(columns:1|2|3,blocks:(ReportBlock|null)[]):ReportLayoutRow=>({id:newId(),columns,blocks});
export const defaultReportLayout=(school:string):ReportLayout=>({pages:[{id:newId(),rows:[
 row(1,[block('text',school)]),
 row(1,[block('text','รายงานเงินคงเหลือประจำวัน')]),
 row(1,[block('date')]),
 row(1,[block('table')]),
 row(2,[null,signature('ผู้จัดทำรายงาน')]),
 row(1,[block('text','คณะกรรมการเก็บรักษาเงินได้ตรวจนับเงินสดคงเหลือประจำวันถูกต้องตามรายการข้างต้นแล้ว')]),
 row(3,[signature('กรรมการ'),signature('กรรมการ'),signature('กรรมการ')]),
 row(2,[null,signature('หัวหน้าหน่วยงาน')]),
 row(1,[block('divider')]),
 row(2,[block('text','ข้าพเจ้าผู้รับมอบหมายได้รับเงินสดตามรายการข้างต้นแล้ว'),block('date')]),
 row(2,[null,signature('ผู้รับเงิน')]),
 ]}]});
export const layoutKey=(school:string)=>`school-report-layout:${school}`;
export const loadReportLayout=(school:string):ReportLayout=>{
 try {const saved=JSON.parse(scopedStorage.getItem(layoutKey(school))||'null');if(saved?.pages?.length&&Array.isArray(saved.pages)){for(const page of saved.pages)for(const row of page.rows||[])for(const item of row.blocks||[])if(item?.type==='signature'&&item.signatureSuffix===undefined&&['ผู้จัดทำรายงาน','กรรมการ','หัวหน้าหน่วยงาน','ผู้รับเงิน'].includes(item.position)){item.signatureSuffix=item.position;item.position=''}return saved as ReportLayout}}catch{/* use default */}
 return defaultReportLayout(school);
};
export const hasSavedReportLayout=(school:string)=>Boolean(scopedStorage.getItem(layoutKey(school)));
export const saveReportLayout=(school:string,layout:ReportLayout)=>scopedStorage.setItem(layoutKey(school),JSON.stringify(layout));
export const reportDateText=(iso:string)=>{const [year,month,day]=iso.split('-').map(Number);return `${day} ${new Intl.DateTimeFormat('th-TH',{month:'long'}).format(new Date(year,month-1,1))} ${year+543}`};
const todayIso=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Bangkok'});
const shift=(iso:string,days:number)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10)};
export const blockDateText=(item:ReportBlock,reportDate:string)=>{
 const template=item.text??(item.dateMode==='manual'?item.manualDate||'วันที่ ................................':'วันที่ {วัน} เดือน {เดือน} พ.ศ. {ปี}');
 if(!/\{(?:วัน|เดือน|ปี|วันที่)\}/.test(template))return template;
 const target=item.dateMode==='today'?todayIso():item.dateMode==='previous'?shift(reportDate,-1):item.dateMode==='next'?shift(reportDate,1):reportDate;
 const [year,month,day]=target.split('-').map(Number);
 const thaiMonth=new Intl.DateTimeFormat('th-TH',{month:'long'}).format(new Date(year,month-1,1));
 return template.replaceAll('{วันที่}',reportDateText(target)).replaceAll('{วัน}',String(day)).replaceAll('{เดือน}',thaiMonth).replaceAll('{ปี}',String(year+543));
};

export const defaultSignatureTemplate=(item:ReportBlock)=>[item.showSignatureLine===false?null:`${item.signatureLabel??'ลงชื่อ'}.............................................${item.signatureSuffix ? ` ${item.signatureSuffix}` : ''}`,item.name?.trim()||item.showNameLine!==false?'({ชื่อ})':null,item.position?.trim()?'ตำแหน่ง {ตำแหน่ง}':null].filter(Boolean).join('\n');
export const signatureText=(item:ReportBlock)=>item.text!==undefined?item.text:(item.signatureTemplate??defaultSignatureTemplate(item)).replaceAll('{ชื่อ}',item.name?.trim()||'.............................................').replaceAll('{ตำแหน่ง}',item.position?.trim()||'.............................................');
export const signatureLines=(item:ReportBlock)=>signatureText(item).split('\n');

