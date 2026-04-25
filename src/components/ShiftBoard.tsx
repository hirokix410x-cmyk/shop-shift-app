"use client";

import { Calendar, ChevronLeft, ChevronRight, MapPin, User } from "lucide-react";
import { useMemo } from "react";
import { SHOP_TAB_LABEL, SHOPS } from "@/lib/master";
import { rowCardClassName } from "@/lib/shiftStyle";
import { isShopClosedOn } from "@/lib/shopHolidays";
import type { ShopHoliday, ShiftRow, ShopName } from "@/lib/types";
import { isHqStaff } from "@/lib/master";
import {
  addDays,
  startOfWindow,
  toISODateString,
  todayISODateString,
} from "@/lib/dateUtils";
import { dayHeaderClass, dayHeaderTextClass, daySubTextClass, getCalDayTone } from "@/lib/jpCalendarStyle";

type Props = {
  rows: ShiftRow[];
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  adminMode?: boolean;
  onConfirmRow?: (id: string) => void | Promise<void>;
  confirmingId?: string | null;
  onAddForDay?: (date: string, shop: ShopName) => void;
  onEditRow?: (row: ShiftRow) => void;
  /** 店舗休業日（週内の該当店舗枠を閉店表示に） */
  shopHolidays: ShopHoliday[];
};

function formatWeekday(d: Date) {
  return new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(d);
}

