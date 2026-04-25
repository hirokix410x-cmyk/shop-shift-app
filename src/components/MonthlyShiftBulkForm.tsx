"use client";

import { CalendarRange } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { SHOPS, staffOptionsForShop } from "@/lib/master";
import type { ShopName, ShiftRow, ShiftType } from "@/lib/types";
import {
  getDaysInMonth,
  getNextMonthFirst,
  toISODateString,
} from "@/lib/dateUtils";

const TYPES: ShiftType[] = ["全日", "午前", "午後", "イレギュラー"];

type DayTypeMap = Record<string, ShiftType | "">;

function newIds(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type Props = {
  onSubmitBulk: (shifts: ShiftRow[]) => void | Promise<void>;
  submitDisabled?: boolean;
};

function formatLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(dt);
}

export function MonthlyShiftBulkForm({ onSubmitBulk, submitDisabled }: Props) {
  const listId = useId();
  const [shop, setShop] = useState<ShopName>(SHOPS[0]);
  const [staffName, setStaffName] = useState("");
  const [noteAll, setNoteAll] = useState("");
  const [saving, setSaving] = useState(false);

  const nextMonth = useMemo(() => getNextMonthFirst(), []);
  const year = nextMonth.getFullYear();
  const month1 = nextMonth.getMonth() + 1;
  const daysInMonth = getDaysInMonth(year, month1);

  const [dayMap, setDayMap] = useState<DayTypeMap>({});

  const isoDates = useMemo(() => {
    const out: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month1 - 1, d);
      dt.setHours(12, 0, 0, 0);
      out.push(toISODateString(dt));
    }
    return out;
  }, [year, month1, daysInMonth]);

  useEffect(() => {
    setDayMap((prev) => {
      const next: DayTypeMap = {};
      for (const iso of isoDates) {
        next[iso] = (prev[iso] as ShiftType | "") ?? "";
      }
      return next;
    });
  }, [isoDates]);

  const setDay = useCallback((iso: string, t: ShiftType | "") => {
    setDayMap((m) => ({ ...m, [iso]: t }));
  }, []);

  const fillAll = useCallback(
    (t: ShiftType) => {
      setDayMap((m) => {
        const next = { ...m };
        for (const iso of isoDates) {
          next[iso] = t;
        }
        return next;
      });
    },
    [isoDates],
  );

  const clearAll = useCallback(() => {
    setDayMap((m) => {
      const next: DayTypeMap = { ...m };
      for (const iso of isoDates) {
        next[iso] = "";
      }
      return next;
    });
  }, [isoDates]);

  const nameOptions = useMemo(() => staffOptionsForShop(shop), [shop]);
  const selectedCount = useMemo(() => {
    return isoDates.filter((iso) => {
      const t = dayMap[iso];
      return t != null && t !== "";
    }).length;
  }, [isoDates, dayMap]);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-stone-800">
        <CalendarRange className="h-5 w-5 text-stone-500" />
        翌月分をまとめて登録
      </h2>
      <p className="mb-4 text-sm text-stone-600">
        対象:{" "}
        <span className="font-medium text-stone-800">
          {year}年{month1}月（全{daysInMonth}日）
        </span>
        。区分を付けた日だけが1回のAPIで一括送信されます。
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700" htmlFor="bulk-shop">
            店舗
          </label>
          <select
            id="bulk-shop"
            className="min-h-[48px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-base"
            value={shop}
            onChange={(e) => {
              setShop(e.target.value as ShopName);
            }}
          >
            {SHOPS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700" htmlFor="bulk-staff">
            氏名（空欄＝未割当・募集枠、任意の名前も入力可）
          </label>
          <input
            id="bulk-staff"
            name="staff"
            list={listId}
            className="min-h-[48px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-base"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="未入力で募集枠"
            autoComplete="off"
          />
          <datalist id={listId}>
            {nameOptions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-stone-700" htmlFor="bulk-note">
            共通・備考（全行に同じ内容を付与）
          </label>
          <textarea
            id="bulk-note"
            rows={2}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base"
            value={noteAll}
            onChange={(e) => setNoteAll(e.target.value)}
            placeholder="空欄可"
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fillAll("全日")}
          className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
        >
          全日で一括
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
        >
          全てクリア
        </button>
      </div>

      <div className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/60 p-2 sm:max-h-[32rem]">
        {isoDates.map((iso) => {
          const cur = (dayMap[iso] as ShiftType | "") ?? "";
          return (
            <div
              key={iso}
              className="flex flex-col gap-2 rounded-lg border border-stone-100 bg-white p-2 sm:flex-row sm:items-center"
            >
              <div className="w-32 shrink-0 text-sm font-medium text-stone-800">
                {formatLabel(iso)}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-5">
                <button
                  type="button"
                  onClick={() => setDay(iso, "")}
                  className={
                    cur === ""
                      ? "min-h-[44px] rounded-lg border-2 border-stone-400 bg-stone-100 text-sm"
                      : "min-h-[44px] rounded-lg border border-stone-200 text-sm text-stone-500"
                  }
                >
                  登録しない
                </button>
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDay(iso, t)}
                    className={
                      cur === t
                        ? "min-h-[44px] rounded-lg border-2 border-amber-500 bg-amber-50 text-sm font-medium text-amber-950"
                        : "min-h-[44px] rounded-lg border border-stone-200 bg-stone-50 text-sm"
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-sm text-stone-500">
        送信対象: {selectedCount} 日分（ステータスは「希望」で登録）
      </p>

      <button
        type="button"
        disabled={saving || submitDisabled || selectedCount === 0}
        onClick={async () => {
          const staff = staffName.trim() === "" ? null : staffName.trim();
          const note = noteAll.trim();
          const rows: ShiftRow[] = [];
          for (const iso of isoDates) {
            const t = (dayMap[iso] as ShiftType | "") ?? "";
            if (t === "") {
              continue;
            }
            rows.push({
              id: newIds(),
              date: iso,
              shop,
              staff_name: staff,
              type: t,
              note,
              status: "希望",
            });
          }
          setSaving(true);
          try {
            await onSubmitBulk(rows);
          } finally {
            setSaving(false);
          }
        }}
        className="mt-4 min-h-[52px] w-full rounded-xl bg-amber-600 text-base font-semibold text-white shadow-sm enabled:active:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? "一括送信中…"
          : `翌月分を一括でスプレッドシートに保存（${selectedCount}件）`}
      </button>
    </section>
  );
}
