"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { staffOptionsForShop } from "@/lib/master";
import { SHOPS } from "@/lib/master";
import type { ShopName, ShiftRow, ShiftType } from "@/lib/types";

const TYPES: ShiftType[] = ["全日", "午前", "午後", "イレギュラー"];

export type FormContext =
  | { kind: "new"; date: string; shop: ShopName }
  | { kind: "edit"; row: ShiftRow };

type Props = {
  open: boolean;
  context: FormContext | null;
  onClose: () => void;
  onCreate: (row: ShiftRow) => Promise<void>;
  onUpdate: (row: ShiftRow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busy?: boolean;
};

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ShiftFormModal({
  open,
  context,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  busy = false,
}: Props) {
  const listId = useId();
  const [shop, setShop] = useState<ShopName>(SHOPS[0]);
  const [dateStr, setDateStr] = useState("");
  const [type, setType] = useState<ShiftType>("全日");
  const [staffName, setStaffName] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!context) {
      return;
    }
    if (context.kind === "new") {
      setShop(context.shop);
      setDateStr(context.date);
      setType("全日");
      setStaffName("");
      setNote("");
    } else {
      const r = context.row;
      setShop(r.shop);
      setDateStr(r.date);
      setType(r.type);
      setStaffName(r.staff_name ?? "");
      setNote(r.note);
    }
    setErr(null);
  }, [context]);

  if (!open || !context) {
    return null;
  }

  const isNew = context.kind === "new";
  const isConfirmedEdit = !isNew && context.row.status === "確定";
  const nameOptions = staffOptionsForShop(shop);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-form-title"
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 id="shift-form-title" className="text-base font-semibold text-stone-900">
            {isNew ? "シフト枠の登録" : "シフト枠の編集"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            if (type === "イレギュラー" && !note.trim()) {
              setErr("イレギュラーの場合は時間帯・内容を備考に記入してください。");
              return;
            }
            const staff = staffName.trim() === "" ? null : staffName.trim();
            const n = note.trim();
            if (isNew) {
              await onCreate({
                id: newId(),
                date: dateStr,
                shop,
                staff_name: staff,
                type,
                note: n,
                status: "希望",
              });
            } else {
              const r = context.row;
              let nextNote = n;
              let nextStatus: "希望" | "確定" = r.status;
              if (isConfirmedEdit) {
                nextStatus = "希望";
                if (!n.startsWith("【要再承認】")) {
                  nextNote = n ? `【要再承認】${n}` : "【要再承認】";
                }
              }
              await onUpdate({
                ...r,
                date: dateStr,
                shop,
                staff_name: staff,
                type,
                note: nextNote,
                status: nextStatus,
              });
            }
            onClose();
          }}
        >
          {isConfirmedEdit ? (
            <p className="rounded-lg bg-amber-50 px-2 py-2 text-sm text-amber-950">
              保存すると <strong>確定</strong> は <strong>希望</strong>{" "}
              に戻り、承認依頼として備考に「【要再承認】」を付与します（管理者向け再確認用）。
            </p>
          ) : null}

          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">店舗</label>
            <select
              className="min-h-[44px] w-full rounded-lg border border-stone-200 bg-stone-50 px-2"
              value={shop}
              onChange={(e) => setShop(e.target.value as ShopName)}
              required
            >
              {SHOPS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">日付</label>
            <input
              type="date"
              className="min-h-[44px] w-full rounded-lg border border-stone-200 bg-stone-50 px-2"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              required
            />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-700">区分</p>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={
                    type === t
                      ? "min-h-[44px] rounded-lg border-2 border-amber-500 bg-amber-50 text-sm font-medium"
                      : "min-h-[44px] rounded-lg border border-stone-200 bg-stone-50 text-sm"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            {type === "イレギュラー" ? (
              <p className="mt-1 text-xs text-amber-800">
                イレギュラーは必ず備考（時間帯・内容）を記入してください。
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">氏名</label>
            <input
              list={listId}
              className="min-h-[44px] w-full rounded-lg border border-stone-200 bg-stone-50 px-2"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="空欄＝未割当（募集枠）"
            />
            <datalist id={listId}>
              {nameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">備考</label>
            <textarea
              className="min-h-[4rem] w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          {err ? <p className="text-sm text-red-700">{err}</p> : null}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            {!isNew ? (
              <button
                type="button"
                disabled={deleting || busy}
                onClick={async () => {
                  if (!window.confirm("この枠を削除してよいですか？")) {
                    return;
                  }
                  setDeleting(true);
                  try {
                    await onDelete(context.row.id);
                    onClose();
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="min-h-[44px] rounded-lg border border-red-300 text-red-800 disabled:opacity-50 sm:mr-auto"
              >
                {deleting ? "削除中…" : "削除"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-stone-200"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-amber-600 px-4 font-medium text-white disabled:opacity-50"
            >
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
