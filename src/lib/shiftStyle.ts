import { shiftBoardCardSurfaceClass } from "./master";
import type { ShiftRow } from "./types";

export function rowCardClassName(row: ShiftRow): string {
  if (row.staff_name == null) {
    return "border-red-400 bg-red-50 text-red-900 shadow-sm";
  }
  return shiftBoardCardSurfaceClass(row.shop);
}
