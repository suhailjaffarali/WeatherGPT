import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  Easing,
  Dimensions,
  StyleSheet,
  TouchableWithoutFeedback,
  GestureResponderEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export type WeatherType = "sunny" | "rain" | "cloudy" | "storm" | "snow" | "default";

interface WeatherBackgroundProps {
  weatherState: WeatherType;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Dynamic Gradient Palettes
// ---------------------------------------------------------------------------
export const WEATHER_PALETTES: Record<WeatherType, [string, string, string]> = {
  sunny:   ["#f59e0b", "#ea580c", "#7c2d12"], // warm golden sunset/sunshine
  rain:    ["#0f172a", "#1e293b", "#0369a1"], // deep slate & rain blue
  cloudy:  ["#334155", "#475569", "#64748b"], // overcast atmospheric gray
  storm:   ["#09090b", "#18181b", "#312e81"], // dark night sky with electric violet
  snow:    ["#1e293b", "#3b82f6", "#93c5fd"], // crisp frost and icy glow
  default: ["#0a0a2e", "#1b1b4b", "#2d2d6e"], // midnight nebula
};

// ---------------------------------------------------------------------------
// 1. Rain Drops Particle Layer
// ---------------------------------------------------------------------------
const RAIN_COUNT = 24;

function RainParticles() {
  const drops = useRef(
    Array.from({ length: RAIN_COUNT }).map(() => ({
      anim: new Animated.Value(-50),
      x: Math.random() * SCREEN_WIDTH,
      speed: 700 + Math.random() * 500,
      delay: Math.random() * 1200,
      opacity: 0.3 + Math.random() * 0.5,
      length: 18 + Math.random() * 22,
    }))
  ).current;

  useEffect(() => {
    drops.forEach((drop) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(drop.delay),
          Animated.timing(drop.anim, {
            toValue: SCREEN_HEIGHT + 60,
            duration: drop.speed,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    });
  }, [drops]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {drops.map((drop, idx) => (
        <Animated.View
          key={idx}
          style={{
            position: "absolute",
            left: drop.x,
            width: 2,
            height: drop.length,
            backgroundColor: "rgba(186, 230, 253, 0.75)",
            borderRadius: 1,
            opacity: drop.opacity,
            transform: [
              { translateY: drop.anim },
              { rotate: "12deg" }, // Wind slant
            ],
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. Snowflakes Layer
// ---------------------------------------------------------------------------
const SNOW_COUNT = 20;

function SnowParticles() {
  const flakes = useRef(
    Array.from({ length: SNOW_COUNT }).map(() => ({
      fallAnim: new Animated.Value(-20),
      swayAnim: new Animated.Value(0),
      x: Math.random() * SCREEN_WIDTH,
      size: 4 + Math.random() * 6,
      fallSpeed: 3000 + Math.random() * 2500,
      swaySpeed: 1500 + Math.random() * 1000,
      delay: Math.random() * 2000,
      opacity: 0.4 + Math.random() * 0.5,
    }))
  ).current;

  useEffect(() => {
    flakes.forEach((flake) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(flake.delay),
          Animated.timing(flake.fallAnim, {
            toValue: SCREEN_HEIGHT + 30,
            duration: flake.fallSpeed,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(flake.swayAnim, {
            toValue: 20,
            duration: flake.swaySpeed,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(flake.swayAnim, {
            toValue: -20,
            duration: flake.swaySpeed,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [flakes]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flakes.map((f, idx) => (
        <Animated.View
          key={idx}
          style={{
            position: "absolute",
            left: f.x,
            width: f.size,
            height: f.size,
            borderRadius: f.size / 2,
            backgroundColor: "#ffffff",
            opacity: f.opacity,
            transform: [
              { translateY: f.fallAnim },
              { translateX: f.swayAnim },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 3. Sunny Corona & Sunbeam Aura
// ---------------------------------------------------------------------------
function SunnyRays() {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 35000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [rotateAnim, pulseAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Radiant Sun Orb at top right */}
      <Animated.View
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: "rgba(254, 215, 170, 0.28)",
          transform: [{ scale: pulseAnim }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: "rgba(253, 186, 116, 0.35)",
          transform: [{ rotate: spin }],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 15,
          right: 15,
          width: 130,
          height: 130,
          borderRadius: 65,
          backgroundColor: "rgba(254, 240, 138, 0.55)",
          shadowColor: "#f59e0b",
          shadowOpacity: 0.9,
          shadowRadius: 30,
          elevation: 10,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// 4. Storm Lightning Flash
// ---------------------------------------------------------------------------
function StormLightning() {
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timeout: any;

    const triggerFlash = () => {
      // Lightning flicker sequence
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.85, duration: 60, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.1, duration: 70, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        // Next random lightning flash between 4 and 10 seconds
        timeout = setTimeout(triggerFlash, 4000 + Math.random() * 6000);
      });
    };

    timeout = setTimeout(triggerFlash, 3000);
    return () => clearTimeout(timeout);
  }, [flashAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <RainParticles />
      {/* Screen flash on thunder strike */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "rgba(224, 231, 255, 0.85)",
            opacity: flashAnim,
          },
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5. Drifting Clouds / Fog Mist
// ---------------------------------------------------------------------------
function CloudyMist() {
  const drift1 = useRef(new Animated.Value(-100)).current;
  const drift2 = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(drift1, {
          toValue: SCREEN_WIDTH + 60,
          duration: 30000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(drift1, {
          toValue: -200,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(drift2, {
          toValue: -220,
          duration: 38000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(drift2, {
          toValue: SCREEN_WIDTH + 100,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [drift1, drift2]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Cloud Blob 1 */}
      <Animated.View
        style={{
          position: "absolute",
          top: 110,
          width: 260,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(203, 213, 225, 0.16)",
          transform: [{ translateX: drift1 }],
        }}
      />
      {/* Cloud Blob 2 */}
      <Animated.View
        style={{
          position: "absolute",
          top: 240,
          width: 320,
          height: 150,
          borderRadius: 75,
          backgroundColor: "rgba(148, 163, 184, 0.18)",
          transform: [{ translateX: drift2 }],
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// 6. Fluid Interactive Orbs (Ambient for all weathers)
// ---------------------------------------------------------------------------
function AmbientOrbs({ weatherState }: { weatherState: WeatherType }) {
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 25,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: -25,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, {
          toValue: -30,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim2, {
          toValue: 20,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim1, floatAnim2]);

  const orbColor1 =
    weatherState === "sunny"
      ? "rgba(245, 158, 11, 0.22)"
      : weatherState === "rain" || weatherState === "storm"
      ? "rgba(56, 189, 248, 0.14)"
      : "rgba(99, 102, 241, 0.18)";

  const orbColor2 =
    weatherState === "sunny"
      ? "rgba(234, 88, 12, 0.2)"
      : weatherState === "rain" || weatherState === "storm"
      ? "rgba(99, 102, 241, 0.16)"
      : "rgba(168, 85, 247, 0.18)";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={{
          position: "absolute",
          top: SCREEN_HEIGHT * 0.15,
          left: -40,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: orbColor1,
          transform: [{ translateY: floatAnim1 }, { scale: 1.1 }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          bottom: SCREEN_HEIGHT * 0.2,
          right: -50,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: orbColor2,
          transform: [{ translateY: floatAnim2 }, { scale: 1.15 }],
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// WeatherBackground Component
// ---------------------------------------------------------------------------
export default function WeatherBackground({
  weatherState,
  children,
}: WeatherBackgroundProps) {
  // Touch Ripple Animation
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const ripplePos = useRef({ x: 0, y: 0 });

  const handleTouch = (evt: GestureResponderEvent) => {
    const { pageX, pageY } = evt.nativeEvent;
    ripplePos.current = { x: pageX, y: pageY };

    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 3.5],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.2, 0],
  });

  const gradientColors = WEATHER_PALETTES[weatherState] || WEATHER_PALETTES.default;

  return (
    <TouchableWithoutFeedback onPress={handleTouch}>
      <View style={styles.container}>
        {/* Dynamic Gradient Background */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Ambient Floating Orbs */}
        <AmbientOrbs weatherState={weatherState} />

        {/* Weather-Specific Dynamic FX */}
        {weatherState === "sunny" && <SunnyRays />}
        {weatherState === "rain" && <RainParticles />}
        {weatherState === "storm" && <StormLightning />}
        {weatherState === "snow" && <SnowParticles />}
        {weatherState === "cloudy" && <CloudyMist />}

        {/* Interactive Touch Ripple */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: ripplePos.current.x - 40,
            top: ripplePos.current.y - 40,
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "rgba(255, 255, 255, 0.3)",
            opacity: rippleOpacity,
            transform: [{ scale: rippleScale }],
          }}
        />

        {/* Foreground Content */}
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

