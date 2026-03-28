import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** 대시보드 패널 UI 상태 (로딩 / 빈 / 오류) */
export type DashboardPanelState = "loading" | "empty" | "error";

type PanelStateProps = {
  title: string;
  description?: string;
  state: DashboardPanelState;
  emptyMessage: string;
  errorMessage: string;
};

/** Sensor / Actuator 공통 — 스켈레톤·빈 상태·오류 안내(한글) */
export function PanelState({
  title,
  description,
  state,
  emptyMessage,
  errorMessage,
}: PanelStateProps) {
  return (
    <section
      className="flex flex-col rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
      aria-busy={state === "loading"}
    >
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 min-h-[140px] flex-1">
        {state === "loading" ? <LoadingBlock /> : null}
        {state === "empty" ? <EmptyBlock message={emptyMessage} /> : null}
        {state === "error" ? <ErrorBlock message={errorMessage} /> : null}
      </div>
    </section>
  );
}

/** 로딩 — 스켈레톤 + 스피너 */
function LoadingBlock() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="불러오는 중">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span>불러오는 중입니다…</span>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full max-w-[80%]" />
      <Skeleton className="h-24 w-full rounded-md" />
    </div>
  );
}

/** 빈 데이터 */
function EmptyBlock({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[120px] flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
      role="status"
    >
      {message}
    </div>
  );
}

/** API/네트워크 오류 */
function ErrorBlock({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[120px] flex-col items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive"
      role="alert"
    >
      {message}
    </div>
  );
}
