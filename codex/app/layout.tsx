import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPT Image 2 X Gallery",
  description: "Discover public GPT Image 2 generations and prompt snippets from X-compatible sources."
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
