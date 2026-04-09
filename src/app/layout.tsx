import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "内容监控与选题分析工具",
  description: "多平台内容监控与 AI 选题分析",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
