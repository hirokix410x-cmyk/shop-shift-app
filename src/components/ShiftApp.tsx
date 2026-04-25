"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SHOP_TAB_LABEL, SHOPS } from "@/lib/master";
import type { ShiftRow, ShopHoliday } from "@/lib/types";
import { addDays, startOfMonth, startOfWindow, toISODateString } from "@/lib/dateUtils";
import { ShiftBoard } from "./ShiftBoard";
import { MonthlyShopCalendar } from "./MonthlyShopCalendar";
import { MonthlyShiftBulkForm } from "./MonthlyShiftBulkForm";
import { ShiftFormModal, type FormContext } from "./ShiftFormModal";
import { ShopHolidayAdminPanel } from "./ShopHolidayAdminPanel";
import type { ShopName } from "@/lib/types";

function today(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

type ApiErrorBody = {
  error?: string;
  hint?: string;
  errorCode?: string;
};

type ApiErrorDisplay = {
  title: string;
  message: string;
  hint?: string;
  errorCode?: string;
  httpStatus: number;
};

function ErrorCallout({ detail }: { detail: ApiErrorDisplay }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
    >
      <p className="font-semibold">{detail.title}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{detail.message}</p>
      {detail.errorCode ? (
        <p className="mt-2 font-mono text-xs text-red-800">
          エラーコード: {detail.errorCode}
        </p>
      ) : null}
      {detail.hint ? (
        <p className="mt-2 border-t border-red-200/80 pt-2 text-red-900/95">
          <span className="font-medium">ヒント: </span>
          {detail.hint}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-red-700/90">HTTP {detail.httpStatus}</p>
    </div>
  );
}

async function parseJsonResponse(
  res: Response,
  text: string,
): Promise<{ error?: string; hint?: string; errorCode?: string } & Record<string, unknown>> {
  try {
    return (text ? JSON.parse(text) : {}) as { error?: string; hint?: string; errorCode?: string };
  } catch {
    return { error: `非JSON (先頭: ${text.slice(0, 200)})` };
  }
}

async function fetchShiftsFromApi(): Promise<
  { ok: true; shifts: ShiftRow[] } | { ok: false; display: ApiErrorDisplay }
> {
  const res = await fetch("/api/shifts", { cache: "no-store" });
  const text = await res.text();
  const data = await parseJsonResponse(res, text);
  if (!res.ok) {
    return {
      ok: false,
      display: {
        title: "シフト一覧の取得に失敗しました",
        message: data.error ?? `リクエストが失敗しました (${res.status})`,
        hint: data.hint,
        errorCode: data.errorCode,
        httpStatus: res.status,
      },
    };
  }
  if (!("shifts" in data) || !Array.isArray((data as { shifts?: unknown }).shifts)) {
    return {
      ok: false,
      display: {
        title: "想定外のレスポンスです",
        message: "shifts 配列がありません。",
        httpStatus: res.status,
      },
    };
  }
  return { ok: true, shifts: (data as { shifts: ShiftRow[] }).shifts };
}

async function loadShopHolidaysFromApi(): Promise<ShopHoliday[]> {
  const res = await fetch("/api/shop-holidays", { cache: "no-store" });
  const text = await res.text();
  let data: { holidays?: unknown };
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return [];
  }
  if (!res.ok || !Array.isArray(data.holidays)) {
    return [];
  }
  return data.holidays as ShopHoliday[];
}

type BoardView = "week" | "month";

export function ShiftApp() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => today());
  const [boardView, setBoardView] = useState<BoardView>("week");
  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(today()));
  const [monthTabShop, setMonthTabShop] = useState<ShopName>(SHOPS[0]);
  const [adminMode, setAdminMode] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [formCtx, setFormCtx] = useState<FormContext | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorDisplay | null>(null);
  const [saveError, setSaveError] = useState<ApiErrorDisplay | null>(null);
  const [shopHolidays, setShopHolidays] = useState<ShopHoliday[]>([]);

  const refetchShopHolidays = useCallback(async () => {
    setShopHolidays(await loadShopHolidaysFromApi());
  }, []);

  const refetch = useCallback(async () => {
    const r = await fetchShiftsFromApi();
    if (!r.ok) {
      setLoadError({
        ...r.display,
        title: "保存後の再読み込みに失敗しました",
      });
      throw new Error(r.display.message);
    }
    setRows(r.shifts);
    setLoadError(null);
    setShopHolidays(await loadShopHolidaysFromApi());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      setLoading(true);
      const r = await fetchShiftsFromApi();
      if (cancelled) {
        return;
      }
      if (!r.ok) {
        setLoadError(r.display);
      } else {
        setRows(r.shifts);
        setShopHolidays(await loadShopHolidaysFromApi());
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inWindow = useMemo(() => {
    const s = startOfWindow(weekAnchor);
    const end = addDays(s, 6);
    const startStr = toISODateString(s);
    const endStr = toISODateString(end);
    return rows.filter((r) => r.date >= startStr && r.date <= endStr);
  }, [rows, weekAnchor]);

  const applyErrorFromResponse = useCallback(
    (title: string, res: Response, data: { error?: string; hint?: string; errorCode?: string }) => {
      setSaveError({
        title,
        message: data.error ?? `失敗 (${res.status})`,
        hint: data.hint,
        errorCode: data.errorCode,
        httpStatus: res.status,
      });
    },
    [],
  );

  const handleBulkSubmit = useCallback(
    async (shifts: ShiftRow[]) => {
      setSaveError(null);
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shifts }),
      });
      const text = await res.text();
      const data = await parseJsonResponse(res, text);
      if (!res.ok) {
        applyErrorFromResponse("一括登録に失敗しました", res, data);
        throw new Error(data.error ?? "bulk failed");
      }
      await refetch();
    },
    [applyErrorFromResponse, refetch],
  );

  const openNew = useCallback((date: string, shop: ShopName) => {
    setFormCtx({ kind: "new", date, shop });
  }, []);

  const openEdit = useCallback((row: ShiftRow) => {
    setFormCtx({ kind: "edit", row });
  }, []);

  const handleCreate = useCallback(
    async (row: ShiftRow) => {
      setFormBusy(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        const text = await res.text();
        const data = await parseJsonResponse(res, text);
        if (!res.ok) {
          applyErrorFromResponse("登録に失敗しました", res, data);
          throw new Error("create failed");
        }
        await refetch();
      } finally {
        setFormBusy(false);
      }
    },
    [applyErrorFromResponse, refetch],
  );

  const handleUpdate = useCallback(
    async (row: ShiftRow) => {
      setFormBusy(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/shifts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            type: row.type,
            staff_name: row.staff_name,
            note: row.note,
            status: row.status,
            date: row.date,
            shop: row.shop,
          }),
        });
        const text = await res.text();
        const data = await parseJsonResponse(res, text);
        if (!res.ok) {
          applyErrorFromResponse("更新に失敗しました", res, data);
          throw new Error("update failed");
        }
        await refetch();
      } finally {
        setFormBusy(false);
      }
    },
    [applyErrorFromResponse, refetch],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setFormBusy(true);
      setSaveError(null);
      try {
        const res = await fetch(
          `/api/shifts?id=${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        const text = await res.text();
        const data = await parseJsonResponse(res, text);
        if (!res.ok) {
          applyErrorFromResponse("削除に失敗しました", res, data);
          throw new Error("delete failed");
        }
        await refetch();
      } finally {
        setFormBusy(false);
      }
    },
    [applyErrorFromResponse, refetch],
  );

  const onConfirmRow = useCallback(
    async (id: string) => {
      setSaveError(null);
      setConfirmingId(id);
      try {
        const res = await fetch("/api/shifts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "確定" }),
        });
        const text = await res.text();
        const data = await parseJsonResponse(res, text);
        if (!res.ok) {
          applyErrorFromResponse("確定の更新に失敗しました", res, data);
          return;
        }
        await refetch();
      } finally {
        setConfirmingId(null);
      }
    },
    [applyErrorFromResponse, refetch],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-amber-800">ぴたカフェ 店舗シフト</p>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          シフト管理
        </h1>
        <p className="text-sm text-stone-600">
          募集中=赤、本部社員=青。翌月分は一括希望を1回のAPIで送信。週次・月間から個別登録・修正も可能です。確定済み行を修正すると
          status は「希望」に戻り、承認のやり直しが必要です（管理者向け再確認用）。
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-stone-300"
              checked={adminMode}
              onChange={(e) => setAdminMode(e.target.checked)}
            />
            管理者：確定モード（希望行に「確定」ボタンを表示）・店舗休業日の登録
          </label>
        </div>
        {adminMode ? (
          <ShopHolidayAdminPanel
            holidays={shopHolidays}
            onAfterChange={refetchShopHolidays}
          />
        ) : null}
      </header>

      {loadError ? <ErrorCallout detail={loadError} /> : null}
      {saveError ? <ErrorCallout detail={saveError} /> : null}

      {loading ? (
        <p className="text-sm text-stone-500" aria-live="polite">
          スプレッドシートから読み込み中…
        </p>
      ) : null}

      <MonthlyShiftBulkForm
        onSubmitBulk={handleBulkSubmit}
        submitDisabled={loading}
        allRows={rows}
        shopHolidays={shopHolidays}
      />

      <div className="border-t border-stone-200 pt-6" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-semibold text-stone-800">表示</h2>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-stone-500">切替:</span>
          <div className="inline-flex overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-0.5">
            <button
              type="button"
              onClick={() => setBoardView("week")}
              className={
                boardView === "week"
                  ? "min-h-[40px] rounded-lg bg-white px-4 text-sm font-medium shadow-sm"
                  : "min-h-[40px] rounded-lg px-4 text-sm text-stone-600"
              }
            >
              週次リスト
            </button>
            <button
              type="button"
              onClick={() => setBoardView("month")}
              className={
                boardView === "month"
                  ? "min-h-[40px] rounded-lg bg-white px-4 text-sm font-medium shadow-sm"
                  : "min-h-[40px] rounded-lg px-4 text-sm text-stone-600"
              }
            >
              店舗別月間
            </button>
          </div>
        </div>
      </div>

      {boardView === "week" ? (
        <ShiftBoard
          rows={inWindow}
          anchor={weekAnchor}
          onAnchorChange={setWeekAnchor}
          adminMode={adminMode}
          onConfirmRow={adminMode ? onConfirmRow : undefined}
          confirmingId={confirmingId}
          onAddForDay={openNew}
          onEditRow={openEdit}
          shopHolidays={shopHolidays}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="店舗">
            {SHOPS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={monthTabShop === s}
                onClick={() => setMonthTabShop(s)}
                className={
                  monthTabShop === s
                    ? "min-h-[40px] rounded-lg border-2 border-amber-500 bg-amber-50 px-3 text-sm font-medium text-amber-950"
                    : "min-h-[40px] rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700"
                }
              >
                {SHOP_TAB_LABEL[s]}
              </button>
            ))}
          </div>
          <MonthlyShopCalendar
            shop={monthTabShop}
            month={monthCursor}
            onMonthChange={setMonthCursor}
            rows={rows}
            adminMode={adminMode}
            onConfirmRow={adminMode ? onConfirmRow : undefined}
            confirmingId={confirmingId}
            onAddForDay={(iso) => openNew(iso, monthTabShop)}
            onEditRow={openEdit}
            shopHolidays={shopHolidays}
          />
        </div>
      )}

      <ShiftFormModal
        open={formCtx != null}
        context={formCtx}
        onClose={() => setFormCtx(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        busy={formBusy}
      />
    </div>
  );
}
