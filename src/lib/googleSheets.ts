import { GoogleSpreadsheet, type GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { SHOPS } from "./master";
import type { ShiftRow, ShopDayOverride, ShiftStatus, ShiftType, ShopName } from "./types";

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

type ListCache = { exp: number; data: ShiftRow[] };

let shiftsListCache: ListCache | null = null;

function getShiftsListCacheTtlMs(): number {
  const raw = process.env.SHIFTS_LIST_CACHE_TTL_MS;
  if (raw === "0" || raw === "false") {
    return 0;
  }
  if (raw == null || raw === "") {
    return 20_000;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return 20_000;
  }
  return n;
}

function invalidateShiftsListCache(): void {
  shiftsListCache = null;
}

async function loadShiftsFromSheetOnce(): Promise<ShiftRow[]> {
  const sheet = await getShiftsWorksheet();
  const rows = await sheet.getRows();
  const out: ShiftRow[] = [];
  for (const r of rows) {
    const s = parseRowToShift(r);
    if (s) {
      out.push(s);
    }
  }
  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.shop.localeCompare(b.shop) || a.type.localeCompare(b.type),
  );
  return out;
}

/**
 * 同一サーバープロセス内で短時間キャッシュ（既定 20 秒）し、GET の連打時の
 * Sheets 読み取り 429 発生を抑える。書き込み成功後は必ず無効化する。
 * `SHIFTS_LIST_CACHE_TTL_MS=0` で無効化可能。
 */
export async function listShiftsFromSheet(): Promise<ShiftRow[]> {
  const ttl = getShiftsListCacheTtlMs();
  if (ttl === 0) {
    return loadShiftsFromSheetOnce();
  }
  const now = Date.now();
  if (shiftsListCache && now < shiftsListCache.exp) {
    return shiftsListCache.data;
  }
  const data = await loadShiftsFromSheetOnce();
  shiftsListCache = { exp: now + ttl, data };
  return data;
}

export async function appendShiftToSheet(shift: ShiftRow): Promise<void> {
  const sheet = await getShiftsWorksheet();
  await sheet.addRow(shiftToRecord(shift));
  invalidateShiftsListCache();
}

export async function appendShiftsToSheet(shifts: ShiftRow[]): Promise<void> {
  if (shifts.length === 0) {
    return;
  }
  const sheet = await getShiftsWorksheet();
  await sheet.addRows(shifts.map(shiftToRecord));
  invalidateShiftsListCache();
}

/**
 * 先頭シート上で id 列が一致する行を更新（保存）する
 */
export async function updateShiftByIdInSheet(
  id: string,
  patch: {
    status?: ShiftStatus;
    type?: ShiftType;
    note?: string;
    staff_name?: string | null;
    date?: string;
    shop?: ShopName;
  },
): Promise<void> {
  if (
    patch.status == null &&
    patch.type == null &&
    patch.note === undefined &&
    patch.staff_name === undefined &&
    patch.date === undefined &&
    patch.shop === undefined
  ) {
    throw new Error("更新内容がありません");
  }
  const sheet = await getShiftsWorksheet();
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (cellString(r.get("id")) !== id) {
      continue;
    }
    if (patch.status != null) {
      r.set("status", patch.status);
    }
    if (patch.type != null) {
      r.set("type", patch.type);
    }
    if (patch.note !== undefined) {
      r.set("note", patch.note);
    }
    if (patch.staff_name !== undefined) {
      r.set("staff_name", patch.staff_name ?? "");
    }
    if (patch.date != null) {
      r.set("date", patch.date);
    }
    if (patch.shop != null) {
      r.set("shop", patch.shop);
    }
    await r.save();
    invalidateShiftsListCache();
    return;
  }
  throw new Error(`該当する行が見つかりません (id: ${id})`);
}

export async function deleteShiftByIdInSheet(id: string): Promise<void> {
  const sheet = await getShiftsWorksheet();
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (cellString(r.get("id")) !== id) {
      continue;
    }
    await r.delete();
    invalidateShiftsListCache();
    return;
  }
  throw new Error(`該当する行が見つかりません (id: ${id})`);
}

