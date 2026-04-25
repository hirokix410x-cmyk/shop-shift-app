import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pita Work | シフト管理システム",
  description:
    "ぴたカフェ各店舗向け。シフト希望の一括登録・週次・店舗別・個人別の月間表示（2店舗まとめ表示含む）・枠の編集、同日重複（店舗を跨いだダブルブッキング）の防止、管理者向けの確定操作および店舗営業・休業の例外登録。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased text-stone-800">{children}</body>
    </html>
  );
}
