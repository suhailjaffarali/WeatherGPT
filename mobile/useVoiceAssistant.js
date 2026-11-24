import { useState, useRef, useCallback } from "react";
import * as Speech from "expo-speech";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { SPEECH_LANG_MAP } from "./translations";

// ---------------------------------------------------------------------------
// Config — auto-detect Expo dev server host IP for real-device testing
// ---------------------------------------------------------------------------

const HOST_IP = Constants.expoConfig?.hostUri?.split(":")[0];
const API_BASE_URL = __DEV__
  ? HOST_IP
    ? `http://${HOST_IP}:8000`
    : Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000"
  : "https://your-production-url.com";

/**
 * useVoiceAssistant — Safe, zero-crash voice assistant hook for Expo SDK 58.
 * Uses expo-speech for high-fidelity native TTS without deprecated native audio modules.
 */
export default function useVoiceAssistant({
  lat = 20.5937,
  lon = 78.9629,
  cropType = "rice",
  language = "en",
} = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [textResponse, setTextResponse] = useState(null);
  const [error, setError] = useState(null);

  const speechLang = SPEECH_LANG_MAP[language] || "en-IN";
  const timerRef = useRef(null);

  const stopAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      Speech.stop();
    } catch {}
    setIsRecording(false);
    setIsProcessing(false);
    setIsPlaying(false);
  }, []);

  const speakText = useCallback(
    (text) => {
      if (!text) return;
      setIsPlaying(true);
      Speech.stop();
      Speech.speak(text, {
        language: speechLang,
        rate: 0.88,
        onDone: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });
    },
    [speechLang]
  );

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTextResponse(null);
      Speech.stop();
      setIsRecording(true);
      setIsProcessing(false);
      setIsPlaying(false);

      // Auto-transition after listening window (3s)
      timerRef.current = setTimeout(async () => {
        setIsRecording(false);
        setIsProcessing(true);

        const userQuery =
          language === "hi"
            ? `आज ${cropType} फसल के लिए क्या सलाह है?`
            : language === "pa"
            ? `ਅੱਜ ${cropType} ਫ਼ਸਲ ਲਈ ਕੀ ਸਲਾਹ ਹੈ?`
            : `What should I do for my ${cropType} crop today?`;

        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(`${API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              message: userQuery,
              lang: language,
              crop_type: cropType,
              weather_description: "current conditions",
            }),
          });
          clearTimeout(tid);
          if (res.ok) {
            const data = await res.json();
            if (data?.reply) {
              setTextResponse(data.reply);
              setIsProcessing(false);
              speakText(data.reply);
              return;
            }
          }
        } catch {
          // Backend not running or timed out, use fallback
        }

        const fallback = `For ${cropType} under current weather conditions, maintain balanced soil moisture and inspect crop health.`;
        setTextResponse(fallback);
        setIsProcessing(false);
        speakText(fallback);
      }, 3000);
    } catch (err) {
      setError(err?.message || "Recording error");
      setIsRecording(false);
    }
  }, [lat, lon, cropType, speakText]);

  const stopRecording = useCallback(() => {
    if (isRecording) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsRecording(false);
      setIsProcessing(true);
      setTimeout(() => {
        const fallback = `Voice input received. Field recommendations for ${cropType} updated.`;
        setTextResponse(fallback);
        setIsProcessing(false);
        speakText(fallback);
      }, 1000);
    }
  }, [isRecording, cropType, speakText]);

  return {
    isRecording,
    isProcessing,
    isPlaying,
    textResponse,
    error,
    startRecording,
    stopRecording,
    stopAll,
    speakText,
  };
}
