/** credentials·no-store 공통 — Abort·priority 는 호출부에서 덧붙임 */
export function dashboardJsonFetchInit(overrides?: RequestInit): RequestInit {
  return {
    credentials: "include",
    cache: "no-store",
    ...overrides,
  };
}

/**
 * 대시보드 API용 fetch Init — silent(폴링·백그라운드 갱신)일 때 priority: low 로
 * 사용자 클릭·수동 조회와의 네트워크 경합을 완화(Chrome 등 지원 브라우저).
 */
export function dashboardFetchInit(
  signal: AbortSignal,
  opts?: { silent?: boolean },
): RequestInit {
  const base = dashboardJsonFetchInit({ signal });
  if (opts?.silent !== true) return base;
  return { ...base, priority: "low" } as RequestInit;
}

/**
 * MQTT 수신 후 ingest 요청 — 사용자 클릭과 경합 시 네트워크 우선순위 낮춤(Abort 없음).
 */
export function mqttBackgroundFetchInit(): RequestInit {
  return {
    ...dashboardJsonFetchInit(),
    priority: "low",
  } as RequestInit;
}
