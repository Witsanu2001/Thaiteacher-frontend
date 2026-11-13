export function formatMoneyInput(raw: string) {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = dot < 0 ? cleaned : cleaned.slice(0, dot);
  const decimals = dot < 0 ? "" : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dot < 0 ? grouped : `${grouped || "0"}.${decimals}`;
}

export function parseMoneyInput(text: string) {
  return Number(text.replace(/,/g, ""));
}
