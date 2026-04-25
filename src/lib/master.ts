export const SHOPS = ["中村学園大学前店", "九産大店"] as const;

export const STAFFS: Record<string, string[]> = {
  中村学園大学前店: ["福田"],
  九産大店: ["宮﨑"],
  本部社員: ["榎本", "七種", "大角", "平田"],
} as const;

export const HQ_STAFFS = new Set<string>(STAFFS["本部社員"]);

export function staffOptionsForShop(shop: string): string[] {
  const local = STAFFS[shop];
  if (!local) return [...STAFFS["本部社員"]];
  return [...local, ...STAFFS["本部社員"]];
}

export function isHqStaff(name: string | null | undefined): boolean {
  if (!name) return false;
  return HQ_STAFFS.has(name);
}

/** 氏名プルーダ用の重複なし候補（`STAFFS` の併合） */
export function allKnownStaffNameOptions(): string[] {
  const s = new Set<string>();
  for (const list of Object.values(STAFFS)) {
    for (const n of list) {
      s.add(n);
    }
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ja"));
}

/** マスタ＋登録データに出てくる氏名をまとめた候補 */
export function allStaffNamesForPicker(rows: readonly { staff_name: string | null }[]): string[] {
  const s = new Set<string>(allKnownStaffNameOptions());
  for (const r of rows) {
    if (r.staff_name) {
      s.add(r.staff_name);
    }
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ja"));
}

/** 月間表示タブ用の短い表示名 */
export const SHOP_TAB_LABEL = {
  中村学園大学前店: "中村店",
  九産大店: "九産大店",
} as const;
