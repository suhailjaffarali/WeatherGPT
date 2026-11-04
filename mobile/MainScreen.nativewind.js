import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  StatusBar,
  SafeAreaView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "nativewind";

// ── NativeWind wrappers ─────────────────────────────────────────────────────

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);
const StyledSafeAreaView = styled(SafeAreaView);

// ── Weather background palette ─────────────────────────────────────────────

const WEATHER_GRADIENTS = {
  sunny: ["#f59e0b", "#f97316", "#ef4444"],
  clear: ["#3b82f6", "#60a5fa", "#93c5fd"],
  rain: ["#374151", "#4b5563", "#1e3a5f"],
  storm: ["#1f2937", "#111827", "#0c0a09"],
  snow: ["#e0e7ff", "#c7d2fe", "#a5b4fc"],
  cloudy: ["#6b7280", "#9ca3af", "#d1d5db"],
  haze: ["#78716c", "#a8a29e", "#d6d3d1"],
  default: ["#1e293b", "#334155", "#475569"],
};

function getGradient(weatherState) {
  const key = (weatherState || "default").toLowerCase();
  return WEATHER_GRADIENTS[key] || WEATHER_GRADIENTS.default;
}

// ── Skeleton Loader ─────────────────────────────────────────────────────────

function SkeletonPulse({ width, height, borderRadius = 8, style }) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: "rgba(255,255,255,0.15)",
          opacity,
        },
        style,
      ]}
    />
  );
}

function SkeletonCard() {
  return (
    <StyledView className="mx-6 rounded-3xl overflow-hidden">
      <BlurView intensity={40} tint="dark" style={{ padding: 28 }}>
        <SkeletonPulse width={140} height={20} style={{ marginBottom: 16 }} />
        <SkeletonPulse width={100} height={56} borderRadius={12} style={{ marginBottom: 20 }} />
        <SkeletonPulse width="100%" height={16} style={{ marginBottom: 10 }} />
        <SkeletonPulse width="80%" height={16} style={{ marginBottom: 10 }} />
        <StyledView className="flex-row justify-between mt-4">
          <SkeletonPulse width="45%" height={60} borderRadius={16} />
          <SkeletonPulse width="45%" height={60} borderRadius={16} />
        </StyledView>
      </BlurView>
    </StyledView>
  );
}

// ── Glassmorphism Weather Card ──────────────────────────────────────────────

function WeatherCard({ data }) {
  const { temperature_c, description, humidity, has_extreme_alert, alerts } = data;

  return (
    <StyledView className="mx-6 rounded-3xl overflow-hidden shadow-2xl">
      <BlurView
        intensity={50}
        tint="dark"
        style={{
          padding: 28,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          borderRadius: 24,
        }}
      >
        {/* Location / header */}
        <StyledText className="text-white/70 text-sm font-medium tracking-widest uppercase mb-1">
          Current Weather
        </StyledText>

        {/* Temperature */}
        <StyledView className="flex-row items-end mb-3">
          <StyledText className="text-white text-6xl font-extralight">
            {Math.round(temperature_c)}
          </StyledText>
          <StyledText className="text-white/60 text-2xl font-light mb-2 ml-1">
            °C
          </StyledText>
        </StyledView>

        {/* Description */}
        <StyledText className="text-white text-lg font-medium capitalize mb-5">
          {description}
        </StyledText>

        {/* Stats row */}
        <StyledView className="flex-row justify-between">
          <StyledView className="bg-white/10 rounded-2xl px-5 py-3 flex-1 mr-3 items-center">
            <Ionicons name="water-outline" size={20} color="rgba(255,255,255,0.7)" />
            <StyledText className="text-white text-xl font-semibold mt-1">
              {humidity}%
            </StyledText>
            <StyledText className="text-white/50 text-xs mt-0.5">Humidity</StyledText>
          </StyledView>

          <StyledView
            className={`rounded-2xl px-5 py-3 flex-1 items-center ${
              has_extreme_alert ? "bg-red-500/30" : "bg-white/10"
            }`}
          >
            <Ionicons
              name={has_extreme_alert ? "warning" : "shield-checkmark-outline"}
              size={20}
              color={has_extreme_alert ? "#fca5a5" : "rgba(255,255,255,0.7)"}
            />
            <StyledText
              className={`text-xl font-semibold mt-1 ${
                has_extreme_alert ? "text-red-300" : "text-white"
              }`}
            >
              {has_extreme_alert ? "Alert" : "Safe"}
            </StyledText>
            <StyledText className="text-white/50 text-xs mt-0.5">Status</StyledText>
          </StyledView>
        </StyledView>

        {/* Alert banner */}
        {has_extreme_alert && alerts?.length > 0 && (
          <StyledView className="bg-red-500/20 rounded-xl mt-4 px-4 py-3 border border-red-400/30">
            <StyledText className="text-red-200 text-xs font-bold uppercase tracking-wider mb-1">
              ⚠ Active Alert
            </StyledText>
            <StyledText className="text-red-100 text-sm">
              {alerts[0].event}
            </StyledText>
          </StyledView>
        )}
      </BlurView>
    </StyledView>
  );
}

