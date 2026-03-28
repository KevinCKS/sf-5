import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

/** 보호된 대시보드(메인) — 로그인 사용자만 접근 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <h1 className="text-lg font-semibold">스마트팜 대시보드</h1>
        <LogoutButton />
      </header>
      <main className="p-4">
        <p className="text-muted-foreground">
          로그인됨: <span className="font-medium text-foreground">{user.email}</span>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          이후 단계에서 센서·액츄 UI가 이 영역에 연결됩니다.
        </p>
      </main>
    </div>
  );
}
