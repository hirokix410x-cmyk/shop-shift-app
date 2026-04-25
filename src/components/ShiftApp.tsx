"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHOP_TAB_LABEL, SHOPS, allStaffNamesForPicker } from "@/lib/master";
import type { ShiftRow, ShopDayOverride } from "@/lib/types";
import { addDays, startOfMonth, startOfWindow, toISODateString } from "@/lib/dateUtils";
import { ShiftBoard } from "./ShiftBoard";
import { MonthlyShopCalendar } from "./MonthlyShopCalendar";
import { MonthlyShiftBulkForm } from "./MonthlyShiftBulkForm";
import { PersonalShiftCalendar } from "./PersonalShiftCalendar";
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

/** プログラムスクロールで上端に空ける分（`scroll-mt-20` ≒ 5rem の考え方に合わせる） */
const SCROLL_ANCHOR_TOP_OFFSET_PX = 80;
const SCROLL_AFTER_VIEW_CHANGE_MS = 120;

function formatSuccessTimestamp(): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

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

type BoardView = "week" | "month" | "person";

export function ShiftApp() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => today());
  const [boardView, setBoardView] = useState<BoardView>("week");
  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(today()));
  const [monthTabShop, setMonthTabShop] = useState<ShopName>(SHOPS[0]);
  const [personAddShop, setPersonAddShop] = useState<ShopName>(SHOPS[0]);
  const [personalStaffName, setPersonalStaffName] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [formCtx, setFormCtx] = useState<FormContext | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorDisplay | null>(null);
  const [saveError, setSaveError] = useState<ApiErrorDisplay | null>(null);
  const [shopDayOverrides, setShopDayOverrides] = useState<ShopDayOverride[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const successToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccessToast = useCallback((message: string) => {
    if (successToastTimeoutRef.current) {
      clearTimeout(successToastTimeoutRef.current);
    }
    setSuccessToast(`${message}（${formatSuccessTimestamp()}）`);
    successToastTimeoutRef.current = setTimeout(() => {
      setSuccessToast(null);
      successToastTimeoutRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (successToastTimeoutRef.current) {
        clearTimeout(successToastTimeoutRef.current);
      }
    };
  }, []);

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

  const personNameOptions = useMemo(
    () => allStaffNamesForPicker(rows),
    [rows],
  );

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
      showSuccessToast("一括で保存しました");
    },
    [applyErrorFromResponse, refetch, showSuccessToast],
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
        showSuccessToast("登録しました");
      } finally {
        setFormBusy(false);
      }
    },
    [applyErrorFromResponse, refetch, showSuccessToast],
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
        showSuccessToast("保存しました");
      } finally {
        setFormBusy(false);
      }
    },
    [applyErrorFromResponse, refetch, showSuccessToast],
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
        showSuccessToast("削除しました");
      } finally {
        setFormBusy(false);
      }
    },
    [applyErrorFromResponse, refetch, showSuccessToast],
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
        showSuccessToast("確定しました");
      } finally {
        setConfirmingId(null);
      }
    },
    [applyErrorFromResponse, refetch, showSuccessToast],
  );

  const scrollToId = useCallback((id: string) => {
    const run = () => {
      const el = document.getElementById(id);
      if (!el) {
        return;
      }
      const y =
        el.getBoundingClientRect().top + window.scrollY - SCROLL_ANCHOR_TOP_OFFSET_PX;
      const maxTop = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({
        top: Math.max(0, Math.min(y, maxTop)),
        behavior: "smooth",
      });
    };
    window.requestAnimationFrame(() => {
      window.setTimeout(run, SCROLL_AFTER_VIEW_CHANGE_MS);
    });
  }, []);

  const goToWeekView = useCallback(() => {
    setBoardView("week");
    scrollToId("section-views");
  }, [scrollToId]);

  const goToMonthView = useCallback(() => {
    setBoardView("month");
    scrollToId("section-views");
  }, [scrollToId]);

  const goToPersonView = useCallback(() => {
    setBoardView("person");
    scrollToId("panel-person");
  }, [scrollToId]);

  const navBtnClass =
    "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-amber-200 bg-white px-3 text-center text-sm font-medium text-amber-950 shadow-sm ring-1 ring-amber-100/80 transition active:scale-[0.99] sm:flex-initial sm:min-w-0 sm:px-4";

  return (
    <div
      className="relative mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8"
      aria-busy={loading}
    >
      {successToast ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="pointer-events-auto max-w-md rounded-b-xl border border-emerald-200/90 bg-emerald-50 px-4 py-2.5 text-center text-sm font-medium text-emerald-950 shadow-md ring-1 ring-emerald-100">
            {successToast}
          </p>
        </div>
      ) : null}
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
        <button
          type="button"
          onClick={goToPersonView}
          className={navBtnClass}
        >
          個人別月間
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

      {loadError ? <ErrorCallout detail={loadError} /> : null}
      {saveError ? <ErrorCallout detail={saveError} /> : null}

      {loading ? (
        <p className="text-sm text-stone-500" aria-live="polite">
          データを読み込んでいます…
        </p>
      ) : null}

      <section id="section-bulk" className="scroll-mt-20">
        <MonthlyShiftBulkForm
          onSubmitBulk={handleBulkSubmit}
          submitDisabled={loading}
          allRows={rows}
          shopDayOverrides={shopDayOverrides}
        />
      </section>

      <section
        id="section-admin"
        className="scroll-mt-20 rounded-2xl border border-amber-200/70 bg-amber-50/30 p-3 sm:p-4"
        aria-label="管理者向け"
      >
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
          <div className="mt-3 space-y-2">
            <details className="group rounded-xl border border-amber-200/90 bg-amber-50/80 open:bg-amber-50/95">
              <summary className="cursor-pointer list-none rounded-xl px-3 py-3 text-sm font-semibold text-amber-950 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex min-h-[40px] w-full items-center justify-between gap-2">
                  確定操作モード
                  <span
                    className="text-amber-600/80 transition group-open:rotate-180"
                    aria-hidden
                  >
                    ▼
                  </span>
                </span>
              </summary>
              <div className="border-t border-amber-200/70 px-3 pb-3 pt-0 text-sm text-stone-600">
                週次・月間の希望行に「この希望を確定」が表示され、承認作業を行えます。
              </div>
            </details>
            <details className="group rounded-xl border border-amber-200/90 bg-amber-50/80 open:bg-amber-50/95">
              <summary className="cursor-pointer list-none rounded-xl px-3 py-3 text-sm font-semibold text-amber-950 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex min-h-[40px] w-full items-center justify-between gap-2">
                  店舗営業・休業の登録
                  <span
                    className="text-amber-600/80 transition group-open:rotate-180"
                    aria-hidden
                  >
                    ▼
                  </span>
                </span>
              </summary>
              <div className="border-t border-amber-200/70 p-2 pt-0 sm:p-3 sm:pt-0">
                <ShopOperatingDayPanel
                  hideTitle
                  overrides={shopDayOverrides}
                  onAfterChange={refetchShopDayOverrides}
                />
              </div>
            </details>
          </div>
        ) : null}
      </section>

      <div className="border-t border-stone-200 pt-6" />

      <section
        id="section-views"
        className="scroll-mt-20 space-y-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-stone-800">表示</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-stone-500">切替:</span>
            <div className="inline-flex flex-wrap overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-0.5">
              <button
                type="button"
                onClick={() => setBoardView("week")}
                className={
                  boardView === "week"
                    ? "min-h-[40px] rounded-lg bg-white px-3 text-sm font-medium shadow-sm sm:px-4"
                    : "min-h-[40px] rounded-lg px-3 text-sm text-stone-600 sm:px-4"
                }
              >
                週次リスト
              </button>
              <button
                type="button"
                onClick={() => setBoardView("month")}
                className={
                  boardView === "month"
                    ? "min-h-[40px] rounded-lg bg-white px-3 text-sm font-medium shadow-sm sm:px-4"
                    : "min-h-[40px] rounded-lg px-3 text-sm text-stone-600 sm:px-4"
                }
              >
                店舗別月間
              </button>
              <button
                type="button"
                onClick={() => setBoardView("person")}
                className={
                  boardView === "person"
                    ? "min-h-[40px] rounded-lg bg-white px-3 text-sm font-medium shadow-sm sm:px-4"
                    : "min-h-[40px] rounded-lg px-3 text-sm text-stone-600 sm:px-4"
                }
              >
                個人別
              </button>
            </div>
          </div>
        </div>

        {boardView === "week" ? (
          <div id="panel-week" className="scroll-mt-20">
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
        ) : boardView === "month" ? (
          <div id="panel-month" className="scroll-mt-20 space-y-4">
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
        ) : (
          <div
            id="panel-person"
            className="scroll-mt-20 space-y-3"
            aria-label="個人別月間"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <label
                className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-stone-700"
                htmlFor="person-staff-select"
              >
                表示する氏名
                <select
                  id="person-staff-select"
                  className="min-h-[44px] max-w-md rounded-lg border border-stone-200 bg-stone-50 px-2 text-base"
                  value={personalStaffName}
                  onChange={(e) => setPersonalStaffName(e.target.value)}
                >
                  <option value="">氏名を選択</option>
                  {personNameOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <PersonalShiftCalendar
              staffName={personalStaffName}
              month={monthCursor}
              onMonthChange={setMonthCursor}
              rows={rows}
              addSlotShop={personAddShop}
              onAddSlotShopChange={setPersonAddShop}
              adminMode={adminMode}
              onConfirmRow={adminMode ? onConfirmRow : undefined}
              confirmingId={confirmingId}
              onAddForDay={openNew}
              onEditRow={openEdit}
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
        allRows={rows}
        busy={formBusy}
      />
    </div>
  );
}
