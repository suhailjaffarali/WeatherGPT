import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WeatherState = "sunny" | "rain" | "cloudy" | "storm" | "snow" | "default";

interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  has_extreme_alert: boolean;
}

// ---------------------------------------------------------------------------
// Theme map — gradient pairs keyed by weather state
// ---------------------------------------------------------------------------

const GRADIENTS: Record<WeatherState, [string, string, string]> = {
  sunny:   ["#f6d365", "#fda085", "#ff7e5f"],
  rain:    ["#0f2027", "#203a43", "#2c5364"],
  cloudy:  ["#3e5151", "#536976", "#bbd2c5"],
  storm:   ["#0f0c29", "#302b63", "#24243e"],
  snow:    ["#e6dada", "#a8c0d6", "#274060"],
  default: ["#0a0a2e", "#1b1b4b", "#2d2d6e"],
};

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function SkeletonPulse({ style }: { style?: ViewStyle }) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
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
          backgroundColor: "rgba(255,255,255,0.15)",
          borderRadius: 12,
          opacity,
        },
        style,
      ]}
    />
  );
}

function SkeletonLoader() {
  return (
    <BlurView
      intensity={40}
      tint="dark"
      style={{
        borderRadius: 24,
        overflow: "hidden",
        padding: 28,
        width: "100%",
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
          padding: 28,
        }}
      >
        <SkeletonPulse style={{ width: 120, height: 18, marginBottom: 20 }} />
        <SkeletonPulse style={{ width: 180, height: 56, marginBottom: 24 }} />
        <SkeletonPulse style={{ width: "80%" as any, height: 16, marginBottom: 12 }} />
        <SkeletonPulse style={{ width: "60%" as any, height: 16 }} />
      </View>
    </BlurView>
  );
}

// ---------------------------------------------------------------------------
// Weather Card — Glassmorphism
// ---------------------------------------------------------------------------

function WeatherCard({ data }: { data: WeatherData }) {
  return (
    <BlurView
      intensity={50}
      tint="dark"
      style={{
        borderRadius: 24,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          padding: 28,
        }}
      >
        {/* Alert banner */}
        {data.has_extreme_alert && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(255,59,48,0.25)",
              borderRadius: 12,
              padding: 10,
              marginBottom: 18,
            }}
          >
            <Ionicons name="warning" size={18} color="#ff6b6b" />
            <Text style={{ color: "#ff6b6b", fontSize: 13, marginLeft: 8, fontWeight: "600" }}>
              Extreme weather alert active
            </Text>
          </View>
        )}

        {/* Temperature */}
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "500" }}>
          Current Temperature
        </Text>
        <Text
          style={{
            color: "#ffffff",
            fontSize: 64,
            fontWeight: "800",
            letterSpacing: -2,
            marginVertical: 4,
          }}
        >
          {Math.round(data.temperature)}°
        </Text>

        {/* Description */}
        <Text
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 20,
            fontWeight: "600",
            textTransform: "capitalize",
            marginBottom: 20,
          }}
        >
          {data.description}
        </Text>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: "rgba(255,255,255,0.12)",
            marginBottom: 18,
          }}
        />

        {/* Stats row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <StatItem icon="water" label="Humidity" value={`${data.humidity}%`} />
          <StatItem
            icon="thermometer"
            label="Feels Like"
            value={`${Math.round(data.temperature)}°`}
          />
          <StatItem
            icon={data.has_extreme_alert ? "alert-circle" : "checkmark-circle"}
            label="Status"
            value={data.has_extreme_alert ? "Alert" : "Safe"}
          />
        </View>
      </View>
    </BlurView>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Ionicons name={icon} size={20} color="rgba(255,255,255,0.5)" />
      <Text
        style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: 11,
          marginTop: 6,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
      <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700", marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mic FAB
// ---------------------------------------------------------------------------

function MicButton({ onPress }: { onPress: () => void }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 48,
        alignSelf: "center",
        transform: [{ scale }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient
          colors={["#6366f1", "#8b5cf6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#6366f1",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.45,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          <Ionicons name="mic" size={36} color="#ffffff" />
        </LinearGradient>
      </Pressable>
      <Text
        style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: 12,
          textAlign: "center",
          marginTop: 8,
          fontWeight: "500",
        }}
      >
        Tap to speak
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function MainScreen() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [weatherState, setWeatherState] = useState<WeatherState>("default");
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  // Simulate initial fetch — replace with real API call
  useEffect(() => {
    const timer = setTimeout(() => {
      setWeatherData({
        temperature: 32,
        description: "partly cloudy",
        humidity: 68,
        has_extreme_alert: false,
      });
      setWeatherState("sunny");
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const gradientColors = GRADIENTS[weatherState] ?? GRADIENTS.default;

  const handleMicPress = () => {
    // TODO: Wire to speech-to-text → backend
    console.log("Mic pressed");
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          minHeight: SCREEN_HEIGHT,
          paddingHorizontal: 24,
          paddingTop: 72,
        }}
      >
        {/* Header */}
        <Text
          style={{
            color: "#ffffff",
            fontSize: 28,
            fontWeight: "800",
            letterSpacing: -0.5,
          }}
        >
          WeatherGPT
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 14,
            fontWeight: "500",
            marginTop: 4,
            marginBottom: 32,
          }}
        >
          AI-powered agricultural weather insights
        </Text>

        {/* Card area */}
        {isLoading ? <SkeletonLoader /> : weatherData && <WeatherCard data={weatherData} />}

        {/* Mic FAB */}
        <MicButton onPress={handleMicPress} />
      </LinearGradient>
    </View>
  );
}

