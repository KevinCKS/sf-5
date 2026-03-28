import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** 루트 — 세션에 따라 대시보드 또는 로그인으로 이동 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }
  redirect("/login");
}
