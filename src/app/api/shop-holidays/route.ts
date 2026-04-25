import { NextResponse } from "next/server";
import {
  addShopHolidayToSheet,
  deleteShopHolidayInSheet,
  listShopHolidaysFromSheet,
} from "@/lib/googleSheets";
import { toClientSheetErrorPayload } from "@/lib/sheetConnectionLog";
import { SHOPS } from "@/lib/master";
import type { ShopName } from "@/lib/types";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHOP_SET = new Set<string>(SHOPS);

function jsonError(
  status: number,
  payload: { error: string; hint?: string; errorCode?: string },
) {
  return NextResponse.json(payload, { status });
}

export async function GET() {
  try {
    const holidays = await listShopHolidaysFromSheet();
    return NextResponse.json({ holidays });
  } catch (e) {
    const { status, payload } = toClientSheetErrorPayload(
      e,
      "店舗休業日の読み込みに失敗しました",
    );
    return jsonError(status, payload);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, { error: "JSON が不正です", errorCode: "JSON_PARSE" });
  }
  if (body == null || typeof body !== "object") {
    return jsonError(400, { error: "JSON オブジェクトが必要です", errorCode: "VALIDATION" });
  }
  const o = body as Record<string, unknown>;
  const date = String(o.date ?? "").trim();
  const shop = String(o.shop ?? "").trim();
  if (!DATE_RE.test(date)) {
    return jsonError(400, { error: "date は YYYY-MM-DD 形式で指定してください", errorCode: "VALIDATION" });
  }
  if (!SHOP_SET.has(shop)) {
    return jsonError(400, { error: "shop が正しくありません", errorCode: "VALIDATION" });
  }
  try {
    const { alreadyExists } = await addShopHolidayToSheet({
      date,
      shop: shop as ShopName,
    });
    if (alreadyExists) {
      return NextResponse.json({ ok: true, alreadyExists: true });
    }
    return NextResponse.json({ ok: true, alreadyExists: false });
  } catch (e) {
    const { status, payload } = toClientSheetErrorPayload(
      e,
      "店舗休業日の登録に失敗しました",
    );
    return jsonError(status, payload);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const shop = url.searchParams.get("shop")?.trim() ?? "";
  if (!DATE_RE.test(date)) {
    return jsonError(400, { error: "クエリ date (YYYY-MM-DD) が必要です", errorCode: "VALIDATION" });
  }
  if (!SHOP_SET.has(shop)) {
    return jsonError(400, { error: "クエリ shop が正しくありません", errorCode: "VALIDATION" });
  }
  try {
    const { deleted } = await deleteShopHolidayInSheet({
      date,
      shop: shop as ShopName,
    });
    if (!deleted) {
      return jsonError(404, { error: "該当する休業日がありません", errorCode: "NOT_FOUND" });
    }
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) {
    const { status, payload } = toClientSheetErrorPayload(
      e,
      "店舗休業日の削除に失敗しました",
    );
    return jsonError(status, payload);
  }
}
