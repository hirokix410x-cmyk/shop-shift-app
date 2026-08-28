import type { ShiftRow } from "./types";

/** リクエストボディの形式・必須項目など、送信側の作り方が原因のエラー */
export class ShiftFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShiftFormatError";
  }
}

/** 同一氏名・同日で区分が重なるなど、業務ルール違反によるエラー */
export class ShiftConflictError extends Error {
  constructor(
    message: string,
    public readonly conflictingRow: ShiftRow,
  ) {
    super(message);
    this.name = "ShiftConflictError";
  }
}
