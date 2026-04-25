"use client";

import { Calendar, ChevronLeft, ChevronRight, MapPin, User } from "lucide-react";
import { useMemo, useState } from "react";
import { SHOPS } from "@/lib/master";
import { rowCardClassName } from "@/lib/shiftStyle";
import type { ShiftRow } from "@/lib/types";
import { isHqStaff } from "@/lib/master";
import { addDays, startOfWindow, toISODateString } from "@/lib/dateUtils";

type Props = {
  rows: ShiftRow[];
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  adminMode?: boolean;
  onConfirmRow?: (id: string) => void | Promise<void>;
  confirmingId?: string | null;
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
}: Props) {
  const windowStart = startOfWindow(anchor);
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
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onAnchorChange(addDays(anchor, -7))}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-stone-200 bg-white p-2 text-stone-700 shadow-sm active:scale-95"
            aria-label="前の週"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[10.5rem] text-center text-sm text-stone-600">
            {toISODateString(windowStart).replaceAll("-", "/")} 〜
          </span>
          <button
            type="button"
            onClick={() => onAnchorChange(addDays(anchor, 7))}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-stone-200 bg-white p-2 text-stone-700 shadow-sm active:scale-95"
            aria-label="次の週"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ul className="space-y-6">
        {days.map((d) => {
          const key = toISODateString(d);
          const list = byDate.get(key) ?? [];
          return (
            <li key={key} className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/80 shadow-sm">
              <div className="border-b border-stone-200 bg-white px-4 py-3">
                <p className="text-base font-medium text-stone-900">
                  {key.replaceAll("-", "/")}{" "}
                  <span className="text-stone-500">({formatWeekday(d)})</span>
                </p>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {SHOPS.map((shop) => {
                  const shopRows = list.filter((r) => r.shop === shop);
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
                        <p className="text-sm text-stone-400">この日の登録はありません</p>
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
                                {adminMode &&
                                row.status === "希望" &&
                                onConfirmRow ? (
                                  <button
                                    type="button"
                                    onClick={() => onConfirmRow(row.id)}
                                    disabled={confirmingId === row.id}
                                    className="mt-1 min-h-[36px] w-full rounded-lg bg-amber-600 text-xs font-semibold text-white disabled:opacity-50"
                                  >
                                    {confirmingId === row.id
                                      ? "確定処理中…"
                                      : "この希望を確定"}
                                  </button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
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
