export type AiAttachment = { name: string; mimeType: string; data: string };

const maxFileBytes = 8 * 1024 * 1024;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
    reader.readAsDataURL(blob);
  });
}

export async function prepareAiAttachment(file: File): Promise<AiAttachment> {
  if (file.size > maxFileBytes) throw new Error("ไฟล์แนบต้องมีขนาดไม่เกิน 8 MB");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["xlsx", "xls"].includes(extension || "")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const text = workbook.SheetNames.slice(0, 5).map((name) => {
      const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, blankrows: false }).slice(0, 200);
      return `ชีต: ${name}\n${rows.map((row) => row.join("\t")).join("\n")}`;
    }).join("\n\n").slice(0, 100_000);
    if (!text.trim()) throw new Error("ไม่พบข้อมูลในตาราง Excel");
    return { name: file.name, mimeType: "text/plain", data: await toBase64(new Blob([text])) };
  }
  if (["txt", "csv"].includes(extension || "")) {
    const text = (await file.text()).slice(0, 100_000);
    return { name: file.name, mimeType: "text/plain", data: await toBase64(new Blob([text])) };
  }
  const mimeType = extension === "pdf" ? "application/pdf"
    : extension === "png" ? "image/png"
    : ["jpg", "jpeg"].includes(extension || "") ? "image/jpeg"
    : extension === "webp" ? "image/webp" : "";
  if (!mimeType) throw new Error("รองรับ PDF, รูปภาพ, TXT, CSV และ Excel เท่านั้น");
  return { name: file.name, mimeType, data: await toBase64(file) };
}
