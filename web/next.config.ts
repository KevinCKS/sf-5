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
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
    ],
    // 클라이언트 라우터 스크롤 복원 경로 최적화
    optimizeRouterScrolling: true,
    // 동적 라우트 클라이언트 캐시(기본 dynamic=0) — 탭 왕복 시 RSC 재요청 완화
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;
