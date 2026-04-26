import { NextResponse } from "next/server";
import { confirmShiftsByIdsInSheet } from "@/lib/googleSheets";
import {
  logShiftsConnectionFailure,
  toClientSheetErrorPayload,
} from "@/lib/sheetConnectionLog";

export const runtime = "nodejs";

const MAX_IDS = 2000;

function jsonError(
  status: number,
  payload: { error: string; hint?: string; errorCode?: string },
) {
  return NextResponse.json(payload, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, {
      error: "JSON の解析に失敗しました",
      errorCode: "JSON_PARSE",
    });
  }
  if (body == null || typeof body !== "object" || !("ids" in body)) {
    return jsonError(400, {
      error: "ids 配列が必要です",
      errorCode: "INVALID_BODY",
    });
  }
  const raw = (body as { ids: unknown }).ids;
  if (!Array.isArray(raw)) {
    return jsonError(400, {
      error: "ids は配列で指定してください",
      errorCode: "INVALID_BODY",
    });
  }
  const ids = raw
    .map((x) => (typeof x === "string" ? x.trim() : String(x).trim()))
    .filter((s) => s.length > 0);
  if (ids.length > MAX_IDS) {
    return jsonError(400, {
      error: `id は${MAX_IDS}件までです`,
      errorCode: "TOO_MANY",
    });
  }
  try {
    const { updated, notFound } = await confirmShiftsByIdsInSheet(ids);
    return NextResponse.json({ ok: true, updated, notFound });
  } catch (e) {
    logShiftsConnectionFailure("POST", "save", e);
    const { status, payload } = toClientSheetErrorPayload(
      e,
      "一括確定の保存に失敗しました",
    );
    return jsonError(status, payload);
  }
}
