"use client";

import { CalendarRange } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { SHOPS, staffOptionsForShop } from "@/lib/master";
import { isShopClosedOn } from "@/lib/shopHolidays";
import type { ShopHoliday, ShopName, ShiftRow, ShiftType } from "@/lib/types";
import { addMonths, getDaysInMonth, startOfMonth, toISODateString } from "@/lib/dateUtils";
import {
  dayRowSurfaceClass,
  getCalDayToneFromIso,
  weekdayPublicHolidayLabel,
} from "@/lib/jpCalendarStyle";

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
  /** 重複案内・取り込み用の既存シフト行 */
  allRows: ShiftRow[];
  /** 店舗休業日（該当する日の行を除外） */
  shopHolidays: ShopHoliday[];
};

function todayNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(dt);
}

export function MonthlyShiftBulkForm({
  onSubmitBulk,
  submitDisabled,
  allRows,
  shopHolidays,
}: Props) {
  const listId = useId();
  const [shop, setShop] = useState<ShopName>(SHOPS[0]);
  const [monthOffset, setMonthOffset] = useState<0 | 1 | 2>(1);
  const [staffName, setStaffName] = useState("");
  const [noteAll, setNoteAll] = useState("");
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const targetMonth = useMemo(
    () => addMonths(startOfMonth(todayNoon()), monthOffset),
    [monthOffset],
  );
  const year = targetMonth.getFullYear();
  const month1 = targetMonth.getMonth() + 1;
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

  /** 一括対象: 店舗休業日の日付は行を出さない */
  const inputIsoDates = useMemo(
    () => isoDates.filter((iso) => !isShopClosedOn(shop, iso, shopHolidays)),
    [isoDates, shop, shopHolidays],
  );
  const closedInMonthCount = isoDates.length - inputIsoDates.length;

  useEffect(() => {
    setDayMap((prev) => {
      const next: DayTypeMap = {};
      for (const iso of inputIsoDates) {
        next[iso] = (prev[iso] as ShiftType | "") ?? "";
      }
      return next;
    });
    setDayNotes((prev) => {
      const next: Record<string, string> = {};
      for (const iso of inputIsoDates) {
        next[iso] = prev[iso] ?? "";
      }
      return next;
    });
  }, [inputIsoDates]);

  const setDay = useCallback((iso: string, t: ShiftType | "") => {
    setDayMap((m) => ({ ...m, [iso]: t }));
  }, []);

  const fillAll = useCallback(
    (t: ShiftType) => {
      setDayMap((m) => {
        const next = { ...m };
        for (const iso of inputIsoDates) {
          next[iso] = t;
        }
        return next;
      });
    },
    [inputIsoDates],
  );

  const clearAll = useCallback(() => {
    setDayMap((m) => {
      const next: DayTypeMap = { ...m };
      for (const iso of inputIsoDates) {
        next[iso] = "";
      }
      return next;
    });
  }, [inputIsoDates]);

  const nameOptions = useMemo(() => staffOptionsForShop(shop), [shop]);
  const selectedCount = useMemo(() => {
    return inputIsoDates.filter((iso) => {
      const t = dayMap[iso];
      return t != null && t !== "";
    }).length;
  }, [inputIsoDates, dayMap]);

  const isoSet = useMemo(() => new Set(isoDates), [isoDates]);

  const { existingDateCount, hasExisting } = useMemo(() => {
    const dates = new Set<string>();
    for (const r of allRows) {
      if (r.shop !== shop) {
        continue;
      }
      if (isoSet.has(r.date)) {
        dates.add(r.date);
      }
    }
    return { existingDateCount: dates.size, hasExisting: dates.size > 0 };
  }, [allRows, shop, isoSet]);

  const importExisting = useCallback(() => {
    setSubmitErr(null);
    setDayMap((prev) => {
      const next: DayTypeMap = { ...prev };
      for (const iso of inputIsoDates) {
        const forDay = allRows.filter((r) => r.shop === shop && r.date === iso);
        if (forDay.length === 0) {
          continue;
        }
        const r0 = forDay[0];
        next[iso] = r0.type;
      }
      return next;
    });
    setDayNotes((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const iso of inputIsoDates) {
        const forDay = allRows.filter((r) => r.shop === shop && r.date === iso);
        if (forDay.length === 0) {
          continue;
        }
        next[iso] = forDay[0].note ?? "";
      }
      return next;
    });
  }, [allRows, shop, inputIsoDates]);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-stone-800">
        <CalendarRange className="h-5 w-5 text-stone-500" />
        月を選んで一括登録
      </h2>
      <p className="mb-3 text-sm text-stone-600">
        対象月の全日（1日〜{daysInMonth}日）を列挙します。区分を付けた日だけが1回のAPIで一括送信されます。
        <span className="ml-1 text-xs text-stone-500">（行の色: 土=青、日/祝=薄赤）</span>
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-stone-700" htmlFor="bulk-month">
          対象月
        </label>
        <select
          id="bulk-month"
          className="min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-medium text-stone-900"
          value={monthOffset}
          onChange={(e) => {
            setMonthOffset(Number(e.target.value) as 0 | 1 | 2);
            setSubmitErr(null);
          }}
        >
          {([0, 1, 2] as const).map((off) => {
            const m = addMonths(startOfMonth(todayNoon()), off);
            const y = m.getFullYear();
            const mo = m.getMonth() + 1;
            const label =
              off === 0 ? "当月" : off === 1 ? "翌月" : "翌々月";
            return (
              <option key={off} value={off}>
                {label}（{y}年{mo}月）
              </option>
            );
          })}
        </select>
        <span className="text-sm text-stone-600">
          ={" "}
          <span className="font-medium text-stone-800">
            {year}年{month1}月
          </span>
        </span>
      </div>

      {closedInMonthCount > 0 ? (
        <p className="mb-3 text-sm text-slate-600">
          店舗休業日（<code className="rounded bg-slate-100 px-1">shop_holidays</code>）のため、この店舗では{" "}
          <strong>{closedInMonthCount}日分</strong>は一括入力欄に表示しません。
        </p>
      ) : null}

      {hasExisting ? (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          <p>
            この店舗×{year}年{month1}月には、すでに登録のある日が{" "}
            <strong>{existingDateCount}日分</strong> あります。一括送信すると
            <strong>同じ日に行が追記</strong>され、スプレッドシート上で重複する可能性があります。整理が必要なら、先に
            スプレッドシートで削除するか、週次・月間の「修正」で個別に直してください。
          </p>
          <button
            type="button"
            onClick={importExisting}
            className="mt-2 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-950"
          >
            既存の1件目（同じ日）を日別の区分・備考に取り込む
          </button>
        </div>
      ) : null}

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
            共通・備考（日別を空欄のとき、各行に同じ文を付与。日別欄を優先）
          </label>
          <textarea
            id="bulk-note"
            rows={2}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base"
            value={noteAll}
            onChange={(e) => setNoteAll(e.target.value)}
            placeholder="空欄可。イレギュラー枠のための一文もここに入れられます（日別があれば日別を優先）"
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
        {inputIsoDates.map((iso) => {
          const cur = (dayMap[iso] as ShiftType | "") ?? "";
          const tone = getCalDayToneFromIso(iso);
          const wkHoli = weekdayPublicHolidayLabel(iso);
          return (
            <div
              key={iso}
              className={`flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center ${dayRowSurfaceClass(tone)}`}
            >
              <div
                className={`w-32 shrink-0 text-sm font-medium ${
                  tone === "saturday"
                    ? "text-blue-900"
                    : tone === "sundayOrHoliday"
                      ? "text-red-900"
                      : "text-stone-800"
                }`}
              >
                {formatLabel(iso)}
                {wkHoli ? (
                  <span className="ml-1 text-[10px] font-medium text-red-800">（{wkHoli}）</span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start">
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
                {cur ? (
                  <div className="w-full min-w-0 sm:max-w-[12rem]">
                    <label className="sr-only" htmlFor={`dn-${iso}`}>
                      この日の備考
                    </label>
                    <textarea
                      id={`dn-${iso}`}
                      rows={2}
                      className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs"
                      placeholder="日別の備考（空なら共通へ）"
                      value={dayNotes[iso] ?? ""}
                      onChange={(e) =>
                        setDayNotes((m) => ({ ...m, [iso]: e.target.value }))
                      }
                    />
                    {cur === "イレギュラー" ? (
                      <p className="mt-0.5 text-[11px] text-amber-800">※イレは日別か共通のどちらかに内容を入れてください</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {submitErr ? (
        <p className="mb-2 text-sm text-red-700" role="alert">
          {submitErr}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-stone-500">
        送信対象: {selectedCount} 日分（ステータスは「希望」で登録）
      </p>

      <button
        type="button"
        disabled={saving || submitDisabled || selectedCount === 0}
        onClick={async () => {
          setSubmitErr(null);
          const staff = staffName.trim() === "" ? null : staffName.trim();
          const globalN = noteAll.trim();
          const rows: ShiftRow[] = [];
          for (const iso of inputIsoDates) {
            const t = (dayMap[iso] as ShiftType | "") ?? "";
            if (t === "") {
              continue;
            }
            const perDay = (dayNotes[iso] ?? "").trim();
            const combined = perDay || globalN;
            if (t === "イレギュラー" && !combined) {
              setSubmitErr(
                `「イレギュラー」: ${formatLabel(iso)} の枠に、日別か共通の備考（時間帯等）を入力してください。`,
              );
              return;
            }
            rows.push({
              id: newIds(),
              date: iso,
              shop,
              staff_name: staff,
              type: t,
              note: combined,
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
          : `${year}年${month1}月分を一括でスプレッドシートに保存（${selectedCount}件）`}
      </button>
    </section>
  );
}
