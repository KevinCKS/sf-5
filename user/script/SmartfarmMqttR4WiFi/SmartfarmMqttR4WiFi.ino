/**
 * Smartfarm — Arduino UNO R4 WiFi (1차)
 * PRD §6 토픽·JSON 정합: 센서 발행 + 액추 구독 + §6.3 상태 발행
 * timestamp 는 웹 브리지가 덮어쓰므로 본 페이로드는 플레이스홀더("-")만 둠 (NTP 없음)
 * 라이브러리: PubSubClient (라이브러리 매니저 설치)
 */
#include <WiFiS3.h>
#include <WiFiSSLClient.h>
#include <PubSubClient.h>
#include <math.h>
#include <string.h>

// arduino_secrets.h.example 을 같은 폴더에 arduino_secrets.h 로 복사한 뒤 값을 채웁니다.
#include "arduino_secrets.h"

#ifndef SECRET_MQTT_PORT
#define SECRET_MQTT_PORT 8883
#endif

// ---- PRD §6.1 발행 토픽 / §6.2 구독 토픽 (web/lib/mqtt/allowlist.ts 와 동일 문자열) ----
static const char TOPIC_SENSORS[] = "smartfarm/sensors";
static const char TOPIC_LED[] = "smartfarm/actuators/led";
static const char TOPIC_PUMP[] = "smartfarm/actuators/pump";
static const char TOPIC_FAN1[] = "smartfarm/actuators/fan1";
static const char TOPIC_FAN2[] = "smartfarm/actuators/fan2";

// PRD §6.3 — 명령 처리 후 웹이 구독하는 상태 토픽(보고)
static const char TOPIC_STATUS_LED[] = "smartfarm/actuators/status/led";
static const char TOPIC_STATUS_PUMP[] = "smartfarm/actuators/status/pump";
static const char TOPIC_STATUS_FAN1[] = "smartfarm/actuators/status/fan1";
static const char TOPIC_STATUS_FAN2[] = "smartfarm/actuators/status/fan2";

static const char MQTT_CLIENT_ID[] = "uno-r4-smartfarm-1";

// 고정 더미(1차) — 시리얼로 숫자 덮어쓰기 가능
static float g_temp = 24.5f;
static float g_humi = 62.0f;
static float g_ec = 1.2f;
static float g_ph = 6.1f;

static WiFiSSLClient wifiSsl;
static PubSubClient mqtt(wifiSsl);

static const unsigned long PUBLISH_INTERVAL_MS = 15000;

static unsigned long lastPublishMs = 0;

/** 명령 토픽에 대응하는 §6.3 상태 토픽으로 {"state":"ON"|"OFF"} 발행 */
static void publishStatusForCommandTopic(const char* cmdTopic, const char* stateStr) {
  const char* st = nullptr;
  if (strcmp(cmdTopic, TOPIC_LED) == 0) st = TOPIC_STATUS_LED;
  else if (strcmp(cmdTopic, TOPIC_PUMP) == 0) st = TOPIC_STATUS_PUMP;
  else if (strcmp(cmdTopic, TOPIC_FAN1) == 0) st = TOPIC_STATUS_FAN1;
  else if (strcmp(cmdTopic, TOPIC_FAN2) == 0) st = TOPIC_STATUS_FAN2;
  if (!st) return;
  char body[40];
  snprintf(body, sizeof(body), "{\"state\":\"%s\"}", stateStr);
  if (mqtt.publish(st, body)) {
    Serial.print(F("[STATUS] "));
    Serial.println(st);
  } else {
    Serial.println(F("[STATUS] publish 실패"));
  }
}

static void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char buf[128];
  unsigned int n = length < sizeof(buf) - 1 ? length : sizeof(buf) - 1;
  memcpy(buf, payload, n);
  buf[n] = '\0';

  Serial.print(F("[ACT] "));
  Serial.print(topic);
  Serial.print(F(" "));
  Serial.println(buf);

  const char* stateStr = nullptr;
  if (strstr(buf, "\"OFF\"") != nullptr) stateStr = "OFF";
  else if (strstr(buf, "\"ON\"") != nullptr) stateStr = "ON";

  if (stateStr != nullptr) {
    publishStatusForCommandTopic(topic, stateStr);
  }
}

static bool connectMqtt() {
  mqtt.setServer(SECRET_MQTT_HOST, SECRET_MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(384);

  if (mqtt.connected()) return true;

  Serial.print(F("[MQTT] 연결 시도... "));
  if (mqtt.connect(MQTT_CLIENT_ID, SECRET_MQTT_USER, SECRET_MQTT_PASS)) {
    Serial.println(F("OK"));
    mqtt.subscribe(TOPIC_LED);
    mqtt.subscribe(TOPIC_PUMP);
    mqtt.subscribe(TOPIC_FAN1);
    mqtt.subscribe(TOPIC_FAN2);
    Serial.println(F("[MQTT] 구독: led, pump, fan1, fan2"));
    return true;
  }
  Serial.print(F("실패 rc="));
  Serial.println(mqtt.state());
  return false;
}

static void publishSensorJson() {
  char body[224];
  snprintf(body, sizeof(body),
           "{\"temp\":%.1f,\"humi\":%.1f,\"ec\":%.1f,\"ph\":%.1f,\"timestamp\":\"-\"}",
           (double)g_temp, (double)g_humi, (double)g_ec, (double)g_ph);

  if (mqtt.publish(TOPIC_SENSORS, body)) {
    Serial.print(F("[TX] "));
    Serial.println(body);
  } else {
    Serial.println(F("[TX] publish 실패"));
  }
}

static void handleSerialCommands() {
  if (Serial.available() < 1) return;
  char c = (char)Serial.read();
  switch (c) {
    case 'p':
    case 'P':
      publishSensorJson();
      break;
    case 'h':
    case 'H':
      Serial.println(F("p — 지금 센서 JSON 1회 발행"));
      Serial.println(F("t23.5 — temp 덮어쓰기(예: t23.5)"));
      break;
    case 't':
    case 'T': {
      float v = Serial.parseFloat();
      if (!isnan((double)v)) g_temp = v;
      Serial.print(F("[CFG] temp="));
      Serial.println(g_temp);
      break;
    }
    default:
      break;
  }
  while (Serial.available() > 0) Serial.read();
}

void setup() {
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 3000) {}

  Serial.println(F("Smartfarm MQTT R4 WiFi — step7"));

  WiFi.begin(SECRET_WIFI_SSID, SECRET_WIFI_PASS);
  Serial.print(F("[WiFi] 연결 중 "));
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print('.');
  }
  Serial.println();
  Serial.print(F("[WiFi] OK IP "));
  Serial.println(WiFi.localIP());

  lastPublishMs = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[WiFi] 끊김 — 재연결"));
    WiFi.begin(SECRET_WIFI_SSID, SECRET_WIFI_PASS);
    delay(2000);
    return;
  }

  if (!mqtt.connected()) {
    connectMqtt();
    delay(1500);
  } else {
    mqtt.loop();
  }

  handleSerialCommands();

  unsigned long now = millis();
  if (mqtt.connected() && (now - lastPublishMs >= PUBLISH_INTERVAL_MS)) {
    lastPublishMs = now;
    publishSensorJson();
  }
}
