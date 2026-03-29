import { createBrowserClient } from "@supabase/ssr";

/** 브라우저에서만 재사용 — RSC 사전 렌더 시에는 매번 새 인스턴스 */
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

/** 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (typeof window === "undefined") {
    return createBrowserClient(url, key);
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
