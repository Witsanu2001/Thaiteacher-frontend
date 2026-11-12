import { useRef, useState } from "react";
import { FileDown, Printer, X } from "lucide-react";
import {
  loanTotal,
  thaiBahtText,
  toAmount,
  type LoanContract,
} from "./loanContract";

const money = (value: number) =>
  value.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const dateText = (iso: string) =>
  iso
    ? new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${iso}T00:00:00Z`))
    : "................................";
function Fill({
  value,
  width = "min-w-24",
}: {
  value?: string;
  width?: string;
}) {
  return (
    <span
      className={`inline-block border-b border-dotted border-black px-1 text-center align-baseline ${width}`}
    >
      {value || " "}
    </span>
  );
}
const cell = "border border-black px-1.5 py-0.5 align-top";

export default function LoanContractPreview({
  contract,
  school,
  onClose,
  onPrint,
}: {
  contract: LoanContract;
  school: string;
  onClose: () => void;
  onPrint: () => void;
}) {
  const pages = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const total = loanTotal(contract);
  const repayments = (contract.repayments || []).reduce<Array<{ date: string; description: string; amount: string; receiptNo: string; remaining: number }>>((rows, item) => {
    const previous = rows.at(-1)?.remaining ?? total;
    rows.push({ ...item, remaining: Math.max(0, previous - toAmount(item.amount)) });
    return rows;
  }, []);
  const exportPdf = async () => {
    if (!pages.current || exporting) return;
    setExporting(true);
    setError("");
    try {
      await document.fonts.ready;
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const paper =
        pages.current.querySelectorAll<HTMLElement>("[data-loan-page]");
      for (const [index, page] of Array.from(paper).entries()) {
        const image = await toPng(page, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          cacheBust: true,
        });
        if (index) pdf.addPage();
        pdf.addImage(image, "PNG", 0, 0, 210, 297);
      }
      pdf.save(
        `สัญญาการยืมเงิน_${contract.number || contract.loanDate || "ใหม่"}.pdf`,
      );
    } catch {
      setError("สร้าง PDF ไม่สำเร็จ กรุณาลองพิมพ์เอกสารแทน");
    } finally {
      setExporting(false);
    }
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ตัวอย่างสัญญาการยืมเงิน"
      className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/70 p-2 sm:p-5 print:static print:overflow-visible print:bg-white print:p-0"
    >
      <div className="mx-auto max-w-[210mm]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 dark:bg-slate-900 print:hidden">
          <div>
            <h2 className="font-semibold">ตัวอย่างสัญญาการยืมเงิน</h2>
            <p className="text-xs text-slate-500">
              แบบฟอร์มหน้า–หลังตามไฟล์ต้นฉบับ · ตรวจข้อมูลก่อนพิมพ์
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { onPrint(); window.print(); }}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300"
            >
              <Printer size={17} /> พิมพ์
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void exportPdf()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <FileDown size={17} /> {exporting ? "กำลังสร้าง…" : "บันทึก PDF"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดตัวอย่าง"
              className="rounded-lg border border-slate-300 p-2 dark:border-slate-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 print:hidden"
          >
            {error}
          </p>
        )}
        <div ref={pages} className="space-y-4 print:space-y-0">
          <section
            data-loan-page
            className="mx-auto min-h-[297mm] w-[210mm] bg-white px-[16mm] py-[12mm] font-sarabun text-[15pt] leading-[1.13] text-black shadow-xl print:min-h-[297mm] print:shadow-none print:break-after-page"
          >
            <table className="w-full table-fixed border-collapse">
              <tbody>
                <tr>
                  <th colSpan={2} className={`${cell} text-center font-bold`}>
                    สัญญาการยืมเงิน
                  </th>
                </tr>
                <tr>
                  <td className={`${cell} h-[24mm] w-[76%] align-middle`}>
                    ยื่นต่อ{" "}
                    <Fill value={contract.submittedTo} width="min-w-[65%]" />
                    <br />
                    วันที่ทำสัญญา{" "}
                    <Fill
                      value={dateText(contract.loanDate)}
                      width="min-w-40"
                    />
                  </td>
                  <td className={`${cell} w-[24%] text-center`}>
                    เลขที่ <Fill value={contract.number} width="min-w-16" />
                    <br />
                    วันครบกำหนด
                    <br />
                    <Fill
                      value={dateText(contract.dueDate)}
                      width="min-w-full"
                    />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className={`${cell} py-2 leading-[1.42]`}>
                    ข้าพเจ้า{" "}
                    <Fill value={contract.borrower} width="min-w-[42%]" />{" "}
                    ตำแหน่ง{" "}
                    <Fill value={contract.position} width="min-w-[34%]" />
                    <br />
                    สังกัด{" "}
                    <Fill
                      value={contract.affiliation}
                      width="min-w-[43%]"
                    />{" "}
                    จังหวัด{" "}
                    <Fill value={contract.province} width="min-w-[36%]" />
                    <br />
                    มีความประสงค์ขอยืมเงินจาก{" "}
                    <Fill value={contract.borrowFrom} width="min-w-[68%]" />
                    <br />
                    เพื่อเป็นค่าใช้จ่ายในการ{" "}
                    <Fill value={contract.purpose} width="min-w-[62%]" />{" "}
                    ดังรายละเอียดต่อไปนี้
                  </td>
                </tr>
              </tbody>
            </table>
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  <th className={`${cell} w-[76%] text-center`}>รายการ</th>
                  <th className={`${cell} text-center`}>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  { length: Math.max(5, contract.expenses.length) },
                  (_, index) => (
                    <tr key={index} className="h-[9mm]">
                      <td className={cell}>
                        {contract.expenses[index]?.description || " "}
                      </td>
                      <td className={`${cell} text-right tabular-nums`}>
                        {contract.expenses[index]?.amount
                          ? money(toAmount(contract.expenses[index].amount))
                          : " "}
                      </td>
                    </tr>
                  ),
                )}
                <tr>
                  <td className={`${cell} text-center`}>
                    (
                    {contract.amountWords ||
                      thaiBahtText(total) ||
                      "........................................"}
                    ) รวมเงิน
                  </td>
                  <td className={`${cell} text-right font-bold tabular-nums`}>
                    {money(total)}
                  </td>
                </tr>
              </tbody>
            </table>
            <table className="w-full table-fixed border-collapse">
              <tbody>
                <tr>
                  <td className={`${cell} py-2 text-justify leading-[1.28]`}>
                    {" "}
                    ข้าพเจ้าสัญญาว่าจะปฏิบัติตามระเบียบของทางราชการทุกประการ
                    และจะนำใบสำคัญจ่ายที่ถูกต้องพร้อมทั้งเงินเหลือจ่าย (ถ้ามี)
                    ส่งใช้ภายในกำหนดไว้ในระเบียบการเบิกจ่ายเงินจากคลัง คือภายใน{" "}
                    <Fill value={contract.repaymentDays} width="min-w-10" /> วัน
                    นับแต่วันที่ได้รับเงินยืมนี้/กลับมาถึง
                    ถ้าข้าพเจ้าไม่ส่งตามกำหนด ข้าพเจ้ายินยอมให้หักเงินเดือน
                    ค่าจ้าง เบี้ยหวัด บำเหน็จบำนาญ
                    หรือเงินอื่นใดที่ข้าพเจ้าจะพึงได้รับจากทางราชการชดใช้จำนวนเงินที่ยืมไปจนครบถ้วนได้ทันที
                    <div className="mt-2 flex justify-around">
                      <span>
                        (ลงชื่อ){" "}
                        <Fill width="min-w-32" />{" "}
                        ผู้ยืม
                      </span>
                      <span>
                        วันที่{" "}
                        <Fill
                          width="min-w-32"
                        />
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={`${cell} py-1.5 leading-[1.25]`}>
                    เสนอ {contract.submittedTo || `ผู้อำนวยการ${school}`}
                    <br /> ได้ตรวจสอบแล้ว
                    เห็นสมควรให้ยืมเงินตามสัญญายืมเงินฉบับนี้ได้ จำนวนเงิน{" "}
                    <Fill value={money(total)} width="min-w-24" /> บาท
                    <br />(
                    {contract.amountWords ||
                      thaiBahtText(total) ||
                      "................................"}
                    )
                    <div className="mt-1 text-center">
                      (ลงชื่อ){" "}
                      <Fill width="min-w-32" />{" "}
                      เจ้าหน้าที่การเงิน วันที่{" "}
                      <Fill
                        width="min-w-28"
                      />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={`${cell} py-1.5 leading-[1.25]`}>
                    <p className="text-center font-bold">คำอนุมัติ</p>{" "}
                    อนุมัติให้ยืมเงินตามเงื่อนไขข้างต้นได้ เป็นจำนวนเงิน{" "}
                    <Fill value={money(total)} width="min-w-24" /> บาท
                    <br />(
                    {contract.amountWords ||
                      thaiBahtText(total) ||
                      "................................"}
                    )
                    <div className="mt-1 text-center">
                      (ลงชื่อ){" "}
                      <Fill width="min-w-32" />{" "}
                      ผู้อนุมัติ วันที่{" "}
                      <Fill
                        width="min-w-28"
                      />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={`${cell} py-1.5 leading-[1.25]`}>
                    <p className="text-center font-bold">ใบรับเงิน</p>{" "}
                    ได้รับเงินจำนวนเงิน{" "}
                    <Fill value={money(total)} width="min-w-24" /> บาท (
                    {contract.amountWords ||
                      thaiBahtText(total) ||
                      "................................"}
                    ) ไว้ถูกต้องแล้ว
                    <div className="mt-1 text-center">
                      (ลงชื่อ){" "}
                      <Fill width="min-w-32" />{" "}
                      ผู้รับเงิน วันที่{" "}
                      <Fill
                        width="min-w-28"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
          <section
            data-loan-page
            className="mx-auto min-h-[297mm] w-[210mm] bg-white px-[16mm] py-[12mm] font-sarabun text-[15pt] leading-[1.16] text-black shadow-xl print:min-h-[297mm] print:shadow-none"
          >
            <h3 className="mb-5 text-center text-[18pt] font-bold">
              รายการส่งใช้เงินยืม
            </h3>
            <table className="w-full table-fixed border-collapse text-center">
              <thead>
                <tr>
                  <th rowSpan={2} className={`${cell} w-[7%] align-middle`}>
                    ครั้งที่
                  </th>
                  <th rowSpan={2} className={`${cell} w-[16%] align-middle`}>
                    วัน เดือน ปี
                  </th>
                  <th colSpan={2} className={cell}>
                    รายการส่งใช้
                  </th>
                  <th rowSpan={2} className={`${cell} w-[12%] align-middle`}>
                    คงค้าง
                  </th>
                  <th rowSpan={2} className={`${cell} w-[14%] align-middle`}>
                    ลายมือผู้รับ
                  </th>
                  <th rowSpan={2} className={`${cell} w-[10%] align-middle`}>
                    ใบรับเลขที่
                  </th>
                </tr>
                <tr>
                  <th className={`${cell} w-[24%]`}>เงินสด/ใบสำคัญ</th>
                  <th className={`${cell} w-[17%]`}>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 19 }, (_, index) => (
                  <tr key={index} className="h-[10mm]">
                    <td className={cell}>{repayments[index] ? index + 1 : " "}</td>
                    <td className={cell}>{repayments[index]?.date ? dateText(repayments[index].date) : " "}</td>
                    <td className={`${cell} text-left`}>{repayments[index]?.description || " "}</td>
                    <td className={`${cell} text-right tabular-nums`}>{repayments[index]?.amount ? money(toAmount(repayments[index].amount)) : " "}</td>
                    <td className={`${cell} text-right tabular-nums`}>{repayments[index]?.amount ? money(repayments[index].remaining) : " "}</td>
                    <td className={cell}> </td>
                    <td className={cell}>{repayments[index]?.receiptNo || " "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
