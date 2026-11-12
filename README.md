# 🛠️ Service Team Troubleshooting Tools
### L2/L3 VoIP Forensics, Network Diagnostics & Audio Impairment Lab

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-33.4-47848F.svg)](https://www.electronjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-Passing-success.svg)](https://github.com/)

---

## 📖 Overview

**Service Team Troubleshooting Tools** is a comprehensive, modular diagnostic workbench designed specifically for **Tier-2 / Tier-3 Technical Support Engineers, Network Operations Center (NOC) teams, and VoIP Specialists**.

Troubleshooting VoIP incidents (such as 30-second call drops, one-way audio, codec negotiation failures, and intermittent voice jitter) often requires juggling multiple disjointed utilities—raw JSON webhooks, Wireshark packet captures, traceroute terminals, and manual MOS calculations.

This workbench consolidates all of these critical capabilities into a single, cohesive desktop and web application with **zero cloud dependencies** for sensitive data:
- **100% Client-Side PCAP Dissection**: Binary packet captures are parsed locally using native `ArrayBuffer` and `DataView` primitives. Audio and SIP signaling never leave your computer.
- **Automated Root-Cause Correlation**: Instant defect detection mapping directly to ITU-T standards, Q.850 cause codes, and RFC 3261 specifications.
- **Dual-Trace Demarcation Pinpointing**: Compare Customer LAN vs Provider SBC captures side-by-side to definitively prove whether a drop occurred inside the customer's firewall or on the carrier WAN.
- **Real-Time Voice Impairment Synthesis**: Demonstrate live packet loss, jitter, and codec degradation to non-technical customers using the Web Audio API.

> 📚 **Complete Standard Operating Procedure**: For the full, step-by-step VoIP defect resolution matrix, packet capture recipes, and customer communication templates, refer to [docs/OPERATIONS_GUIDELINES.md](docs/OPERATIONS_GUIDELINES.md).

---

## 🚀 Key Modules & Capabilities

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           L2 SUPPORT WORKBENCH                                   │
├───────────────┬──────────────────┬─────────────────┬──────────────┬──────────────┤
│ 📊 Dashboard  │ 📞 Call Forensics│ 🌐 Network Diag │ 📁 Case Hub  │ 🎧 Voice Sim │
├───────────────┴──────────────────┴─────────────────┴──────────────┴──────────────┤
│ 🔍 PCAP Analyzer (Ladder Flow • RTP Streams • Demarc Diff • Capture Recipes)     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1. 🔍 PCAP & Packet Capture Analyzer (`pcap-analyzer`)
- **Native Binary Libpcap / PCAP Dissector**: Ingests `.pcap` files directly in the browser/Electron process with zero external dependencies (no Wireshark binary needed).
- **Interactive SIP Ladder Sequence Diagram**:
  - Full ladder flow visualization mapping User Agents, Proxies, and SBCs.
  - Inspect detailed SIP headers, CSeq, Call-ID, Via, Contact, SDP negotiation, and payload bodies.
  - Distinct color-coded message types (INVITE, 100 Trying, 180 Ringing, 200 OK, ACK, BYE, 4xx/5xx Errors).
- **RTP Media Stream Telemetry**:
  - Automatically identifies SSRC identifiers, payload types, and audio codecs (PCMU, PCMA, G.729, Opus).
  - Calculates bidirectional packet loss percentage, continuous sequence number loss, and interarrival jitter.
  - Instant **One-Way Audio Defect Flag** when reverse audio stream is absent.
- **Automated Root Cause Analysis (RCA) Engine**:
  - Pre-programmed detection for **Missing SIP ACK (30s timeout drop)**, **SIP 488 Codec Mismatch**, **SIP 404 Route Congestion / Asterisk Failures**, and **RTP stream blocking**.
  - Provides clear diagnostic badges, culprit node identification, and actionable remediation steps.
- **Dual-Trace Demarcation Comparison Engine (A/B Diff)**:
  - Ingest two simultaneous traces: **Trace A** (*Customer LAN / Handset*) vs **Trace B** (*Provider Core SBC*).
  - Correlates sessions across NAT firewalls, computes packet-by-packet one-way transit delta ($\Delta t$), and detects dropped packets (e.g. SIP ACK leaving the phone but never reaching the SBC).
  - Generates definitive verdict: `BOUNDARY_DROP_CONFIRMED (CUSTOMER_PREMISE_FIREWALL)`.
- **Capture Readiness Auditor & 1-Click Recipe Generator**:
  - Analyzes uploaded traces across 4 planes: Signaling Plane, Media Plane, Telemetry Plane, and Packet Integrity.
  - Assigns an audit score (0–100) and letter grade (`EXCELLENT`, `GOOD`, `PARTIAL`, `DEFICIENT`).
  - Pre-flight capture checklist and 1-click sniffer command presets for **Linux SBC (`tcpdump`)**, **Asterisk / FreePBX**, **FreeSWITCH**, **MikroTik RouterOS**, **Cisco IOS**, and **Wireshark**.
- **Endpoint IP Role & Alias Annotator**:
  - Tag raw IP addresses (e.g. `10.0.8.2` $\to$ `Customer PBX`, `203.0.113.88` $\to$ `Provider Core SBC`).
  - Aliases immediately reflect on ladder diagrams and exported investigation reports.

---

### 2. 📞 VoIP Call Quality & Telemetry Forensics (`call-forensics`)
- **Dynamic Webhook / Raw JSON Ingestion**: Ingest CPaaS transaction logs and call webhooks (including B3 Networks `universalEvent` payloads).
- **Hop-by-Hop Topology Reconstruction**:
  - Maps complete signaling path: `Caller ➔ Ingress SBC ➔ CPaaS Engine ➔ Forked Endpoints`.
  - Distinguishes Call Direction: **INBOUND** vs **OUTBOUND**.
  - Pinpoints the **Culprit Hop** responsible for degradation or failure.
- **Forked Branch Analysis (Parallel Ringing)**:
  - Dissects multi-device ring groups (e.g. Callee Desktop WebRTC vs Callee Mobile App vs Hardware IP Phone).
  - Distinguishes between winner branch (`ANSWERED`), user rejection (`PRIMARY_REFUSAL - 486 Busy`), sibling cancellation (`CANCELLED_BY_FORK - 487`), and route congestion (`SIP 404`).
- **Directional QoS Telemetry**:
  - Isolates Upstream (Tx) vs Downstream (Rx) packet loss and jitter.
  - Automatically identifies microphone hardware mute vs network-level RTP stream block.
- **Customer Symptom Correlation Engine**:
  - Automatically compares customer complaints against telemetry realities:
    - Customer reports *~30s drop* $\to$ Matches ACK/NAT stateful firewall timeout defect.
    - Customer reports *~15m drop* $\to$ Matches SIP Session Timer (RFC 4028) refresh failure.
    - Customer reports *dropped call* on a call with Q.850 Cause 16 $\to$ Flags **Discrepancy: Normal User Hangup**.
- **Executive Dossier Generator**:
  - Generates ready-to-send technical explanations and customer-friendly summaries in professional English.

---

### 3. 🎧 Voice Quality & Audio Impairment Simulator (`voice-simulator`)
- **Interactive ITU-T E-Model (G.107) Engine**:
  - Calculates Transmission Rating Factor ($R$) and Mean Opinion Score ($MOS$ from 1.0 to 4.5).
  - Models equipment impairment factors ($I_e$), codec robustness, packet loss degradation, and round-trip delay penalty ($I_d$).
- **Live Real-Time Audio Impairment Engine (Web Audio API)**:
  - Synthesizes audio in real-time (Choose between Test Tone, Synthesized Speech, or Audio Samples).
  - Introduces dynamic **Packet Loss (0–30%)**, **Jitter Buffer Variance (0–300ms)**, and **Latency (0–1000ms)**.
  - Real-time audible emulation of packet drop pops, robotic clipping, and buffer underruns.
- **Codec Comparison & Bandwidth Calculator**:
  - Real-time comparison between **G.711 (PCMU/PCMA)**, **G.729 (8 kbps CS-ACELP)**, and **Opus (Adaptive with FEC)**.
  - Computes single-stream and concurrent duplex bandwidth requirements in kbps.
- **One-Click Real-World Scenarios**:
  - *Pristine Office Fiber (LAN)*: MOS 4.39 (0% loss, 1ms jitter)
  - *Crowded Office Wi-Fi*: MOS 2.67 (4.5% loss, 75ms jitter, high congestion)
  - *Mobile 4G/LTE Hotspot*: MOS 4.13 (0.8% loss, 18ms jitter)
  - *Throttled Home ISP*: MOS 1.15 (18% loss, 180ms jitter)
  - *International Long Haul (SG ➔ US)*: MOS 3.89 (210ms latency)

---

### 4. 🌐 Network Diagnostics & Globalping Lab (`network-diagnostics`)
- **Global Probe Measurements**:
  - Execute live network tests from over 500+ probes globally or targeted from specific regions/ASNs using the Globalping API.
  - Run **Ping**, **Traceroute**, **MTR**, **DNS Resolution**, and **HTTP/HTTPS** tests.
- **VoIP Edge SBC Benchmarking**:
  - Test round-trip latency and packet loss directly against carrier SIP proxies and media gateways.
  - Identify inter-country routing inefficiencies, peering transit congestion, and high-latency ISP hops.
- **Copyable Terminal Output**:
  - Formatted CLI-style terminal view for immediate pasting into customer tickets or NOC escalations.

---

### 5. 📁 Investigation Center & Case Hub (`investigation-center`)
- **Central Incident Management**:
  - Manage active troubleshooting cases with SLA indicators, priority badges, and customer identity tags.
- **1-Click Escalation Forwarding**:
  - Forward findings directly from the **Call Forensics** module or **PCAP Analyzer** into an investigation case.
  - Automatically compiles session telemetry, sequence flows, MOS calculations, and culprit hop isolation into the case record.
- **Diagnostic Decision Trees**:
  - Guided step-by-step troubleshooting workflows for standard VoIP issues (Registration failure, One-way audio, DTMF drop, Early disconnect).
- **Comprehensive Dossier Export**:
  - Export complete forensic evidence packages to **Markdown** or **JSON** for ticketing systems (Zendesk, Jira, ServiceNow).

---

### 6. 📊 Executive Dashboard (`dashboard`)
- Consolidated overview of active platform health, recent investigations, quick-access forensic actions, and direct links to all analytical modules.

---

## 💻 Installation & Setup

### Prerequisites
- **Node.js**: Version 18.x or 20.x+
- **npm**: Version 9.x or higher

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/your-org/service-team-troubleshooting-tools.git
cd service-team-troubleshooting-tools
npm install
```

### 2. Running in Web Development Mode (Vite)
Starts the local development server in the browser:
```bash
npm run dev
```
Open [http://localhost:5199](http://localhost:5199) in your browser.

### 3. Running in Desktop Electron Mode
Starts the full native desktop application with window frame and local IPC bridge:
```bash
npm run electron:dev
```

### 4. Running the Complete Automated Test Suite
Executes the comprehensive unit and integration test suite across all engines:
```bash
npm test
```
The test suite verifies:
- Call quality classification and hop topology extraction
- Customer symptom matching and discrepancy detection
- Binary libpcap parsing and RTP packet extraction
- Dual-trace demarcation correlation and fault isolation
- Capture readiness auditor and scoring
- Voice quality ITU-T G.107 MOS calculations

### 5. Production Build
Compile TypeScript and generate optimized Vite bundles and Electron main/preload binaries:
```bash
npm run build
```

### 6. Packaging Executables (macOS, Windows, Linux)
Build native standalone desktop distributables:
```bash
npm run electron:build
```
Binaries will be output to the `release/` directory:
- **macOS**: `.dmg` and `.zip` (Universal / Apple Silicon & Intel)
- **Windows**: `.exe` / NSIS installer (when configured)
- **Linux**: `.AppImage` / `.deb` (when configured)

---

## 📖 Step-by-Step User Guide

### Scenario 1: Troubleshooting a ~30-Second Call Drop (Missing SIP ACK)

#### Problem
A customer reports: *"Our calls drop after talking for exactly 30 seconds."*

#### Steps:
1. Open the **PCAP Analyzer** tab.
2. In the top bar, click the preset **"30s Drop (ACK Timeout)"** (or upload the customer's `.pcap` file).
3. Review the **Overview Card**:
   - Status will show `REJECTED` or `FAILED`.
   - The RCA banner will flag: **CRITICAL DEFECT: 30-Second Call Drop (Missing SIP ACK)**.
4. Switch to **Tab 1: SIP Ladder Sequence Flow**:
   - Notice the PBX sends `200 OK`, but repeats it 7 times before issuing a `BYE`.
   - There is no `ACK` received by the SBC.
5. Switch to **Tab 4: Dual-Trace Demarcation (A/B Diff)**:
   - Click **"Load Sample Demarcation Pair"** (comparing Customer LAN trace vs Provider SBC trace).
   - Notice that on the **Customer LAN trace**, the IP phone sent the `ACK` at $t=50.518\text{s}$.
   - On the **Provider SBC trace**, the `ACK` is flagged in red: **DROPPED AT BOUNDARY**.
   - Fault Domain: **CUSTOMER_PREMISE_FIREWALL**.
6. Switch to **Tab 5: Capture Toolkit**:
   - Review recommended actions: *Disable SIP ALG on the customer gateway router and check firewall UDP session timeout.*
7. Click **"Forward to Investigation Center"** to create a formal customer ticket dossier.

---

### Scenario 2: Investigating a Customer Complaint of "Call Dropped" that was Normal Hangup

#### Problem
Customer submits an urgent ticket: *"My call dropped abruptly after 55 seconds!"*

#### Steps:
1. Open the **Call Forensics** tab.
2. Paste the transaction JSON or load the preset **"Sample Call"**.
3. Observe the **Symptom Correlation Badge**:
   - Displays: **DISCREPANCY: NORMAL USER HANGUP**.
   - Explanation: The call was cleanly terminated by the remote party (Callee) using `Q.850 Cause 16: Normal call clearing`.
4. Review the **Hop Chain**:
   - Culprit hop is marked `NONE (NORMAL)`.
   - Audio quality throughout the 55s call was pristine (MOS 4.40, Rx/Tx Loss 0.0%).
5. Copy the generated **Customer-Facing Explanation**:
   - Paste the ready-to-send English explanation template into the support ticket to reassure the customer that the call was hung up normally by the other party and network quality was nominal.

---

### Scenario 3: Investigating One-Way Audio Complaints

#### Problem
Customer states: *"I can hear the caller, but they cannot hear me."*

#### Steps:
1. In **PCAP Analyzer**, upload the call capture or select preset **"One-Way Audio"**.
2. Switch to **Tab 2: RTP Media Streams**:
   - Stream 1 (`Caller -> Callee`) is active with 1,200 packets and 0.0% loss.
   - Stream 2 (`Callee -> Caller`) shows **0 packets received / missing**.
   - Badge flags: **CRITICAL: ONE-WAY AUDIO DETECTED**.
3. Check the **Sip Ladder**:
   - Inspect the SDP in the `200 OK`. Verify whether the media IP is set to a private RFC 1918 address (e.g. `192.168.1.50`) instead of a public IP, indicating an asymmetric NAT routing or symmetric firewall block.

---

### Scenario 4: Demonstrating Wi-Fi Jitter to a Customer (Voice Simulator)

#### Problem
A customer using softphones over congested office Wi-Fi blames the VoIP platform for "robotic sound".

#### Steps:
1. Open the **Voice Simulator** tab.
2. Under Presets, select **"Crowded Office Wi-Fi"**.
3. Observe the calculated MOS: **2.67 (Fair / Annoying Impairments)** with 4.5% packet loss and 75ms jitter.
4. Click **"▶ Play Audio Simulation"**:
   - Let the customer hear the difference between **Pristine Fiber (MOS 4.39)** and **Crowded Wi-Fi (MOS 2.67)**.
5. Switch the Codec dropdown to **Opus (Adaptive + FEC)**:
   - Notice how Opus recovers quality to MOS 3.96 even under 4.5% loss due to forward error correction.
6. Share the generated network recommendation: *Switch agent desktops to wired Ethernet cables (Cat5e/Cat6) or enable QoS 802.1p/DiffServ prioritization on Wi-Fi APs.*

---

## 📂 Project Architecture

```
service-team-troubleshooting-tools/
├── electron/                         # Native Electron backend & IPC handlers
│   ├── main.ts                       # Main process lifecycle, windows, Globalping proxy
│   ├── preload.ts                    # Secure contextBridge API exposure
│   └── b3InboxService.ts             # B3 Networks ticket & inbox integration
├── src/
│   ├── modules/                      # Modular application architecture
│   │   ├── dashboard/                # Central KPI overview & navigation
│   │   ├── call-forensics/           # Webhook & transaction JSON diagnostics
│   │   │   ├── components/           # Hop chain, forked branches, dossier cards
│   │   │   └── services/             # Topology builder, Q.850 cause mapper
│   │   ├── network-diagnostics/      # Globalping probe runner & terminal UI
│   │   ├── investigation-center/     # Case management & decision trees
│   │   ├── voice-simulator/          # ITU-T G.107 MOS & Web Audio synthesizer
│   │   │   └── services/             # E-model calculator & audio engine
│   │   ├── pcap-analyzer/            # Binary packet capture diagnostics
│   │   │   ├── components/           # Ladder flows, RTP charts, Demarc views
│   │   │   └── services/
│   │   │       ├── pcapParser.ts     # Client-side binary libpcap & SIP/RTP parser
│   │   │       ├── pcapPresets.ts    # Preset PCAP scenarios & demo traces
│   │   │       ├── dualTraceComparator.ts # A/B Demarcation correlation engine
│   │   │       └── captureToolkit.ts # Readiness auditor & sniffer command recipes
│   │   └── settings/                 # App preferences & API configurations
│   ├── shared/                       # Shared context, UI primitives & navigation
│   ├── tests/                        # Comprehensive unit & integration tests
│   │   ├── callQualityService.test.ts
│   │   ├── investigationDecisionEngine.test.ts
│   │   ├── globalpingService.test.ts
│   │   ├── customerDiagnosticService.test.ts
│   │   ├── voiceQualityCalculator.test.ts
│   │   └── pcapParser.test.ts
│   ├── App.tsx                       # Root container preserving tab states
│   └── main.tsx                      # Vite React entrypoint
├── package.json                      # Scripts, dependencies, and build metadata
├── tailwind.config.js                # Theme & VoIP status color palette
└── tsconfig.json                     # Strict TypeScript configuration
```

---

## 🔒 Security, Privacy & Sandboxing

- **Zero Cloud PCAP Processing**: Unlike online packet analyzers, all PCAP parsing is executed purely on the user's local machine inside the browser/Electron runtime memory using typed arrays (`Uint8Array`, `DataView`). No packet bytes, SIP authentication credentials, or voice payloads are ever uploaded to any third-party server.
- **Sandboxed Electron Execution**: The desktop application runs with `contextIsolation: true`, `nodeIntegration: false`, and an isolated `preload.ts` bridge to protect your local environment.
- **Privacy-Preserving Reporting**: When exporting reports, sensitive private IP addresses can be replaced with custom aliases using the built-in **IP Role Annotator**.

---

## 🤝 Contributing & Maintenance

1. When adding new SIP defect rules, add the scenario to `pcapPresets.ts` and write corresponding assertions in `src/tests/pcapParser.test.ts`.
2. Ensure all unit tests pass before submitting code:
   ```bash
   npm test
   ```
3. Ensure the production build succeeds without TypeScript compiler warnings:
   ```bash
   npm run build
   ```

---

## 📄 License
Internal Technical Support & Service Operations Tool. Copyright © 2026 Service Operations Team. All rights reserved.
