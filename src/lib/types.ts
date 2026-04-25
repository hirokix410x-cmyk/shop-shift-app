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
