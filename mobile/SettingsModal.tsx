import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { getTranslation, SPEECH_LANG_MAP } from "./translations";

export interface AppSettings {
  language: string;
  voiceEnabled: boolean;
  speechRate: "slow" | "normal" | "fast";
  unit: "metric" | "imperial";
  lowBandwidthMode: boolean;
  imdAlertNotifications: boolean;
}

export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
];

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export default function SettingsModal({
  visible,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsModalProps) {
  const t = getTranslation(settings.language);
  const speechLang = SPEECH_LANG_MAP[settings.language] || "en-IN";

  const handleTestVoice = () => {
    Speech.stop();
    const rateValue =
      settings.speechRate === "slow"
        ? 0.75
        : settings.speechRate === "fast"
        ? 1.1
        : 0.88;

    Speech.speak(t.welcomeVoicePrompt, {
      language: speechLang,
      rate: rateValue,
    });
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={85} tint="dark" style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="settings" size={24} color="#a5b4fc" />
              <Text style={styles.headerTitle}>{t.settingsTitle}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* 1. Language Selector */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="language" size={18} color="#818cf8" />
                <Text style={styles.sectionTitle}>{t.languageSection}</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {t.languageSubtitle}
              </Text>
              <View style={styles.langGrid}>
                {LANGUAGES.map((lang) => {
                  const isSelected = settings.language === lang.code;
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => {
                        onUpdateSettings({ language: lang.code });
                        // Provide instantaneous voice confirmation when language selected
                        if (settings.voiceEnabled) {
                          const newLangCode = lang.code;
                          const newSpeechLang = SPEECH_LANG_MAP[newLangCode] || "en-IN";
                          const newT = getTranslation(newLangCode);
                          Speech.stop();
                          Speech.speak(newT.appName, {
                            language: newSpeechLang,
                            rate: 0.9,
                          });
                        }
                      }}
                      style={[
                        styles.langPill,
                        isSelected && styles.langPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.langNativeText,
                          isSelected && styles.langTextActive,
                        ]}
                      >
                        {lang.native}
                      </Text>
                      <Text style={styles.langSubText}>{lang.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 2. Voice & Audio Controls */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="mic" size={18} color="#f472b6" />
                <Text style={styles.sectionTitle}>{t.voiceSection}</Text>
              </View>

              {/* Voice Control Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.rowTextContainer}>
                  <Text style={styles.settingLabel}>{t.voiceToggleLabel}</Text>
                  <Text style={styles.settingDesc}>{t.voiceToggleDesc}</Text>
                </View>
                <Switch
                  value={settings.voiceEnabled}
                  onValueChange={(val) => {
                    if (!val) Speech.stop();
                    onUpdateSettings({ voiceEnabled: val });
                  }}
                  trackColor={{ false: "#334155", true: "#6366f1" }}
                  thumbColor={settings.voiceEnabled ? "#ffffff" : "#94a3b8"}
                />
              </View>

              {/* Speech Speed & Test Voice */}
              {settings.voiceEnabled && (
                <View style={[styles.settingRow, { marginTop: 14 }]}>
                  <View style={styles.rowTextContainer}>
                    <Text style={styles.settingLabel}>{t.voiceSpeedLabel}</Text>
                    <Text style={styles.settingDesc}>{t.voiceSpeedDesc}</Text>
                  </View>
                  <View style={styles.segmentGroup}>
                    {(["slow", "normal", "fast"] as const).map((spd) => {
                      const isActive = settings.speechRate === spd;
                      return (
                        <Pressable
                          key={spd}
                          onPress={() => onUpdateSettings({ speechRate: spd })}
                          style={[
                            styles.segmentBtn,
                            isActive && styles.segmentBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              isActive && styles.segmentTextActive,
                            ]}
                          >
                            {spd}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Instant Test Voice Button */}
              {settings.voiceEnabled && (
                <Pressable
                  onPress={handleTestVoice}
                  style={styles.testVoiceBtn}
                >
                  <Ionicons name="volume-medium" size={18} color="#a5b4fc" />
                  <Text style={styles.testVoiceText}>
                    🔊 {settings.language === "hi" ? "आवाज़ की जांच करें" : "Test Voice Preview"}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* 3. Units & Data Preferences */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="thermometer"
                  size={20}
                  color="#38bdf8"
                />
                <Text style={styles.sectionTitle}>{t.unitsSection}</Text>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.rowTextContainer}>
                  <Text style={styles.settingLabel}>{t.unitsLabel}</Text>
                  <Text style={styles.settingDesc}>{t.unitsDesc}</Text>
                </View>
                <View style={styles.segmentGroup}>
                  {(["metric", "imperial"] as const).map((u) => {
                    const isActive = settings.unit === u;
                    return (
                      <Pressable
                        key={u}
                        onPress={() => onUpdateSettings({ unit: u })}
                        style={[
                          styles.segmentBtn,
                          isActive && styles.segmentBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            isActive && styles.segmentTextActive,
                          ]}
                        >
                          {u === "metric" ? "°C" : "°F"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Low Bandwidth Mode */}
              <View style={[styles.settingRow, { marginTop: 14 }]}>
                <View style={styles.rowTextContainer}>
                  <Text style={styles.settingLabel}>{t.lowDataLabel}</Text>
                  <Text style={styles.settingDesc}>{t.lowDataDesc}</Text>
                </View>
                <Switch
                  value={settings.lowBandwidthMode}
                  onValueChange={(val) =>
                    onUpdateSettings({ lowBandwidthMode: val })
                  }
                  trackColor={{ false: "#334155", true: "#10b981" }}
                  thumbColor={settings.lowBandwidthMode ? "#ffffff" : "#94a3b8"}
                />
              </View>

              {/* Emergency Alerts */}
              <View style={[styles.settingRow, { marginTop: 14 }]}>
                <View style={styles.rowTextContainer}>
                  <Text style={styles.settingLabel}>{t.alertsLabel}</Text>
                  <Text style={styles.settingDesc}>{t.alertsDesc}</Text>
                </View>
                <Switch
                  value={settings.imdAlertNotifications}
                  onValueChange={(val) =>
                    onUpdateSettings({ imdAlertNotifications: val })
                  }
                  trackColor={{ false: "#334155", true: "#ef4444" }}
                  thumbColor={
                    settings.imdAlertNotifications ? "#ffffff" : "#94a3b8"
                  }
                />
              </View>
            </View>

            {/* 4. College Project Specs */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle" size={18} color="#eab308" />
                <Text style={styles.sectionTitle}>{t.aboutTitle}</Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoLine}>
                  <Text style={styles.infoBold}>Project:</Text> WeatherGPT Kisan Advisory
                </Text>
                <Text style={styles.infoLine}>
                  <Text style={styles.infoBold}>Stack:</Text> FastAPI + Expo Go SDK 58 + expo-speech
                </Text>
                <Text style={styles.infoLine}>
                  <Text style={styles.infoBold}>Languages:</Text> English, हिन्दी, ਪੰਜਾਬੀ, తెలుగు, தமிழ், मराठी, বাংলা
                </Text>
                <Text style={styles.disclaimerText}>
                  ⚠️ {t.disclaimer}
                </Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>{t.saveReturn}</Text>
            </Pressable>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "88%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollBody: {
    padding: 22,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 26,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  langPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    minWidth: 90,
  },
  langPillActive: {
    backgroundColor: "rgba(99, 102, 241, 0.28)",
    borderColor: "#818cf8",
  },
  langNativeText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 15,
    fontWeight: "700",
  },
  langTextActive: {
    color: "#ffffff",
    fontWeight: "900",
  },
  langSubText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  rowTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  settingDesc: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    lineHeight: 16,
  },
  segmentGroup: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: "#6366f1",
  },
  segmentText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  segmentTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  testVoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.3)",
    paddingVertical: 10,
    marginTop: 10,
  },
  testVoiceText: {
    color: "#c7d2fe",
    fontSize: 13,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  infoLine: {
    color: "#cbd5e1",
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: "800",
    color: "#ffffff",
  },
  disclaimerText: {
    color: "#fde047",
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
  doneBtn: {
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  doneBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
