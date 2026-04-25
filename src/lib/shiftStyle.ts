import { isHqStaff } from "./master";
import type { ShiftRow } from "./types";

export function rowCardClassName(row: ShiftRow): string {
  if (row.staff_name == null) {
    return "border-red-400 bg-red-50 text-red-900 shadow-sm";
  }
  if (isHqStaff(row.staff_name)) {
    return "border-blue-400 bg-blue-50 text-blue-950 shadow-sm";
  }
  return "border-stone-200 bg-white";
}
