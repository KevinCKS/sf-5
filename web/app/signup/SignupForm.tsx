"use client";

import { useState, useCallback, startTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toKoreanAuthMessage } from "@/lib/authErrors";
import { Lock, Mail, UserPlus } from "lucide-react";
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

/** 회원가입 폼 */
export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 대시보드 탭 청크 — 유휴·스태거 프리패치(로그인 폼과 동일 훅)
  useIdleStaggeredRouterPrefetch(router, DASHBOARD_PREFETCH_HREFS);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setInfo(null);
      setLoading(true);
      const supabase = createClient();
      const { data, error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=/dashboard`,
        },
      });
      setLoading(false);
      if (signError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[signup]", signError.message, signError);
        }
        setError(toKoreanAuthMessage(signError));
        return;
      }
      if (data.session) {
        startTransition(() => {
          router.push("/dashboard");
          router.refresh();
        });
        return;
      }
      setInfo(
        "가입 메일을 보냈습니다. 이메일을 확인한 뒤 로그인해 주세요. (인증을 끈 프로젝트는 바로 로그인 화면으로 이동해 주세요.)",
      );
    },
    [email, password, router],
  );

  return (
    <Card className="w-full max-w-md border border-white/10 bg-card shadow-[0_16px_48px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
      <CardHeader>
        <CardTitle>회원가입</CardTitle>
        <CardDescription>이메일과 비밀번호로 계정을 만듭니다.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="text-sm text-muted-foreground" role="status">
              {info}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label
              htmlFor="signup-email"
              className="inline-flex items-center gap-1.5"
            >
              <Mail className="size-3.5 text-muted-foreground" aria-hidden />
              이메일
            </Label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="signup-password"
              className="inline-flex items-center gap-1.5"
            >
              <Lock className="size-3.5 text-muted-foreground" aria-hidden />
              비밀번호
            </Label>
            <Input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">6자 이상 입력해 주세요.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              "처리 중…"
            ) : (
              <>
                <UserPlus className="mr-2 size-4 shrink-0" aria-hidden />
                가입하기
              </>
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              prefetch
              scroll={false}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              로그인
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
