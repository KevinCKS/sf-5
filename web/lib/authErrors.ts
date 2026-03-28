import type { AuthError } from "@supabase/supabase-js";

/** Supabase Auth 오류 메시지를 사용자용 한글로 변환 */
export function toKoreanAuthMessage(error: AuthError | Error): string {
  const raw = "message" in error ? error.message : String(error);
  const m = raw.toLowerCase();

  if (m.includes("invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (
    m.includes("invalid api key") ||
    m.includes("invalid jwt") ||
    (m.includes("jwt") && m.includes("malformed"))
  )
    return "Supabase API 키가 올바르지 않습니다. .env.local 의 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 대시보드에서 다시 복사했는지 확인해 주세요.";
  if (m.includes("email not confirmed"))
    return "이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "이미 가입된 이메일입니다.";
  if (m.includes("password should be at least") || m.includes("at least 6"))
    return "비밀번호는 6자 이상 입력해 주세요.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "올바른 이메일 형식이 아닙니다.";
  if (m.includes("signup is disabled"))
    return "현재 회원가입이 비활성화되어 있습니다.";
  if (m.includes("email rate limit") || m.includes("too many requests") || m.includes("rate limit"))
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch"))
    return "네트워크 오류가 발생했습니다. 연결과 Supabase URL 을 확인해 주세요.";
  if (m.includes("database") && m.includes("error"))
    return "서버 설정 오류입니다. Supabase 프로젝트 상태를 확인해 주세요.";

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
