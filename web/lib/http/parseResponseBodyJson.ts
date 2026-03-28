/**
 * fetch 응답 본문을 JSON 으로 파싱. HTML 오류 페이지 등이면 한글 안내 반환
 */
export async function parseResponseBodyJson<T>(res: Response): Promise<
  | { parseOk: true; data: T }
  | { parseOk: false; fallbackMessage: string }
> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as T;
    return { parseOk: true, data };
  } catch {
    const snippet = text.trim().slice(0, 80).replace(/\s+/g, " ");
    const msg =
      res.status >= 500
        ? `서버 오류(HTTP ${res.status}). 터미널 로그를 확인하세요.${snippet ? ` (${snippet}…)` : ""}`
        : `응답을 JSON 으로 읽을 수 없습니다(HTTP ${res.status}).${snippet ? ` (${snippet}…)` : ""}`;
    return { parseOk: false, fallbackMessage: msg };
  }
}
