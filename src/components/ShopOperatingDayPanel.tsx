"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { SHOP_TAB_LABEL, SHOPS } from "@/lib/master";
import { isDefaultOperatingDay } from "@/lib/shopOperatingDay";
import type { ShopDayOverride, ShopName } from "@/lib/types";

type Props = {
  overrides: ShopDayOverride[];
  onAfterChange: () => void | Promise<void>;
  /** 親に見出しを置く場合、パネル内のタイトルを出さない */
  hideTitle?: boolean;
};

async function parseJson(
  res: Response,
  text: string,
): Promise<{ error?: string; errorCode?: string; alreadyExists?: boolean }> {
  try {
    return (text ? JSON.parse(text) : {}) as { error?: string; errorCode?: string };
  } catch {
    return { error: text.slice(0, 200) };
  }
}

function effectLabel(iso: string): { kind: "open" | "closed"; text: string } {
  if (isDefaultOperatingDay(iso)) {
    return { kind: "closed", text: "特別休業（原則営業の日を休みに）" };
  }
  return { kind: "open", text: "特別営業（原則休みの日を営業に）" };
}

export function ShopOperatingDayPanel({
  overrides,
  onAfterChange,
  hideTitle = false,
}: Props) {
  const idDate = useId();
  const idShop = useId();
  const [date, setDate] = useState("");
  const [shop, setShop] = useState<ShopName>(SHOPS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const nextEffect = useMemo(() => (date ? effectLabel(date) : null), [date]);

  const add = useCallback(async () => {
    setErr(null);
    setMsg(null);
    if (!date) {
      setErr("日付を選んでください。");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/shop-operating-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, shop }),
      });
      const text = await res.text();
      const data = await parseJson(res, text);
      if (!res.ok) {
        setErr(data.error ?? `失敗 (${res.status})`);
        return;
      }
      if (data.alreadyExists) {
        setMsg("すでに同じ日付・店舗の例外が登録されています。");
      } else {
        setMsg("登録しました。");
        setDate("");
      }
      await onAfterChange();
    } finally {
      setBusy(false);
    }
  }, [date, onAfterChange, shop]);

  const remove = useCallback(
    async (h: ShopDayOverride) => {
      if (!window.confirm("この例外行を削除しますか？")) {
        return;
      }
      setErr(null);
      setMsg(null);
      setBusy(true);
      try {
        const u = new URL("/api/shop-operating-days", window.location.origin);
        u.searchParams.set("date", h.date);
        u.searchParams.set("shop", h.shop);
        const res = await fetch(u.toString(), { method: "DELETE" });
        const text = await res.text();
        const data = await parseJson(res, text);
        if (!res.ok) {
          setErr(data.error ?? `失敗 (${res.status})`);
          return;
        }
        setMsg("削除しました。");
        await onAfterChange();
      } finally {
        setBusy(false);
      }
    },
    [onAfterChange],
  );

  const sorted = useMemo(
    () =>
      [...overrides].sort(
        (a, b) => a.date.localeCompare(b.date) || a.shop.localeCompare(b.shop),
      ),
    [overrides],
  );

  return (
    <div
      className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm"
      role="region"
      aria-label="店舗営業・休業の設定"
    >
      {hideTitle ? null : (
        <h3 className="font-semibold text-slate-900">店舗営業・休業設定</h3>
      )}
      <p className={hideTitle ? "text-slate-600" : "mt-1 text-slate-600"}>
        デフォルト: <strong>土日祝は休み</strong>、<strong>平日（祝日を除く）は営業</strong>。
        下記で「例外」を登録します（<strong>特別営業</strong>: 原則休みの日を営業に /
        <strong>特別休業</strong>: 原則営業の日を休みに）。シート
        <code className="mx-0.5 rounded bg-slate-200/80 px-1">shop_operating_days</code>
        。
      </p>
      <div className="mt-2 flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="min-w-0">
          <label className="text-xs font-medium text-slate-700" htmlFor={idDate}>
            日付
          </label>
          <input
            id={idDate}
            type="date"
            className="mt-0.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700" htmlFor={idShop}>
            店舗
          </label>
          <select
            id={idShop}
            className="mt-0.5 min-h-[40px] w-full min-w-[10rem] rounded-lg border border-slate-200 bg-white px-2 text-sm"
            value={shop}
            onChange={(e) => setShop(e.target.value as ShopName)}
          >
            {SHOPS.map((s) => (
              <option key={s} value={s}>
                {SHOP_TAB_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void add();
          }}
          className="min-h-[40px] rounded-lg bg-slate-800 px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "処理中…" : "例外を登録"}
        </button>
        {date ? (
          <p
            className="w-full text-xs text-slate-700 sm:min-w-0"
            role="status"
            aria-live="polite"
          >
            この日付の効果:{" "}
            <span
              className={nextEffect?.kind === "open" ? "font-semibold text-emerald-800" : "font-semibold text-amber-900"}
            >
              {nextEffect?.text}
            </span>
          </p>
        ) : null}
      </div>
      {err ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-2 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}
      {sorted.length > 0 ? (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 text-xs">
          {sorted.map((h) => {
            const eff = effectLabel(h.date);
            return (
            <li
              key={`${h.date}-${h.shop}`}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-0"
            >
              <span>
                {h.date.replaceAll("-", "/")} ・ {SHOP_TAB_LABEL[h.shop] ?? h.shop}{" "}
                <span
                  className={
                    eff.kind === "open"
                      ? "rounded bg-emerald-100 px-1 text-emerald-900"
                      : "rounded bg-amber-100 px-1 text-amber-900"
                  }
                >
                  {eff.kind === "open" ? "特別営業" : "特別休業"}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void remove(h);
                }}
                className="shrink-0 text-red-700 underline"
              >
                削除
              </button>
            </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          登録中の例外はありません（デフォルトの土日祝は休み・平日（祝日を除く）は営業のまま）。
        </p>
      )}
    </div>
  );
}
