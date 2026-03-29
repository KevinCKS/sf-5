import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["mqtt"],
  // 프로덕션에서 console.log 등 제거(오류·경고는 유지)
  compiler:
    process.env.NODE_ENV === "production"
      ? { removeConsole: { exclude: ["error", "warn"] } }
      : undefined,
  // 아이콘·차트 라이브러리 트리 쉐이킹으로 번들·파싱 비용 감소
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@base-ui/react",
      // @supabase/* 는 Edge 미들웨어에서 쓰임 — optimizePackageImports 시 Vercel Edge 번들 오류 가능
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
    ],
    // 초기 HTML에 CSS 인라인 — 첫 페인트까지 링크 요청 감소(실험)
    inlineCss: true,
    // 클라이언트 라우터 스크롤 복원 경로 최적화
    optimizeRouterScrolling: true,
    // 동적 라우트 클라이언트 캐시 — 탭 왕복 시 RSC 재요청·전환 지연 완화(최대 60초까지 스냅샷 재사용)
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
