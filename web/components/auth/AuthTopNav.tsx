"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/** 로그인·회원가입 상단 바 — 브랜드 + 필(pill) 형태 보조 내비 */
export function AuthTopNav() {
  const pathname = usePathname();

  const pill = (
    href: string,
    label: string,
    active: boolean,
    Icon: typeof LogIn,
  ) => (
    <Link
      href={href}
      prefetch
      scroll={false}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary shadow-[0_0_16px_-4px_var(--primary)]"
          : "border-white/35 text-white hover:bg-white/10",
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
      {label}
    </Link>
  );

  return (
    <header className="auth-top-nav sticky top-0 z-50 flex w-full shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 backdrop-blur-md">
      <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-white md:text-base">
        <Leaf className="size-4 shrink-0 text-primary" aria-hidden />
        Smartfarm Web Service
      </span>
      <nav className="flex items-center gap-2" aria-label="인증 보조 메뉴">
        {pill("/login", "로그인", pathname === "/login", LogIn)}
        {pill("/signup", "회원가입", pathname === "/signup", UserPlus)}
      </nav>
    </header>
  );
}
