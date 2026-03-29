import { AuthTopNav } from "@/components/auth/AuthTopNav";
import { SignupForm } from "./SignupForm";

/** 회원가입 페이지 — 상단 브랜드·보조 내비 + 폼 */
export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthTopNav />
      <div className="auth-page flex flex-1 flex-col items-center justify-center p-4">
        <SignupForm />
      </div>
    </div>
  );
}
