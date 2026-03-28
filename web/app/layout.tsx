import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/** Supabase API 호출 전에 DNS·TLS 핸드셰이크 준비 — 첫 fetch 지연 완화 */
function supabasePreconnectOrigin(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u?.trim()) return null;
  try {
    return new URL(u.trim()).origin;
  } catch {
    return null;
  }
}

/** 루트 레이아웃 — 전역 폰트·스타일 래퍼 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Smartfarm",
  description: "스마트팜 모니터링·제어",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseOrigin = supabasePreconnectOrigin();

  return (
    <html lang="ko" className="dark">
      <head>
        {supabaseOrigin ? (
          <link
            rel="preconnect"
            href={supabaseOrigin}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
