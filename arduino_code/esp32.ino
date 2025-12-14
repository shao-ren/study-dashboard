#include "secrets.h"

#include <Wire.h>
#include <BH1750.h>
#include <FastLED.h>

#include "esp_camera.h"
#include "esp_system.h"
#include "esp_psram.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <base64.h>

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#ifdef ARDUINO_ARCH_ESP32
  #include <esp_eap_client.h>
#endif

/* LED Ring */
#define LED_PIN 15
#define NUM_LEDS 16
#define LED_TYPE WS2812
#define BRIGHTNESS 64
#define TARGET_LUX 100

CRGB leds[NUM_LEDS];
BH1750 lightMeter(0x23);

float ambient_lux = 0.0;
bool isWhite = false;

/* Ultrasonic Sensor */
#define TRIG_PIN 5
#define ECHO_PIN 18

float distance_cm = 0.0;
bool isPresent = false;

/* AWS Connections */
#define AMBIENT_PUBLISH_TOPIC    "esp32/ambient/pub"
#define AMBIENT_SUBSCRIBE_TOPIC  "esp32/ambient/sub"
#define PRESENCE_PUBLISH_TOPIC   "esp32/presence/pub"
#define PRESENCE_SUBSCRIBE_TOPIC "esp32/presence/sub"
#define CAMERA_PUBLISH_TOPIC     "esp32/camera/pub"
#define CAMERA_SUBSCRIBE_TOPIC   "esp32/camera/sub"

unsigned long lastPublishTime = 0;
const unsigned long publishInterval = 5000; // 10 seconds

unsigned long lastImageCaptureTime = 0;
const unsigned long imageCaptureInterval = 5000; // 10 seconds

WiFiClientSecure net;
PubSubClient client(net);

// forward declarations
void messageHandler(char *topic, byte *payload, unsigned int length);
void connectWiFi_PEAP();
void connectAWS();
void publishPresenceMessage();
void publishAmbientMessage();
float measureDistance();

// --- WiFi (WPA2-Enterprise / PEAP) ---
void connectWiFi_PEAP() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_STA);
  Serial.printf("Starting PEAP connect to SSID: %s\n", WIFI_SSID);

#ifdef ARDUINO_ARCH_ESP32
  esp_eap_client_set_identity((const unsigned char*)WIFI_IDENTITY, strlen(WIFI_IDENTITY));
  esp_eap_client_set_username((const unsigned char*)WIFI_USERNAME, strlen(WIFI_USERNAME));
  esp_eap_client_set_password((const unsigned char*)WIFI_PASSWORD, strlen(WIFI_PASSWORD));
  esp_err_t err = esp_wifi_sta_enterprise_enable();
  if (err != ESP_OK) {
    Serial.printf("esp_wifi_sta_enterprise_enable() returned %d\n", err);
  }
#endif

  WiFi.begin(WIFI_SSID);
  unsigned long start = millis();
  const unsigned long timeout = 30000;
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeout) {
    Serial.print(".");
    delay(500);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected (PEAP). IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi (PEAP) within timeout.");
  }
}

// --- AWS IoT connect (MQTT over TLS) ---
void connectAWS() {
  connectWiFi_PEAP();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot connect to AWS: WiFi not connected.");
    return;
  }

  net.setCACert(AWS_CERT_CA);
  net.setCertificate(AWS_CERT_CRT);
  net.setPrivateKey(AWS_CERT_PRIVATE);

  client.setServer(AWS_IOT_ENDPOINT, 8883);
  client.setCallback(messageHandler);

  Serial.println("Connecting to AWS IoT...");
  int tries = 0;
  const int maxTries = 8;
  while (!client.connected() && tries < maxTries) {
    if (client.connect(THINGNAME)) {
      Serial.println("\nConnected to AWS IoT.");
      break;
    } else {
      Serial.print(".");
      delay(500);
      tries++;
    }
  }

  if (!client.connected()) {
    Serial.println("\nFailed to connect to AWS IoT after retries.");
    return;
  }

  client.subscribe(AMBIENT_SUBSCRIBE_TOPIC);
  Serial.println("Subscribed to ambient topic: " AMBIENT_SUBSCRIBE_TOPIC);
  client.subscribe(PRESENCE_SUBSCRIBE_TOPIC);
  Serial.println("Subscribed to presence topic: " PRESENCE_SUBSCRIBE_TOPIC);
  client.subscribe(CAMERA_SUBSCRIBE_TOPIC);
  Serial.println("Subscribed to camera topic: " CAMERA_SUBSCRIBE_TOPIC);
}

// --- Publish JSON presence data via MQTT ---
void publishPresenceMessage() {
  StaticJsonDocument<256> doc;
  doc["device"] = "esp32-ultrasonic";
  doc["distance_cm"] = distance_cm;
  doc["presence"] = isPresent;
  doc["timestamp"] = millis();

  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));

  if (client.connected()) {
    bool ok = client.publish(PRESENCE_PUBLISH_TOPIC, jsonBuffer);
    if (ok) {
      Serial.println("Published to presence topic: ");
      Serial.println(jsonBuffer);
    } else {
      Serial.println("Publish to presence topic failed!");
    }
  } else {
    Serial.println("MQTT not connected, skip publish to presence topic.");
  }
}

