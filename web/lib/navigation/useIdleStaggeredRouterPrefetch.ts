"use client";

import { useEffect } from "react";

/** next/navigation router.prefetch 최소 타입 */
type PrefetchCapableRouter = { prefetch: (href: string) => void };

const STAGGER_MS = 45;
/** 유휴가 길게 안 잡힐 때 콜백이 너무 늦게 강제 실행되지 않도록 상한(프리패치 완료 시점 앞당김) */
const IDLE_TIMEOUT_MS = 1500;

/**
 * 유휴 시 `router.prefetch` 를 경로마다 간격을 두어 실행 — 메인 스레드·네트워크 버스트 완화.
 * 호출부에서 `hrefs` 는 내용이 바뀔 때만 참조가 바뀌도록 `useMemo` 로 감싸는 것을 권장.
 */
export function useIdleStaggeredRouterPrefetch(
  router: PrefetchCapableRouter,
  hrefs: readonly string[],
) {
  useEffect(() => {
    if (hrefs.length === 0) return;

    const targets = [...hrefs];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      targets.forEach((href, i) => {
        timeouts.push(
          setTimeout(() => {
            if (!cancelled) router.prefetch(href);
          }, i * STAGGER_MS),
        );
      });
    };

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (typeof requestIdleCallback !== "undefined") {
      idleId = requestIdleCallback(
        () => {
          if (!cancelled) run();
        },
        { timeout: IDLE_TIMEOUT_MS },
      );
    } else {
      timeoutId = setTimeout(() => {
        if (!cancelled) run();
      }, 1);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, [router, hrefs]);
}
