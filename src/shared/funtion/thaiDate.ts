export const thaiDate = (iso:string) => {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${Number(match[1])+543}` : "เลือกวันที่";
};
