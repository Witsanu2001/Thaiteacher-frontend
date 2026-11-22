import qrPayment from "../../assets/qr_payment.jpg";

export const paymentConfig = {
  duration: "1 เดือน",
  qr: qrPayment,
  benefits: [
    "จัดการรายงานเงินคงเหลือประจำวันและทะเบียนคุมเงิน",
    "บันทึกรายรับ–รายจ่าย พร้อมหลักฐานแนบ",
    "จัดการโครงการ กิจกรรม และสัญญาการยืมเงิน",
    "จัดแบบฟอร์ม พิมพ์ และส่งออก Excel, PDF และ Word",
    "สำรองข้อมูล 3 ปี (เตรียมเปิดให้บริการ)",
  ],
} as const;
