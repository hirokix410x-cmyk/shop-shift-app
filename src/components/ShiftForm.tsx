"use client";

import { ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";
import { SHOPS, staffOptionsForShop } from "@/lib/master";
import type { ShopName, ShiftRow, ShiftStatus, ShiftType } from "@/lib/types";

const TYPES: ShiftType[] = ["全日", "午前", "午後", "イレギュラー"];
const STATUS_OPTIONS: ShiftStatus[] = ["希望", "確定"];

type Props = {
  onSubmitRow: (row: ShiftRow) => void | Promise<void>;
  /** 初期読み込み中は送信を防ぐ */
  submitDisabled?: boolean;
};

export function ShiftForm({ onSubmitRow, submitDisabled }: Props) {
  const [shop, setShop] = useState<ShopName>(SHOPS[0]);
  const [staffName, setStaffName] = useState<string>("");
  const [dateStr, setDateStr] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });

  const [type, setType] = useState<ShiftType>("全日");
  const [status, setStatus] = useState<ShiftStatus>("希望");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const nameOptions = useMemo(() => staffOptionsForShop(shop), [shop]);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-stone-800">
        <ClipboardList className="h-5 w-5 text-stone-500" />
        シフトを登録
      </h2>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const id =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `r-${Date.now()}`;
          setSaving(true);
          try {
            await Promise.resolve(
              onSubmitRow({
                id,
                date: dateStr,
                shop,
                staff_name: staffName.trim() === "" ? null : staffName.trim(),
                type,
                status,
                note: note.trim(),
              }),
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700" htmlFor="shop">
            店舗
          </label>
          <select
            id="shop"
            className="min-h-[48px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-base"
            value={shop}
            onChange={(e) => {
              const v = e.target.value as ShopName;
              setShop(v);
              setStaffName("");
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
          <label className="text-sm font-medium text-stone-700" htmlFor="name">
            氏名
          </label>
          <select
            id="name"
            className="min-h-[48px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-base"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
          >
            <option value="">未割当（募集中枠として登録）</option>
            {nameOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700" htmlFor="date">
            日付
          </label>
          <input
            id="date"
            type="date"
            className="min-h-[48px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-base"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">区分</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={
                  type === t
                    ? "min-h-[48px] rounded-xl border-2 border-amber-500 bg-amber-50 text-sm font-semibold text-amber-900 shadow-sm"
                    : "min-h-[48px] rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 active:scale-[0.98]"
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-stone-700">ステータス</p>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={
                  status === s
                    ? "min-h-[48px] flex-1 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-sm font-semibold text-emerald-900"
                    : "min-h-[48px] flex-1 rounded-xl border border-stone-200 bg-white text-sm text-stone-700"
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700" htmlFor="note">
            備考
          </label>
          <textarea
            id="note"
            rows={3}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base"
            placeholder="連絡事項や時間帯の補足など"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={saving || submitDisabled}
          className="min-h-[52px] w-full rounded-xl bg-amber-600 text-base font-semibold text-white shadow-sm enabled:active:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "スプレッドシートに保存中…" : "スプレッドシートに保存"}
        </button>
      </form>
    </section>
  );
}
