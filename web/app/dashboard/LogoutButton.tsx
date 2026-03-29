"use client";

import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useIdleStaggeredRouterPrefetch } from "@/lib/navigation/useIdleStaggeredRouterPrefetch";

/** 로그인 페이지 프리패치 — 대시보드와 동일 유휴·스태거 훅 */
const LOGIN_PREFETCH_HREFS = ["/login"] as const;

/** 로그아웃 버튼 — 레이아웃 본문 갱신 시 헤더만 불필요 재렌더 생략 */
export const LogoutButton = memo(function LogoutButton() {
  const router = useRouter();
  useIdleStaggeredRouterPrefetch(router, LOGIN_PREFETCH_HREFS);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <Button type="button" variant="outline" onClick={handleLogout}>
      로그아웃
    </Button>
  );
});
