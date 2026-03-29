"use client";

import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
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
    <Button
      type="button"
      variant="outline"
      className="rounded-full border-white/25 bg-transparent text-foreground hover:bg-white/10"
      onClick={handleLogout}
    >
      <LogOut className="mr-2 size-4 shrink-0" aria-hidden />
      로그아웃
    </Button>
  );
});
