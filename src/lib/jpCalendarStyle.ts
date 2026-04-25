import holiday_jp from "@holiday-jp/holiday_jp";
import { toISODateString } from "./dateUtils";

/**
 * 土: 青系 / 日・祝(土以外): 赤系。土曜が祝日の場合は土扱い（青）に揃える。
 */
export type CalDayTone = "weekday" | "saturday" | "sundayOrHoliday";

export function getCalDayTone(d: Date): CalDayTone {
  const iso = toISODateString(d);
  const w = d.getDay();
  if (w === 6) {
    return "saturday";
  }
  if (w === 0) {
    return "sundayOrHoliday";
  }
  if (holiday_jp.isHoliday(iso)) {
    return "sundayOrHoliday";
  }
  return "weekday";
}

export function getCalDayToneFromIso(iso: string): CalDayTone {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(12, 0, 0, 0);
  return getCalDayTone(dt);
}

/** 週次：日付ヘッダー帯用 */
export function dayHeaderClass(tone: CalDayTone): string {
  if (tone === "saturday") {
    return "border-b border-blue-200/80 bg-blue-50/90";
  }
  if (tone === "sundayOrHoliday") {
    return "border-b border-red-200/80 bg-red-50/80";
  }
  return "border-b border-stone-200 bg-white";
}

/** 週次：日付ラベル文字色 */
export function dayHeaderTextClass(tone: CalDayTone): string {
  if (tone === "saturday") {
    return "text-blue-950";
  }
  if (tone === "sundayOrHoliday") {
    return "text-red-900";
  }
  return "text-stone-900";
}

export function daySubTextClass(tone: CalDayTone): string {
  if (tone === "saturday") {
    return "text-blue-700/90";
  }
  if (tone === "sundayOrHoliday") {
    return "text-red-700/90";
  }
  return "text-stone-500";
}

/** 一括フォーム行・月間セルの枠＋地色 */
export function dayRowSurfaceClass(tone: CalDayTone): string {
  if (tone === "saturday") {
    return "border-blue-200/80 bg-blue-50/50";
  }
  if (tone === "sundayOrHoliday") {
    return "border-red-200/80 bg-red-50/50";
  }
  return "border-stone-100 bg-white";
}

export function dayNumberPillClass(tone: CalDayTone): string {
  if (tone === "saturday") {
    return "text-[11px] font-semibold text-blue-800";
  }
  if (tone === "sundayOrHoliday") {
    return "text-[11px] font-semibold text-red-800";
  }
  return "text-[11px] font-semibold text-stone-500";
}

/** 月間カレンダー：日付数字の上に「祝」ラベル用（週日以外で祝） */
export function isHolidayForCalendarLabel(d: Date): boolean {
  const w = d.getDay();
  if (w === 0 || w === 6) {
    return false;
  }
  return holiday_jp.isHoliday(toISODateString(d));
}

/** 月〜金の祝日のみ（表示に「祝」表記） */
export function weekdayPublicHolidayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(12, 0, 0, 0);
  const w = dt.getDay();
  if (w === 0 || w === 6) {
    return "";
  }
  return holiday_jp.isHoliday(iso) ? "祝" : "";
}
