"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DASHBOARD_PREFETCH_HREFS } from "@/lib/dashboardPrefetchRoutes";

/** 대시보드 하위 탭 RSC·청크를 미리 불러와 링크 클릭 시 전환 지연을 줄임 */
export function DashboardRoutePrefetch() {
  const router = useRouter();

  // 첫 페인트 직후 메인 스레드 경합을 줄이기 위해 유휴 시 프리패치(최대 ~2초 내 실행)
  useEffect(() => {
    const run = () => {
      DASHBOARD_PREFETCH_HREFS.forEach((href) => {
        router.prefetch(href);
      });
    };
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (typeof requestIdleCallback !== "undefined") {
      idleId = requestIdleCallback(
        () => {
          if (!cancelled) run();
        },
        { timeout: 2000 },
      );
    } else {
      timeoutId = setTimeout(() => {
        if (!cancelled) run();
      }, 1);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [router]);

  return null;
}
