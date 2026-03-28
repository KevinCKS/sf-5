import { ActuatorPanel } from "@/components/dashboard/ActuatorPanel";
import { SensorReadingsDbPanel } from "@/components/dashboard/SensorReadingsDbPanel";

/** DB 탭 — 센서 측정값 조회(기간·타입·정렬) + 액추 제어 이력(MQTT 설정은 대시보드 탭) */
export default function DashboardDbPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SensorReadingsDbPanel />
      <ActuatorPanel showMqttDetails={false} showControls={false} showHistory />
    </div>
  );
}