export function ShiftBoard({
  rows,
  anchor,
  onAnchorChange,
  adminMode = false,
  onConfirmRow,
  confirmingId,
  onAddForDay,
  onEditRow,
  shopHolidays,
}: Props) {
  const windowStart = startOfWindow(anchor);
  const windowEnd = useMemo(() => addDays(windowStart, 6), [windowStart]);
  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < 7; i++) {
      list.push(addDays(windowStart, i));
    }
    return list;
  }, [windowStart]);

  const byDate = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    for (const r of rows) {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    map.forEach((arr) => {
      arr.sort((a, b) => a.shop.localeCompare(b.shop) || a.type.localeCompare(b.type));
    });
    return map;
  }, [rows]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-800">
            <Calendar className="h-5 w-5 text-stone-500" />
            週次シフト
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            <span className="text-red-700">赤</span>＝募集中 / 未充足、
            <span className="text-blue-800">青</span>＝本部社員の枠
          </p>
          <p className="text-xs text-stone-500">
            日付帯: <span className="text-blue-800">土</span>＝青、
            <span className="text-red-700">日祝</span>＝薄赤
          </p>
          <p className="text-xs text-stone-500">先頭の日＝起算日（初回は今日から7日）。前後ボタンで7日ずつ移動。</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onAnchorChange(addDays(anchor, -7))}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-stone-200 bg-white p-2 text-stone-700 shadow-sm active:scale-95"
            aria-label="表示を7日分さかのぼる"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[12rem] text-center text-sm text-stone-600 sm:min-w-[16rem]">
            {toISODateString(windowStart).replaceAll("-", "/")} 〜{" "}
            {toISODateString(windowEnd).replaceAll("-", "/")}
            <span className="ml-1 text-xs text-stone-400">（7日）</span>
          </span>
          <button
            type="button"
            onClick={() => onAnchorChange(addDays(anchor, 7))}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-stone-200 bg-white p-2 text-stone-700 shadow-sm active:scale-95"
            aria-label="表示を7日分進める"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ul className="space-y-6">
        {days.map((d) => {
          const key = toISODateString(d);
          const list = byDate.get(key) ?? [];
          const tone = getCalDayTone(d);
          const isToday = key === todayISODateString();
          return (
            <li
              key={key}
              aria-current={isToday ? "date" : undefined}
              className={
                isToday
                  ? "overflow-hidden rounded-2xl border-2 border-amber-400 bg-amber-50/80 shadow-md ring-2 ring-amber-200 ring-offset-2"
                  : "overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/80 shadow-sm"
              }
            >
              <div
                className={
                  isToday
                    ? "border-b border-amber-200 bg-amber-100/95"
                    : `px-4 py-3 ${dayHeaderClass(tone)}`
                }
              >
                {isToday ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <p className="text-base font-medium text-amber-950">
                      {key.replaceAll("-", "/")}{" "}
                      <span className="text-amber-800/90">({formatWeekday(d)})</span>
                    </p>
                    <span
                      className="shrink-0 rounded-md bg-amber-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
                      lang="en"
                    >
                      Today
                    </span>
                  </div>
                ) : (
                  <p
                    className={`text-base font-medium ${dayHeaderTextClass(
                      tone,
                    )}`}
                  >
                    {key.replaceAll("-", "/")}{" "}
                    <span className={daySubTextClass(tone)}>({formatWeekday(d)})</span>
                  </p>
                )}
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {SHOPS.map((shop) => {
                  const shopRows = list.filter((r) => r.shop === shop);
                  const closed = isShopClosedOn(shop, key, shopHolidays);
                  if (closed) {
                    return (
                      <div
                        key={shop}
                        className="flex min-h-[8rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-100/90 p-4 text-center shadow-inner"
                        aria-label={`${shop} 店舗休業日`}
                      >
                        <p className="text-lg font-bold text-slate-700">店舗休業日</p>
                        <p className="mt-0.5 text-xs text-slate-500">{SHOP_TAB_LABEL[shop] ?? shop}</p>
                        <p className="mt-1 text-xs text-slate-500">募集枠の登録は不要です</p>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={shop}
                      className="rounded-xl border border-stone-100 bg-white p-3 shadow-sm"
                    >
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-800">
                        <MapPin className="h-4 w-4 shrink-0 text-amber-600" />
                        {shop}
                      </h3>
                      {shopRows.length === 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-stone-400">この日の登録はありません</p>
                          {onAddForDay ? (
                            <button
                              type="button"
                              onClick={() => onAddForDay(key, shop)}
                              className="w-full min-h-[40px] rounded-lg border border-dashed border-amber-400 bg-amber-50/50 text-sm font-medium text-amber-900"
                            >
                              ＋ この日・この店舗に枠を追加
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {shopRows.map((row) => {
                            return (
                              <li
                                key={row.id}
                                className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-sm ${rowCardClassName(row)}`}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={
                                      row.staff_name == null
                                        ? "rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900"
                                        : "rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-800"
                                    }
                                  >
                                    {row.type}
                                  </span>
                                  {row.staff_name == null ? (
                                    <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-semibold text-red-900">
                                      募集中・未充足
                                    </span>
                                  ) : null}
                                  <span
                                    className={
                                      row.status === "確定" ? "text-xs text-emerald-700" : "text-xs text-amber-700"
                                    }
                                  >
                                    {row.status}
                                  </span>
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-medium">
                                    {row.staff_name ?? "（要カバー）"}
                                  </span>
                                  {row.staff_name != null ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-stone-600">
                                      <User className="h-3.5 w-3.5" />
                                      {isHqStaff(row.staff_name) ? "本部社員" : "スタッフ"}
                                    </span>
                                  ) : null}
                                </div>
                                {row.note ? (
                                  <p className="text-xs text-stone-500">備考: {row.note}</p>
                                ) : null}
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {onEditRow ? (
                                    <button
                                      type="button"
                                      onClick={() => onEditRow(row)}
                                      className="min-h-[36px] flex-1 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-800"
                                    >
                                      修正
                                    </button>
                                  ) : null}
                                  {adminMode &&
                                  row.status === "希望" &&
                                  onConfirmRow ? (
                                    <button
                                      type="button"
                                      onClick={() => onConfirmRow(row.id)}
                                      disabled={confirmingId === row.id}
                                      className="min-h-[36px] flex-1 rounded-lg bg-amber-600 text-xs font-semibold text-white disabled:opacity-50"
                                    >
                                      {confirmingId === row.id
                                        ? "確定処理中…"
                                        : "この希望を確定"}
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {shopRows.length > 0 && onAddForDay ? (
                        <button
                          type="button"
                          onClick={() => onAddForDay(key, shop)}
                          className="mt-2 w-full min-h-[36px] rounded-lg border border-dashed border-stone-300 text-xs font-medium text-stone-700"
                        >
                          ＋ 同じ日・店舗にもう1枠
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
