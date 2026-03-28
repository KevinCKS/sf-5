import { SignupForm } from "./SignupForm";

/** 회원가입 페이지 */
export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <SignupForm />
    </div>
  );
}
