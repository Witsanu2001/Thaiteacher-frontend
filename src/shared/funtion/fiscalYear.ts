export const todayIso=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Bangkok'});
export const fiscalYearOf=(iso:string)=>{const [year,month]=iso.split('-').map(Number);return year+543+(month>=10?1:0)};
export const firstDayOfFiscalYear=(year:number)=>`${year-544}-10-01`;
export const currentFiscalYear=()=>fiscalYearOf(new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Bangkok'}));
