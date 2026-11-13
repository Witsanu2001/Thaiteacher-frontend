# Google login และสิทธิ์ทดลองใช้งาน

สถานะแพ็กเกจมาจาก `GET /api/v1/users` และเก็บใน Firestore ฟิลด์ `users/{uid}.plan`: `trial` (ทดลองใช้ 9 วัน), `paid` (ถึงวันที่ `paidUntil`) หรือ `lifetime` (ฟรีตลอดชีพ) ผู้ใช้แก้แพ็กเกจเองไม่ได้ ผู้ดูแลกำหนดแพ็กเกจที่ชำระเงินหรือฟรีตลอดชีพจากฝั่งที่มีสิทธิ์เท่านั้น

หน้า **จัดการผู้ใช้งาน** แสดงเฉพาะบัญชีที่ `position` เป็น `SupperAdmin` ตรงตามตัวสะกดนี้ API ตรวจสิทธิ์ซ้ำที่ users-service: `GET /api/v1/users/admin` ดูรายชื่อทั้งหมด และ `PATCH /api/v1/users/admin/{uid}` แก้ชื่อ เบอร์ ตำแหน่ง โรงเรียน แพ็กเกจ และ `paidUntil` ต้องกำหนด `SupperAdmin` คนแรกจาก Firestore Console ด้วยสิทธิ์ผู้ดูแล แล้วรีสตาร์ต users-service และ deploy `firestore.rules` ก่อนใช้งานจริง

การเคลียร์ข้อมูลในหน้านี้ใช้ `GET/DELETE /api/v1/users/admin/{uid}/clear` แสดงจำนวนข้อมูลก่อน และต้องพิมพ์อีเมลตรงกับบัญชีเป้าหมาย บัญชี Auth ยังอยู่ แต่โปรไฟล์ถูกปิดใช้งานเพื่อไม่ให้สมัครทดลองซ้ำ ต้อง deploy ทั้ง `firestore.rules` และ `storage.rules` และให้ service account มีสิทธิ์ดูรายการ/ลบไฟล์ใน Storage

ระบบใช้ Firebase Authentication (Google), Cloud Firestore และ Cloud Storage โดยทดลองใช้งาน 9 วันนับจากการเข้าระบบครั้งแรก วันที่เริ่มทดลองถูกบันทึกด้วยเวลาเซิร์ฟเวอร์ของ Firestore และผู้ใช้แก้ไขไม่ได้ด้วยกฎที่ให้ไว้

ก่อนใช้งานจริง:

1. เปิด Google เป็น Sign-in provider ใน Firebase Authentication และเพิ่มโดเมนเว็บใน Authorized domains
2. สร้าง Cloud Firestore และ Cloud Storage ในโปรเจกต์ `thaiteacher-app`
3. ติดตั้ง Firebase CLI แล้วรัน `firebase login`, `firebase use thaiteacher-app` และ `firebase deploy --only firestore:rules,storage` จากโฟลเดอร์นี้
4. เมื่อได้ราคาและ QR รับเงิน ให้ใส่รูป QR ไว้ใน `public/` และตั้ง `VITE_PAYMENT_AMOUNT` กับ `VITE_PAYMENT_QR_URL` ใน `.env` ตาม `.env.example` แล้วเริ่ม Vite ใหม่
5. ตรวจสลิปใน Storage ที่ `payment-slips/{uid}/` จากนั้นผู้ดูแลกำหนด `users/{uid}.plan` เป็น `paid` และ `paidUntil` เป็น Firestore Timestamp วันหมดอายุใหม่ การอนุมัติจะทำให้ผู้ใช้กลับเข้าแอปได้

ระบบนี้เป็นการชำระด้วยการโอนและตรวจสลิปด้วยคน ไม่มีการตัดเงินอัตโนมัติ **รายงานงบประมาณรายวัน** บันทึกใน Firestore ผ่าน users-service และเรียกคืนข้ามอุปกรณ์ได้ โดย API ตรวจสิทธิ์แพ็กเกจ ข้อมูลรายรับ–รายจ่าย แบบฟอร์ม และหลักฐานส่วนอื่นยังอยู่ในเบราว์เซอร์ของบัญชีที่ล็อกอิน

เมื่อเปิดหน้ารายงาน ระบบจะนำรายงานที่มีเฉพาะในเครื่องขึ้น Firestore หากวันที่เดียวกันมีข้อมูลต่างจากบนระบบ ระบบใช้ข้อมูลบนระบบและให้ดาวน์โหลดสำเนาข้อมูลเดิมในเครื่องได้ การแก้ยอด ยกยอด เปิดปีพร้อมยอด และนำเข้า Excel ต้องบันทึก API สำเร็จก่อนจึงอัปเดตหน้าจอ

