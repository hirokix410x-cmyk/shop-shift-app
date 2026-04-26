# shop-shift-app — 改修向けメモ

次回以降の修正で迷子にならないよう、役割の中心だけを圧縮して書いています。

## ざっくりデータの流れ

1. ブラウザ `ShiftApp` が `/api/shifts` と `/api/shop-operating-days` を取得（初回は並列。シフト失敗時も営業例外は取りに行く）。
2. シフト行は 1 シート目。営業例外は同じブック内タブ `shop_operating_days`（`date` / `shop` 列。コード定数: `src/lib/googleSheets.ts` の `SHOP_OPERATING_DAYS_SHEET_TITLE`）。
3. 店舗の休業/営業の**実効**は `src/lib/shopOperatingDay.ts`（`isDefaultOperatingDay`＋`@holiday-jp`、上書き有無で `isStoreClosed` 等）。ここを変えると週次・一括・月間（単一店）の判定が一括で変わる。

## 型メモ

- `PersonViewShopFilter`（`"all" \| ShopName`）は `src/components/PersonalShiftCalendar.tsx` で定義。店舗別月間の `shop` 兼用のため `MonthlyShopCalendar` から `import type` している（循環 import にならないよう **値の import にしない**）。

## 主要ファイル早見

| 領域 | パス | メモ |
|------|------|------|
| 画面の親・ナビ・トースト・エラー | `src/components/ShiftApp.tsx` | ページ内 ID: `#section-bulk` `#section-admin` `#section-views` `#panel-week` `#panel-month` `#panel-person`。表示切替: 週次 / **店舗別月間** / **個人別**。月間・個人別とも **「2店舗」タブ**で全店分を1グリッドに集約、各単一店タブでその店だけ。2店舗表示中の「＋」の店舗は **直前に選んだ単一店**（`monthAddShop` / `personAddShop`、未操作時は `SHOPS[0]`）。スクロール: `SCROLL_ANCHOR_TOP_OFFSET_PX` / `SCROLL_AFTER_VIEW_CHANGE_MS`、各所 `scroll-mt-20` |
| 週次 | `src/components/ShiftBoard.tsx` | 休業/特別営業表示 |
| 一括 | `src/components/MonthlyShiftBulkForm.tsx` | 休業日はフォームから除外（`isStoreClosed`）。送信前に重複（下記 `staffShiftConflict`）をクライアントでも検査 |
| 月間（店舗） | `src/components/MonthlyShopCalendar.tsx` | `shop: "all" \| 店名`。単一店: `isStoreClosed` でセル全体を店休表示。**2店舗（`all`）**: 両店行を日付に集約し行頭に店名短縮、セル全体の店休グレーは使わない（店ごとに休みが違うため）。特営はどちらかで特営ならバッジ |
| 月間（個人） | `src/components/PersonalShiftCalendar.tsx` | 氏名＋`viewShopFilter`（2店舗/単一店）。行は店名＋区分 |
| モーダル | `src/components/ShiftFormModal.tsx` | 1 枠の CRUD。送信前に重複検査（`allRows` 利用） |
| 同時刻重複（ダブルブッキング）防止 | `src/lib/staffShiftConflict.ts` | 同一氏名・同一日で区分の時間帯が重なる組は **別店舗でも不可**。メッセージ用に `SHOP_TAB_LABEL` を使用。API: `src/app/api/shifts/route.ts` の POST/一部 PATCH で `listShiftsFromSheet` と突合（PATCH は日時・店舗・氏名が変わる場合のみ） |
| 管理者・営業例外 UI | `src/components/ShopOperatingDayPanel.tsx` | `hideTitle` で外見出しと重複回避可 |
| 営業日ロジック | `src/lib/shopOperatingDay.ts` | ドメインの単一の源に寄せる |
| Sheets 読み書き | `src/lib/googleSheets.ts` | シフト + `shop_operating_days` 作成/追加/削除 |
| API | `src/app/api/shifts/route.ts`、一括承認 `src/app/api/shifts/confirm-batch/route.ts`（POST `ids: string[]`）、`src/app/api/shop-operating-days/route.ts` | バリデーション → Sheets。一括承認は `googleSheets.confirmShiftsByIdsInSheet`（希望→確定のみ更新） |
| 店舗名・定数 | `src/lib/master.ts` | 店舗列挙・`SHOP_TAB_LABEL`・一括/モーダル用氏名（`STAFFS` / `staffOptionsForShop`）・**個人別の氏名プルーダ**（`allKnownStaffNameOptions` / `allStaffNamesForPicker`） |
| 和暦/土日祝色 | `src/lib/jpCalendarStyle.ts` + `dateUtils.ts` | 表示トーンの統一 |
| 行の色（募集中等） | `src/lib/shiftStyle.ts` + `master.ts` の `shiftBoardCardSurfaceClass` 等 | 週次カードは **店舗** で色分け（中村=琥珀、九産大=水色）。募集中は赤のまま |

## スプレッドシート

- 先頭タブ: シフト用（ヘッダーは `googleSheets` の `SHIFT_SHEET_HEADER`）。
- タブ名 `shop_operating_days`: 例外行のみ。**土日祝に行がある → 特別営**、**平日(祝日を除く)に行がある → 特別休**（旧 `shop_holidays` の意味と逆。移行は手作業想定でコード側の自動移行はしていない）。

## 動作確認の定番

```bash
npm run build
```

## メタデータ（ブラウザタブ等）

`src/app/layout.tsx` の `metadata`（`title` / `description`）。
