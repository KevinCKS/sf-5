import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

/** 대시보드 공통 레이아웃 — 헤더·배경 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            스마트팜 대시보드
          </h1>
          <p className="text-xs text-muted-foreground">Sensor · Actuator</p>
        </div>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
