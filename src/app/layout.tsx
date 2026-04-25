import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pita Work | シフト管理システム",
  description:
    "ぴたカフェ各店舗向け。シフト希望の一括登録・週次・月間表示、枠の編集、管理者向けの確定操作および店舗営業・休業の例外登録に対応したPita Workの管理画面です。",
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
