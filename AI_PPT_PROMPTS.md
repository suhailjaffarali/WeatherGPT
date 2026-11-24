# WeatherGPT: AI Presentation Prompts (Slide-by-Slide)
## Ready-to-use prompts for Gamma, Canva AI, Beautiful.ai, ChatGPT, or Pitch

---

### Master Style & Theme Prompt (Paste this first or as Global Style)
```text
Design Style: Modern, clean, tech-forward agricultural theme.
Color Palette: Deep emerald green (#0F291E), vibrant agro-mint (#10B981), warm sunlight amber (#F59E0B), clean slate dark mode (#0F172A), and crisp white text.
Typography: Clean modern sans-serif (Inter / Plus Jakarta Sans). High contrast, professional presentation for academic evaluators.
Visual Elements: Glassmorphic cards, satellite/telemetry graphics, soil stratum diagrams, mobile device mockups, minimal clean iconography.
```

---

### Slide 1: Title & Introduction
- **Prompt:**
```text
Create a compelling title slide for an engineering capstone project.
Title: "WeatherGPT: AI-Powered Agricultural Weather & Farm Advisory System"
Subtitle: "Democratizing Precision Agriculture for Indian Smallholder Farmers with Hyperlocal Satellite Telemetry and Regional Voice AI"
Content:
- Project Category: AI, IoT Telemetry, Mobile Computing & Agritech
- Presented By: Team of 4 Final-Year Engineering Students
- Department: Department of Computer Science & Engineering
Visual: High-tech aerial imagery of Indian agricultural fields overlaid with subtle glowing digital weather grid lines and a floating mobile smartphone frame.
```

---

### Slide 2: The Core Problem & Motivation
- **Prompt:**
```text
Create a problem statement slide titled "The Climate Crisis in Rural Agriculture".
Split into 3 distinct problem cards with warning accents:
1. "The Hyperlocal Blindspot": Traditional forecasts operate at 50-100km radiuses. Weather variations across 2km can ruin a harvest.
2. "The Data vs. Action Gap": Meteorologists provide numbers ("VPD 2.4 kPa, humidity 72%"). Farmers need actionable decisions ("Should I irrigate today?").
3. "The Linguistic & Literacy Divide": Existing apps are English-centric and text-heavy, alienating rural farmers who communicate through spoken regional languages.
Stat Highlight Box: "58% of rural India depends on agriculture, yet over 70% of crop losses stem from unpredicted micro-climatic events."
Visual: Side-by-side comparison icon graphic showing complex meteorological charts crossed out vs a farmer confused in a field.
```

---

### Slide 3: The Solution — Introducing WeatherGPT
- **Prompt:**
```text
Create a product overview slide titled "WeatherGPT: Climate Intelligence Simplified".
Key Solution Pillars (3 Column Layout):
1. "Sub-Surface Telemetry": Tracks 5 layers of soil moisture (including 9-27cm root zone) + Vapour Pressure Deficit, not just surface air temperature.
2. "Deterministic Agronomy Engines": Color-coded actionable cards for Irrigation (Irrigate/Skip), Chemical Spraying (Safe/Delay), and Harvest Readiness (Ready/Hold).
3. "100% Regional Inclusivity": Complete end-to-end voice and text parity in 7 Indian languages (Hindi, Punjabi, Telugu, Tamil, Marathi, Bengali, English).
Visual: Clean mobile mockup showing the dark-mode glassmorphic interface with a large glowing microphone button and green/red status badges.
```

---

### Slide 4: System Architecture & Technology Stack
- **Prompt:**
```text
Create a technical architecture slide titled "Robust, Low-Latency System Architecture".
Show a 3-tier system diagram flow:
1. Client Tier (Mobile): React Native + Expo SDK 58, Expo-Speech (Zero-data native TTS), Expo-Location (GPS tracing), Dynamic Animated Weather Canvas.
2. Backend API Tier: FastAPI (Python 3.14 ASGI), Asynchronous non-blocking architecture, Pydantic data validation schemas.
3. Telemetry & Intelligence Tier:
   - Open-Meteo Satellite & Soil Telemetry (Zero API Key overhead)
   - Groq Cloud AI Engine (Qwen 2.5 / Llama 3) for lightning-fast sub-second agronomy queries
   - Deterministic offline rules fallback
Visual: Clean software architecture block diagram with glowing connecting arrows and modern tech logos (React, Python, FastAPI, Groq).
```

---

### Slide 5: The Science: Multi-Depth Soil Telemetry
- **Prompt:**
```text
Create an agronomy science deep-dive slide titled "Looking Beneath the Surface: Soil Telemetry".
Explain the scientific logic with 2 visual metric cards:
1. "Root-Zone Soil Moisture (9–27cm Depth)":
   - Why it matters: Topsoil dries fast under midday sun, but roots may be saturated.
   - Logic: >35% = Saturated (Skip irrigation, prevent root rot); <15% = Water stress (Immediate irrigation required); 15-35% = Optimal.
2. "Vapour Pressure Deficit (VPD) & Evapotranspiration":
   - Why it matters: When VPD > 2.0 kPa, plant stomata close. Spraying pesticide in this window burns crop leaves and wastes ₹3,000–₹8,000/acre in evaporated chemicals.
Visual: Diagram showing cross-section of soil layers (0-1cm topsoil vs 9-27cm plant root zone) with moisture percentage indicators.
```

