import { SHOPS } from "./master";

export type ShopName = (typeof SHOPS)[number];

export type ShiftType = "全日" | "午前" | "午後" | "イレギュラー";

export type ShiftStatus = "希望" | "確定";

export type ShiftRow = {
  id: string;
  date: string; // YYYY-MM-DD
  shop: ShopName;
  staff_name: string | null;
  type: ShiftType;
  note: string;
  status: ShiftStatus;
};

/**
 * `shop_operating_days` シートの1行。意味は日付の種別で変わる:
 * - 土日祝: 特別**営業**（元は休み）
 * - 平日(祝外): 特別**休業**（元は営業）
 */
export type ShopDayOverride = {
  date: string;
  shop: ShopName;
};

