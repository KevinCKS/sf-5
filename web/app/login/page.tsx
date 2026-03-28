import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

/** 로그인 페이지 */
export default function LoginPage() {
  return (
    <div className="auth-page flex items-center justify-center p-4">
      <Suspense fallback={<p className="text-muted-foreground">불러오는 중…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
