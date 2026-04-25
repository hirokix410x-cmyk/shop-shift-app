"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import {
  SHOP_TAB_LABEL,
  SHOPS,
  shopLabelTextClass,
  shiftCalendarRowClassByShop,
} from "@/lib/master";
import type { PersonViewShopFilter } from "./PersonalShiftCalendar";
import {
  isSpecialClosedDay,
  isSpecialOperatingDay,
  isStoreClosed,
} from "@/lib/shopOperatingDay";
import type { ShopDayOverride, ShopName, ShiftRow } from "@/lib/types";
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

type Props = {
  /** 単一店 or 両店舗（同一グリッドに集約） */
  shop: PersonViewShopFilter;
  /** 「＋」の店舗（2店舗表示時は親がタブに合わせて渡す） */
  addSlotShop: ShopName;
  month: Date;
  onMonthChange: (d: Date) => void;
  rows: ShiftRow[];
  adminMode: boolean;
  onConfirmRow?: (id: string) => void | Promise<void>;
  confirmingId?: string | null;
  onAddForDay?: (iso: string, shop: ShopName) => void;
  onEditRow?: (row: ShiftRow) => void;
  shopDayOverrides: ShopDayOverride[];
};

function typeShort(t: string) {
  if (t === "午前") return "前";
  if (t === "午後") return "後";
  if (t === "イレギュラー") return "イ";
  if (t === "全日") return "全";
  return t.slice(0, 1);
}

export function MonthlyShopCalendar({
  shop,
  addSlotShop,
  month,
  onMonthChange,
  rows,
  adminMode,
  onConfirmRow,
  confirmingId,
  onAddForDay,
  onEditRow,
  shopDayOverrides,
}: Props) {
  const y = month.getFullYear();
  const m1 = month.getMonth() + 1;
  const cells = useMemo(() => getMonthCalendarCells(y, m1), [y, m1]);

  const startStr = `${y}-${String(m1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m1, 0).getDate();
  const endStr = `${y}-${String(m1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const byDate = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    for (const r of rows) {
      if (shop !== "all" && r.shop !== shop) {
        continue;
      }
      if (shop === "all" && !SHOPS.includes(r.shop as (typeof SHOPS)[number])) {
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
          a.shop.localeCompare(b.shop) || (a.staff_name ?? "").localeCompare(b.staff_name ?? ""),
      );
    });
    return map;
  }, [rows, shop, startStr, endStr]);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-stone-800">
          店舗別月間カレンダー —{" "}
          {shop === "all" ? "2店舗" : (SHOP_TAB_LABEL[shop] ?? shop)}
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
          const dayClosed =
            shop !== "all" && isStoreClosed(shop, key, shopDayOverrides);
          if (dayClosed) {
            const specClose = isSpecialClosedDay(shop, key, shopDayOverrides);
            return (
              <div
                key={key}
                className="flex min-h-[5.5rem] flex-col items-center justify-center gap-0.5 border border-slate-300 bg-slate-200/90 p-1 text-left"
                aria-label={specClose ? "特別休業" : "店舗休業日"}
              >
                <div className="w-full text-[11px] font-semibold text-slate-500">{d.getDate()}</div>
                <p className="w-full text-center text-[10px] font-bold leading-tight text-slate-800">
                  {specClose ? "特休" : "店休"}
                </p>
              </div>
            );
          }
          const tone = getCalDayTone(d);
          const wkHoli = isHolidayForCalendarLabel(d);
          const specOpen =
            shop === "all"
              ? SHOPS.some((s) =>
                  isSpecialOperatingDay(s, key, shopDayOverrides),
                )
              : isSpecialOperatingDay(shop, key, shopDayOverrides);
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
                  {specOpen ? (
                    <span className="text-[8px] font-semibold text-emerald-800">特営</span>
                  ) : null}
                  {wkHoli ? (
                    <span className="text-[8px] font-medium text-red-800">祝</span>
                  ) : null}
                </div>
                {onAddForDay ? (
                  <button
                    type="button"
                    onClick={() => onAddForDay(key, addSlotShop)}
                    className="shrink-0 rounded border border-amber-400 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-950"
                    title={`${SHOP_TAB_LABEL[addSlotShop] ?? addSlotShop}に枠を追加`}
                  >
                    ＋
                  </button>
                ) : null}
              </div>
              <ul className="min-h-0 flex-1 space-y-0.5">
                {list.map((r) => {
                  const isOpen = r.staff_name == null;
                  const unconfirmed = r.status === "希望";
                  const showShop = shop === "all";
                  return (
                    <li
                      key={r.id}
                      className={
                        isOpen
                          ? "cursor-pointer rounded border border-red-300 bg-red-50 px-0.5 py-0.5 text-[10px] leading-tight text-red-900"
                          : shiftCalendarRowClassByShop(r.shop)
                      }
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => onEditRow?.(r)}
                        disabled={!onEditRow}
                      >
                        {showShop ? (
                          <>
                            <span className={shopLabelTextClass(r.shop)}>
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
                        </span>{" "}
                        {r.staff_name ?? "募"}
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
