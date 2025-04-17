#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <TM1637Display.h>

// WiFi credentials - should be moved to a config file or environment variables
const char* ssid = "Mihalew";       // Replace with your WiFi SSID
const char* password = "Semeomed1"; // Replace with your WiFi password

// WebSocket server details
const char* wsHost = "192.168.1.105"; // Your server IP address
const int wsPort = 8080;

// Hardware pins
#define SERVO_PIN 13

// IR Sensor pins
#define IR_SENSOR1_PIN 14
#define IR_SENSOR2_PIN 27
#define IR_SENSOR3_PIN 26
#define IR_SENSOR4_PIN 32
#define IR_SENSOR5_PIN 33
#define IR_SENSOR6_PIN 25

// LED pins (pairs of red/green LEDs for each spot)
#define RED_LED1 15
#define GREEN_LED1 2
#define RED_LED2 16
#define GREEN_LED2 5
#define RED_LED3 17
#define GREEN_LED3 18
#define RED_LED4 19
#define GREEN_LED4 23
#define RED_LED5 12
#define GREEN_LED5 34
#define RED_LED6 39
#define GREEN_LED6 4

// TM1637 Display pins - changed from GPIO 0
#define CLK_PIN 21  // I2C Clock pin - new assignment
#define DIO_PIN 22  // I2C Data pin - new assignment

// Initialize objects
WebSocketsClient webSocket;
Servo barrierServo;
TM1637Display display(CLK_PIN, DIO_PIN);

// Store previous sensor states to detect changes
bool prevSensorStates[6] = {false, false, false, false, false, false};
bool spotOccupied[6] = {false, false, false, false, false, false};

// Store number of available spots
int availableSpots = 0;
int totalSpots = 6;  // Match the database count (adjust as needed)

// Reconnection variables
unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectInterval = 5000;  // 5 seconds between reconnection attempts

void setup() {
  Serial.begin(115200);
  
  // Initialize servo
  ESP32PWM::allocateTimer(0);
  barrierServo.setPeriodHertz(50);
  barrierServo.attach(SERVO_PIN, 500, 2400);
  barrierServo.write(0); // Start with barrier closed
  
  // Initialize IR sensors as inputs
  pinMode(IR_SENSOR1_PIN, INPUT);
  pinMode(IR_SENSOR2_PIN, INPUT);
  pinMode(IR_SENSOR3_PIN, INPUT);
  pinMode(IR_SENSOR4_PIN, INPUT);
  pinMode(IR_SENSOR5_PIN, INPUT);
  pinMode(IR_SENSOR6_PIN, INPUT);
  
  // Initialize LEDs as outputs
  pinMode(RED_LED1, OUTPUT);
  pinMode(GREEN_LED1, OUTPUT);
  pinMode(RED_LED2, OUTPUT);
  pinMode(GREEN_LED2, OUTPUT);
  pinMode(RED_LED3, OUTPUT);
  pinMode(GREEN_LED3, OUTPUT);
  pinMode(RED_LED4, OUTPUT);
  pinMode(GREEN_LED4, OUTPUT);
  pinMode(RED_LED5, OUTPUT);
  pinMode(GREEN_LED5, OUTPUT);
  pinMode(RED_LED6, OUTPUT);
  pinMode(GREEN_LED6, OUTPUT);
  
  // Initialize all LEDs
  for (int i = 1; i <= totalSpots; i++) {
    updateLED(i, false);  // Initially all spots vacant (green)
  }
  
  // Initialize 7-segment display
  display.setBrightness(7); // Set maximum brightness
  display.showNumberDec(totalSpots); // Initially show all spots available
  
  // Connect to WiFi
  connectToWiFi();
  
  // Configure WebSocket connection
  connectWebSocket();
  
  Serial.println("Setup complete");
}

void loop() {
  // Check WiFi connection and reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost. Reconnecting...");
    connectToWiFi();
  }
  
  // Handle WebSocket connection
  webSocket.loop();
  
  // If WebSocket is disconnected, try to reconnect
  if (!webSocket.isConnected()) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastReconnectAttempt > reconnectInterval) {
      lastReconnectAttempt = currentMillis;
      connectWebSocket();
    }
  }
  
  // Check IR sensors for spot occupancy
  checkParkingSpots();
  
  // Update display with available spots count
  display.showNumberDec(availableSpots);
  
  delay(100); // Small delay to prevent excessive processing
}

void connectToWiFi() {
  WiFi.disconnect();
  delay(1000);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi ");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed.");
  }
}