export function shiftsArrayFromRequestBody(data: unknown): ShiftRow[] {
  if (data == null || typeof data !== "object") {
    throw new TypeError("JSON オブジェクトが必要です");
  }
  const o = data as { shifts?: unknown };
  if (!Array.isArray(o.shifts) || o.shifts.length === 0) {
    throw new TypeError("shifts には1件以上のオブジェクト配列を指定してください");
  }
  const out: ShiftRow[] = [];
  for (let i = 0; i < o.shifts.length; i++) {
    try {
      out.push(shiftFromRequestBody(o.shifts[i]));
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      throw new TypeError(`shifts[${i}]: ${m}`);
    }
  }
  return out;
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
  if (sn == null || String(sn).trim() === "") {
    throw new TypeError("氏名（staff_name）は必須です。リストから選択してください。");
  }
  const staff_name = String(sn).trim();

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

export function shiftPatchFromRequestBody(data: unknown): {
  id: string;
  status?: ShiftStatus;
  type?: ShiftType;
  note?: string;
  staff_name?: string | null;
  date?: string;
  shop?: ShopName;
} {
  if (data == null || typeof data !== "object") {
    throw new TypeError("JSON オブジェクトが必要です");
  }
  const o = data as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  if (!id) {
    throw new TypeError("id が空です");
  }
  const patch: {
    id: string;
    status?: ShiftStatus;
    type?: ShiftType;
    note?: string;
    staff_name?: string | null;
    date?: string;
    shop?: ShopName;
  } = { id };

  if ("status" in o && o.status != null && String(o.status).trim() !== "") {
    const s = String(o.status).trim();
    if (!STATUS_SET.has(s)) {
      throw new TypeError("status は 希望 または 確定 です");
    }
    patch.status = s as ShiftStatus;
  }
  if ("type" in o && o.type != null && String(o.type).trim() !== "") {
    const t = String(o.type).trim();
    if (!SHIFT_TYPE_SET.has(t)) {
      throw new TypeError("type が不正です");
    }
    patch.type = t as ShiftType;
  }
  if ("note" in o) {
    patch.note = o.note == null ? "" : String(o.note);
  }
  if ("staff_name" in o) {
    const sn = o.staff_name;
    if (sn == null || String(sn).trim() === "") {
      throw new TypeError("氏名（staff_name）を空にすることはできません。リストから選択してください。");
    }
    patch.staff_name = String(sn).trim();
  }
  if ("date" in o && o.date != null && String(o.date).trim() !== "") {
    const d = String(o.date).trim();
    if (!DATE_RE.test(d)) {
      throw new TypeError("date は YYYY-MM-DD 形式で指定してください");
    }
    patch.date = d;
  }
  if ("shop" in o && o.shop != null && String(o.shop).trim() !== "") {
    const sh = String(o.shop).trim();
    if (!SHOP_SET.has(sh)) {
      throw new TypeError("shop が正しくありません");
    }
    patch.shop = sh as ShopName;
  }

  if (
    patch.status == null &&
    patch.type == null &&
    patch.note === undefined &&
    patch.staff_name === undefined &&
    patch.date === undefined &&
    patch.shop === undefined
  ) {
    throw new TypeError(
      "status / type / note / staff_name / date / shop のいずれかを指定してください",
    );
  }
  return patch;
}

export const SHOP_OPERATING_DAYS_SHEET_TITLE = "shop_operating_days" as const;
export const SHOP_OPERATING_DAYS_HEADER = ["date", "shop"] as const;

/**
 * タブ `shop_operating_days`（店舗×日付の例外: 土日祝は特別営業、平日祝外は特別休み）。
 * 1行目が空のまま行操作不可のため、新規タブは先に setHeaderRow。
 */
export async function getOrCreateShopOperatingDaysWorksheet() {
  const { sheetId } = readSheetEnv();
  const doc = new GoogleSpreadsheet(sheetId, getJwt());
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle[SHOP_OPERATING_DAYS_SHEET_TITLE];
  const created = !sheet;
  if (!sheet) {
    sheet = await doc.addSheet({ title: SHOP_OPERATING_DAYS_SHEET_TITLE });
  }
  if (created) {
    await sheet.setHeaderRow([...SHOP_OPERATING_DAYS_HEADER]);
    await sheet.loadHeaderRow(1);
    return sheet;
  }
  await sheet.loadHeaderRow(1);
  const emptyHeader =
    !sheet.headerValues ||
    sheet.headerValues.length === 0 ||
    sheet.headerValues.every((h) => !String(h ?? "").trim());
  if (emptyHeader) {
    await sheet.setHeaderRow([...SHOP_OPERATING_DAYS_HEADER]);
  }
  await sheet.loadHeaderRow(1);
  if (
    !sheet.headerValues ||
    sheet.headerValues.length === 0 ||
    sheet.headerValues.every((h) => !String(h ?? "").trim())
  ) {
    throw new Error(
      "shop_operating_days シートの1行目に date / shop のヘッダーが置けません。手動で1行目に date と shop を入力するか、空のタブを削除して再試行してください。",
    );
  }
  return sheet;
}

function rowToShopDayOverride(
  r: GoogleSpreadsheetRow<Record<string, string | number | boolean | null>>,
): ShopDayOverride | null {
  const date = cellString(r.get("date"));
  const shopRaw = cellString(r.get("shop"));
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !SHOP_SET.has(shopRaw)) {
    return null;
  }
  return { date, shop: shopRaw as ShopName };
}

function dedupeOverrides(list: ShopDayOverride[]): ShopDayOverride[] {
  const seen = new Set<string>();
  const out: ShopDayOverride[] = [];
  for (const h of list) {
    const k = `${h.date}\t${h.shop}`;
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(h);
  }
  return out;
}

export async function listShopDayOverridesFromSheet(): Promise<ShopDayOverride[]> {
  const sheet = await getOrCreateShopOperatingDaysWorksheet();
  const rows = await sheet.getRows();
  const out: ShopDayOverride[] = [];
  for (const r of rows) {
    const o = rowToShopDayOverride(r);
    if (o) {
      out.push(o);
    }
  }
  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.shop.localeCompare(b.shop),
  );
  return dedupeOverrides(out);
}

/**
 * 同一 date+shop が既にあれば何も追加しない。
 */
export async function addShopDayOverrideToSheet(
  h: ShopDayOverride,
): Promise<{ alreadyExists: boolean }> {
  const sheet = await getOrCreateShopOperatingDaysWorksheet();
  const rows = await sheet.getRows();
  for (const r of rows) {
    if (cellString(r.get("date")) === h.date && cellString(r.get("shop")) === h.shop) {
      return { alreadyExists: true };
    }
  }
  await sheet.addRow({ date: h.date, shop: h.shop });
  return { alreadyExists: false };
}

export async function deleteShopDayOverrideInSheet(
  h: ShopDayOverride,
): Promise<{ deleted: boolean }> {
  const sheet = await getOrCreateShopOperatingDaysWorksheet();
  const rows = await sheet.getRows();
  for (const r of rows) {
    const date = cellString(r.get("date"));
    const shopRaw = cellString(r.get("shop"));
    if (date === h.date && shopRaw === h.shop) {
      await r.delete();
      return { deleted: true };
    }
  }
  return { deleted: false };
}