// ── Mic Button ──────────────────────────────────────────────────────────────

function MicButton({ onPress, isListening }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
    scale.setValue(1);
  }, [isListening, scale]);

  return (
    <StyledView className="absolute bottom-10 self-center items-center">
      {/* Outer glow ring */}
      <Animated.View
        style={{
          transform: [{ scale }],
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: isListening
            ? "rgba(239,68,68,0.25)"
            : "rgba(255,255,255,0.08)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StyledPressable
          onPress={onPress}
          className="w-20 h-20 rounded-full items-center justify-center shadow-lg"
          style={{
            backgroundColor: isListening
              ? "rgba(239,68,68,0.9)"
              : "rgba(255,255,255,0.15)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.25)",
          }}
        >
          <Ionicons
            name={isListening ? "mic" : "mic-outline"}
            size={36}
            color="#ffffff"
          />
        </StyledPressable>
      </Animated.View>
      <StyledText className="text-white/40 text-xs mt-2 tracking-wider">
        {isListening ? "Listening…" : "Tap to speak"}
      </StyledText>
    </StyledView>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

const PLACEHOLDER_DATA = {
  temperature_c: 0,
  description: "",
  humidity: 0,
  has_extreme_alert: false,
  alerts: [],
};

export default function MainScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [weatherState, setWeatherState] = useState("default");
  const [weatherData, setWeatherData] = useState(PLACEHOLDER_DATA);

  // Simulated fetch — replace with real API call
  useEffect(() => {
    const timer = setTimeout(() => {
      setWeatherData({
        temperature_c: 34,
        description: "partly cloudy",
        humidity: 62,
        has_extreme_alert: false,
        alerts: [],
      });
      setWeatherState("sunny");
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleMicPress = useCallback(() => {
    setIsListening((prev) => !prev);
  }, []);

  const gradientColors = getGradient(weatherState);

  return (
    <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <StyledSafeAreaView className="flex-1">
        {/* Header */}
        <StyledView className="px-6 pt-4 pb-6">
          <StyledText className="text-white/50 text-xs font-medium tracking-widest uppercase">
            WeatherGPT
          </StyledText>
          <StyledText className="text-white text-2xl font-bold mt-1">
            Farm Advisory
          </StyledText>
        </StyledView>

        {/* Content */}
        <StyledView className="flex-1 justify-center pb-32">
          {isLoading ? <SkeletonCard /> : <WeatherCard data={weatherData} />}
        </StyledView>

        {/* Floating mic */}
        <MicButton onPress={handleMicPress} isListening={isListening} />
      </StyledSafeAreaView>
    </LinearGradient>
  );
}

