import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "店舗シフト | ぴたカフェ",
  description: "中村学園大学前店・九産大店のシフト希望と枠管理（モック）",
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
