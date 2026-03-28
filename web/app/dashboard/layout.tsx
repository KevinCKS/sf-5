import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MqttBrowserProvider } from "@/components/dashboard/MqttBrowserBridge";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LogoutButton } from "./LogoutButton";

/** 대시보드 공통 — 좌측 내비·MQTT Provider·헤더 */
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
    <div className="dashboard-root">
      <header className="dashboard-header sticky top-0 z-10 flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            스마트팜
          </h1>
          <p className="text-muted-foreground text-xs tracking-wide">
            대시보드 · DB · Alert
          </p>
        </div>
        <LogoutButton />
      </header>
      <MqttBrowserProvider>
        <DashboardShell userEmail={user.email ?? null}>{children}</DashboardShell>
      </MqttBrowserProvider>
    </div>
  );
}
