import { NextResponse } from "next/server";
import {
  appendShiftToSheet,
  appendShiftsToSheet,
  clearAllDataRowsInSheet,
  deleteShiftByIdInSheet,
  listShiftsFromSheet,
  shiftFromRequestBody,
  shiftPatchFromRequestBody,
  shiftsArrayFromRequestBody,
  updateShiftByIdInSheet,
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
    if (
      body != null &&
      typeof body === "object" &&
      (body as { action?: string }).action === "clearAllDataRows"
    ) {
      const token = request.headers.get("x-admin-token");
      const expected = process.env.SHIFT_ADMIN_CLEAR_TOKEN?.trim();
      if (!expected) {
        return jsonError(403, {
          error:
            "全データ削除は無効です（サーバーに SHIFT_ADMIN_CLEAR_TOKEN が未設定）",
          errorCode: "CLEAR_DISABLED",
          hint: "Vercel の Environment Variables に SHIFT_ADMIN_CLEAR_TOKEN を設定してください。",
        });
      }
      if (token !== expected) {
        return jsonError(403, {
          error: "管理者トークンが一致しません",
          errorCode: "FORBIDDEN",
        });
      }
      const { deleted } = await clearAllDataRowsInSheet();
      return NextResponse.json({ ok: true, deleted, action: "clearAllDataRows" });
    }

    if (
      body != null &&
      typeof body === "object" &&
      "shifts" in body &&
      Array.isArray((body as { shifts: unknown }).shifts)
    ) {
      const shifts = shiftsArrayFromRequestBody(body);
      await appendShiftsToSheet(shifts);
      return NextResponse.json({ ok: true, count: shifts.length, shifts });
    }
    const shift = shiftFromRequestBody(body);
    await appendShiftToSheet(shift);
    return NextResponse.json({ ok: true, shift });
  } catch (e) {
    if (e instanceof TypeError) {
      console.error("[/api/shifts] POST バリデーション失敗 (TypeError)", e.message);
      return jsonError(400, {
        error: e.message,
        errorCode: "VALIDATION",
        hint:
          "単一行は従来どおり。一括の場合は { shifts: ShiftRow[] } 形式にしてください。",
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

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    console.error(
      "[/api/shifts] PATCH JSON parse 失敗",
      e instanceof Error ? e.message : e,
    );
    return jsonError(400, {
      error: "JSON の解析に失敗しました",
      errorCode: "JSON_PARSE",
    });
  }
  try {
    const p = shiftPatchFromRequestBody(body);
    await updateShiftByIdInSheet(p.id, {
      status: p.status,
      type: p.type,
      note: p.note,
      staff_name: p.staff_name,
      date: p.date,
      shop: p.shop,
    });
    return NextResponse.json({ ok: true, id: p.id, patch: p });
  } catch (e) {
    if (e instanceof TypeError) {
      console.error("[/api/shifts] PATCH バリデーション失敗", e.message);
      return jsonError(400, {
        error: e.message,
        errorCode: "VALIDATION",
      });
    }
    logShiftsConnectionFailure("PATCH", "save", e);
    const { status, payload } = toClientSheetErrorPayload(
      e,
      "スプレッドシートの更新に失敗しました",
    );
    return jsonError(status, payload);
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return jsonError(400, {
      error: "クエリ ?id= が必要です",
      errorCode: "MISSING_ID",
    });
  }
  try {
    await deleteShiftByIdInSheet(id);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    logShiftsConnectionFailure("DELETE", "save", e);
    const { status, payload } = toClientSheetErrorPayload(
      e,
      "行の削除に失敗しました",
    );
    return jsonError(status, payload);
  }
}
