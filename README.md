# Pita Work — 店舗シフト（shop-shift-app）

ぴたカフェ各店向けのシフト希望登録・週次/月間表示・管理者向け営業日例外の Next.js（App Router）アプリです。データは Google スプレッドシート経由（詳細は `docs/MAINTENANCE.md`）。

## 必要環境

- Node.js 18+（LTS 推奨）
- スプレッドシート用のサービスアカウントとシート共有設定（`.env`）

## セットアップ

```bash
cd cursor/products/pitawork/shop-shift-app
cp .env.example .env   # 値を本番用に差し替え
npm install
npm run dev
```

既定で **http://localhost:3011** です（`package.json` の `dev` スクリプト参照）。

## よく使うコマンド

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー（ポート 3011） |
| `npm run build` | 本番ビルド（型・Lint 同梱） |
| `npm run start` | 本番起動（ビルド後、ポート 3011） |
| `npm run lint` | `next lint` |

## ドキュメント

- **変更箇所の地図・ドメインルール** → [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md)

## 環境変数

`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_SHEET_ID` が必須。任意で `SHIFTS_LIST_CACHE_TTL_MS`（一覧 GET の短時間キャッシュ、ミリ秒）。中身は `.env.example` を参照。
