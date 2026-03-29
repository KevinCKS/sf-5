"use client";

import {
  useState,
  useMemo,
  useCallback,
  startTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toKoreanAuthMessage } from "@/lib/authErrors";
import { Lock, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DASHBOARD_PREFETCH_HREFS } from "@/lib/dashboardPrefetchRoutes";
import { useIdleStaggeredRouterPrefetch } from "@/lib/navigation/useIdleStaggeredRouterPrefetch";

/** 로그인 폼 — 이메일·비밀번호 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const prefetchHrefs = useMemo(
    () => [...new Set<string>([...DASHBOARD_PREFETCH_HREFS, next])],
    [next],
  );
  // 대시보드 전 탭 + next — 유휴·스태거 프리패치(이메일 입력 리렌더마다 effect 재실행 방지)
  useIdleStaggeredRouterPrefetch(router, prefetchHrefs);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (signError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[login]", signError.message, signError);
        }
        setError(toKoreanAuthMessage(signError));
        return;
      }
      // 라우트 전환을 전환으로 묶어 로그인 폼 언마운트 직후 메인 스레드 반응성 완화
      startTransition(() => {
        router.push(next);
        router.refresh();
      });
    },
    [email, password, next, router],
  );

  return (
    <Card className="w-full max-w-md border border-white/10 bg-card shadow-[0_16px_48px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="size-5 shrink-0 text-primary" aria-hidden />
          로그인
        </CardTitle>
        <CardDescription>이메일과 비밀번호를 입력해 주세요.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email" className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" aria-hidden />
              이메일
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5 text-muted-foreground" aria-hidden />
              비밀번호
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              "처리 중…"
            ) : (
              <>
                <LogIn className="mr-2 size-4 shrink-0" aria-hidden />
                로그인
              </>
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            계정이 없으신가요?{" "}
            <Link
              href="/signup"
              prefetch
              scroll={false}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              회원가입
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
