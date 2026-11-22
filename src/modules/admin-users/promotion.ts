import type { UserProfile } from "../../config/services/users.service";
export function promotionOf(profile: UserProfile, now: number) {
 const price = profile.monthlyPriceSatang || 9900;
 const days = profile.trialDays || 9;
 const until = Date.parse(profile.createdAt || "") + days * 86400000;
 return {
  price: Number.isSafeInteger(price) && price > 0 ? `${(price/100).toLocaleString("th-TH", {maximumFractionDigits:2})} บาท/เดือน` : "ไม่ระบุราคา",
  trial: (profile.plan || (profile.paidUntil ? "paid" : "trial")) === "trial" && profile.billingMode !== "individual" && profile.billingMode !== "sponsored" && (!profile.status || profile.status === "active") && Number.isFinite(until) && until > now ? `ทดลอง ${days} วัน` : null,
 };
}
