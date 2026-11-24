import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { getTranslation, SPEECH_LANG_MAP } from "./translations";

// ---------------------------------------------------------------------------
// Animated Soundwave Equalizer (displays while audio advisory plays)
// ---------------------------------------------------------------------------

function SoundwaveEqualizer({ active }) {
  const bar1 = useRef(new Animated.Value(6)).current;
  const bar2 = useRef(new Animated.Value(14)).current;
  const bar3 = useRef(new Animated.Value(10)).current;
  const bar4 = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!active) {
      bar1.setValue(6);
      bar2.setValue(10);
      bar3.setValue(8);
      bar4.setValue(12);
      return;
    }

    const animateBar = (val, min, max, duration) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: max,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(val, {
            toValue: min,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );

    const a1 = animateBar(bar1, 4, 18, 300);
    const a2 = animateBar(bar2, 8, 22, 420);
    const a3 = animateBar(bar3, 6, 20, 360);
    const a4 = animateBar(bar4, 5, 24, 480);

    a1.start();
    a2.start();
    a3.start();
    a4.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      a4.stop();
    };
  }, [active, bar1, bar2, bar3, bar4]);

  return (
    <View style={styles.soundwaveContainer}>
      <Animated.View style={[styles.soundwaveBar, { height: bar1 }]} />
      <Animated.View style={[styles.soundwaveBar, { height: bar2 }]} />
      <Animated.View style={[styles.soundwaveBar, { height: bar3 }]} />
      <Animated.View style={[styles.soundwaveBar, { height: bar4 }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Visual Crop Selector Card
// ---------------------------------------------------------------------------

function VisualCropSelector({ crops, selected, onSelect, label }) {
  const cropIcons = {
    rice: { icon: "barley", labelHint: "Kharif", emoji: "🌾" },
    wheat: { icon: "grain", labelHint: "Rabi", emoji: "🌾" },
    cotton: { icon: "flower-tulip-outline", labelHint: "Cash Crop", emoji: "☁️" },
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <Text style={styles.sectionHint}>Select your field crop</Text>
      </View>
      <View style={styles.cropGrid}>
        {crops.map((opt) => {
          const active = opt.key === selected;
          const meta = cropIcons[opt.key] || { icon: "leaf", emoji: "🌱" };

          return (
            <Pressable
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              style={[styles.cropCard, active && styles.cropCardActive]}
            >
              <View
                style={[
                  styles.cropIconWrapper,
                  active && styles.cropIconWrapperActive,
                ]}
              >
                <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
              </View>
              <Text style={[styles.cropCardTitle, active && styles.cropCardTitleActive]}>
                {opt.label}
              </Text>
              {active && (
                <View style={styles.activeCropDot}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Crop Stage Stepper
// ---------------------------------------------------------------------------

function GrowthStageStepper({ stages, selected, onSelect, label }) {
  const stageIcons = {
    sowing: "sprout-outline",
    growing: "leaf",
    harvest: "gold",
  };

  const selectedIndex = stages.findIndex((s) => s.key === selected);

  return (
    <View style={{ marginBottom: 22 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <Text style={styles.sectionHint}>Crop lifecycle phase</Text>
      </View>

      <BlurView intensity={35} tint="dark" style={styles.stepperContainer}>
        {/* Progress connecting line */}
        <View style={styles.stepperLineBackground}>
          <View
            style={[
              styles.stepperLineFill,
              {
                width: `${(selectedIndex / (stages.length - 1)) * 100}%`,
              },
            ]}
          />
        </View>

        <View style={styles.stepperStepsRow}>
          {stages.map((stg, idx) => {
            const active = stg.key === selected;
            const completed = idx < selectedIndex;

            return (
              <Pressable
                key={stg.key}
                onPress={() => onSelect(stg.key)}
                style={styles.stepItem}
              >
                <View
                  style={[
                    styles.stepCircle,
                    active && styles.stepCircleActive,
                    completed && styles.stepCircleCompleted,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={stageIcons[stg.key] || "circle"}
                    size={16}
                    color={active ? "#ffffff" : completed ? "#10b981" : "rgba(255,255,255,0.4)"}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    active && styles.stepLabelActive,
                    completed && styles.stepLabelCompleted,
                  ]}
                >
                  {stg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Telemetry KPI Strip (Micro Dashboard)
// ---------------------------------------------------------------------------

function TelemetryKPIStrip({ rootMoisture, vpd, et, temp, humidity }) {
  const moisturePct = rootMoisture != null ? Math.round(rootMoisture * 100) : "--";
  const moistureStatus =
    rootMoisture == null
      ? "Unknown"
      : rootMoisture > 0.35
      ? "Wet"
      : rootMoisture < 0.15
      ? "Dry"
      : "Optimal";

  const moistureColor =
    moistureStatus === "Optimal"
      ? "#34d399"
      : moistureStatus === "Dry"
      ? "#f87171"
      : "#60a5fa";

  return (
    <View style={styles.kpiContainer}>
      <BlurView intensity={45} tint="dark" style={styles.kpiCard}>
        <View style={styles.kpiTopRow}>
          <Ionicons name="water-outline" size={14} color="#60a5fa" />
          <Text style={styles.kpiLabel}>Root Soil (9-27cm)</Text>
        </View>
        <View style={styles.kpiBottomRow}>
          <Text style={styles.kpiValue}>{moisturePct}%</Text>
          <View style={[styles.kpiPill, { backgroundColor: `${moistureColor}22` }]}>
            <Text style={[styles.kpiPillText, { color: moistureColor }]}>
              {moistureStatus}
            </Text>
          </View>
        </View>
        {/* Progress Bar */}
        <View style={styles.miniProgressBarTrack}>
          <View
            style={[
              styles.miniProgressBarFill,
              {
                width: rootMoisture != null ? `${Math.min(100, Math.max(10, moisturePct * 2))}%` : "50%",
                backgroundColor: moistureColor,
              },
            ]}
          />
        </View>
      </BlurView>

      <BlurView intensity={45} tint="dark" style={styles.kpiCard}>
        <View style={styles.kpiTopRow}>
          <MaterialCommunityIcons name="weather-windy" size={14} color="#a78bfa" />
          <Text style={styles.kpiLabel}>VPD (Stress)</Text>
        </View>
        <View style={styles.kpiBottomRow}>
          <Text style={styles.kpiValue}>
            {vpd != null ? `${vpd.toFixed(1)}` : "--"}
            <Text style={styles.kpiUnit}> kPa</Text>
          </Text>
          <View
            style={[
              styles.kpiPill,
              {
                backgroundColor:
                  vpd != null && vpd > 2.0
                    ? "rgba(239,68,68,0.2)"
                    : "rgba(52,211,153,0.2)",
              },
            ]}
          >
            <Text
              style={[
                styles.kpiPillText,
                { color: vpd != null && vpd > 2.0 ? "#f87171" : "#34d399" },
              ]}
            >
              {vpd != null && vpd > 2.0 ? "High" : "Normal"}
            </Text>
          </View>
        </View>
        <Text style={styles.kpiSubtext}>
          {et != null ? `ET₀: ${et.toFixed(2)} mm/h` : `${temp}°C • ${humidity}% hum`}
        </Text>
      </BlurView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Premium Glassmorphic Advisory Card
// ---------------------------------------------------------------------------

function AdvisoryCard({
  icon,
  iconPack,
  title,
  ok,
  badge,
  detail,
  onSpeak,
  isSpeakingThis,
}) {
  const Icon = iconPack === "mci" ? MaterialCommunityIcons : Ionicons;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const glowBorderColor = ok ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)";
  const statusColor = ok ? "#34d399" : "#f87171";

  return (
    <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
      <BlurView
        intensity={55}
        tint="dark"
        style={[
          styles.advisoryCardWrapper,
          { borderColor: isSpeakingThis ? "#818cf8" : glowBorderColor },
        ]}
      >
        <View style={styles.cardHeader}>
          {/* Icon + Title */}
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.advisoryIconBox,
                {
                  backgroundColor: ok
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                },
              ]}
            >
              <Icon name={icon} size={22} color={statusColor} />
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.advisoryTitle}>{title}</Text>
            </View>
          </View>

          {/* Right Status Badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: ok
                  ? "rgba(16, 185, 129, 0.18)"
                  : "rgba(239, 68, 68, 0.18)",
                borderColor: ok
                  ? "rgba(52, 211, 153, 0.4)"
                  : "rgba(248, 113, 113, 0.4)",
              },
            ]}
          >
            <Ionicons
              name={ok ? "checkmark-circle" : "alert-circle"}
              size={13}
              color={statusColor}
            />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {badge}
            </Text>
          </View>
        </View>

        {/* Advisory Detail Text */}
        <Text style={styles.advisoryDetail}>{detail}</Text>

        {/* Action Row */}
        <View style={styles.cardFooter}>
          <Pressable
            onPress={onSpeak}
            style={[
              styles.speakCardBtn,
              isSpeakingThis && styles.speakCardBtnActive,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name={isSpeakingThis ? "stop" : "volume-medium"}
              size={14}
              color={isSpeakingThis ? "#f87171" : "#a5b4fc"}
            />
            <Text
              style={[
                styles.speakCardBtnText,
                isSpeakingThis && { color: "#f87171" },
              ]}
            >
              {isSpeakingThis ? "Stop" : "Listen advice"}
            </Text>
          </Pressable>

          <View style={styles.cardMetaPill}>
            <Ionicons name="shield-checkmark-outline" size={11} color="#94a3b8" />
            <Text style={styles.cardMetaText}>Decision Engine</Text>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Kisan Helpline & KVK Card
// ---------------------------------------------------------------------------

function KisanSupportBanner() {
  return (
    <BlurView intensity={35} tint="dark" style={styles.supportCard}>
      <View style={styles.supportLeft}>
        <View style={styles.supportIconBox}>
          <Ionicons name="call" size={18} color="#38bdf8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.supportTitle}>Kisan Call Center (Toll-Free)</Text>
          <Text style={styles.supportSubtitle}>
            1800-180-1551 • Agronomist Advisory & Schemes
          </Text>
        </View>
      </View>
      <View style={styles.supportBadge}>
        <Text style={styles.supportBadgeText}>FREE</Text>
      </View>
    </BlurView>
  );
}

// ---------------------------------------------------------------------------
// Disclaimer Banner
// ---------------------------------------------------------------------------

function DisclaimerBanner({ text }) {
  return (
    <View style={styles.disclaimerContainer}>
      <Ionicons name="shield-outline" size={16} color="#fbbf24" />
      <Text style={styles.disclaimerText}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {any} [props.weatherData]
 * @param {any} [props.soilData]
 * @param {string} [props.language]
 * @param {boolean} [props.voiceEnabled]
 * @param {() => void} [props.onMicPress]
 */
export default function KisanPortal({
  weatherData,
  soilData = null,
  language = "en",
  voiceEnabled = true,
  onMicPress,
}) {
  const [crop, setCrop] = useState("rice");
  const [stage, setStage] = useState("growing");
  const [speakingCardKey, setSpeakingCardKey] = useState(null);
  const [isPlayingFullAudio, setIsPlayingFullAudio] = useState(false);
  const lastSpokenLang = useRef(null);

  const t = getTranslation(language);
  const speechLang = SPEECH_LANG_MAP[language] || "en-IN";

  const crops = [
    { key: "rice", label: t.crops.rice },
    { key: "wheat", label: t.crops.wheat },
    { key: "cotton", label: t.crops.cotton },
  ];

  const stages = [
    { key: "sowing", label: t.stages.sowing },
    { key: "growing", label: t.stages.growing },
    { key: "harvest", label: t.stages.harvest },
  ];

  // Voice onboarding
  useEffect(() => {
    if (!voiceEnabled) return;
    if (lastSpokenLang.current === language) return;
    lastSpokenLang.current = language;

    const delay = setTimeout(() => {
      try {
        Speech.stop();
        Speech.speak(t.welcomeVoicePrompt, {
          language: speechLang,
          rate: 0.86,
          pitch: 1.0,
        });
      } catch {}
    }, 700);

    return () => {
      clearTimeout(delay);
      try { Speech.stop(); } catch {}
    };
  }, [voiceEnabled, language, speechLang, t.welcomeVoicePrompt]);

  // Telemetry values
  const temp = weatherData?.temperature ?? 30;
  const humidity = weatherData?.humidity ?? 50;
  const desc = (weatherData?.description ?? "").toLowerCase();
  const hasAlert = weatherData?.has_extreme_alert ?? false;

  const rootMoisture =
    soilData?.soil_moisture_root != null
      ? Number(soilData.soil_moisture_root)
      : null;
  const vpd =
    soilData?.vapour_pressure_deficit != null
      ? Number(soilData.vapour_pressure_deficit)
      : null;
  const et =
    soilData?.evapotranspiration != null
      ? Number(soilData.evapotranspiration)
      : null;

  const isRainy =
    desc.includes("rain") ||
    desc.includes("drizzle") ||
    desc.includes("thunderstorm") ||
    desc.includes("shower") ||
    desc.includes("बारिश") ||
    desc.includes("ਮੀਂਹ") ||
    desc.includes("వర్షం") ||
    desc.includes("மழை") ||
    desc.includes("पाऊस") ||
    desc.includes("বৃষ্টি");

  const isWindy =
    desc.includes("wind") ||
    desc.includes("squall") ||
    desc.includes("storm");

  // 1. Irrigation calculation
  let irrigationOk = !isRainy;
  let irrigationBadge = irrigationOk ? t.badgeIrrigate || "Irrigate" : t.badgeSkip || "Skip";
  let irrigationDetail = irrigationOk
    ? t.irrigationNoRain || "No rain expected — irrigate as scheduled"
    : t.irrigationRain || "Rain detected — skip irrigation today, save groundwater";

  if (rootMoisture !== null) {
    const moisturePct = Math.round(rootMoisture * 100);
    if (rootMoisture > 0.35) {
      irrigationOk = false;
      irrigationBadge = t.badgeSkip || "Skip";
      irrigationDetail = `${t.soilMoistureWet || "Soil is saturated — skip irrigation, risk of waterlogging"} (${moisturePct}%)`;
    } else if (rootMoisture < 0.15) {
      irrigationOk = true;
      irrigationBadge = t.badgeIrrigate || "Irrigate";
      irrigationDetail = `${t.soilMoistureDry || "Soil is dry — irrigate now to prevent crop stress"} (${moisturePct}%)`;
    } else {
      if (isRainy) {
        irrigationOk = false;
        irrigationBadge = t.badgeSkip || "Skip";
        irrigationDetail = `${t.irrigationRain || "Rain detected — skip irrigation today"} (${moisturePct}%)`;
      } else {
        irrigationOk = true;
        irrigationBadge = t.badgeOptimal || "Optimal";
        irrigationDetail = `${t.soilMoistureOptimal || "Soil moisture is optimal — scheduled light morning watering is safe"} (${moisturePct}%)`;
      }
    }
  }

  // 2. Fertilizer / Spraying calculation
  let fertilizerOk = !isWindy && !isRainy && humidity < 90;
  let fertilizerBadge = fertilizerOk ? t.badgeSafe || "Safe" : t.badgeDelay || "Delay";
  let fertilizerDetail = fertilizerOk
    ? t.fertilizerSafe || "Calm & dry conditions — safe window for foliar spraying"
    : t.fertilizerDelay || "Wind or rain detected — delay spraying to prevent chemical waste";

  if (vpd !== null && vpd > 2.0) {
    fertilizerOk = false;
    fertilizerBadge = t.badgeDelay || "Delay";
    fertilizerDetail = `VPD is elevated (${vpd.toFixed(1)} kPa) — delay spraying; crop is under moisture stress.`;
  }

  // 3. Harvest readiness
  const isHarvestStage = stage === "harvest";
  const harvestOk = isHarvestStage && !isRainy && !hasAlert && temp < 42;
  const harvestBadge = !isHarvestStage
    ? t.badgeNa || "N/A"
    : harvestOk
    ? t.badgeReady || "Ready"
    : t.badgeHold || "Hold";
  const harvestDetail = !isHarvestStage
    ? t.harvestNotTime || "Crop is still in vegetative/ripening phase — monitor growth"
    : harvestOk
    ? t.harvestReady || "Clear dry weather — ideal window to cut, thresh, and store"
    : t.harvestDelay || "Adverse conditions detected — delay harvest to protect grain quality";

  // 4. Root soil telemetry card
  let soilOk = true;
  let soilBadge = t.badgeOptimal || "Optimal";
  let soilDetail = t.soilMoistureOptimal || "Root soil moisture is balanced.";

  if (rootMoisture !== null) {
    const moisturePct = Math.round(rootMoisture * 100);
    const etSuffix = et !== null ? ` • ET₀: ${et.toFixed(2)} mm/h` : "";
    if (rootMoisture > 0.35) {
      soilOk = false;
      soilBadge = t.badgeWet || "Wet";
      soilDetail = `Root-zone is saturated (${moisturePct}%)${etSuffix}. Ensure drainage trenches are clear.`;
    } else if (rootMoisture < 0.15) {
      soilOk = false;
      soilBadge = t.badgeDry || "Dry";
      soilDetail = `Root-zone is moisture deficient (${moisturePct}%)${etSuffix}. Drip or furrow irrigation required.`;
    } else {
      soilOk = true;
      soilBadge = t.badgeOptimal || "Optimal";
      soilDetail = `Root-zone soil moisture is optimal (${moisturePct}%)${etSuffix}. High nutrient absorption capacity.`;
    }
  }

  const activeCropLabel = crops.find((c) => c.key === crop)?.label ?? crop;

  // Single card audio speaker
  const handleSpeakCard = (cardKey, textToSpeak) => {
    if (speakingCardKey === cardKey) {
      Speech.stop();
      setSpeakingCardKey(null);
      return;
    }
    Speech.stop();
    setIsPlayingFullAudio(false);
    setSpeakingCardKey(cardKey);

    Speech.speak(textToSpeak, {
      language: speechLang,
      rate: 0.88,
      onDone: () => setSpeakingCardKey(null),
      onError: () => {
        if (speechLang !== "en-IN" && speechLang !== "hi-IN") {
          Speech.speak(textToSpeak, {
            language: "hi-IN",
            rate: 0.88,
            onDone: () => setSpeakingCardKey(null),
            onError: () => setSpeakingCardKey(null),
          });
        } else {
          setSpeakingCardKey(null);
        }
      },
    });
  };

  // Full advisory audio reader
  const handleReadFullAdvisory = () => {
    if (isPlayingFullAudio) {
      Speech.stop();
      setIsPlayingFullAudio(false);
      return;
    }

    Speech.stop();
    setSpeakingCardKey(null);
    setIsPlayingFullAudio(true);

    const fullSpeech = `${t.todaysAdvisory} for ${activeCropLabel}. ${t.irrigationTitle}: ${irrigationDetail}. ${t.fertilizerTitle}: ${fertilizerDetail}. ${t.harvestTitle}: ${harvestDetail}.`;

    Speech.speak(fullSpeech, {
      language: speechLang,
      rate: 0.88,
      onDone: () => setIsPlayingFullAudio(false),
      onError: () => {
        if (speechLang !== "en-IN" && speechLang !== "hi-IN") {
          Speech.speak(fullSpeech, {
            language: "hi-IN",
            rate: 0.88,
            onDone: () => setIsPlayingFullAudio(false),
            onError: () => setIsPlayingFullAudio(false),
          });
        } else {
          setIsPlayingFullAudio(false);
        }
      },
    });
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 160 }}
    >
      {/* Visual Crop Selector */}
      <VisualCropSelector
        label={t.selectCrop || "CROP PROFILE"}
        crops={crops}
        selected={crop}
        onSelect={setCrop}
      />

      {/* Lifecycle Stepper */}
      <GrowthStageStepper
        label={t.growthStage || "GROWTH STAGE"}
        stages={stages}
        selected={stage}
        onSelect={setStage}
      />

      {/* Telemetry Micro Dashboard Strip */}
      <TelemetryKPIStrip
        rootMoisture={rootMoisture}
        vpd={vpd}
        et={et}
        temp={temp}
        humidity={humidity}
      />

      {/* Audio Advisory Controller Banner */}
      <BlurView intensity={50} tint="dark" style={styles.audioControllerCard}>
        <View style={styles.audioControllerLeft}>
          <Text style={styles.audioControllerTitle}>
            🌾 {t.todaysAdvisory || "Agronomic Advisory"} — {activeCropLabel}
          </Text>
          <Text style={styles.audioControllerSubtitle}>
            Tailored to current field soil & weather conditions
          </Text>
        </View>

        {voiceEnabled && (
          <Pressable
            onPress={handleReadFullAdvisory}
            style={[
              styles.audioPlayButton,
              isPlayingFullAudio && styles.audioPlayButtonActive,
            ]}
          >
            <SoundwaveEqualizer active={isPlayingFullAudio} />
            <Text
              style={[
                styles.audioPlayButtonText,
                isPlayingFullAudio && { color: "#f87171" },
              ]}
            >
              {isPlayingFullAudio ? "Stop" : "🔊 Listen All"}
            </Text>
          </Pressable>
        )}
      </BlurView>

      {/* Advisory Card 1: Irrigation */}
      <AdvisoryCard
        icon="water"
        iconPack="ion"
        title={t.irrigationTitle || "Irrigation Management"}
        ok={irrigationOk}
        badge={irrigationBadge}
        detail={irrigationDetail}
        isSpeakingThis={speakingCardKey === "irrigation"}
        onSpeak={() =>
          handleSpeakCard(
            "irrigation",
            `${t.irrigationTitle}: ${irrigationDetail}`
          )
        }
      />

      {/* Advisory Card 2: Spraying / Fertilizer */}
      <AdvisoryCard
        icon="spray"
        iconPack="mci"
        title={t.fertilizerTitle || "Pest & Fertilizer Spray Window"}
        ok={fertilizerOk}
        badge={fertilizerBadge}
        detail={fertilizerDetail}
        isSpeakingThis={speakingCardKey === "fertilizer"}
        onSpeak={() =>
          handleSpeakCard(
            "fertilizer",
            `${t.fertilizerTitle}: ${fertilizerDetail}`
          )
        }
      />

      {/* Advisory Card 3: Harvest Readiness */}
      <AdvisoryCard
        icon={isRainy ? "cloud-outline" : "sunny-outline"}
        iconPack="ion"
        title={t.harvestTitle || "Harvest & Threshing Window"}
        ok={harvestOk}
        badge={harvestBadge}
        detail={harvestDetail}
        isSpeakingThis={speakingCardKey === "harvest"}
        onSpeak={() =>
          handleSpeakCard(
            "harvest",
            `${t.harvestTitle}: ${harvestDetail}`
          )
        }
      />

      {/* Advisory Card 4: Root Soil Telemetry */}
      <AdvisoryCard
        icon="layers-outline"
        iconPack="ion"
        title={t.soilMoistureTitle || "Root-Zone Soil State"}
        ok={soilOk}
        badge={soilBadge}
        detail={soilDetail}
        isSpeakingThis={speakingCardKey === "soil"}
        onSpeak={() =>
          handleSpeakCard(
            "soil",
            `${t.soilMoistureTitle}: ${soilDetail}`
          )
        }
      />

      {/* Kisan Assistance / Helpline Card */}
      <KisanSupportBanner />

      {/* AI Guardrail & Safety Disclaimer */}
      <DisclaimerBanner text={t.disclaimer} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  sectionHint: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 10,
  },
  cropGrid: {
    flexDirection: "row",
    gap: 10,
  },
  cropCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cropCardActive: {
    backgroundColor: "rgba(99, 102, 241, 0.22)",
    borderColor: "#818cf8",
  },
  cropIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cropIconWrapperActive: {
    backgroundColor: "rgba(99, 102, 241, 0.4)",
  },
  cropCardTitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  cropCardTitleActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  activeCropDot: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  stepperContainer: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: "hidden",
    position: "relative",
  },
  stepperLineBackground: {
    position: "absolute",
    top: 30,
    left: 45,
    right: 45,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    zIndex: 1,
  },
  stepperLineFill: {
    height: 3,
    backgroundColor: "#818cf8",
  },
  stepperStepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 2,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: "#6366f1",
    borderColor: "#c7d2fe",
  },
  stepCircleCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10b981",
  },
  stepLabel: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  stepLabelCompleted: {
    color: "#a7f3d0",
  },
  kpiContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 12,
    overflow: "hidden",
  },
  kpiTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  kpiLabel: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  kpiBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  kpiValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  kpiUnit: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.5)",
  },
  kpiPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  kpiPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  miniProgressBarTrack: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  miniProgressBarFill: {
    height: 3,
    borderRadius: 2,
  },
  kpiSubtext: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 10,
    fontWeight: "500",
  },
  audioControllerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 14,
    marginBottom: 16,
    overflow: "hidden",
  },
  audioControllerLeft: {
    flex: 1,
    marginRight: 10,
  },
  audioControllerTitle: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "800",
    marginBottom: 2,
  },
  audioControllerSubtitle: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 10.5,
  },
  audioPlayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    borderWidth: 1,
    borderColor: "#818cf8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  audioPlayButtonActive: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    borderColor: "#ef4444",
  },
  audioPlayButtonText: {
    color: "#c7d2fe",
    fontSize: 11.5,
    fontWeight: "800",
  },
  soundwaveContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 16,
    marginRight: 2,
  },
  soundwaveBar: {
    width: 2.5,
    backgroundColor: "#a5b4fc",
    borderRadius: 1.5,
  },
  advisoryCardWrapper: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 16,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  advisoryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  advisoryTitle: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "800",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  advisoryDetail: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12.5,
    lineHeight: 18.5,
    fontWeight: "500",
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.07)",
    paddingTop: 10,
  },
  speakCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  speakCardBtnActive: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  speakCardBtnText: {
    color: "#c7d2fe",
    fontSize: 11,
    fontWeight: "700",
  },
  cardMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardMetaText: {
    color: "rgba(255, 255, 255, 0.35)",
    fontSize: 10,
    fontWeight: "600",
  },
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    overflow: "hidden",
  },
  supportLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  supportIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  supportTitle: {
    color: "#e0f2fe",
    fontSize: 12.5,
    fontWeight: "800",
  },
  supportSubtitle: {
    color: "#7dd3fc",
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 1,
  },
  supportBadge: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  supportBadgeText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "800",
  },
  disclaimerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.22)",
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
  },
  disclaimerText: {
    color: "#fde68a",
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
    fontWeight: "500",
  },
});
