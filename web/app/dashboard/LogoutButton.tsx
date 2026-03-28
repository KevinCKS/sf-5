"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** 로그아웃 버튼 */
export function LogoutButton() {
  const router = useRouter();

  // 로그아웃 직후 이동할 로그인 RSC·청크 미리 로드
  useEffect(() => {
    router.prefetch("/login");
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}
