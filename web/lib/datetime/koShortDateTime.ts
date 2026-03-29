/** ko-KR 짧은 날짜·시각 — 루프에서 toLocaleString 반복 호출 대신 단일 Intl 인스턴스 재사용 */
export const KO_SHORT_DATETIME = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "medium",
});
