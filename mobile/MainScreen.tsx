import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import KisanPortal from "./KisanPortal";
import WeatherBackground, { type WeatherType } from "./WeatherBackground";
import SettingsModal, { type AppSettings, LANGUAGES } from "./SettingsModal";
import ChatbotScreen from "./ChatbotScreen";
import VoiceAssistantModal from "./VoiceAssistantModal";
import LocationSearchModal, { type SelectedLocation } from "./LocationSearchModal";
import {
  getTranslation,
  TranslationStrings,
  getWeatherDescription,
  getWeatherName,
} from "./translations";

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

type TabMode = "standard" | "kisan" | "chat";

interface WeatherData {
  temperature: number;
  feelsLike?: number;
  description: string;
  humidity: number;
  has_extreme_alert: boolean;
  city?: string;
}

interface DailyWeatherItem {
  date: string;
  weatherType: WeatherType;
  tempMax: number;
  tempMin: number;
  precipitation: number;
}

function mapWmoToWeatherType(code: number): WeatherType {
  if (code === 95 || code === 96 || code === 99) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 2 || code === 3 || code === 45 || code === 48) return "cloudy";
  return "sunny";
}

function weatherEmojiForType(type: WeatherType): string {
  switch (type) {
    case "rain":
      return "🌧️";
    case "storm":
      return "⛈️";
    case "cloudy":
      return "⛅";
    case "snow":
      return "❄️";
    default:
      return "☀️";
  }
}

interface SoilData {
  soil_moisture_shallow: number;
  soil_moisture_root: number;
  evapotranspiration: number;
  vapour_pressure_deficit: number;
}

// ---------------------------------------------------------------------------
// Top Tab Bar Navigation
// ---------------------------------------------------------------------------

