import { type NextRequest } from "next/server";
/** Edge 번들 — Vercel에서 `@/` 해석 이슈 방지용 상대 경로 */
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// 세션 갱신이 필요한 경로만 실행 — API·정적·404 등에서는 Supabase getUser 생략
export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/auth/:path*",
  ],
};
