import { NextResponse } from "next/server";
import {
  appendShiftToSheet,
  appendShiftsToSheet,
  deleteShiftByIdInSheet,
  listShiftsFromSheet,
  shiftFromRequestBody,
  shiftPatchFromRequestBody,
  shiftsArrayFromRequestBody,
  updateShiftByIdInSheet,
} from "@/lib/googleSheets";
import {
  assertProposedShiftsNoTimeDoubleBook,
  mergeShiftWithPatch,
  patchAffectsTimeOrPlace,
} from "@/lib/staffShiftConflict";
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
      return jsonError(410, {
        error: "全データ一括削除の機能は廃止されました。不要な行は行ごとに削除してください。",
        errorCode: "CLEAR_REMOVED",
      });
    }

    if (
      body != null &&
      typeof body === "object" &&
      "shifts" in body &&
      Array.isArray((body as { shifts: unknown }).shifts)
    ) {
      const shifts = shiftsArrayFromRequestBody(body);
      const existing = await listShiftsFromSheet();
      assertProposedShiftsNoTimeDoubleBook(shifts, existing, {});
      await appendShiftsToSheet(shifts);
      return NextResponse.json({ ok: true, count: shifts.length, shifts });
    }
    const shift = shiftFromRequestBody(body);
    const existingSingle = await listShiftsFromSheet();
    assertProposedShiftsNoTimeDoubleBook([shift], existingSingle, {});
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
    const all = await listShiftsFromSheet();
    const current = all.find((r) => r.id === p.id);
    if (!current) {
      return jsonError(404, {
        error: `該当する行が見つかりません (id: ${p.id})`,
        errorCode: "NOT_FOUND",
      });
    }
    const merged = mergeShiftWithPatch(current, p);
    if (patchAffectsTimeOrPlace(p)) {
      assertProposedShiftsNoTimeDoubleBook([merged], all, {
        excludeIds: new Set([p.id]),
      });
    }
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