function MainTabBar({
  activeTab,
  onChange,
  t,
}: {
  activeTab: TabMode;
  onChange: (t: TabMode) => void;
  t: TranslationStrings;
}) {
  const tabs: { key: TabMode; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: "standard", icon: "cloud", label: t.tabWeather },
    { key: "kisan", icon: "leaf", label: t.tabKisan },
    { key: "chat", icon: "chatbubble-ellipses", label: t.tabChat },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map(({ key, icon, label }) => {
        const isActive = key === activeTab;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
          >
            <Ionicons
              name={icon}
              size={15}
              color={isActive ? "#c7d2fe" : "rgba(255,255,255,0.45)"}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Weather Demo Quick-Switch Bar
// ---------------------------------------------------------------------------

function WeatherModeBar({
  current,
  onSelect,
  label,
  language,
}: {
  current: WeatherType;
  onSelect: (m: WeatherType) => void;
  label: string;
  language: string;
}) {
  const modes: { key: WeatherType; emoji: string }[] = [
    { key: "sunny", emoji: "☀️" },
    { key: "rain", emoji: "🌧️" },
    { key: "storm", emoji: "⛈️" },
    { key: "cloudy", emoji: "⛅" },
    { key: "snow", emoji: "❄️" },
  ];

  return (
    <View style={styles.weatherModeBar}>
      <Text style={styles.weatherModeTitle}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.weatherModeRow}>
          {modes.map((m) => {
            const isSel = m.key === current;
            const localizedName = getWeatherName(m.key, language);
            return (
              <Pressable
                key={m.key}
                onPress={() => onSelect(m.key)}
                style={[
                  styles.weatherModePill,
                  isSel && styles.weatherModePillActive,
                ]}
              >
                <Text style={styles.weatherEmoji}>{m.emoji}</Text>
                <Text
                  style={[
                    styles.weatherModeText,
                    isSel && styles.weatherModeTextActive,
                  ]}
                >
                  {localizedName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

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
    <BlurView intensity={40} tint="dark" style={styles.skeletonContainer}>
      <View style={styles.skeletonInner}>
        <SkeletonPulse style={{ width: 120, height: 18, marginBottom: 20 }} />
        <SkeletonPulse style={{ width: 180, height: 56, marginBottom: 24 }} />
        <SkeletonPulse style={{ width: "80%" as any, height: 16, marginBottom: 12 }} />
        <SkeletonPulse style={{ width: "60%" as any, height: 16 }} />
      </View>
    </BlurView>
  );
}

// ---------------------------------------------------------------------------
// Weather Card (Glassmorphism)
// ---------------------------------------------------------------------------

function WeatherCard({
  data,
  soil,
  unit,
  t,
}: {
  data: WeatherData;
  soil?: SoilData | null;
  unit: "metric" | "imperial";
  t: TranslationStrings;
}) {
  const tempDisplay =
    unit === "imperial"
      ? Math.round((data.temperature * 9) / 5 + 32)
      : Math.round(data.temperature);
  const rawFeelsLike = data.feelsLike ?? data.temperature;
  const feelsLikeDisplay =
    unit === "imperial"
      ? Math.round((rawFeelsLike * 9) / 5 + 32)
      : Math.round(rawFeelsLike);
  const unitSymbol = unit === "imperial" ? "°F" : "°C";
  const soilPct = soil ? `${Math.round(soil.soil_moisture_root * 100)}%` : "--";

  return (
    <BlurView intensity={50} tint="dark" style={styles.weatherCard}>
      <View style={styles.weatherCardInner}>
        {/* Alert Banner */}
        {data.has_extreme_alert && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={18} color="#ff6b6b" />
            <Text style={styles.alertText}>{t.alertBanner}</Text>
          </View>
        )}

        <View style={styles.tempHeader}>
          <Text style={styles.tempSubtitle}>{t.currentConditions}</Text>
          <View style={styles.liveBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.liveText}>{t.live}</Text>
          </View>
        </View>

        <View style={styles.tempRow}>
          <Text style={styles.tempValue}>{tempDisplay}</Text>
          <Text style={styles.tempUnit}>{unitSymbol}</Text>
        </View>

        <Text style={styles.weatherDesc}>{data.description}</Text>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <StatItem icon="water" label={t.humidity} value={`${data.humidity}%`} />
          <StatItem
            icon="thermometer"
            label={t.feelsLike}
            value={`${feelsLikeDisplay}${unitSymbol}`}
          />
          <StatItem
            icon="leaf"
            label={t.soilMoistureLabel}
            value={soilPct}
          />
          <StatItem
            icon={data.has_extreme_alert ? "alert-circle" : "checkmark-circle"}
            label={t.safety}
            value={data.has_extreme_alert ? t.statusAlert : t.statusSafe}
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
    <View style={styles.statItem}>
      <Ionicons name={icon} size={20} color="rgba(255,255,255,0.6)" />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Past & Future Weather Forecast Section
// ---------------------------------------------------------------------------

function formatDayLabel(
  isoDate: string,
  offsetFromToday: number,
  t: TranslationStrings
): string {
  if (offsetFromToday === 0) return t.todayLabel;
  if (offsetFromToday === -1) return t.yesterdayLabel;
  if (offsetFromToday === 1) return t.tomorrowLabel;
  try {
    const parsed = new Date(`${isoDate}T12:00:00`);
    return parsed.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function ForecastSection({
  pastDays,
  futureDays,
  unit,
  language,
  t,
}: {
  pastDays: DailyWeatherItem[];
  futureDays: DailyWeatherItem[];
  unit: "metric" | "imperial";
  language: string;
  t: TranslationStrings;
}) {
  const [mode, setMode] = useState<"future" | "past">("future");
  const items = mode === "future" ? futureDays : [...pastDays].reverse();
  const formatTemp = (c: number) =>
    unit === "imperial" ? `${Math.round((c * 9) / 5 + 32)}°` : `${Math.round(c)}°`;

  if (pastDays.length === 0 && futureDays.length === 0) return null;

  return (
    <BlurView intensity={45} tint="dark" style={styles.forecastCard}>
      <View style={styles.forecastInner}>
        <View style={styles.forecastToggleRow}>
          <Pressable
            onPress={() => setMode("future")}
            style={[
              styles.forecastTab,
              mode === "future" && styles.forecastTabActive,
            ]}
          >
            <Text
              style={[
                styles.forecastTabText,
                mode === "future" && styles.forecastTabTextActive,
              ]}
            >
              {t.futureForecast}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("past")}
            style={[
              styles.forecastTab,
              mode === "past" && styles.forecastTabActive,
            ]}
          >
            <Text
              style={[
                styles.forecastTabText,
                mode === "past" && styles.forecastTabTextActive,
              ]}
            >
              {t.pastWeather}
            </Text>
          </Pressable>
        </View>

        {items.map((item, idx) => {
          const offset = mode === "future" ? idx : -(idx + 1);
          const dayLabel = formatDayLabel(item.date, offset, t);
          const condName = getWeatherName(item.weatherType, language);
          return (
            <View
              key={item.date}
              style={[
                styles.forecastRow,
                idx === items.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.forecastDay} numberOfLines={1}>
                {dayLabel}
              </Text>
              <View style={styles.forecastCondBox}>
                <Text style={styles.forecastEmoji}>
                  {weatherEmojiForType(item.weatherType)}
                </Text>
                <Text style={styles.forecastCondText} numberOfLines={1}>
                  {condName}
                </Text>
              </View>
              <Text style={styles.forecastPrecip}>
                {item.precipitation > 0 ? `${item.precipitation.toFixed(1)}mm` : ""}
              </Text>
              <Text style={styles.forecastTemps}>
                {formatTemp(item.tempMin)} / {formatTemp(item.tempMax)}
              </Text>
            </View>
          );
        })}
      </View>
    </BlurView>
  );
}

// ---------------------------------------------------------------------------
// Floating Mic FAB
// ---------------------------------------------------------------------------

function MicButton({
  onPress,
  label,
}: {
  onPress: () => void;
  label: string;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start();

  return (
    <Animated.View style={[styles.micContainer, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.micCircle}
      >
        <Ionicons name="mic" size={34} color="#ffffff" />
      </Pressable>
      <Text style={styles.micLabel}>{label}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen Root
// ---------------------------------------------------------------------------

export default function MainScreen() {
  const [activeTab, setActiveTab] = useState<TabMode>("standard");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [weatherState, setWeatherState] = useState<WeatherType>("sunny");
  const [manualWeatherMode, setManualWeatherMode] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation>({
    name: "Nagpur, Maharashtra",
    lat: 21.1458,
    lon: 79.0882,
    isGps: false,
  });
  const [isTracingGps, setIsTracingGps] = useState<boolean>(false);
  const [locationModalVisible, setLocationModalVisible] = useState<boolean>(false);
  const [liveWeather, setLiveWeather] = useState<{
    temperature: number;
    feelsLike: number;
    humidity: number;
    weatherType: WeatherType;
  } | null>(null);
  const [pastDays, setPastDays] = useState<DailyWeatherItem[]>([]);
  const [futureDays, setFutureDays] = useState<DailyWeatherItem[]>([]);
  const [liveSoilData, setLiveSoilData] = useState<SoilData | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  // App Settings State (Language, Voice, Units, etc.)
  const [settings, setSettings] = useState<AppSettings>({
    language: "en",
    voiceEnabled: true,
    speechRate: "normal",
    unit: "metric",
    lowBandwidthMode: false,
    imdAlertNotifications: true,
  });

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const t = getTranslation(settings.language);

  // Dynamic Weather Data based on live Open-Meteo or manual FX preview
  const currentWeatherDesc = getWeatherDescription(weatherState, settings.language);
  const tempForWeather =
    !manualWeatherMode && liveWeather
      ? liveWeather.temperature
      : weatherState === "snow"
      ? 3
      : weatherState === "storm"
      ? 22
      : weatherState === "rain"
      ? 24
      : weatherState === "cloudy"
      ? 28
      : 33;
  const feelsLikeForWeather =
    !manualWeatherMode && liveWeather ? liveWeather.feelsLike : tempForWeather;
  const humidityForWeather =
    !manualWeatherMode && liveWeather
      ? liveWeather.humidity
      : weatherState === "rain" || weatherState === "storm"
      ? 88
      : weatherState === "cloudy"
      ? 70
      : weatherState === "snow"
      ? 82
      : 55;

  const activeWeatherData: WeatherData = {
    temperature: tempForWeather,
    feelsLike: feelsLikeForWeather,
    description: currentWeatherDesc,
    humidity: humidityForWeather,
    has_extreme_alert: weatherState === "storm",
    city: selectedLocation.name || t.defaultLocation,
  };

  const FALLBACK_SOIL: SoilData = {
    soil_moisture_shallow: 0.28,
    soil_moisture_root: 0.22,
    evapotranspiration: 0.3,
    vapour_pressure_deficit: 1.2,
  };

  const activeSoilData: SoilData = !manualWeatherMode
    ? liveSoilData || FALLBACK_SOIL
    : weatherState === "rain"
    ? { soil_moisture_shallow: 0.48, soil_moisture_root: 0.42, evapotranspiration: 0.05, vapour_pressure_deficit: 0.3 }
    : weatherState === "storm"
    ? { soil_moisture_shallow: 0.5, soil_moisture_root: 0.45, evapotranspiration: 0.02, vapour_pressure_deficit: 0.2 }
    : weatherState === "sunny"
    ? { soil_moisture_shallow: 0.1, soil_moisture_root: 0.13, evapotranspiration: 0.65, vapour_pressure_deficit: 2.4 }
    : weatherState === "cloudy"
    ? { soil_moisture_shallow: 0.22, soil_moisture_root: 0.24, evapotranspiration: 0.25, vapour_pressure_deficit: 1.1 }
    : weatherState === "snow"
    ? { soil_moisture_shallow: 0.38, soil_moisture_root: 0.38, evapotranspiration: 0.04, vapour_pressure_deficit: 0.4 }
    : liveSoilData || FALLBACK_SOIL;

  // Trace user's current GPS location via expo-location
  const traceGpsLocation = async () => {
    setIsTracingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setIsTracingGps(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      let placeName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo && geo.length > 0) {
          const g = geo[0];
          const parts = [g.city || g.subregion || g.district, g.region || g.country].filter(Boolean);
          if (parts.length > 0) placeName = parts.slice(0, 2).join(", ");
        }
      } catch {}

      setManualWeatherMode(false);
      setSelectedLocation({
        name: placeName,
        lat: latitude,
        lon: longitude,
        isGps: true,
      });
    } catch {
      // Keep current/default location if GPS is unavailable
    } finally {
      setIsTracingGps(false);
    }
  };

  useEffect(() => {
    traceGpsLocation();
  }, []);

  // Fetch live current weather + past 5 days + future 7 days + soil moisture
  useEffect(() => {
    let cancelled = false;
    const fetchLocationWeather = async () => {
      setIsLoading(true);
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lon}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
          `&hourly=soil_moisture_0_to_1cm,soil_moisture_9_to_27cm,evapotranspiration,vapour_pressure_deficit` +
          `&past_days=5&forecast_days=7&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Open-Meteo unavailable");
        const json = await res.json();
        if (cancelled) return;

        const cur = json.current || {};
        const detectedType = mapWmoToWeatherType(Number(cur.weather_code ?? 0));
        setLiveWeather({
          temperature: Number(cur.temperature_2m ?? 30),
          feelsLike: Number(cur.apparent_temperature ?? cur.temperature_2m ?? 30),
          humidity: Math.round(Number(cur.relative_humidity_2m ?? 55)),
          weatherType: detectedType,
        });
        if (!manualWeatherMode) {
          setWeatherState(detectedType);
        }

        const h = new Date().getHours();
        setLiveSoilData({
          soil_moisture_shallow: Number(json.hourly?.soil_moisture_0_to_1cm?.[h] ?? 0.25),
          soil_moisture_root: Number(json.hourly?.soil_moisture_9_to_27cm?.[h] ?? 0.22),
          evapotranspiration: Number(json.hourly?.evapotranspiration?.[h] ?? 0.3),
          vapour_pressure_deficit: Number(json.hourly?.vapour_pressure_deficit?.[h] ?? 1.2),
        });

        const daily = json.daily || {};
        const dates: string[] = daily.time || [];
        const codes: number[] = daily.weather_code || [];
        const maxes: number[] = daily.temperature_2m_max || [];
        const mins: number[] = daily.temperature_2m_min || [];
        const precips: number[] = daily.precipitation_sum || [];

        const allDays: DailyWeatherItem[] = dates.map((d, i) => ({
          date: d,
          weatherType: mapWmoToWeatherType(Number(codes[i] ?? 0)),
          tempMax: Number(maxes[i] ?? 30),
          tempMin: Number(mins[i] ?? 20),
          precipitation: Number(precips[i] ?? 0),
        }));

        // First 5 entries are past_days=5; remaining 7 are today + next 6 days
        setPastDays(allDays.slice(0, 5));
        setFutureDays(allDays.slice(5));
      } catch {
        if (!cancelled) {
          setLiveSoilData(FALLBACK_SOIL);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchLocationWeather();
    return () => {
      cancelled = true;
    };
  }, [selectedLocation.lat, selectedLocation.lon]);

  const handleOpenVoice = () => {
    if (!settings.voiceEnabled) {
      alert("Voice control is turned off. You can re-enable it in Settings (⚙️).");
      return;
    }
    setVoiceModalVisible(true);
  };

  const currentLangObj =
    LANGUAGES.find((l) => l.code === settings.language) || LANGUAGES[0];

  return (
    <WeatherBackground weatherState={weatherState}>
      <StatusBar style="light" />

      <View style={styles.safeArea}>
        {/* Top Header Bar */}
        <View style={styles.header}>
          <View>
            <View style={styles.appNameRow}>
              <Text style={styles.brandTitle}>{t.appName}</Text>
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>{t.aiFarm}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setLocationModalVisible(true)}
              style={styles.locationRow}
            >
              <Ionicons
                name={selectedLocation.isGps ? "navigate" : "location-sharp"}
                size={13}
                color={selectedLocation.isGps ? "#818cf8" : "#94a3b8"}
              />
              <Text style={styles.locationText}>
                {isTracingGps ? t.detectingGps : activeWeatherData.city}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#94a3b8" />
            </Pressable>
          </View>

          {/* Right Action Icons: Language Pill & Settings Gear */}
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setSettingsVisible(true)}
              style={styles.langBadge}
            >
              <Ionicons name="globe-outline" size={14} color="#c7d2fe" />
              <Text style={styles.langBadgeText}>{currentLangObj.native}</Text>
            </Pressable>

            <Pressable
              onPress={() => setSettingsVisible(true)}
              hitSlop={8}
              style={styles.settingsIconBtn}
            >
              <Ionicons name="settings-sharp" size={20} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Dynamic Weather Mode Switcher */}
        <WeatherModeBar
          current={weatherState}
          onSelect={(mode) => {
            setWeatherState(mode);
            setManualWeatherMode(true);
          }}
          label={t.designFx}
          language={settings.language}
        />

        {/* Top Navigation Tabs */}
        <MainTabBar activeTab={activeTab} onChange={setActiveTab} t={t} />

        {/* Main Content Body */}
        <View style={styles.contentContainer}>
          {activeTab === "standard" && (
            isLoading ? (
              <SkeletonLoader />
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 145 }}
              >
                <WeatherCard
                  data={activeWeatherData}
                  soil={activeSoilData}
                  unit={settings.unit}
                  t={t}
                />
                <ForecastSection
                  pastDays={pastDays}
                  futureDays={futureDays}
                  unit={settings.unit}
                  language={settings.language}
                  t={t}
                />
              </ScrollView>
            )
          )}

          {activeTab === "kisan" && (
            isLoading ? (
              <SkeletonLoader />
            ) : (
              <KisanPortal
                weatherData={activeWeatherData}
                soilData={activeSoilData}
                language={settings.language}
                voiceEnabled={settings.voiceEnabled}
                onMicPress={handleOpenVoice}
              />
            )
          )}

          {activeTab === "chat" && (
            <ChatbotScreen
              language={settings.language}
              cropHint={t.crops.rice}
              weatherDescription={currentWeatherDesc}
              voiceEnabled={settings.voiceEnabled}
              onOpenVoiceAssistant={handleOpenVoice}
            />
          )}
        </View>

        {/* Bottom Floating Voice Assistant Button (Hidden if voice disabled) */}
        {settings.voiceEnabled && activeTab !== "chat" && (
          <MicButton onPress={handleOpenVoice} label={t.tapToSpeak} />
        )}

        {/* Voice Assistant Live Interactive Modal */}
        <VoiceAssistantModal
          visible={voiceModalVisible}
          onClose={() => setVoiceModalVisible(false)}
          language={settings.language}
          speechRate={settings.speechRate}
          cropHint={t.crops.rice}
          weatherDescription={currentWeatherDesc}
          temperature={activeWeatherData.temperature}
        />

        {/* Settings Modal */}
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
        />

        {/* Location Search & GPS Modal */}
        <LocationSearchModal
          visible={locationModalVisible}
          onClose={() => setLocationModalVisible(false)}
          onSelectLocation={(loc) => {
            setManualWeatherMode(false);
            setSelectedLocation(loc);
          }}
          onUseGps={traceGpsLocation}
          isTracingGps={isTracingGps}
          language={settings.language}
        />
      </View>
    </WeatherBackground>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  appNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  aiTag: {
    backgroundColor: "rgba(99, 102, 241, 0.4)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.4)",
  },
  aiTagText: {
    color: "#e0e7ff",
    fontSize: 10,
    fontWeight: "800",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  langBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  langBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  settingsIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  weatherModeBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  weatherModeTitle: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  weatherModeRow: {
    flexDirection: "row",
    gap: 6,
  },
  weatherModePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  weatherModePillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  weatherEmoji: {
    fontSize: 12,
  },
  weatherModeText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
    fontWeight: "600",
  },
  weatherModeTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 16,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 13,
  },
  tabItemActive: {
    backgroundColor: "rgba(99, 102, 241, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.3)",
  },
  tabLabel: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12.5,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: "#ffffff",
  },
  contentContainer: {
    flex: 1,
  },
  skeletonContainer: {
    borderRadius: 24,
    overflow: "hidden",
    padding: 24,
  },
  skeletonInner: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 24,
  },
  weatherCard: {
    borderRadius: 26,
    overflow: "hidden",
  },
  weatherCardInner: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    padding: 24,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    marginBottom: 16,
  },
  alertText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "700",
  },
  tempHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tempSubtitle: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  liveText: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "800",
  },
  tempRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 6,
  },
  tempValue: {
    color: "#ffffff",
    fontSize: 70,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 78,
  },
  tempUnit: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 26,
    fontWeight: "600",
    marginTop: 8,
    marginLeft: 4,
  },
  weatherDesc: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 17,
    fontWeight: "600",
    textTransform: "capitalize",
    marginBottom: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    marginTop: 6,
    fontWeight: "500",
    textAlign: "center",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  micContainer: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    alignItems: "center",
  },
  micCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  micLabel: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    letterSpacing: 0.5,
  },
  forecastCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 14,
  },
  forecastInner: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 16,
  },
  forecastToggleRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  forecastTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  forecastTabActive: {
    backgroundColor: "rgba(99, 102, 241, 0.4)",
  },
  forecastTabText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontWeight: "700",
  },
  forecastTabTextActive: {
    color: "#ffffff",
  },
  forecastRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  forecastDay: {
    width: 92,
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "700",
  },
  forecastCondBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  forecastEmoji: {
    fontSize: 15,
  },
  forecastCondText: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 1,
  },
  forecastPrecip: {
    width: 48,
    textAlign: "right",
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: "600",
    marginRight: 8,
  },
  forecastTemps: {
    width: 64,
    textAlign: "right",
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "700",
  },
});
