import { SHOP_TAB_LABEL } from "./master";
import type { ShiftStatus, ShopName, ShiftRow, ShiftType } from "./types";

/** 同一人物・同一日で物理的に重なる区分の組合せ */
export function shiftTypesTimeOverlap(t1: ShiftType, t2: ShiftType): boolean {
  if (t1 === "全日" || t2 === "全日") {
    return true;
  }
  if (t1 === "午前" && t2 === "午前") {
    return true;
  }
  if (t1 === "午後" && t2 === "午後") {
    return true;
  }
  if (t1 === "イレギュラー" || t2 === "イレギュラー") {
    return true;
  }
  return false;
}

export function doubleBookingErrorMessage(name: string, existingRow: ShiftRow): string {
  const place = SHOP_TAB_LABEL[existingRow.shop] ?? existingRow.shop;
  return `${name}さんは同日の${place}に既に登録されています。`;
}

function hasStaffOverlap(
  a: { staff_name: string | null; date: string; type: ShiftType; id: string },
  b: ShiftRow,
): boolean {
  if (!a.staff_name || !b.staff_name) {
    return false;
  }
  if (a.id === b.id) {
    return false;
  }
  if (a.staff_name !== b.staff_name) {
    return false;
  }
  if (a.date !== b.date) {
    return false;
  }
  return shiftTypesTimeOverlap(a.type, b.type);
}

/**
 * まず既存行との重複、次に同一リクエスト内の後から登録分との重複を検査する
 */
export function assertProposedShiftsNoTimeDoubleBook(
  proposed: readonly ShiftRow[],
  existing: readonly ShiftRow[],
  options: { excludeIds?: Set<string> } = {},
): void {
  const ex = options.excludeIds ?? new Set<string>();
  const base = existing.filter((e) => !ex.has(e.id));
  const pool: ShiftRow[] = [...base];
  for (const p of proposed) {
    for (const o of pool) {
      if (hasStaffOverlap(p, o)) {
        if (p.staff_name) {
          throw new TypeError(doubleBookingErrorMessage(p.staff_name, o));
        }
      }
    }
    pool.push(p);
  }
}

type Patch = {
  id: string;
  status?: ShiftStatus;
  type?: ShiftType;
  note?: string;
  staff_name?: string | null;
  date?: string;
  shop?: ShopName;
};

export function mergeShiftWithPatch(current: ShiftRow, p: Patch): ShiftRow {
  return {
    ...current,
    ...(p.status != null && { status: p.status }),
    ...(p.type != null && { type: p.type }),
    ...(p.note !== undefined && { note: p.note }),
    ...(p.staff_name !== undefined && { staff_name: p.staff_name }),
    ...(p.date != null && { date: p.date }),
    ...(p.shop != null && { shop: p.shop }),
  };
}

export function patchAffectsTimeOrPlace(p: Patch): boolean {
  return (
    p.date != null ||
    p.type != null ||
    p.staff_name !== undefined ||
    p.shop != null
  );
}
