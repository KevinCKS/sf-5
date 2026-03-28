/** PRD §6.3 액추 실제 상태 JSON — {"state":"ON"|"OFF"} */

export function parseActuatorStatusPayload(
  raw: string,
): { state: "ON" | "OFF" } | null {
  let o: unknown;
  try {
    o = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (o === null || typeof o !== "object" || Array.isArray(o)) return null;
  const rec = o as Record<string, unknown>;
  if (rec.state !== "ON" && rec.state !== "OFF") return null;
  return { state: rec.state };
}
