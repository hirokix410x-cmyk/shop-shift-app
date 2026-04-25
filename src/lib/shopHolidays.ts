import type { ShopName } from "./types";
import type { ShopHoliday } from "./types";

export function isShopClosedOn(
  shop: ShopName,
  date: string,
  holidays: readonly ShopHoliday[],
): boolean {
  for (const h of holidays) {
    if (h.shop === shop && h.date === date) {
      return true;
    }
  }
  return false;
}
