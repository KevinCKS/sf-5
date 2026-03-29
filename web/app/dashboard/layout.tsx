import { Leaf } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MqttBrowserProvider } from "@/components/dashboard/MqttBrowserBridge";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardHeaderActions } from "./DashboardHeaderActions";

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
    <MqttBrowserProvider>
      <div className="dashboard-root">
        <header className="dashboard-header sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Leaf
              className="size-10 shrink-0 text-primary md:size-12"
              aria-hidden
            />
            <div className="min-w-0 leading-tight">
              <p className="text-[22px] font-semibold uppercase tracking-wide text-foreground md:text-[24px]">
                Smartfarm
              </p>
              <p className="text-primary/90 text-[20px] tracking-tight md:text-[22px]">
                Web Service
              </p>
            </div>
          </div>
          <DashboardHeaderActions />
        </header>
        <DashboardShell userEmail={user.email ?? null}>{children}</DashboardShell>
      </div>
    </MqttBrowserProvider>
  );
}