// --- Publish JSON ambient data via MQTT ---
void publishAmbientMessage() {
  StaticJsonDocument<2048> doc;
  doc["device"] = "esp32-light";
  doc["ambient_lux"] = ambient_lux;
  doc["timestamp"] = millis();

  char jsonBuffer[2048];
  serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));

  if (client.connected()) {
    bool ok = client.publish(AMBIENT_PUBLISH_TOPIC, jsonBuffer);
    if (ok) {
      Serial.println("Published to ambient topic: ");
      Serial.println(jsonBuffer);
    } else {
      Serial.println("Publish to ambient topic failed!");
    }
  } else {
    Serial.println("MQTT not connected, skip publish to ambient topic.");
  }
}

// --- Publish JSON camera data via MQTT ---
void publishCameraMessage(String base64Img) {
  StaticJsonDocument<256> doc;
  doc["device"] = "eps32-camera";
  doc["image"] = base64Img;
  doc["timestamp"] = millis();

  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));

  if (client.connected()) {
    bool ok = client.publish(CAMERA_PUBLISH_TOPIC, jsonBuffer);
    if (ok) {
      Serial.println("Published to camera topic: ");
      Serial.println(jsonBuffer);
    } else {
      Serial.println("Publish to camera topic failed!");
    }
  } else {
    Serial.println("MQTT not connected, skip publish to camera topic.");
  }
}

// --- MQTT callback ---
void messageHandler(char *topic, byte *payload, unsigned int length) {
  Serial.print("Incoming on [");
  Serial.print(topic);
  Serial.println("]");
  char msg[length + 1];
  memcpy(msg, payload, length);
  msg[length] = '\0';
  Serial.println(msg);
}

// --- Measure distance using HC-SR04 ---
float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH); // timeout 30ms
  float distance = duration * 0.0343 / 2;         // convert to cm
  if (distance == 0 || distance > 400) return -1; // invalid reading
  return distance;
}

// --- LED ring lighting transition ---
void smoothTransition(CRGB color1, CRGB color2) {
  int blendAmount = 0;
  while (blendAmount <= 255) {
    for (int i = 0; i < NUM_LEDS; i++) {
      leds[i] = blend(color1, color2, blendAmount);
    }
    blendAmount+=10;  // 0-255, controls mix
    FastLED.show();
    FastLED.delay(100);
  }
}

void cameraInit() {
  if (psramInit()) {
    Serial.println("PSRAM initialized successfully!");
  } else {
    Serial.println("PSRAM not found or failed to initialize!");
  }

  // Initialize camera
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5;
  config.pin_d1 = 18;
  config.pin_d2 = 19;
  config.pin_d3 = 21;
  config.pin_d4 = 36;
  config.pin_d5 = 39;
  config.pin_d6 = 34;
  config.pin_d7 = 35;
  config.pin_xclk = 0;
  config.pin_pclk = 22;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_sscb_sda = 26;
  config.pin_sscb_scl = 27;
  config.pin_pwdn = 32;
  config.pin_reset = -1;   // no reset pin
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    // config.frame_size = FRAMESIZE_VGA;  // 640x480
    config.frame_size = FRAMESIZE_XGA;
    config.jpeg_quality = 12;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 15;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  } else {
    Serial.println("Camera init success!");
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println("ESP32 + AWS IoT Starting...");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  Wire.begin(21, 22);         // explicit SDA, SCL
  Wire.setClock(100000);     // safe 100 kHz
  delay(200);
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("BH1750 init failed");
  } else {
    Serial.println("BH1750 ok");
  }

  FastLED.addLeds<LED_TYPE, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  isWhite = false;

  cameraInit();

  connectAWS();

}

void loop() {
  distance_cm = measureDistance();
  if (distance_cm < 0) {
    Serial.println("Distance: Invalid reading");
  } else {
    Serial.printf("Distance: %.2f cm\n", distance_cm);
  }

  // presence logic: consider <50 cm as "present"
  isPresent = (distance_cm > 0 && distance_cm < 50);

  ambient_lux = lightMeter.readLightLevel();
  Serial.print("Ambient Light: ");
  Serial.print(ambient_lux);
  Serial.println(" lx");

  unsigned long now_camera = millis();
  if (now_camera - lastImageCaptureTime > imageCaptureInterval) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera: Capture failed.");
      delay(2000);
    } 
    Serial.println("Camera: Image captured.");

    String base64Img = base64::encode(fb->buf, fb->len);
    esp_camera_fb_return(fb);
    // String base64Img = "img";
    publishCameraMessage(base64Img);
    lastImageCaptureTime = now_camera;
  }

  unsigned long now = millis();
  if (now - lastPublishTime > publishInterval) {
    publishPresenceMessage();
    publishAmbientMessage();
    lastPublishTime = now;
  }

  // Keep MQTT alive
  client.loop();

  // Reconnect if needed
  if (!client.connected()) {
    Serial.println("MQTT disconnected, reconnecting...");
    connectAWS();
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting...");
    connectWiFi_PEAP();
  }

  // Map lux value to LED brightness (0–255)
  if (ambient_lux < TARGET_LUX && !isWhite) {
    smoothTransition(CRGB::Yellow, CRGB::White);
    isWhite = true;
  } 
  else if (ambient_lux < TARGET_LUX && isWhite) {
    fill_solid(leds, NUM_LEDS, CRGB::White);
    FastLED.show();
  }
  else if (ambient_lux >= TARGET_LUX && isWhite) {
    smoothTransition(CRGB::White, CRGB::Yellow);
    isWhite = false;
  }
  else {
    fill_solid(leds, NUM_LEDS, CRGB::Yellow);
  }

  delay(1000);
}