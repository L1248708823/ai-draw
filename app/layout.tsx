import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "画图工作台",
  description: "",
  icons: {
    icon: [
      { url: "/cat-f.png?v=1", type: "image/png", sizes: "32x32" },
      { url: "/cat-f.png?v=1", type: "image/png", sizes: "192x192" }
    ],
    shortcut: ["/cat-f.png?v=1"],
    apple: [{ url: "/cat-f.png?v=1", sizes: "180x180" }]
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
