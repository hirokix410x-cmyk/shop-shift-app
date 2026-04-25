"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SHOP_TAB_LABEL, SHOPS } from "@/lib/master";
import type { ShiftRow, ShopDayOverride } from "@/lib/types";
import { addDays, startOfMonth, startOfWindow, toISODateString } from "@/lib/dateUtils";
import { ShiftBoard } from "./ShiftBoard";
import { MonthlyShopCalendar } from "./MonthlyShopCalendar";
import { MonthlyShiftBulkForm } from "./MonthlyShiftBulkForm";
import { ShiftFormModal, type FormContext } from "./ShiftFormModal";
import { ShopOperatingDayPanel } from "./ShopOperatingDayPanel";
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
  /** シフト取得失敗時など、状況を補足する1行 */
  supplement?: string;
};

const SHIFT_LOAD_REASSURANCE =
  "シフトは読み込めませんでしたが、店舗の営業状況（店休等）は最新です。";

function ErrorCallout({ detail }: { detail: ApiErrorDisplay }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
    >
      <p className="font-semibold">{detail.title}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{detail.message}</p>
      {detail.supplement ? (
        <p className="mt-2 border-t border-red-200/70 pt-2 text-sm font-medium text-red-900/95">
          {detail.supplement}
        </p>
      ) : null}
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
        supplement: SHIFT_LOAD_REASSURANCE,
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
        supplement: SHIFT_LOAD_REASSURANCE,
      },
    };
  }
  return { ok: true, shifts: (data as { shifts: ShiftRow[] }).shifts };
}

async function loadShopDayOverridesFromApi(): Promise<ShopDayOverride[]> {
  const res = await fetch("/api/shop-operating-days", { cache: "no-store" });
  const text = await res.text();
  let data: { overrides?: unknown };
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return [];
  }
  if (!res.ok || !Array.isArray(data.overrides)) {
    return [];
  }
  return data.overrides as ShopDayOverride[];
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
  const [shopDayOverrides, setShopDayOverrides] = useState<ShopDayOverride[]>([]);

  const refetchShopDayOverrides = useCallback(async () => {
    setShopDayOverrides(await loadShopDayOverridesFromApi());
  }, []);

  const refetch = useCallback(async () => {
    const [r, overrides] = await Promise.all([
      fetchShiftsFromApi(),
      loadShopDayOverridesFromApi(),
    ]);
    setShopDayOverrides(overrides);
    if (!r.ok) {
      setLoadError({
        ...r.display,
        title: "保存後の再読み込みに失敗しました",
        supplement: r.display.supplement ?? SHIFT_LOAD_REASSURANCE,
      });
      throw new Error(r.display.message);
    }
    setRows(r.shifts);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      setLoading(true);
      const [r, overrides] = await Promise.all([
        fetchShiftsFromApi(),
        loadShopDayOverridesFromApi(),
      ]);
      if (cancelled) {
        return;
      }
      setShopDayOverrides(overrides);
      if (r.ok) {
        setRows(r.shifts);
      } else {
        setLoadError(r.display);
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

  const scrollToId = useCallback((id: string) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    });
  }, []);

  const goToWeekView = useCallback(() => {
    setBoardView("week");
    scrollToId("panel-week");
  }, [scrollToId]);

  const goToMonthView = useCallback(() => {
    setBoardView("month");
    scrollToId("panel-month");
  }, [scrollToId]);

  const navBtnClass =
    "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-amber-200 bg-white px-3 text-center text-sm font-medium text-amber-950 shadow-sm ring-1 ring-amber-100/80 transition active:scale-[0.99] sm:flex-initial sm:min-w-0 sm:px-4";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-amber-800">ぴたカフェ 店舗シフト</p>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          シフト管理
        </h1>
      </header>

      <nav
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        aria-label="ページ内の主な移動"
      >
        <a
          href="#section-bulk"
          className={navBtnClass}
        >
          一括希望を出す
        </a>
        <button
          type="button"
          onClick={goToWeekView}
          className={navBtnClass}
        >
          週次シフトを見る
        </button>
        <button
          type="button"
          onClick={goToMonthView}
          className={navBtnClass}
        >
          店舗月間カレンダー
        </button>
      </nav>

      <details className="group rounded-xl border border-stone-200/90 bg-white/60 p-0 shadow-sm open:bg-white/90 open:shadow-md">
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-medium text-stone-800 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-h-[44px] w-full items-center justify-between gap-2">
            使い方・凡例を確認する
            <span
              className="text-stone-400 transition group-open:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </span>
        </summary>
        <div className="border-t border-stone-200/80 px-4 pb-4 pt-0 text-sm text-stone-600">
          <p>
            募集中=赤、本部社員=青。翌月分は一括希望を1回のAPIで送信。週次・月間から個別登録・修正も可能です。確定済み行を修正すると
            status は「希望」に戻り、承認のやり直しが必要です（管理者向け再確認用）。
          </p>
        </div>
      </details>

      <div className="space-y-3">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-stone-800">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-stone-300"
            checked={adminMode}
            onChange={(e) => setAdminMode(e.target.checked)}
          />
          管理者向け機能を有効にする
        </label>
        {adminMode ? (
          <div className="space-y-4 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 sm:p-4">
            <div>
              <h3 className="text-base font-semibold text-stone-900">確定操作モード</h3>
              <p className="mt-1 text-sm text-stone-600">
                週次・月間の希望行に「この希望を確定」が表示され、承認作業を行えます。
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900">店舗営業・休業の登録</h3>
              <div className="mt-2">
                <ShopOperatingDayPanel
                  hideTitle
                  overrides={shopDayOverrides}
                  onAfterChange={refetchShopDayOverrides}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {loadError ? <ErrorCallout detail={loadError} /> : null}
      {saveError ? <ErrorCallout detail={saveError} /> : null}

      {loading ? (
        <p className="text-sm text-stone-500" aria-live="polite">
          スプレッドシートから読み込み中…
        </p>
      ) : null}

      <section id="section-bulk" className="scroll-mt-4">
        <MonthlyShiftBulkForm
          onSubmitBulk={handleBulkSubmit}
          submitDisabled={loading}
          allRows={rows}
          shopDayOverrides={shopDayOverrides}
        />
      </section>

      <div className="border-t border-stone-200 pt-6" />

      <section id="section-views" className="scroll-mt-4 space-y-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-stone-800">表示</h2>
          <div className="flex flex-wrap items-center gap-2">
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
          <div id="panel-week">
            <ShiftBoard
              rows={inWindow}
              anchor={weekAnchor}
              onAnchorChange={setWeekAnchor}
              adminMode={adminMode}
              onConfirmRow={adminMode ? onConfirmRow : undefined}
              confirmingId={confirmingId}
              onAddForDay={openNew}
              onEditRow={openEdit}
              shopDayOverrides={shopDayOverrides}
            />
          </div>
        ) : (
          <div id="panel-month" className="space-y-4">
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
              shopDayOverrides={shopDayOverrides}
            />
          </div>
        )}
      </section>

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
