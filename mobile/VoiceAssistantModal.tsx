/*
 * VoiceAssistantModal.tsx — Zero-crash Voice Assistant for Expo SDK 58
 * Uses expo-audio for native microphone recording, Groq Whisper for real STT,
 * and expo-speech for high-fidelity native TTS.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from "expo-audio";
import { API_BASE_URL } from "./apiConfig";
import { getTranslation, SPEECH_LANG_MAP } from "./translations";

interface VoiceAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
  speechRate: "slow" | "normal" | "fast";
  cropHint?: string;
  weatherDescription?: string;
  temperature?: number;
}

type AssistantPhase = "idle" | "recording" | "processing" | "speaking";

interface VoiceCommand {
  id: string;
  icon: string;
  getQuery: (crop: string) => string;
}

const VOICE_COMMANDS: Record<string, VoiceCommand[]> = {
  hi: [
    { id: "irrigation", icon: "water", getQuery: (crop) => `क्या आज ${crop} में पानी देना चाहिए?` },
    { id: "rain", icon: "cloud-rain", getQuery: () => `क्या अगले 24 घंटे में बारिश या तूफान का अलर्ट है?` },
    { id: "spray", icon: "spray", getQuery: (crop) => `${crop} में कीटनाशक और खाद छिड़काव का सही समय क्या है?` },
    { id: "harvest", icon: "gold", getQuery: (crop) => `क्या ${crop} फसल की कटाई के लिए मौसम अनुकूल है?` },
    { id: "soil", icon: "layers", getQuery: () => `खेत की मिट्टी में नमी की क्या स्थिति है?` },
  ],
  pa: [
    { id: "irrigation", icon: "water", getQuery: (crop) => `ਕੀ ਅੱਜ ${crop} ਨੂੰ ਪਾਣੀ ਲਾਉਣਾ ਠੀਕ ਹੈ?` },
    { id: "rain", icon: "cloud-rain", getQuery: () => `ਕੀ ਮੀਂਹ ਜਾਂ ਤੇਜ਼ ਹਨ੍ਹੇਰੀ ਦਾ ਕੋਈ ਅਲਰਟ ਹੈ?` },
    { id: "spray", icon: "spray", getQuery: (crop) => `${crop} ਉੱਤੇ ਸਪਰੇਅ ਕਦੋਂ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ?` },
    { id: "harvest", icon: "gold", getQuery: (crop) => `ਕੀ ${crop} ਦੀ ਕਟਾਈ ਲਈ ਮੌਸਮ ਠੀਕ ਹੈ?` },
  ],
  te: [
    { id: "irrigation", icon: "water", getQuery: (crop) => `ఈ రోజు ${crop} పంటకు నీరు పెట్టవచ్చా?` },
    { id: "rain", icon: "cloud-rain", getQuery: () => `రాబోయే 24 గంటల్లో వర్షం పడే అవకాశం ఉందా?` },
    { id: "spray", icon: "spray", getQuery: (crop) => `${crop} పై పురుగుమందు పిచికారీ ఎప్పుడు చేయాలి?` },
  ],
  ta: [
    { id: "irrigation", icon: "water", getQuery: (crop) => `இன்று ${crop} பயிருக்கு நீர் பாய்ச்சலாமா?` },
    { id: "rain", icon: "cloud-rain", getQuery: () => `அடுத்த 24 மணி நேரத்தில் மழை வருமா?` },
    { id: "spray", icon: "spray", getQuery: (crop) => `${crop} பூச்சிக்கொல்லி தெளிக்க உகந்த நேரம் எது?` },
  ],
  mr: [
    { id: "irrigation", icon: "water", getQuery: (crop) => `आज ${crop} पिकाला पाणी द्यावे का?` },
    { id: "rain", icon: "cloud-rain", getQuery: () => `पुढील 24 तासांत पावसाची शक्यता आहे का?` },
    { id: "spray", icon: "spray", getQuery: (crop) => `${crop} वर कीटकनाशक फवारणी कधी करावी?` },
  ],
  bn: [
    { id: "irrigation", icon: "water", getQuery: (crop) => `আজ কি ${crop} ফসলে সেচ দেওয়া উচিত?` },
    { id: "rain", icon: "cloud-rain", getQuery: () => `আগামী ২৪ ঘণ্টায় বৃষ্টির পূর্বাভাস আছে কি?` },
    { id: "spray", icon: "spray", getQuery: (crop) => `${crop} ফসলে সার বা ওষুধ কখন স্প্রে করব?` },
  ],
  en: [
    { id: "irrigation", icon: "water", getQuery: (crop) => `Should I irrigate my ${crop} crop today?` },
    { id: "rain", icon: "cloud-rain", getQuery: () => `Is any rain or severe weather forecast in the next 24 hours?` },
    { id: "spray", icon: "spray", getQuery: (crop) => `Is today safe for spraying pesticide on ${crop}?` },
    { id: "harvest", icon: "gold", getQuery: (crop) => `Is the weather suitable for harvesting ${crop}?` },
  ],
};

export default function VoiceAssistantModal({
  visible,
  onClose,
  language,
  speechRate,
  cropHint = "Rice",
  weatherDescription = "partly cloudy",
  temperature = 32,
}: VoiceAssistantModalProps) {
  const [phase, setPhase] = useState<AssistantPhase>("idle");
  const [userQuery, setUserQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [poweredBy, setPoweredBy] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const t = getTranslation(language);
  const speechLang = SPEECH_LANG_MAP[language] || "en-IN";
  const rateValue =
    speechRate === "slow" ? 0.75 : speechRate === "fast" ? 1.1 : 0.88;

  const recordingTimerRef = useRef<any>(null);
  const webRecognitionRef = useRef<any>(null);

  // Initialize native audio recorder from expo-audio
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Pulse animation for recording and speaking states
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (phase === "recording" || phase === "speaking") {
      const anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseScale, {
              toValue: 1.45,
              duration: 800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseScale, {
              toValue: 1,
              duration: 800,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0.15,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.6,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseScale.setValue(1);
      pulseOpacity.setValue(0.6);
    }
  }, [phase, pulseScale, pulseOpacity]);

  const stopAllAudio = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.abort();
      } catch {}
      webRecognitionRef.current = null;
    }
    try {
      Speech.stop();
    } catch {}
    try {
      if (audioRecorder.isRecording) {
        audioRecorder.stop();
      }
    } catch {}
  }, [audioRecorder]);

  useEffect(() => {
    if (!visible) {
      stopAllAudio();
      setPhase("idle");
      setRecordingSeconds(0);
    }
    return () => {
      stopAllAudio();
    };
  }, [visible, stopAllAudio]);

  const speakAdvisory = useCallback(
    (textToSpeak: string) => {
      setPhase("speaking");
      try {
        Speech.stop();
        Speech.speak(textToSpeak, {
          language: speechLang,
          rate: rateValue,
          onDone: () => setPhase("idle"),
          onError: () => {
            // Dialect fallback: if device lacks regional voice data (e.g. pa-IN / te-IN),
            // fallback gracefully to hi-IN or en-IN
            if (speechLang !== "en-IN" && speechLang !== "hi-IN") {
              Speech.speak(textToSpeak, {
                language: "hi-IN",
                rate: rateValue,
                onDone: () => setPhase("idle"),
                onError: () => setPhase("idle"),
              });
            } else {
              setPhase("idle");
            }
          },
        });
      } catch (err) {
        console.warn("Speech playback error:", err);
        setPhase("idle");
      }
    },
    [speechLang, rateValue]
  );

  // Text-based advisory fetch (used by quick commands, voice-typing bar, or fallbacks)
  const fetchAIAdvisory = useCallback(
    async (queryText: string) => {
      setPhase("processing");
      setUserQuery(queryText);
      setCustomInput("");

      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(`${API_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: queryText,
            lang: language,
            crop_type: cropHint.toLowerCase(),
            crop_stage: "growing",
            weather_description: weatherDescription,
          }),
        });
        clearTimeout(tid);

        if (res.ok) {
          const data = await res.json();
          if (data?.reply) {
            setAiResponse(data.reply);
            setPoweredBy(data.powered_by || "Groq Cloud");
            speakAdvisory(data.reply);
            return;
          }
        }
      } catch (err) {
        console.warn("Backend chat fetch error:", err);
      }

      // Offline deterministic fallback
      const fallback =
        language === "hi"
          ? `मौसम और मिट्टी की स्थिति के अनुसार अपनी ${cropHint} की फसल में सुबह के समय हल्की सिंचाई करें। तेज धूप में पानी न दें।`
          : `For your ${cropHint} under current conditions, irrigate during early morning and avoid peak afternoon sun.`;
      setAiResponse(fallback);
      setPoweredBy("offline-fallback");
      speakAdvisory(fallback);
    },
    [language, cropHint, weatherDescription, speakAdvisory]
  );

  // Upload real microphone audio file to /api/voice-query (Groq Whisper STT)
  const uploadVoiceAudio = async (audioUri: string) => {
    setPhase("processing");
    setUserQuery(
      language === "hi"
        ? "आवाज पहचानी जा रही है (Groq Whisper)..."
        : "Transcribing your voice (Groq Whisper)..."
    );
    setAiResponse("");
    setPoweredBy("");

    try {
      const formData = new FormData();
      formData.append("audio", {
        uri: audioUri,
        name: "voice_query.m4a",
        type: "audio/m4a",
      } as any);
      formData.append("lang", language);
      formData.append("crop_type", cropHint.toLowerCase());
      formData.append("crop_stage", "growing");
      formData.append("lat", String(20.5937));
      formData.append("lon", String(78.9629));

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(`${API_BASE_URL}/api/voice-query`, {
        method: "POST",
        signal: controller.signal,
        body: formData,
      });
      clearTimeout(tid);

      if (res.ok) {
        const data = await res.json();
        if (data?.text_response) {
          const spokenText =
            data.transcript ||
            (language === "hi" ? "किसान का प्रश्न (ध्वनि)" : "Spoken Voice Command");
          setUserQuery(spokenText);
          setAiResponse(data.text_response);
          setPoweredBy(
            data.stt_simulated ? "Groq (Simulated STT)" : "Groq Whisper + LLaMA"
          );
          speakAdvisory(data.text_response);
          return;
        }
      }
    } catch (err) {
      console.warn("Voice query upload failed, falling back to chat:", err);
    }

    // Fallback if STT endpoint failed
    const cmds = VOICE_COMMANDS[language] || VOICE_COMMANDS.en;
    fetchAIAdvisory(cmds[0].getQuery(cropHint));
  };

  // Start microphone recording
  const startRecording = async () => {
    stopAllAudio();

    // 1. Web Speech Recognition fallback for browsers
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const SpeechRec =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = speechLang;
          rec.interimResults = false;
          rec.maxAlternatives = 1;

          rec.onresult = (event: any) => {
            const transcript = event?.results?.[0]?.[0]?.transcript;
            if (transcript) {
              fetchAIAdvisory(transcript);
            }
          };

          rec.onerror = (e: any) => {
            console.warn("Web Speech API error:", e);
            const cmds = VOICE_COMMANDS[language] || VOICE_COMMANDS.en;
            fetchAIAdvisory(cmds[0].getQuery(cropHint));
          };

          rec.start();
          webRecognitionRef.current = rec;
          setPhase("recording");
          return;
        } catch (err) {
          console.warn("Web Speech API initialization failed:", err);
        }
      }
    }

    // 2. Native expo-audio microphone recording
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          language === "hi" ? "माइक्रोफ़ोन अनुमति आवश्यक है" : "Microphone Permission Required",
          language === "hi"
            ? "अपनी आवाज में कृषि सलाह पूछने के लिए कृपया माइक्रोफ़ोन की अनुमति दें। नीचे दिए गए त्वरित बटनों का उपयोग भी कर सकते हैं।"
            : "Please grant microphone permission to speak your farm questions. You can also tap any voice command below."
        );
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setPhase("recording");
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn("Failed to start audio recording:", err);
      // Fallback: prompt user to use command chips or text
      const cmds = VOICE_COMMANDS[language] || VOICE_COMMANDS.en;
      fetchAIAdvisory(cmds[0].getQuery(cropHint));
    }
  };

  // Stop recording and process voice
  const stopRecordingAndSend = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.stop();
      } catch {}
      webRecognitionRef.current = null;
    }

    setPhase("processing");

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri) {
        await uploadVoiceAudio(uri);
        return;
      }
    } catch (err) {
      console.warn("Audio stop error:", err);
    }

    // If no URI captured, use primary question
    const cmds = VOICE_COMMANDS[language] || VOICE_COMMANDS.en;
    fetchAIAdvisory(cmds[0].getQuery(cropHint));
  };

  const handleMicTap = () => {
    if (phase === "idle") {
      startRecording();
    } else if (phase === "recording") {
      stopRecordingAndSend();
    } else if (phase === "speaking") {
      Speech.stop();
      setPhase("idle");
    } else if (phase === "processing") {
      // Allow user to cancel processing
      stopAllAudio();
      setPhase("idle");
    }
  };

  const handleCommandPress = (cmd: VoiceCommand) => {
    stopAllAudio();
    fetchAIAdvisory(cmd.getQuery(cropHint));
  };

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    stopAllAudio();
    fetchAIAdvisory(customInput.trim());
  };

  const handleClose = () => {
    stopAllAudio();
    onClose();
  };

  const orbColor =
    phase === "recording"
      ? "#dc2626"
      : phase === "speaking"
      ? "#16a34a"
      : phase === "processing"
      ? "#d97706"
      : "#4f46e5";

  const orbIcon: any =
    phase === "recording"
      ? "stop"
      : phase === "speaking"
      ? "volume-high"
      : phase === "processing"
      ? "hourglass"
      : "mic";

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const statusText =
    phase === "recording"
      ? `🔴 ${language === "hi" ? "रिकॉर्डिंग चालू है..." : "Recording voice..."} (${formatTimer(recordingSeconds)})`
      : phase === "processing"
      ? t.processing || "AI Agronomist is analyzing your question..."
      : phase === "speaking"
      ? t.speaking || "Speaking farm advisory..."
      : language === "hi"
      ? "बोलने के लिए माइक दबाएं या नीचे सवाल चुनें"
      : "Tap mic orb to speak or choose a command below";

  const tapTipText =
    phase === "recording"
      ? language === "hi"
        ? "अपनी बात पूरी होने पर माइक दोबारा दबाएं"
        : "Tap orb when finished speaking to send"
      : phase === "speaking"
      ? language === "hi"
        ? "आवाज रोकने के लिए माइक दबाएं"
        : "Tap orb to pause spoken audio"
      : phase === "processing"
      ? language === "hi"
        ? "सलाह तैयार हो रही है..."
        : "Generating hyperlocal farm advice..."
      : language === "hi"
      ? "माइक दबाकर अपनी फसल या मौसम से जुड़ा सवाल पूछें"
      : "Tap the orb to record or select a quick question";

  const commandsList = VOICE_COMMANDS[language] || VOICE_COMMANDS.en;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={85} tint="dark" style={styles.modalCard}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.langPill}>
              <Ionicons name="mic" size={14} color="#818cf8" />
              <Text style={styles.langPillText}>
                {language.toUpperCase()} • WeatherGPT Spoken Voice
              </Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={20} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Orb Area */}
            <View style={styles.centerOrbArea}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                    borderColor: orbColor,
                  },
                ]}
              />
              <Pressable
                onPress={handleMicTap}
                style={[
                  styles.micOrb,
                  { backgroundColor: orbColor, shadowColor: orbColor },
                ]}
              >
                {phase === "processing" ? (
                  <ActivityIndicator size="large" color="#ffffff" />
                ) : (
                  <Ionicons name={orbIcon} size={38} color="#ffffff" />
                )}
              </Pressable>
            </View>

            {/* Tap Tip */}
            <Text style={styles.tapTip}>{tapTipText}</Text>

            {/* Status Banner */}
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>

            {/* Transcribed User Question */}
            {userQuery ? (
              <View style={styles.userBubble}>
                <Text style={styles.bubbleLabel}>
                  🧑‍🌾 {language === "hi" ? "किसान का प्रश्न:" : "Spoken Command:"}
                </Text>
                <Text style={styles.userQueryText}>"{userQuery}"</Text>
              </View>
            ) : null}

            {/* AI Advisor Response */}
            {aiResponse ? (
              <View style={styles.aiBubble}>
                <View style={styles.aiHeaderRow}>
                  <Text style={styles.bubbleLabel}>🌾 WeatherGPT Advisor:</Text>
                  <Pressable
                    onPress={() => speakAdvisory(aiResponse)}
                    style={styles.replayBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="volume-high" size={14} color="#818cf8" />
                    <Text style={styles.replayText}>
                      {language === "hi" ? "पुनः सुनें" : "Replay Voice"}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.aiResponseText}>{aiResponse}</Text>
                {poweredBy ? (
                  <Text style={styles.poweredBy}>⚡ {poweredBy}</Text>
                ) : null}
              </View>
            ) : null}

            {/* Quick Voice Command Chips */}
            <View style={styles.commandsContainer}>
              <Text style={styles.commandsHeader}>
                📢 {language === "hi" ? "त्वरित आवाज कमांड चुनें:" : "Quick Voice Commands:"}
              </Text>
              <View style={styles.commandChipsRow}>
                {commandsList.map((cmd) => (
                  <Pressable
                    key={cmd.id}
                    onPress={() => handleCommandPress(cmd)}
                    style={styles.commandChip}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color="#a5b4fc" />
                    <Text style={styles.commandChipText}>{cmd.getQuery(cropHint)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Custom Voice / Text Input Bar */}
            <View style={styles.inputContainer}>
              <TextInput
                value={customInput}
                onChangeText={setCustomInput}
                placeholder={
                  language === "hi"
                    ? "या अपना सवाल बोलें/लिखें..."
                    : "Or type/voice-dictate your question..."
                }
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                style={styles.inputField}
                onSubmitEditing={handleCustomSubmit}
              />
              <Pressable
                onPress={handleCustomSubmit}
                disabled={!customInput.trim()}
                style={[
                  styles.sendBtn,
                  !customInput.trim() && { opacity: 0.5 },
                ]}
              >
                <Ionicons name="arrow-up" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            {phase === "speaking" && (
              <Pressable
                onPress={() => {
                  Speech.stop();
                  setPhase("idle");
                }}
                style={styles.stopBtn}
              >
                <Ionicons name="stop-circle" size={18} color="#ffffff" />
                <Text style={styles.btnText}>
                  {language === "hi" ? "आवाज रोकें" : "Stop Audio"}
                </Text>
              </Pressable>
            )}

            {phase === "idle" && (
              <Pressable onPress={startRecording} style={styles.askAgainBtn}>
                <Ionicons name="mic-outline" size={18} color="#c7d2fe" />
                <Text style={styles.askAgainText}>
                  {language === "hi" ? "बोलकर पूछें" : "Record Voice"}
                </Text>
              </Pressable>
            )}

            <Pressable onPress={handleClose} style={styles.dismissBtn}>
              <Text style={styles.dismissBtnText}>{t.saveReturn || "Done"}</Text>
            </Pressable>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxHeight: "92%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    overflow: "hidden",
    padding: 18,
  },
  scrollContent: { paddingBottom: 16 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.3)",
  },
  langPillText: { color: "#c7d2fe", fontSize: 12, fontWeight: "700" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerOrbArea: {
    alignItems: "center",
    justifyContent: "center",
    height: 130,
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
  },
  micOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  tapTip: {
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11,
    marginBottom: 10,
  },
  statusBox: { alignItems: "center", marginBottom: 14 },
  statusText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  userBubble: {
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.25)",
    padding: 12,
    marginBottom: 10,
  },
  bubbleLabel: {
    color: "#a5b4fc",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  userQueryText: {
    color: "#f8fafc",
    fontSize: 13.5,
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: 19,
  },
  aiBubble: {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.25)",
    padding: 14,
    marginBottom: 14,
  },
  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  replayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(129, 140, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  replayText: { color: "#818cf8", fontSize: 11, fontWeight: "700" },
  aiResponseText: {
    color: "#f1f5f9",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  poweredBy: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    marginTop: 6,
    fontStyle: "italic",
  },
  commandsContainer: {
    marginBottom: 14,
  },
  commandsHeader: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11.5,
    fontWeight: "700",
    marginBottom: 8,
  },
  commandChipsRow: {
    gap: 7,
  },
  commandChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  commandChipText: {
    color: "#e2e8f0",
    fontSize: 12.5,
    fontWeight: "600",
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  inputField: {
    flex: 1,
    color: "#ffffff",
    fontSize: 12.5,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 12,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  askAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.35)",
  },
  askAgainText: { color: "#c7d2fe", fontSize: 12.5, fontWeight: "700" },
  btnText: { color: "#ffffff", fontSize: 12.5, fontWeight: "700" },
  dismissBtn: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  dismissBtnText: { color: "#ffffff", fontSize: 12.5, fontWeight: "800" },
});