void connectWebSocket() {
  webSocket.begin(wsHost, wsPort, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  Serial.println("WebSocket client connecting...");
}

void checkParkingSpots() {
  bool currentSensorStates[6];
  
  // Read all IR sensors
  currentSensorStates[0] = digitalRead(IR_SENSOR1_PIN) == LOW; // LOW means obstacle detected
  currentSensorStates[1] = digitalRead(IR_SENSOR2_PIN) == LOW;
  currentSensorStates[2] = digitalRead(IR_SENSOR3_PIN) == LOW;
  currentSensorStates[3] = digitalRead(IR_SENSOR4_PIN) == LOW;
  currentSensorStates[4] = digitalRead(IR_SENSOR5_PIN) == LOW;
  currentSensorStates[5] = digitalRead(IR_SENSOR6_PIN) == LOW;
  
  // Check each spot for changes
  int newAvailableSpots = totalSpots;
  
  for (int i = 0; i < totalSpots; i++) {
    if (currentSensorStates[i] != prevSensorStates[i]) {
      // State has changed, update LEDs and send to server
      updateLED(i + 1, currentSensorStates[i]);
      sendSpotUpdate(i + 1, currentSensorStates[i]);
      prevSensorStates[i] = currentSensorStates[i];
      spotOccupied[i] = currentSensorStates[i];
    }
    
    // Count occupied spots
    if (spotOccupied[i]) {
      newAvailableSpots--;
    }
  }
  
  // Update available spots if changed
  if (availableSpots != newAvailableSpots) {
    availableSpots = newAvailableSpots;
    // Only update display when value changes
    display.showNumberDec(availableSpots);
  }
}

void updateLED(int spotId, bool isOccupied) {
  // Set the appropriate LEDs based on spot status
  int redPin, greenPin;
  
  switch (spotId) {
    case 1:
      redPin = RED_LED1;
      greenPin = GREEN_LED1;
      break;
    case 2:
      redPin = RED_LED2;
      greenPin = GREEN_LED2;
      break;
    case 3:
      redPin = RED_LED3;
      greenPin = GREEN_LED3;
      break;
    case 4:
      redPin = RED_LED4;
      greenPin = GREEN_LED4;
      break;
    case 5:
      redPin = RED_LED5;
      greenPin = GREEN_LED5;
      break;
    case 6:
      redPin = RED_LED6;
      greenPin = GREEN_LED6;
      break;
    default:
      return; // Invalid spot ID
  }
  
  digitalWrite(redPin, isOccupied ? HIGH : LOW);
  digitalWrite(greenPin, isOccupied ? LOW : HIGH);
}

void sendSpotUpdate(int spotId, bool isOccupied) {
  if (!webSocket.isConnected()) {
    Serial.println("WebSocket not connected. Cannot send update.");
    return;
  }
  
  StaticJsonDocument<200> jsonDoc;
  jsonDoc["type"] = "spot_update";
  jsonDoc["spotId"] = spotId;
  jsonDoc["isOccupied"] = isOccupied;
  
  String jsonString;
  serializeJson(jsonDoc, jsonString);
  
  webSocket.sendTXT(jsonString);
  Serial.println("Sent spot update: " + jsonString);
}

void requestAvailableCount() {
  if (!webSocket.isConnected()) {
    Serial.println("WebSocket not connected. Cannot request count.");
    return;
  }
  
  StaticJsonDocument<100> jsonDoc;
  jsonDoc["type"] = "request_count";
  
  String jsonString;
  serializeJson(jsonDoc, jsonString);
  
  webSocket.sendTXT(jsonString);
  Serial.println("Requested available spots count");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      break;
    
    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
      // Request initial data upon connection
      requestAvailableCount();
      break;
    
    case WStype_TEXT:
      handleWebSocketMessage(payload, length);
      break;
  }
}

void handleWebSocketMessage(uint8_t * payload, size_t length) {
  // Process messages from server
  String message = String((char*)payload);
  Serial.println("Received: " + message);
  
  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Handle different message types
  String messageType = doc["type"];
  
  if (messageType == "barrier_control") {
    String action = doc["action"];
    
    if (action == "open") {
      barrierServo.write(90); // Open barrier
      Serial.println("Barrier opened");
    } else if (action == "close") {
      barrierServo.write(0); // Close barrier
      Serial.println("Barrier closed");
    }
  }
  else if (messageType == "spot_status_change") {
    int spotId = doc["spotId"];
    String status = doc["status"];
    bool isOccupied = (status == "occupied");
    
    // Update LED for this spot
    if (spotId >= 1 && spotId <= totalSpots) {
      updateLED(spotId, isOccupied);
      spotOccupied[spotId-1] = isOccupied;
      
      // Recalculate available spots
      availableSpots = 0;
      for (int i = 0; i < totalSpots; i++) {
        if (!spotOccupied[i]) {
          availableSpots++;
        }
      }
    }
  }
  else if (messageType == "initial_data") {
    JsonArray spots = doc["spots"];
    
    // Reset available spots counter
    availableSpots = 0;
    
    // Process each spot from the server
    for (JsonObject spot : spots) {
      int spotId = spot["id"];
      String status = spot["status"];
      bool isOccupied = (status == "occupied");
      
      if (spotId >= 1 && spotId <= totalSpots) {
        updateLED(spotId, isOccupied);
        spotOccupied[spotId-1] = isOccupied;
        
        if (!isOccupied) {
          availableSpots++;
        }
      }
    }
  }
  else if (messageType == "available_count") {
    availableSpots = doc["count"];
    display.showNumberDec(availableSpots);
  }
}