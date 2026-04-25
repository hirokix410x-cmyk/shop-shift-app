"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { SHOPS, SHOP_TAB_LABEL, isHqStaff } from "@/lib/master";
import type { ShopName, ShiftRow } from "@/lib/types";
import {
  addMonths,
  formatYearMonth,
  getMonthCalendarCells,
  startOfMonth,
  toISODateString,
} from "@/lib/dateUtils";
import {
  dayNumberPillClass,
  getCalDayTone,
  isHolidayForCalendarLabel,
} from "@/lib/jpCalendarStyle";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function typeShort(t: string) {
  if (t === "午前") return "前";
  if (t === "午後") return "後";
  if (t === "イレギュラー") return "イ";
  if (t === "全日") return "全";
  return t.slice(0, 1);
}

/** 個人別: 両店舗分 or 各店舗で絞り込み */
export type PersonViewShopFilter = "all" | ShopName;

type Props = {
  staffName: string;
  month: Date;
  onMonthChange: (d: Date) => void;
  rows: ShiftRow[];
  /** 表示する店舗（両店 / 1店舗） */
  viewShopFilter: PersonViewShopFilter;
  /** 「＋」で開く新規枠の店舗 */
  addSlotShop: ShopName;
  onAddSlotShopChange: (s: ShopName) => void;
  adminMode: boolean;
  onConfirmRow?: (id: string) => void | Promise<void>;
  confirmingId?: string | null;
  onAddForDay?: (iso: string, shop: ShopName) => void;
  onEditRow?: (row: ShiftRow) => void;
};

export function PersonalShiftCalendar({
  staffName,
  month,
  onMonthChange,
  rows,
  viewShopFilter,
  addSlotShop,
  onAddSlotShopChange,
  adminMode,
  onConfirmRow,
  confirmingId,
  onAddForDay,
  onEditRow,
}: Props) {
  const y = month.getFullYear();
  const m1 = month.getMonth() + 1;
  const cells = useMemo(() => getMonthCalendarCells(y, m1), [y, m1]);

  const startStr = `${y}-${String(m1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m1, 0).getDate();
  const endStr = `${y}-${String(m1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const byDate = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    if (!staffName.trim()) {
      return map;
    }
    for (const r of rows) {
      if (r.staff_name !== staffName) {
        continue;
      }
      if (viewShopFilter !== "all" && r.shop !== viewShopFilter) {
        continue;
      }
      if (r.date < startStr || r.date > endStr) {
        continue;
      }
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    map.forEach((arr) => {
      arr.sort(
        (a, b) =>
          a.shop.localeCompare(b.shop) || a.type.localeCompare(b.type),
      );
    });
    return map;
  }, [rows, staffName, viewShopFilter, startStr, endStr]);

  if (!staffName.trim()) {
    return (
      <section className="space-y-3" aria-label="個人別シフト（氏名未選択）">
        <h2 className="text-base font-semibold text-stone-800">個人別（月間）</h2>
        <p className="text-sm text-stone-500">表示する氏名を上のリストから選んでください。</p>
      </section>
    );
  }

  const viewTitle =
    viewShopFilter === "all"
      ? "両店舗分"
      : `${SHOP_TAB_LABEL[viewShopFilter] ?? viewShopFilter}のみ`;
  const showShopInCell = viewShopFilter === "all";

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-base font-semibold text-stone-800">
          個人別月間 — {staffName}（{viewTitle}）
        </h2>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onMonthChange(startOfMonth(addMonths(month, -1)))}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-stone-200 bg-white p-2 shadow-sm"
            aria-label="前の月"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-medium text-stone-700">
            {formatYearMonth(month)}
          </span>
          <button
            type="button"
            onClick={() => onMonthChange(startOfMonth(addMonths(month, 1)))}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-stone-200 bg-white p-2 shadow-sm"
            aria-label="次の月"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-xs text-stone-500">新規枠（＋）を入れる店舗:</p>
        <select
          className="min-h-[40px] max-w-md rounded-lg border border-stone-200 bg-stone-50 px-2 text-sm"
          value={addSlotShop}
          onChange={(e) => onAddSlotShopChange(e.target.value as ShopName)}
          aria-label="新規枠の店舗"
        >
          {SHOPS.map((s) => (
            <option key={s} value={s}>
              {SHOP_TAB_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 text-center text-xs">
        {WEEKDAYS.map((w, wi) => (
          <div
            key={w}
            className={
              wi === 0
                ? "bg-red-100/90 py-1.5 font-medium text-red-900"
                : wi === 6
                  ? "bg-blue-100/90 py-1.5 font-medium text-blue-900"
                  : "bg-stone-100 py-1.5 font-medium text-stone-600"
            }
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d == null) {
            return <div key={`p-${i}`} className="min-h-[5.5rem] bg-stone-50/50" />;
          }
          const key = toISODateString(d);
          const list = byDate.get(key) ?? [];
          const tone = getCalDayTone(d);
          const wkHoli = isHolidayForCalendarLabel(d);
          return (
            <div
              key={key}
              className={
                tone === "saturday"
                  ? "flex min-h-[5.5rem] flex-col space-y-0.5 border border-blue-200/50 bg-blue-50/40 p-1 text-left"
                  : tone === "sundayOrHoliday"
                    ? "flex min-h-[5.5rem] flex-col space-y-0.5 border border-red-200/50 bg-red-50/40 p-1 text-left"
                    : "flex min-h-[5.5rem] flex-col space-y-0.5 bg-white p-1 text-left"
              }
            >
              <div className="flex items-center justify-between gap-0.5">
                <div className="flex flex-col">
                  <div className={dayNumberPillClass(tone)}>{d.getDate()}</div>
                  {wkHoli ? (
                    <span className="text-[8px] font-medium text-red-800">祝</span>
                  ) : null}
                </div>
                {onAddForDay ? (
                  <button
                    type="button"
                    onClick={() => onAddForDay(key, addSlotShop)}
                    className="shrink-0 rounded border border-amber-400 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-950"
                    title="この日の枠を追加"
                  >
                    ＋
                  </button>
                ) : null}
              </div>
              <ul className="min-h-0 flex-1 space-y-0.5">
                {list.map((r) => {
                  const hq = isHqStaff(r.staff_name);
                  const unconfirmed = r.status === "希望";
                  return (
                    <li
                      key={r.id}
                      className={
                        hq
                          ? "cursor-pointer rounded border border-blue-300 bg-blue-50 px-0.5 py-0.5 text-[10px] leading-tight text-blue-950"
                          : "cursor-pointer rounded border border-stone-200 bg-stone-50 px-0.5 py-0.5 text-[10px] leading-tight text-stone-800"
                      }
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => onEditRow?.(r)}
                        disabled={!onEditRow}
                      >
                        {showShopInCell ? (
                          <>
                            <span className="font-medium text-amber-900/90">
                              {SHOP_TAB_LABEL[r.shop] ?? r.shop}
                            </span>{" "}
                          </>
                        ) : null}
                        <span
                          className={
                            r.status === "確定" ? "text-emerald-700" : "text-amber-700"
                          }
                        >
                          {typeShort(r.type)}
                          {r.status === "希望" ? "希" : "確"}
                        </span>
                      </button>
                      {adminMode && unconfirmed && onConfirmRow ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onConfirmRow(r.id);
                          }}
                          disabled={confirmingId === r.id}
                          className="mt-0.5 block w-full rounded bg-amber-600 py-0.5 text-[9px] font-medium text-white disabled:opacity-50"
                        >
                          {confirmingId === r.id ? "…" : "確定"}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
