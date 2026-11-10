export type BalanceRow={name:string;cash:number;bank:number;government:number;note?:string;level?:number;group?:boolean};
export type DailyReport={date:string;rows:BalanceRow[]};
export type FinanceSchool={name:string;reports:DailyReport[]};
export type EvidenceAttachment={name:string;data:string};
export type CashbookEntry={id:string;date:string;kind:'income'|'expense';category:string;account:'cash'|'bank'|'government';documentNo:string;description:string;amount:number;party:string;note:string;attachment?:EvidenceAttachment};
