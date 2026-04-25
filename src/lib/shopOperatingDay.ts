import holiday_jp from "@holiday-jp/holiday_jp";
import type { ShopName, ShopDayOverride } from "./types";
import { toISODateString } from "./dateUtils";

/**
 * デフォルトで営業日とみなす日（月〜金 かつ 内閣府の「国民の休日」に該当しない）。
 * 土日・祝日は false。
 */
export function isDefaultOperatingDay(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(12, 0, 0, 0);
  const w = dt.getDay();
  if (w === 0 || w === 6) {
    return false;
  }
  if (holiday_jp.isHoliday(iso)) {
    return false;
  }
  return true;
}

export function hasDayOverride(
  shop: ShopName,
  date: string,
  overrides: readonly ShopDayOverride[],
): boolean {
  for (const o of overrides) {
    if (o.shop === shop && o.date === date) {
      return true;
    }
  }
  return false;
}

/**
 * 営業・休業の実効（API の優先ルール）:
 * - 登録あり かつ 土日祝 → 営業（特別営業）→ 閉店ではない
 * - 登録あり かつ 平日(祝外) → 休業（特別休業）→ 閉店
 * - 登録なし かつ 土日祝 → 休業
 * - 登録なし かつ 平日(祝外) → 営業
 */
export function isStoreClosed(
  shop: ShopName,
  date: string,
  overrides: readonly ShopDayOverride[],
): boolean {
  const has = hasDayOverride(shop, date, overrides);
  const defOpen = isDefaultOperatingDay(date);
  if (has) {
    // 登録あり: 土日祝 → 特別営業（開）; 平日(祝外) → 特別休業（閉）
    return defOpen;
  }
  // 登録なし: デフォルトどおり（土日祝は休み、平日祝外は営業）
  return !defOpen;
}

/** 特別営業日（元が休業デフォの日に登録あり） */
export function isSpecialOperatingDay(
  shop: ShopName,
  date: string,
  overrides: readonly ShopDayOverride[],
): boolean {
  return hasDayOverride(shop, date, overrides) && !isDefaultOperatingDay(date);
}

/** 特別休業日（元が営業デフォの日に登録あり） */
export function isSpecialClosedDay(
  shop: ShopName,
  date: string,
  overrides: readonly ShopDayOverride[],
): boolean {
  return hasDayOverride(shop, date, overrides) && isDefaultOperatingDay(date);
}

/** 表示用: Date から */
export function isDefaultOperatingDate(d: Date): boolean {
  return isDefaultOperatingDay(toISODateString(d));
}
