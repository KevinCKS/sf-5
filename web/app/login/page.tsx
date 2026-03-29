import { Suspense } from "react";
import { AuthTopNav } from "@/components/auth/AuthTopNav";
import { LoginForm } from "./LoginForm";

/** 로그인 페이지 — 상단 브랜드·보조 내비 + 폼 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthTopNav />
      <div className="auth-page flex flex-1 flex-col items-center justify-center p-4">
        <Suspense fallback={<p className="text-muted-foreground">불러오는 중…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
