import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Speech from "expo-speech";
import { getTranslation, SPEECH_LANG_MAP } from "./translations";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: string;
}

const MULTILINGUAL_PROMPTS: Record<string, string[]> = {
  hi: [
    "🌾 क्या आज धान में पानी देना चाहिए?",
    "💧 गेहूं की सिंचाई का सही समय क्या है?",
    "🐛 कपास में कीड़े लगने पर क्या करें?",
    "⚠️ क्या अगले 24 घंटे में बारिश होगी?",
  ],
  pa: [
    "🌾 ਕੀ ਅੱਜ ਝੋਨੇ ਨੂੰ ਪਾਣੀ ਲਾਉਣਾ ਠੀਕ ਹੈ?",
    "💧 ਕਣਕ ਦੀ ਸਿੰਚਾਈ ਦਾ ਸਹੀ ਸਮਾਂ ਕੀ ਹੈ?",
    "🐛 ਨਰਮੇ ਉੱਤੇ ਸਪਰੇਅ ਕਦੋਂ ਕਰੀਏ?",
    "⚠️ ਕੀ ਮੀਂਹ ਜਾਂ ਹਨ੍ਹੇਰੀ ਦਾ ਕੋਈ ਅਲਰਟ ਹੈ?",
  ],
  te: [
    "🌾 ఈ రోజు వరి పంటకు నీరు పెట్టవచ్చా?",
    "💧 గోధుమ పంటకు ఎప్పుడు నీరు అందించాలి?",
    "🐛 పత్తి పంటకు పురుగుల నివారణ సలహా?",
    "⚠️ రాబోయే 24 గంటల్లో వర్షం ఉందా?",
  ],
  ta: [
    "🌾 இன்று நெல் பயிருக்கு நீர் பாய்ச்சலாமா?",
    "💧 கோதுமை நீர்ப்பாசனத்திற்கு சரியான நேரம்?",
    "🐛 பருத்தி பூச்சி தாக்குதல் தடுப்பு முறை?",
    "⚠️ அடுத்த 24 மணி நேரத்தில் மழை வருமா?",
  ],
  mr: [
    "🌾 आज भात पिकाला पाणी द्यावे का?",
    "💧 गहू पिकाच्या सिंचनाची योग्य वेळ कोणती?",
    "🐛 कापसावरील कीड नियंत्रणासाठी काय करावे?",
    "⚠️ पुढील 24 तासांत पावसाचा इशारा आहे का?",
  ],
  bn: [
    "🌾 আজ কি ধান ফসলে সেচ দেওয়া যাবে?",
    "💧 গম ফসলে জল দেওয়ার সঠিক সময় কী?",
    "🐛 তুলো ফসলে পোকা দমনে কী স্প্রে করব?",
    "⚠️ আগামী ২৪ ঘণ্টায় বৃষ্টির পূর্বাভাস আছে কি?",
  ],
  en: [
    "🌾 Should I irrigate rice paddy today?",
    "💧 Best time for wheat irrigation this week?",
    "🐛 Pest management advice for cotton?",
    "⚠️ Any storm or rain warning in 24 hours?",
  ],
};

import { API_BASE_URL } from "./apiConfig";

interface ChatbotScreenProps {
  language?: string;
  cropHint?: string;
  weatherDescription?: string;
  voiceEnabled?: boolean;
  onOpenVoiceAssistant?: () => void;
}

