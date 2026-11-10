import { scopedStorage } from './scopedStorage';
export const readJson=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(scopedStorage.getItem(key)||'null')??fallback}catch{return fallback}};

