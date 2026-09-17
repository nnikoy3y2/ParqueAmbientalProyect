#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

// ─── CREDENCIALES DE RED ──────────────────────────────────────────
const char* ssid = "BerissoConectado_5760";
const char* password = "35951199";

// Cambia esta IP por la IP local de tu PC y el puerto del backend (3001)
const char* serverUrl = "http://192.168.0.169:3001/api/telemetria";

// ─── DISTRIBUCIÓN DEFINITIVA DE PINES (ESP32C3) ───────────────────
const int PIN_LUZ       = 4;   // GPIO 4: LDR (Analógico)
const int PIN_TEMP_ROJA = 3;   // GPIO 3: KY-028 (Analógico)
const int PIN_DHT       = 0;   // GPIO 0: DHT11 (Digital)
const int PIN_BUZZER    = 2;   // GPIO 2: Buzzer (PWM)
const int PIN_RELE      = 21;  // GPIO 21: Módulo Relé (Actuador)

#define DHTTYPE DHT11
DHT dht(PIN_DHT, DHTTYPE);

// ─── ALARMA DE EMERGENCIA (SIRENA TIPO INCENDIO) ──────────────────
// Sirena de dos tonos (tipo alarma de fuego), en vez de melodía musical.
// No bloqueante: alterna agudo/grave cada TONO_MS mientras dure la emergencia.
const int TONO_ALARMA_AGUDO = 1800; // Hz
const int TONO_ALARMA_GRAVE = 900;  // Hz
const unsigned long TONO_MS = 220;  // duración de cada tono del "wah-wah"

// ─── VARIABLES DE CONTROL Y TEMPORIZADORES ────────────────────────
unsigned long tiempoUltimoReporte = 0;
const unsigned long intervaloReporte = 2000; // Reporte al backend cada 2 seg

unsigned long tiempoInicioAccion = 0;
const unsigned long duracionAccionFija = 5000; // 5 segundos de ventilador y alarma
bool emergenciaActiva = false;

float hGlobal = 0;
float tGlobal = 0;

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELE, OUTPUT);
  
  digitalWrite(PIN_RELE, LOW);
  noTone(PIN_BUZZER);

  dht.begin();

  WiFi.begin(ssid, password);
  Serial.print("Conectando a Wi-Fi");
  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 20) {
    delay(500);
    Serial.print(".");
    intentos++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.print("\nFALLÓ. Código WiFi.status(): ");
    Serial.println(WiFi.status());
  }
  Serial.println("\n¡Conectado a Wi-Fi!");
  Serial.print("IP asignada: ");
  Serial.println(WiFi.localIP());

  Serial.println("==================================================");
  Serial.println("    SISTEMA INTEGRADO + BACKEND - LISTO          ");
  Serial.println("==================================================");
}

void loop() {
  // 1. LECTURA CONTINUA DE TEMPERATURA CRÍTICA
  int valorCrudoRojo = analogRead(PIN_TEMP_ROJA);
  int temperaturaCritica = map(valorCrudoRojo, 750, 200, 20, 75);
  temperaturaCritica = constrain(temperaturaCritica, 0, 120);

  // --- LÓGICA DE ALERTA Y RETENCIÓN DE 5 SEGUNDOS ---
  if (temperaturaCritica > 50 && !emergenciaActiva) {
    emergenciaActiva = true;
    tiempoInicioAccion = millis(); // Arranca el cronómetro de los 5 segundos
    digitalWrite(PIN_RELE, HIGH);  // Enciende ventilador
  }

  // Si la emergencia está activa, manejamos el relé y la sirena sin bloquear el loop
  if (emergenciaActiva) {
    // Mantener relé (ventilador) encendido durante los 5 segundos
    if (millis() - tiempoInicioAccion < duracionAccionFija) {
      digitalWrite(PIN_RELE, HIGH);

      // Sirena de dos tonos (agudo/grave), no bloqueante, tipo alarma de incendio
      static bool tonoAgudo = true;
      static unsigned long tUltimoCambio = 0;

      if (millis() - tUltimoCambio >= TONO_MS) {
        tUltimoCambio = millis();
        tone(PIN_BUZZER, tonoAgudo ? TONO_ALARMA_AGUDO : TONO_ALARMA_GRAVE);
        tonoAgudo = !tonoAgudo;
      }
    } else {
      // Pasaron los 5 segundos: apagamos actuador y resetamos estado
      digitalWrite(PIN_RELE, LOW);
      noTone(PIN_BUZZER);
      emergenciaActiva = false;
    }
  } else {
    digitalWrite(PIN_RELE, LOW);
    noTone(PIN_BUZZER);
  }

  // 2. REPORTE AL MONITOR SERIAL Y AL BACKEND CADA 2 SEGUNDOS
  if (millis() - tiempoUltimoReporte >= intervaloReporte) {
    tiempoUltimoReporte = millis();

    int luzCruda = analogRead(PIN_LUZ);
    int porcentajeLuz = map(luzCruda, 2500, 50, 0, 100);
    porcentajeLuz = constrain(porcentajeLuz, 0, 100);

    float hTemp = dht.readHumidity();
    float tTemp = dht.readTemperature();
    if (!isnan(hTemp) && !isnan(tTemp)) {
      hGlobal = hTemp;
      tGlobal = tTemp;
    }

    // Imprimir en Monitor Serial con formato prolijo y consistente (1 decimal en temps/humedad)
    Serial.println("\n--------------------------------------------------");
    Serial.print("💡 Luz       -> Crudo: "); Serial.print(luzCruda);
    Serial.print(" | Luminosidad: "); Serial.print(porcentajeLuz); Serial.println(" %");
    Serial.print("💧 Ambiente  -> Temp: "); Serial.print(tGlobal, 1);
    Serial.print(" °C | Humedad: "); Serial.print(hGlobal, 1); Serial.println(" %");
    Serial.print("🔥 Emergencia -> Temp. crítica: "); Serial.print(temperaturaCritica); Serial.println(" °C");

    if (temperaturaCritica > 50) {
      Serial.println("🚨 ¡EMERGENCIA DETECTADA! (Ventilador y Sirena por 5s)");
    } else {
      Serial.println("✅ Estado del Sistema: Normal");
    }

    // Envío consolidado de datos al Backend (Node.js) mediante POST HTTP en un solo JSON
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");

      // Armamos el JSON consolidado con todos los sensores juntos.
      // Temperatura y humedad con 1 decimal fijo para que los gráficos y la tabla
      // muestren valores prolijos y consistentes (antes salían con decimales de más).
      String httpRequestData = "{";
      httpRequestData += "\"luz\":" + String(porcentajeLuz) + ",";
      httpRequestData += "\"temp_dht\":" + String(tGlobal, 1) + ",";
      httpRequestData += "\"humedad_dht\":" + String(hGlobal, 1) + ",";
      httpRequestData += "\"temp_roja\":" + String(temperaturaCritica);
      httpRequestData += "}";

      int httpResponseCode = http.POST(httpRequestData);
      if (httpResponseCode > 0) {
        Serial.print("🌐 Dato enviado al backend con éxito. Código: ");
        Serial.println(httpResponseCode);
      } else {
        Serial.print("⚠️ Error al enviar al backend. Código: ");
        Serial.println(httpResponseCode);
      }
      http.end();
    }
  }

  delay(20); // Pausa breve para estabilizar el loop
}
