"use client";

import { useRouter } from "next/navigation";
import { DASHBOARD_PREFETCH_HREFS } from "@/lib/dashboardPrefetchRoutes";
import { useIdleStaggeredRouterPrefetch } from "@/lib/navigation/useIdleStaggeredRouterPrefetch";

/** 대시보드 하위 탭 RSC·청크를 미리 불러와 링크 클릭 시 전환 지연을 줄임 */
export function DashboardRoutePrefetch() {
  const router = useRouter();
  useIdleStaggeredRouterPrefetch(router, DASHBOARD_PREFETCH_HREFS);
  return null;
}
