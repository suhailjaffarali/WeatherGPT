import { Platform } from "react-native";
import Constants from "expo-constants";

export const getApiBaseUrl = (): string => {
  if (!__DEV__) {
    return "https://your-production-url.com";
  }

  // 1. Web browser: always connect directly to localhost backend
  if (Platform.OS === "web") {
    return "http://localhost:8000";
  }

  // 2. Physical device or emulator connected via Expo Go
  const debuggerHost =
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const ip = debuggerHost.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:8000`;
    }
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:8000`;
    }
  }

  // 3. Fallback to PC's active LAN Wi-Fi IP (10.113.207.199)
  // This allows real Android & iOS phones on the same Wi-Fi to reach the backend
  return "http://10.113.207.199:8000";
};

export const API_BASE_URL = getApiBaseUrl();