export default function ChatbotScreen({
  language = "en",
  cropHint = "Rice",
  weatherDescription = "partly cloudy",
  voiceEnabled = true,
  onOpenVoiceAssistant,
}: ChatbotScreenProps) {
  const t = getTranslation(language);
  const speechLang = SPEECH_LANG_MAP[language] || "en-IN";
  const quickPrompts = MULTILINGUAL_PROMPTS[language] || MULTILINGUAL_PROMPTS.en;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "bot",
      text: t.botGreeting,
      time: "Just now",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Update greeting when language changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "1") {
        return [{ ...prev[0], text: t.botGreeting }];
      }
      return prev;
    });
  }, [language, t.botGreeting]);

  const buildLocalFallbackReply = (text: string): string => {
    if (language === "hi") {
      if (text.includes("पानी") || text.includes("सिंचाई")) {
        return `वर्तमान मौसम स्थिति के अनुसार नमी मध्यम है। अपनी ${cropHint} में सुबह या शाम को हल्की सिंचाई करें। तेज धूप में पानी न दें।`;
      } else if (text.includes("बारिश")) {
        return `आगामी समय में हल्के बादल छाए रहेंगे। भारी बारिश की संभावना कम है, फिर भी जल निकासी की नालियां साफ रखें।`;
      }
      return `आपकी ${cropHint} की फसल के लिए मौसम सामान्य है। कीटनाशक छिड़काव हवा थमने पर ही करें।`;
    } else if (language === "pa") {
      if (text.includes("ਪਾਣੀ") || text.includes("ਸਿੰਚਾਈ")) {
        return `ਮੌਸਮ ਦੇ ਹਿਸਾਬ ਨਾਲ ਅੱਜ ਸਵੇਰ ਜਾਂ ਸ਼ਾਮ ਵੇਲੇ ਆਪਣੀ ${cropHint} ਨੂੰ ਹਲਕਾ ਪਾਣੀ ਲਾਓ। ਦੁਪਹਿਰ ਦੀ ਧੁੱਪ ਵਿੱਚ ਪਾਣੀ ਨਾ ਲਾਓ।`;
      }
      return `ਤੁਹਾਡੀ ${cropHint} ਦੀ ਫ਼ਸਲ ਲਈ ਹਾਲਾਤ ਠੀਕ ਹਨ। ਜੇਕਰ ਹਵਾ ਤੇਜ਼ ਹੋਵੇ ਤਾਂ ਸਪਰੇਅ ਰੋਕ ਕੇ ਕਰੋ।`;
    } else if (language === "te") {
      if (text.includes("నీరు") || text.includes("పంట")) {
        return `వాతావరణ పరిస్థితుల ప్రకారం మీ ${cropHint} పంటకు ఉదయం వేళల్లో తేలికపాటి నీటిపారుదల అందించండి. ఎండ తీవ్రత ఉన్నప్పుడు నీరు పెట్టవద్దు.`;
      }
      return `మీ ${cropHint} పంటకు వాతావరణం అనుకూలంగా ఉంది. మందుల పిచికారీ సమయంలో గాలి వేగాన్ని గమనించండి.`;
    } else if (language === "ta") {
      if (text.includes("நீர்") || text.includes("பாசனம்")) {
        return `தற்போதைய வானிலைப்படி உங்கள் ${cropHint} பயிருக்கு காலை வேளையில் மிதமான நீர் பாய்ச்சவும். நண்பகல் வெயிலை தவிர்க்கவும்.`;
      }
      return `உங்கள் ${cropHint} பயிருக்கு வானிலை சீராக உள்ளது. காற்று அமைதியாக இருக்கும்போது உரம் இடவும்.`;
    } else if (language === "mr") {
      if (text.includes("पाणी") || text.includes("सिंचन")) {
        return `सद्य हवामानानुसार आपल्या ${cropHint} पिकाला सकाळी किंवा संध्याकाळी हलके पाणी द्यावे. दुपारच्या उन्हात पाणी देणे टाळावे.`;
      }
      return `आपल्या ${cropHint} पिकासाठी हवामान अनुकूल आहे. कीटकनाशक फवारणी करताना वाऱ्याचा वेग तपासावा.`;
    } else if (language === "bn") {
      if (text.includes("জল") || text.includes("সেচ")) {
        return `বর্তমান আবহাওয়া অনুযায়ী আপনার ${cropHint} ফসলে সকালের দিকে হালকা সেচ দিন। চড়া রোদে সেচ দেওয়া থেকে বিরত থাকুন।`;
      }
      return `আপনার ${cropHint} ফসলের জন্য পরিস্থিতি অনুকূল। শান্ত আবহাওয়ায় কীটনাশক বা সার প্রয়োগ করুন।`;
    }
    if (text.toLowerCase().includes("rain") || text.toLowerCase().includes("water")) {
      return `Current weather is ${weatherDescription}. Soil moisture is moderate. Schedule light irrigation for ${cropHint} in early morning or late afternoon.`;
    }
    return `Conditions for your ${cropHint} are stable. Monitor field drains and apply organic nutrients during calm hours.`;
  };

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    let botReply = "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          lang: language,
          crop_type: cropHint,
          weather_description: weatherDescription,
          previous_interaction_id: interactionId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.reply) {
          botReply = data.reply;
          if (data.interaction_id) {
            setInteractionId(data.interaction_id);
          }
        }
      }
    } catch {
      // Backend offline or timed out — fall back to local multilingual advisory
    } finally {
      clearTimeout(timeoutId);
    }

    if (!botReply) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      botReply = buildLocalFallbackReply(text);
    }

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: "bot",
      text: botReply,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, botMsg]);
    setIsTyping(false);

    if (voiceEnabled) {
      try {
        Speech.stop();
        Speech.speak(botReply, {
          language: speechLang,
          rate: 0.88,
          onError: () => {
            if (speechLang !== "en-IN" && speechLang !== "hi-IN") {
              Speech.speak(botReply, { language: "hi-IN", rate: 0.88 });
            }
          },
        });
      } catch {}
    }
  };

  const speakMessage = (text: string) => {
    try {
      Speech.stop();
      Speech.speak(text, {
        language: speechLang,
        rate: 0.88,
        onError: () => {
          if (speechLang !== "en-IN" && speechLang !== "hi-IN") {
            Speech.speak(text, { language: "hi-IN", rate: 0.88 });
          }
        },
      });
    } catch {}
  };

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      {/* Bot Header Card */}
      <BlurView intensity={35} tint="dark" style={styles.botBadgeContainer}>
        <View style={styles.botBadge}>
          <View style={styles.botAvatar}>
            <Ionicons name="chatbubbles" size={18} color="#818cf8" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.botTitle}>{t.botTitle}</Text>
              <View style={styles.onlineDot} />
            </View>
            <Text style={styles.botSubtitle}>{t.botStatus}</Text>
          </View>
        </View>
      </BlurView>

      {/* Quick Prompt Chips */}
      <View style={styles.chipRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={quickPrompts}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 2, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => sendMessage(item)} style={styles.chipBtn}>
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const isUser = item.sender === "user";
          return (
            <View
              style={[
                styles.messageRow,
                isUser ? styles.userRow : styles.botRow,
              ]}
            >
              {!isUser && (
                <View style={styles.botSmallIcon}>
                  <Ionicons name="leaf" size={12} color="#10b981" />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : styles.botBubble,
                ]}
              >
                <Text style={styles.bubbleText}>{item.text}</Text>
                <View style={styles.bubbleFooter}>
                  <Text style={styles.timestamp}>{item.time}</Text>
                  {!isUser && (
                    <Pressable
                      onPress={() => speakMessage(item.text)}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="volume-high-outline"
                        size={15}
                        color="#94a3b8"
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          isTyping ? (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color="#818cf8" />
              <Text style={styles.typingText}>
                {language === "hi"
                  ? "कृषि विशेषज्ञ उत्तर तैयार कर रहे हैं..."
                  : "AI Agronomist is thinking..."}
              </Text>
            </View>
          ) : undefined
        }
      />

      {/* Chat Input Bar */}
      <BlurView intensity={50} tint="dark" style={styles.inputBar}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={t.chatPlaceholder}
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.inputField}
          onSubmitEditing={() => sendMessage()}
        />

        {/* Mic action button */}
        <Pressable onPress={onOpenVoiceAssistant} style={styles.iconActionBtn}>
          <Ionicons name="mic" size={20} color="#a5b4fc" />
        </Pressable>

        {/* Send Button */}
        <Pressable
          onPress={() => sendMessage()}
          disabled={!inputText.trim()}
          style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
        >
          <Ionicons name="send" size={16} color="#ffffff" />
        </Pressable>
      </BlurView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 70,
  },
  botBadgeContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
  },
  botBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    gap: 12,
  },
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  botTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  botSubtitle: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 10,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  chipRow: {
    marginBottom: 10,
  },
  chipBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  chipText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    fontWeight: "500",
  },
  messageList: {
    paddingVertical: 6,
    gap: 12,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  userRow: {
    justifyContent: "flex-end",
  },
  botRow: {
    justifyContent: "flex-start",
  },
  botSmallIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "82%",
    padding: 13,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: "rgba(99, 102, 241, 0.5)",
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(165, 180, 252, 0.3)",
  },
  botBubble: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  bubbleText: {
    color: "#ffffff",
    fontSize: 13.5,
    lineHeight: 19,
  },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
    gap: 8,
  },
  timestamp: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 10,
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  typingText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    marginTop: 6,
  },
  inputField: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconActionBtn: {
    padding: 7,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
