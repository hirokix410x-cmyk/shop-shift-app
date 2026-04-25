"use client";

import { useMemo, useState } from "react";
import { initialMockShifts } from "@/lib/mockData";
import type { ShiftRow } from "@/lib/types";
import { ShiftBoard } from "./ShiftBoard";
import { ShiftForm } from "./ShiftForm";
import { addDays, startOfWindow, toISODateString } from "@/lib/dateUtils";

function today(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export function ShiftApp() {
  const [rows, setRows] = useState<ShiftRow[]>(() => initialMockShifts);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => today());

  const inWindow = useMemo(() => {
    const s = startOfWindow(weekAnchor);
    const end = addDays(s, 6);
    const startStr = toISODateString(s);
    const endStr = toISODateString(end);
    return rows.filter((r) => r.date >= startStr && r.date <= endStr);
  }, [rows, weekAnchor]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-amber-800">ぴたカフェ 店舗シフト（UIモック）</p>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          週次シフトボード
        </h1>
        <p className="text-sm text-stone-600">
          募集中の枠は赤、本部社員の枠は青で表示。Google
          Sheets連携は次フェーズで接続予定のため、今はこの画面内の仮データです。
        </p>
      </header>

      <ShiftForm
        onSubmitRow={(row) => {
          setRows((prev) => [row, ...prev]);
        }}
      />

      <div className="border-t border-stone-200 pt-6" />

      <ShiftBoard rows={inWindow} anchor={weekAnchor} onAnchorChange={setWeekAnchor} />
    </div>
  );
}
