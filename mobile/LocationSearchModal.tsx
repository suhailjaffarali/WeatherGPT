import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { getTranslation } from "./translations";

export interface SelectedLocation {
  name: string;
  lat: number;
  lon: number;
  isGps?: boolean;
}

interface GeocodingResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

const POPULAR_LOCATIONS: SelectedLocation[] = [
  { name: "Nagpur, Maharashtra", lat: 21.1458, lon: 79.0882 },
  { name: "Ludhiana, Punjab", lat: 30.901, lon: 75.8573 },
  { name: "Guntur, Andhra Pradesh", lat: 16.3067, lon: 80.4365 },
  { name: "Thanjavur, Tamil Nadu", lat: 10.787, lon: 79.1378 },
  { name: "Bardhaman, West Bengal", lat: 23.2324, lon: 87.8615 },
  { name: "New Delhi, India", lat: 28.6139, lon: 77.209 },
  { name: "Mumbai, Maharashtra", lat: 19.076, lon: 72.8777 },
  { name: "London, UK", lat: 51.5074, lon: -0.1278 },
];

export default function LocationSearchModal({
  visible,
  onClose,
  onSelectLocation,
  onUseGps,
  isTracingGps,
  language = "en",
}: {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (loc: SelectedLocation) => void;
  onUseGps: () => void;
  isTracingGps: boolean;
  language?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);

  const t = getTranslation(language);

  const handleSearch = async (text: string) => {
    setQuery(text);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchedOnce(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          trimmed
        )}&count=8&language=en&format=json`
      );
      if (res.ok) {
        const json = await res.json();
        setResults(Array.isArray(json.results) ? json.results : []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setSearchedOnce(true);
    }
  };

  const handlePickResult = (item: GeocodingResult) => {
    const parts = [item.name, item.admin1, item.country].filter(Boolean);
    onSelectLocation({
      name: parts.slice(0, 2).join(", "),
      lat: item.latitude,
      lon: item.longitude,
      isGps: false,
    });
    setQuery("");
    setResults([]);
    setSearchedOnce(false);
    onClose();
  };

  const handlePickPreset = (loc: SelectedLocation) => {
    onSelectLocation({ ...loc, isGps: false });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <BlurView intensity={75} tint="dark" style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t.chooseLocation}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#ffffff" />
            </Pressable>
          </View>

          {/* GPS Trace Button */}
          <Pressable
            onPress={() => {
              onUseGps();
              onClose();
            }}
            style={styles.gpsBtn}
          >
            {isTracingGps ? (
              <ActivityIndicator size="small" color="#c7d2fe" />
            ) : (
              <Ionicons name="navigate" size={18} color="#818cf8" />
            )}
            <Text style={styles.gpsBtnText}>{t.useCurrentGps}</Text>
          </Pressable>

          {/* Search Input */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.45)" />
            <TextInput
              value={query}
              onChangeText={handleSearch}
              placeholder={t.searchLocation}
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setResults([]);
                  setSearchedOnce(false);
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color="rgba(255,255,255,0.45)"
                />
              </Pressable>
            )}
          </View>

          {/* Search Results or Popular Cities */}
          {searching ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color="#818cf8" />
            </View>
          ) : query.trim().length >= 2 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchedOnce ? (
                  <Text style={styles.emptyText}>{t.noLocationsFound}</Text>
                ) : undefined
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handlePickResult(item)}
                  style={styles.resultRow}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color="#a5b4fc"
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultSub}>
                      {[item.admin1, item.country].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color="rgba(255,255,255,0.3)"
                  />
                </Pressable>
              )}
            />
          ) : (
            <FlatList
              data={POPULAR_LOCATIONS}
              keyExtractor={(item) => item.name}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handlePickPreset(item)}
                  style={styles.resultRow}
                >
                  <Ionicons
                    name="pin-outline"
                    size={18}
                    color="#94a3b8"
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.resultName}>{item.name}</Text>
                </Pressable>
              )}
            />
          )}
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "78%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(99, 102, 241, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.5)",
    marginBottom: 14,
  },
  gpsBtnText: {
    color: "#e0e7ff",
    fontSize: 14,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
  },
  centerBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 24,
    fontSize: 13,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  resultName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  resultSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
});
