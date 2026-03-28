"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** 대시보드 세그먼트 오류 — 한글 안내 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[dashboard]", error);
    }
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-destructive">
        문제가 발생했습니다
      </h2>
      <p className="text-sm text-muted-foreground">
        대시보드를 불러오는 중 오류가 났습니다. 네트워크를 확인한 뒤 다시 시도해
        주세요.
      </p>
      <Button type="button" variant="outline" onClick={() => reset()}>
        다시 시도
      </Button>
    </div>
  );
}
