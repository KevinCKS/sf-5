/** yy/m/d HH:mm — 숫자·구분 최소 (예: 25/3/29 14:30) */
export function formatShortDateTime(input: Date | number | string): string {
  const d =
    input instanceof Date
      ? input
      : typeof input === "number"
        ? new Date(input)
        : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const yy = String(d.getFullYear()).slice(-2);
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${yy}/${mo}/${day} ${hh}:${mm}`;
}
