"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ShiftRow } from "@/lib/types";
import { ShiftBoard } from "./ShiftBoard";
import { ShiftForm } from "./ShiftForm";
import { addDays, startOfWindow, toISODateString } from "@/lib/dateUtils";

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
};

function ErrorCallout({ detail }: { detail: ApiErrorDisplay }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm"
    >
      <p className="font-semibold">{detail.title}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{detail.message}</p>
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

/**
 * /api/shifts GET の本文を解析（成功・失敗どちらも JSON 想定）
 */
async function fetchShiftsFromApi(): Promise<
  | { ok: true; shifts: ShiftRow[] }
  | { ok: false; display: ApiErrorDisplay }
> {
  const res = await fetch("/api/shifts", { cache: "no-store" });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      display: {
        title: "サーバー応答の解析に失敗しました",
        message: `JSON 以外の応答です（先頭 ${Math.min(180, text.length)} 文字）:\n${text.slice(0, 180)}${text.length > 180 ? "…" : ""}`,
        httpStatus: res.status,
      },
    };
  }
  if (!res.ok) {
    const b = data as ApiErrorBody;
    return {
      ok: false,
      display: {
        title: "シフト一覧の取得に失敗しました",
        message: b.error ?? `リクエストが失敗しました (${res.status})`,
        hint: b.hint,
        errorCode: b.errorCode,
        httpStatus: res.status,
      },
    };
  }
  const d = data as { shifts?: ShiftRow[] };
  if (!d.shifts || !Array.isArray(d.shifts)) {
    return {
      ok: false,
      display: {
        title: "想定外のレスポンスです",
        message: "shifts 配列がありません。サーバー実装を確認してください。",
        httpStatus: res.status,
      },
    };
  }
  return { ok: true, shifts: d.shifts };
}

export function ShiftApp() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => today());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorDisplay | null>(null);
  const [saveError, setSaveError] = useState<ApiErrorDisplay | null>(null);

  const refetch = useCallback(async () => {
    const r = await fetchShiftsFromApi();
    if (!r.ok) {
      setLoadError({
        ...r.display,
        title: "保存後の再読み込みに失敗しました",
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
      const r = await fetchShiftsFromApi();
      if (cancelled) return;
      if (!r.ok) {
        setLoadError(r.display);
      } else {
        setRows(r.shifts);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inWindow = useMemo(() => {
    const s = startOfWindow(weekAnchor);
    const end = addDays(s, 6);
    const startStr = toISODateString(s);
    const endStr = toISODateString(end);
    return rows.filter((r) => r.date >= startStr && r.date <= endStr);
  }, [rows, weekAnchor]);

  const handleAddShift = useCallback(
    async (row: ShiftRow) => {
      setSaveError(null);
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setSaveError({
          title: "サーバー応答の解析に失敗しました",
          message: `JSON 以外の応答です（先頭）:\n${text.slice(0, 200)}`,
          httpStatus: res.status,
        });
        throw new Error("parse");
      }
      if (!res.ok) {
        const b = data as ApiErrorBody;
        setSaveError({
          title: "スプレッドシートへの保存に失敗しました",
          message: b.error ?? `保存に失敗しました (${res.status})`,
          hint: b.hint,
          errorCode: b.errorCode,
          httpStatus: res.status,
        });
        throw new Error(b.error ?? "save failed");
      }
      await refetch();
    },
    [refetch],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-amber-800">ぴたカフェ 店舗シフト</p>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          週次シフトボード
        </h1>
        <p className="text-sm text-stone-600">
          募集中の枠は赤、本部社員の枠は青で表示。データは Google
          スプレッドシートと同期します。API
          エラー時は下記に理由・コード・ヒントを表示します（Vercel
          ログの [/api/shifts] と併せて確認してください）。
        </p>
      </header>

      {loadError ? <ErrorCallout detail={loadError} /> : null}
      {saveError ? <ErrorCallout detail={saveError} /> : null}

      {loading ? (
        <p className="text-sm text-stone-500" aria-live="polite">
          スプレッドシートから読み込み中…
        </p>
      ) : null}

      <ShiftForm onSubmitRow={handleAddShift} submitDisabled={loading} />

      <div className="border-t border-stone-200 pt-6" />

      <ShiftBoard rows={inWindow} anchor={weekAnchor} onAnchorChange={setWeekAnchor} />
    </div>
  );
}
