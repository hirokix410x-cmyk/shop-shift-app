import { NextResponse } from "next/server";
import {
  appendShiftToSheet,
  listShiftsFromSheet,
  shiftFromRequestBody,
} from "@/lib/googleSheets";
import {
  logShiftsConnectionFailure,
  toClientSheetErrorPayload,
} from "@/lib/sheetConnectionLog";

export const runtime = "nodejs";

function jsonError(
  status: number,
  payload: { error: string; hint?: string; errorCode?: string },
) {
  return NextResponse.json(payload, { status });
}

export async function GET() {
  try {
    const shifts = await listShiftsFromSheet();
    return NextResponse.json({ shifts });
  } catch (e) {
    logShiftsConnectionFailure("GET", "load", e);
    const { status, payload } = toClientSheetErrorPayload(
      e,
      "スプレッドシートの読み込みに失敗しました",
    );
    return jsonError(status, payload);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    console.error(
      "[/api/shifts] POST JSON parse 失敗",
      e instanceof Error ? e.message : e,
    );
    return jsonError(400, {
      error: "JSON の解析に失敗しました",
      errorCode: "JSON_PARSE",
      hint: "Content-Type: application/json で送っているか確認してください。",
    });
  }
  try {
    const shift = shiftFromRequestBody(body);
    await appendShiftToSheet(shift);
    return NextResponse.json({ ok: true, shift });
  } catch (e) {
    if (e instanceof TypeError) {
      console.error("[/api/shifts] POST バリデーション失敗 (TypeError)", e.message);
      return jsonError(400, {
        error: e.message,
        errorCode: "VALIDATION",
        hint: "日付形式・店舗名・区分・ステータスが API の想定と一致するか確認してください。",
      });
    }
    logShiftsConnectionFailure("POST", "save", e);
    const { status, payload } = toClientSheetErrorPayload(
      e,
      "スプレッドシートへの保存に失敗しました",
    );
    return jsonError(status, payload);
  }
}
