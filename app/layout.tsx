import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "画图工作台",
  description: "一个偏编辑刊物风格的对话式生图网站。",
  icons: {
    icon: [
      { url: "/favicon.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/favicon.png?v=3", type: "image/png", sizes: "192x192" }
    ],
    shortcut: ["/favicon.png?v=3"],
    apple: [{ url: "/favicon.png?v=3", sizes: "180x180" }]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
