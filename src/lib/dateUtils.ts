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

/** ローカル日付（時刻は無視） */
export function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(1);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function getNextMonthFirst(d: Date = new Date()): Date {
  return startOfMonth(addMonths(d, 1));
}

export function getDaysInMonth(y: number, m1to12: number): number {
  return new Date(y, m1to12, 0).getDate();
}

export function getMonthCalendarCells(y: number, m1to12: number): (Date | null)[] {
  const first = new Date(y, m1to12 - 1, 1);
  const daysIn = getDaysInMonth(y, m1to12);
  const startPad = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysIn; d++) {
    const dt = new Date(y, m1to12 - 1, d);
    dt.setHours(12, 0, 0, 0);
    cells.push(dt);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function formatYearMonth(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
