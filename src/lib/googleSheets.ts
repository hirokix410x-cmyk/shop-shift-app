import { GoogleSpreadsheet, type GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { SHOPS } from "./master";
import type { ShiftRow, ShiftStatus, ShiftType, ShopName } from "./types";

export const SHIFT_SHEET_HEADER = [
  "id",
  "date",
  "shop",
  "staff_name",
  "type",
  "note",
  "status",
] as const;

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"] as const;

const SHIFT_TYPE_SET = new Set<string>(["全日", "午前", "午後", "イレギュラー"]);
const STATUS_SET = new Set<string>(["希望", "確定"]);
const SHOP_SET = new Set<string>(SHOPS);

export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n");
}

type SheetEnv = { email: string; key: string; sheetId: string };

function readSheetEnv(): SheetEnv {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  if (!email) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL が未設定です");
  }
  if (rawKey == null || rawKey === "") {
    throw new Error("GOOGLE_PRIVATE_KEY が未設定です");
  }
  if (!sheetId) {
    throw new Error("GOOGLE_SHEET_ID が未設定です");
  }
  return { email, key: normalizePrivateKey(rawKey), sheetId };
}

function getJwt() {
  const { email, key } = readSheetEnv();
  return new JWT({
    email,
    key,
    scopes: [...SCOPES],
  });
}

function cellString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

export function parseRowToShift(
  row: GoogleSpreadsheetRow<Record<string, string | number | boolean | null>>,
): ShiftRow | null {
  const id = cellString(row.get("id"));
  const date = cellString(row.get("date"));
  if (!id || !date) return null;

  const shopRaw = cellString(row.get("shop"));
  if (!SHOP_SET.has(shopRaw)) return null;
  const shop = shopRaw as ShopName;

  const staffNameRaw = cellString(row.get("staff_name"));
  const staff_name = staffNameRaw === "" ? null : staffNameRaw;

  const typeRaw = cellString(row.get("type"));
  if (!SHIFT_TYPE_SET.has(typeRaw)) return null;
  const type = typeRaw as ShiftType;

  const note = cellString(row.get("note"));

  const statusRaw = cellString(row.get("status"));
  if (!STATUS_SET.has(statusRaw)) return null;
  const status = statusRaw as ShiftStatus;

  return { id, date, shop, staff_name, type, note, status };
}

function shiftToRecord(row: ShiftRow): Record<string, string> {
  return {
    id: row.id,
    date: row.date,
    shop: row.shop,
    staff_name: row.staff_name ?? "",
    type: row.type,
    note: row.note,
    status: row.status,
  };
}

/**
 * 先頭のワークシートをシフト用にし、1行目をヘッダーとして読み込む。
 * 1行目が空なら `SHIFT_SHEET_HEADER` を書き込む。
 */
export async function getShiftsWorksheet() {
  const { sheetId } = readSheetEnv();
  const doc = new GoogleSpreadsheet(sheetId, getJwt());
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  if (!sheet) {
    throw new Error("スプレッドシートにシートがありません");
  }
  await sheet.loadHeaderRow(1);
  const emptyHeader =
    !sheet.headerValues ||
    sheet.headerValues.length === 0 ||
    sheet.headerValues.every((h) => !String(h ?? "").trim());
  if (emptyHeader) {
    await sheet.setHeaderRow([...SHIFT_SHEET_HEADER]);
  }
  return sheet;
}

export async function listShiftsFromSheet(): Promise<ShiftRow[]> {
  const sheet = await getShiftsWorksheet();
  const rows = await sheet.getRows();
  const out: ShiftRow[] = [];
  for (const r of rows) {
    const s = parseRowToShift(r);
    if (s) out.push(s);
  }
  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.shop.localeCompare(b.shop) || a.type.localeCompare(b.type),
  );
  return out;
}

export async function appendShiftToSheet(shift: ShiftRow): Promise<void> {
  const sheet = await getShiftsWorksheet();
  await sheet.addRow(shiftToRecord(shift));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * クライアント POST 用: API で受け取った JSON を ShiftRow に検証する
 */
export function shiftFromRequestBody(data: unknown): ShiftRow {
  if (!data || typeof data !== "object") {
    throw new TypeError("JSON オブジェクトが必要です");
  }
  const o = data as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  if (!id) throw new TypeError("id が空です");

  const date = String(o.date ?? "").trim();
  if (!DATE_RE.test(date)) {
    throw new TypeError("date は YYYY-MM-DD 形式で指定してください");
  }

  const shopRaw = String(o.shop ?? "").trim();
  if (!SHOP_SET.has(shopRaw)) {
    throw new TypeError("shop が正しくありません");
  }
  const shop = shopRaw as ShopName;

  const sn = o.staff_name;
  const staff_name = sn == null || String(sn).trim() === "" ? null : String(sn).trim();

  const typeRaw = String(o.type ?? "").trim();
  if (!SHIFT_TYPE_SET.has(typeRaw)) {
    throw new TypeError("type（全日/午前/午後/イレギュラー）が不正です");
  }
  const type = typeRaw as ShiftType;

  const note = o.note == null ? "" : String(o.note);

  const statusRaw = String(o.status ?? "").trim();
  if (!STATUS_SET.has(statusRaw)) {
    throw new TypeError("status（希望/確定）が不正です");
  }
  const status = statusRaw as ShiftStatus;

  return { id, date, shop, staff_name, type, note, status };
}