---

### Slide 6: Intelligent Kisan Portal & Decision Engine
- **Prompt:**
```text
Create a feature showcase slide titled "The Kisan Portal: Telemetry to Actionable Decisions".
Highlight the 3 automated decision engines in high-contrast card UI:
1. 💧 "Irrigation Status": Evaluates root moisture + upcoming rain. Badge: [Irrigate] or [Skip].
2. 🌾 "Chemical & Fertilizer Spraying": Checks wind gusts + rainfall + VPD. Badge: [Safe to Spray] or [Delay Spraying].
3. 🚜 "Harvest Readiness": Cross-checks crop stage (Sowing/Vegetative/Harvest) against a 7-day storm horizon. Badge: [Harvest Ready] or [Hold].
Special Feature Callout: "🔊 Native Voice Readout": Every advisory is spoken aloud in the farmer's dialect at the tap of a button.
Visual: 3 glassmorphic cards with vibrant green checkmarks and amber warning icons as seen on a smartphone screen.
```

---

### Slide 7: Linguistic Inclusivity & Dynamic Visuals
- **Prompt:**
```text
Create an accessibility slide titled "Breaking Linguistic & Literacy Barriers".
Showcase 2 key innovation modules:
1. "7-Language Native Parity":
   - Supported: English, हिन्दी (Hindi), ਪੰਜਾਬੀ (Punjabi), తెలుగు (Telugu), தமிழ் (Tamil), मराठी (Marathi), বাংলা (Bengali).
   - Instant language switching across UI, telemetry data, and audio readouts.
2. "Fluid Weather Canvas":
   - Background dynamically reflects real outdoor atmospheric state (Sunny golden rays, rain streaks, storm lightning flashes, cloudy mist, snow particles).
   - Instant cognitive understanding even before reading a single word.
Visual: Grid showing language pills with Indian script typography and thumbnail preview of the 5 weather background animation styles.
```

---

### Slide 8: Real-Time Location Tracing & 12-Day Timeline
- **Prompt:**
```text
Create a feature slide titled "Hyperlocal GPS & Temporal Weather Intelligence".
Include 2 side-by-side modules:
1. "Instant GPS Tracing & Global Geocoding":
   - Auto-detects exact field coordinates via device GPS.
   - Open-Meteo Geocoding search lets farmers inspect any mandi, taluka, or village worldwide.
2. "12-Day Weather Continuum (Past 5 Days + Future 7 Days)":
   - Past 5 Days: Tracks historical precipitation so farmers don't over-water after recent rains.
   - Future 7 Days: Predictive temperature caps and precipitation probabilities for seasonal planning.
Visual: Mobile screen displaying the interactive location search modal and the toggleable 5-day past / 7-day forecast timeline table.
```

---

### Slide 9: AI Safety, Reliability & Fallback Architecture
- **Prompt:**
```text
Create an AI safety and ethics slide titled "Engineering Responsible AI for High-Stakes Agriculture".
Highlight 4 critical safety guardrails:
1. "Deterministic Circuit Breakers": High-risk decisions (irrigation and chemical spraying) are governed by strict mathematical thresholds before consulting the LLM.
2. "Strict Prompt Grounding": The AI model is strictly bounded by live sensor telemetry—it cannot hallucinate weather numbers or invented dosages.
3. "Graceful Offline Degradation": If cloud inference drops or API limits occur, the app switches to offline local agronomist rule sets without crashing.
4. "Mandatory IMD Safety Disclaimer": Prominent safety banner on every screen advising consultation of official IMD alerts for natural disasters.
Visual: Shield icon with safety checkmarks and a dual-layer diagram (Mathematical Rules Barrier -> LLM Explanation Layer).
```

---

### Slide 10: Social Impact & Future Roadmap
- **Prompt:**
```text
Create a visionary conclusion slide titled "Impact & Future Horizons".
Two Column Layout:
Left Column: "Measurable Rural Impact":
- Water Conservation: Up to 25% reduction in agricultural groundwater pumping.
- Economic Savings: Prevents wasted chemical applications saving ₹3,000–₹8,000 per acre.
- Digital Inclusion: Brings precision agronomy to non-English-speaking smallholders.
Right Column: "Future Roadmap":
- Phase 1: Physical IoT LoRaWAN soil-probe hardware deployed in college test plots.
- Phase 2: Computer Vision Leaf Disease Scanner powered by edge vision models.
- Phase 3: Bidirectional conversational streaming using Gemini Live API.
Callout at bottom: "Thank you! Open for Questions & Live Demonstration."
Visual: Inspiring visual of an Indian farmer smiling in a lush green field holding a smartphone, with modern futuristic technology overlays.
```
