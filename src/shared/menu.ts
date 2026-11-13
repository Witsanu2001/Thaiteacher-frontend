export type MenuItem = {
  label: string;
  path: string;
  role: "teacher" | "superAdmin";
};

export const menuConfig: MenuItem[] = [
  { label: "Dashboard", path: "/admin/dashboard", role: "superAdmin" },
  { label: "ผู้ใช้งาน", path: "/admin/users", role: "superAdmin" },
  { label: "บริการลูกค้า", path: "/admin/support", role: "superAdmin" },
  { label: "ประกาศ", path: "/admin/announcements", role: "superAdmin" },
  { label: "เคลียร์ข้อมูลผู้ใช้", path: "/admin/clear-users", role: "superAdmin" },
  { label: "ผู้ช่วย AI", path: "/admin/gimini-ai", role: "superAdmin" },
  { label: "ภาพรวมงบประมาณ", path: "/finance/school-finance", role: "teacher" },
  {
    label: "ทะเบียนคุมเงิน",
    path: "/finance/money-register",
    role: "teacher",
  },
  {
    label: "รายรับ–รายจ่าย",
    path: "/finance/income-expense",
    role: "teacher",
  },
  {
    label: "ใบสำคัญและหลักฐาน",
    path: "/finance/vouchers",
    role: "teacher",
  },
  { label: "สัญญาการยืมเงิน", path: "/finance/loan-contracts", role: "teacher" },
  { label: "โครงการ", path: "/finance/projects", role: "teacher" },
  { label: "ส่งออกทะเบียน", path: "/finance/exports", role: "teacher" },
  {
    label: "จัดแบบฟอร์มรายงาน",
    path: "/finance/report-settings",
    role: "teacher",
  },
  { label: "ติดต่อเรา", path: "/finance/contact", role: "teacher" },
  { label: "ผู้ช่วย AI", path: "/finance/gimini-ai", role: "teacher" },
];

export const menuPaths = Object.fromEntries(
  menuConfig.map(({ label, path }) => [label, path]),
) as Record<MenuItem["label"], string>;

export function getMenuItem(label: string): MenuItem {
  const item = menuConfig.find((menuItem) => menuItem.label === label);
  if (!item) throw new Error(`Unknown menu item: ${label}`);
  return item;
}

export function pageFromPath(pathname: string, isAdmin = false) {
  const menuItem = menuConfig.find((item) => item.path === pathname);
  return (
    menuItem?.label ??
    (isAdmin ? getMenuItem("Dashboard").label : getMenuItem("ภาพรวมงบประมาณ").label)
  );
}

export function pathForPage(label: string, role?: MenuItem["role"]) {
  const matchingItems = menuConfig.filter((item) => item.label === label);
  const item = role
    ? matchingItems.find((menuItem) => menuItem.role === role)
    : matchingItems.find((menuItem) => menuItem.role === "teacher") ??
      matchingItems[0];
  return (
    item?.path ??
    getMenuItem("ภาพรวมงบประมาณ").path
  );
}
