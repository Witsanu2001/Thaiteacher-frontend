export type ReceiptDateMode = 'report' | 'today' | 'previous' | 'next' | 'manual';
export type TableFontSize = 'compact' | 'standard' | 'large';
export type TableRowSpacing = 'compact' | 'standard';
export type TableBorder = 'thin' | 'medium';
export type ExportFormConfig = {
  schoolDisplayName: string;
  reportTitle: string;
  makerName: string;
  makerPosition: string;
  committeeStatement: string;
  committeeNames: [string, string, string];
  committeePositions: [string, string, string];
  headName: string;
  headPosition: string;
  receiptStatement: string;
  receiptDateMode: ReceiptDateMode;
  manualDate: string;
  receiptName: string;
  receiptPosition: string;
  subheadName: string;
  subheadPosition: string;
  showDivider: boolean;
  tableFontSize: TableFontSize;
  tableRowSpacing: TableRowSpacing;
  tableBorder: TableBorder;
  shadeHeader: boolean;
};
export const defaultExportConfig: ExportFormConfig = {
  schoolDisplayName: '',
  reportTitle: 'รายงานเงินคงเหลือประจำวัน',
  makerName: '', makerPosition: '',
  committeeStatement: 'คณะกรรมการเก็บรักษาเงินได้ตรวจนับเงินสดคงเหลือประจำวันถูกต้องตามรายการข้างต้นแล้ว และได้นำเงินสดเก็บรักษาไว้ในตู้นิรภัยเป็นที่เรียบร้อยแล้ว',
  committeeNames: ['', '', ''],
  committeePositions: ['กรรมการ', 'กรรมการ', 'กรรมการ'],
  headName: '', headPosition: '',
  receiptStatement: 'ข้าพเจ้าผู้รับมอบหมายได้รับเงินสดตามรายการข้างต้นแล้ว',
  receiptDateMode: 'report', manualDate: '',
  receiptName: '', receiptPosition: 'ผู้รับเงิน',
  subheadName: '', subheadPosition: 'หัวหน้าหน่วยงานย่อย',
  showDivider: true,
  tableFontSize: 'standard',
  tableRowSpacing: 'compact',
  tableBorder: 'thin',
  shadeHeader: false,
};

export const tableFontClass = (size: TableFontSize) => size === 'compact' ? 'print:text-[10pt]' : size === 'large' ? 'print:text-[12pt]' : 'print:text-[11pt]';
export const tablePaddingClass = (spacing: TableRowSpacing) => spacing === 'compact' ? 'print:p-1' : 'print:p-2';
export const tableBorderClass = (border: TableBorder) => border === 'medium' ? 'border-2 border-black' : 'border border-black';

const todayIso=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Bangkok'});
const shift=(iso:string,days:number)=>{const [year,month,day]=iso.split('-').map(Number);return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10)};
export const receiptDateText=(config:ExportFormConfig,reportDate:string)=>{
 if(config.receiptDateMode==='manual')return config.manualDate;
 const iso=config.receiptDateMode==='today'?todayIso():config.receiptDateMode==='previous'?shift(reportDate,-1):config.receiptDateMode==='next'?shift(reportDate,1):reportDate;
 const [year,month,day]=iso.split('-').map(Number);
 const monthName=new Intl.DateTimeFormat('th-TH',{month:'long'}).format(new Date(year,month-1,1));
 return `เมื่อวันที่ ${day} เดือน ${monthName} พ.ศ. ${year+543}`;
};
