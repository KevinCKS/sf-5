import { dashboardJsonFetchInit } from "@/lib/http/dashboardFetchInit";
import { parseResponseBodyJson } from "@/lib/http/parseResponseBodyJson";

/** DELETE /api/sensor-readings/clear 결과 — UI 는 setState 만 분기 */
export type ClearSensorReadingsResult =
  | { ok: true; deleted: number }
  | { ok: false; errorMessage: string };

/** 본인 측정 이력 전체 삭제 API 호출·JSON 파싱(대시보드·DB 탭 공통) */
export async function requestClearAllSensorReadings(): Promise<ClearSensorReadingsResult> {
  const res = await fetch("/api/sensor-readings/clear", {
    method: "DELETE",
    ...dashboardJsonFetchInit(),
  });
  const parsed = await parseResponseBodyJson<{
    ok?: boolean;
    deleted?: number;
    error?: string;
  }>(res);
  if (!parsed.parseOk) {
    return { ok: false, errorMessage: parsed.fallbackMessage };
  }
  const json = parsed.data;
  if (!res.ok) {
    return { ok: false, errorMessage: json.error ?? "삭제에 실패했습니다." };
  }
  return { ok: true, deleted: json.deleted ?? 0 };
}
