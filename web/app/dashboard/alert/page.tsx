import { AlertPanel } from "@/components/dashboard/AlertPanel";

/** Alert 탭 — 임계치·알림 이력 (PRD §5.5–5.6) */
export default function DashboardAlertPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <AlertPanel />
    </div>
  );
}
