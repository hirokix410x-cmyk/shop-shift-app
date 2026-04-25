export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 週の開始日（月曜0時）。日本の業務週想定。 */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=日
  const diffFromMon = (day + 6) % 7;
  x.setDate(x.getDate() - diffFromMon);
  return x;
}

export function startOfWindow(anchor: Date): Date {
  return startOfWeekMonday(anchor);
}

export function toISODateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
