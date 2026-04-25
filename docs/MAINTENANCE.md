# shop-shift-app — 改修向けメモ

次回以降の修正で迷子にならないよう、役割の中心だけを圧縮して書いています。

## ざっくりデータの流れ

1. ブラウザ `ShiftApp` が `/api/shifts` と `/api/shop-operating-days` を取得（初回は並列。シフト失敗時も営業例外は取りに行く）。
2. シフト行は 1 シート目。営業例外は同じブック内タブ `shop_operating_days`（`date` / `shop` 列。コード定数: `src/lib/googleSheets.ts` の `SHOP_OPERATING_DAYS_SHEET_TITLE`）。
3. 店舗の休業/営業の**実効**は `src/lib/shopOperatingDay.ts`（`isDefaultOperatingDay`＋`@holiday-jp`、上書き有無で `isStoreClosed` 等）。ここを変えると週次・一括・月間の判定が一括で変わる。

## 主要ファイル早見

| 領域 | パス | メモ |
|------|------|------|
| 画面の親・ナビ・トースト・エラー | `src/components/ShiftApp.tsx` | ページ内 ID: `#section-bulk` `#section-admin` `#section-views` `#panel-week` `#panel-month`。スクロール: `SCROLL_ANCHOR_TOP_OFFSET_PX` / `SCROLL_AFTER_VIEW_CHANGE_MS`、各所 `scroll-mt-20` |
| 週次 | `src/components/ShiftBoard.tsx` | 休業/特別営業表示 |
| 一括 | `src/components/MonthlyShiftBulkForm.tsx` | 休業日はフォームから除外（`isStoreClosed`） |
| 月間 | `src/components/MonthlyShopCalendar.tsx` | 同上 |
| モーダル | `src/components/ShiftFormModal.tsx` | 1 枠の CRUD |
| 管理者・営業例外 UI | `src/components/ShopOperatingDayPanel.tsx` | `hideTitle` で外見出しと重複回避可 |
| 営業日ロジック | `src/lib/shopOperatingDay.ts` | ドメインの単一の源に寄せる |
| Sheets 読み書き | `src/lib/googleSheets.ts` | シフト + `shop_operating_days` 作成/追加/削除 |
| API | `src/app/api/shifts/route.ts`, `src/app/api/shop-operating-days/route.ts` | バリデーション → Sheets |
| 店舗名・定数 | `src/lib/master.ts` | 店舗列挙・**一括/モーダルで選べる氏名**（`STAFFS` / `staffOptionsForShop`） |
| 和暦/土日祝色 | `src/lib/jpCalendarStyle.ts` + `dateUtils.ts` | 表示トーンの統一 |
| 行の色（募集中等） | `src/lib/shiftStyle.ts` | 週次カードの色 |

## スプレッドシート

- 先頭タブ: シフト用（ヘッダーは `googleSheets` の `SHIFT_SHEET_HEADER`）。
- タブ名 `shop_operating_days`: 例外行のみ。**土日祝に行がある → 特別営**、**平日(祝日を除く)に行がある → 特別休**（旧 `shop_holidays` の意味と逆。移行は手作業想定でコード側の自動移行はしていない）。

## 動作確認の定番

```bash
npm run build
```

## メタデータ（ブラウザタブ等）

`src/app/layout.tsx` の `metadata`（`title` / `description`）。
