# 📘 VoIP Troubleshooting & Operations Field Guidelines
### Standard Operating Procedure (SOP) & Diagnostic Manual for Service Teams

---

## 📑 Table of Contents
1. [Purpose & Scope](#1-purpose--scope)
2. [Golden Troubleshooting Workflow (The 6-Stage SOP)](#2-golden-troubleshooting-workflow-the-6-stage-sop)
3. [Master VoIP Symptom, Defect & Resolution Playbook](#3-master-voip-symptom-defect--resolution-playbook)
   - [3.1. Exactly ~30-Second Call Drop (Missing SIP ACK / NAT Timeout)](#31-exactly-30-second-call-drop-missing-sip-ack--nat-timeout)
   - [3.2. Exactly ~15-Minute Call Drop (SIP Session Timer Expiry - RFC 4028)](#32-exactly-15-minute-call-drop-sip-session-timer-expiry---rfc-4028)
   - [3.3. One-Way Audio / Dead Air (Asymmetric NAT & Port Blocking)](#33-one-way-audio--dead-air-asymmetric-nat--port-blocking)
   - [3.4. Choppy, Robotic or Muffled Voice (Jitter & Packet Loss)](#34-choppy-robotic-or-muffled-voice-jitter--packet-loss)
   - [3.5. Call Fails Immediately: SIP 488 Not Acceptable Here (Codec Mismatch)](#35-call-fails-immediately-sip-488-not-acceptable-here-codec-mismatch)
   - [3.6. Call Fails Immediately: SIP 404 Not Found (Routing / PBX Dialplan)](#36-call-fails-immediately-sip-404-not-found-routing--pbx-dialplan)
   - [3.7. Call Disconnected: SIP 486 Busy Here vs SIP 487 Request Terminated](#37-call-disconnected-sip-486-busy-here-vs-sip-487-request-terminated)
   - [3.8. Customer Claims "Dropped Call" on Normal Hangup (Q.850 Cause 16)](#38-customer-claims-dropped-call-on-normal-hangup-q850-cause-16)
4. [Packet Capture (PCAP) Forensic Standards & Sniffer Handbook](#4-packet-capture-pcap-forensic-standards--sniffer-handbook)
   - [4.1. Capture Readiness Scoring & Audit Rules](#41-capture-readiness-scoring--audit-rules)
   - [4.2. Exact Sniffer Commands by Platform](#42-exact-sniffer-commands-by-platform)
   - [4.3. Dual-Trace Demarcation (A/B) Methodology](#43-dual-trace-demarcation-ab-methodology)
5. [Voice Quality Impairment & E-Model Simulation Guide](#5-voice-quality-impairment--e-model-simulation-guide)
6. [Customer Communication & Field Incident Templates (EN & ID)](#6-customer-communication--field-incident-templates-en--id)
7. [Escalation Matrix & Tier Handover Checklist](#7-escalation-matrix--tier-handover-checklist)

---

## 1. Purpose & Scope

This manual establishes the authoritative standard operating procedure for Tier-1, Tier-2, and Tier-3 Service Operations Engineers using the **Service Team Troubleshooting Tools** workbench. 

### Core Objectives
1. **Accelerate Mean Time to Resolution (MTTR)**: Reduce complex VoIP diagnostic cycles from hours to under 5 minutes.
2. **Definitive Demarcation Isolation**: Objectively prove whether an issue resides on the **Customer Premise LAN / Firewall**, the **Core CPaaS / PBX Engine**, or the **Upstream Telco Carrier**.
3. **Prevent Disputed Tickets**: Provide irrefutable, data-backed evidence when customers report perceived platform issues that are caused by local Wi-Fi, remote party hangup, or firewall misconfigurations.
4. **Data Privacy**: Ensure all PCAP captures and sensitive client telemetries are analyzed strictly locally without uploading to external cloud services.

---

## 2. Golden Troubleshooting Workflow (The 6-Stage SOP)

When an incident is reported, engineers must follow the structured 6-stage investigation process:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      THE 6-STAGE INVESTIGATION WORKFLOW                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  [Stage 1] Intake & Triage                                                   │
│     │      • Gather Call-ID, Exact Timestamps, Calling/Called Numbers        │
│     ▼                                                                        │
│  [Stage 2] Telemetry Ingestion (Call Forensics)                              │
│     │      • Ingest Transaction JSON / Webhook Event                         │
│     │      • Check Hop-by-Hop Topology & Culprit Hop Identification          │
│     ▼                                                                        │
│  [Stage 3] Symptom Correlation & Discrepancy Check                           │
│     │      • Compare reported issue vs Q.850 cause codes and duration        │
│     │      • Determine if customer complaint matches telemetry reality       │
│     ▼                                                                        │
│  [Stage 4] Deep Packet Forensics (PCAP Analyzer)                             │
│     │      • Dissect SIP Ladder Sequence Flow & CSeq handshakes              │
│     │      • Inspect Bidirectional RTP streams & SSRC continuity             │
│     │      • Run Dual-Trace Demarcation Diff if boundary drop is suspected   │
│     ▼                                                                        │
│  [Stage 5] Network Verification (Network Diagnostics / Globalping)           │
│     │      • Run Traceroute / MTR to customer gateway & edge SBC             │
│     │      • Validate packet loss, jitter buffer spikes, and route hops      │
│     ▼                                                                        │
│  [Stage 6] Dossier Creation & Customer Delivery                              │
│            • Forward case to Investigation Center                            │
│            • Generate customer communication & technical explanations        │
│            • Export Markdown/PDF forensic dossier for ticket closure         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Master VoIP Symptom, Defect & Resolution Playbook

### 3.1. Exactly ~30-Second Call Drop (Missing SIP ACK / NAT Timeout)

#### The Symptom
Calls connect successfully, audio flows in both directions, but the call disconnects abruptly at **29–32 seconds**.

#### The Underlying Protocol Mechanics
1. Caller sends `INVITE`.
2. Callee answers with `200 OK` (containing media SDP).
3. The SIP RFC 3261 specification requires the Caller to return an `ACK` message directly to confirm the `200 OK`.
4. If a stateful NAT firewall or SIP ALG modifies or drops the `ACK`, the answering endpoint never receives it.
5. The answering endpoint enters a retransmission state: it retransmits the `200 OK` 7 to 10 times over 30 seconds.
6. When Timer H / Timer B expires (32 seconds), the answering endpoint concludes the session failed and terminates the call with a `BYE` or `CANCEL`.

#### Diagnosis in the Tool
1. In **PCAP Analyzer**, open the capture.
2. In **Tab 1 (SIP Ladder)**: Look for repeated `200 OK` messages spaced 500ms, 1s, 2s, 4s apart. Note the missing `ACK` before the `BYE`.
3. In **Tab 4 (Dual-Trace Demarcation Diff)**: Ingest Trace A (Customer Phone) and Trace B (Provider SBC). The tool will flag:
   - Trace A: `ACK` transmitted at $t=0.518\text{s}$.
   - Trace B: `DROPPED AT BOUNDARY`.
   - Verdict: `BOUNDARY_DROP_CONFIRMED` $\to$ `CUSTOMER_PREMISE_FIREWALL`.

#### Remediation Steps
1. **Disable SIP ALG** on the customer router/firewall (Asus, Fortinet, SonicWall, Cisco, MikroTik).
2. Set UDP connection keepalive/session timeout to at least **180 seconds** on the customer perimeter firewall.
3. If using hardphones on private LAN, configure SIP outbound proxy with Keep-Alive options (`OPTIONS` ping or STUN).

---

### 3.2. Exactly ~15-Minute Call Drop (SIP Session Timer Expiry - RFC 4028)

#### The Symptom
Long calls consistently drop at exactly **15 minutes (900 seconds)** or **30 minutes (1800 seconds)**.

#### The Underlying Protocol Mechanics
- RFC 4028 establishes periodic `re-INVITE` or `UPDATE` messages during active calls to verify both endpoints are still reachable.
- If the customer router has a short UDP NAT mapping timeout (e.g. 300 seconds), idle signaling ports close while audio continues.
- When the 15-minute Session-Expires timer arrives, the session refresh `re-INVITE` fails with no response or receives `481 Call/Transaction Does Not Exist`.
- The SBC automatically releases the call with a `BYE`.

#### Diagnosis in the Tool
- In **Call Forensics**: Symptom correlation highlights: `MATCHED_DEFECT: 15m Session Refresh Timeout`.
- Duration displays `15m 00s (900s)`.
- Directional QoS metrics prior to drop show normal MOS and 0% packet loss.

#### Remediation Steps
1. Enable SIP Keep-Alive (`NAT Keepalive = 15s` or `30s`) in endpoint provisioning.
2. Verify customer firewall maintains UDP port associations for active SIP dialogs for $\ge 3600\text{s}$.

---

### 3.3. One-Way Audio / Dead Air (Asymmetric NAT & Port Blocking)

#### The Symptom
Party A speaks and is heard by Party B, but Party B’s voice is completely silent to Party A (or both hear dead air).

#### The Underlying Protocol Mechanics
- SIP signaling establishes connection on port 5060, but voice media is transmitted over separate dynamic UDP ports (typically 10000–30000).
- Common Causes:
  1. **Private IP in SDP**: Endpoint puts RFC 1918 private address (e.g., `c=IN IP4 192.168.1.105`) into SDP instead of public IP, causing audio to be routed to a black hole.
  2. **Asymmetric Egress Filtering**: Firewall allows outbound audio but blocks inbound UDP media ports.
  3. **Local Microphone Hardware Mute**: OS audio device permission failure or hardware mute.

#### Diagnosis in the Tool
1. In **Call Forensics**: Check Directional Telemetry.
   - If Party A Tx is 0.0% loss and Party B Rx is 100% loss $\to$ **Microphone Stream Blocked**.
2. In **PCAP Analyzer (Tab 2: RTP Streams)**:
   - Exactly 1 RTP stream present instead of 2.
   - Badge flags: `CRITICAL: ONE-WAY AUDIO DETECTED`.
3. In **PCAP Analyzer (Tab 1: SIP Ladder)**:
   - Check SDP `connectionIp` on the `INVITE` and `200 OK`. If it contains an unroutable IP (`192.168.x.x` or `10.x.x.x`) without symmetric RTP latching, one-way audio is guaranteed.

#### Remediation Steps
1. Ensure SBC has **Symmetric RTP / Media Latching** enabled (latching media to the actual IP:port packet received from).
2. Ensure customer perimeter firewall allows bidirectional UDP traffic for ports `10000–30000`.
3. Check agent desktop browser microphone permissions if using WebRTC.

---

### 3.4. Choppy, Robotic or Muffled Voice (Jitter & Packet Loss)

#### The Symptom
Voice cuts out, sounds "underwater", robotic, or has high latency.

#### The Underlying Protocol Mechanics
- Human voice quality degrades non-linearly according to the **ITU-T E-Model (G.107)**:
  - **Packet Loss > 1%**: Noticeable audio clicks and syllable drops on G.711.
  - **Packet Loss > 3%**: MOS drops below 3.5 (degraded intelligibility).
  - **Jitter > 30ms**: Jitter buffer overflow/underruns occur, causing dropped audio frames.
  - **One-Way Delay > 150ms**: Conversation cadence becomes difficult; callers talk over each other.

#### Diagnosis in the Tool
1. In **Voice Simulator**: Select **"Crowded Office Wi-Fi"** or enter customer's telemetry stats (e.g. 4.5% loss, 75ms jitter).
2. The tool computes MOS: **2.67 (Fair/Poor)**.
3. Click **"Play Audio Simulation"** to listen to the exact audible degradation.
4. Switch codec to **Opus with FEC** to show how forward error correction restores MOS to 3.96.

#### Remediation Steps
1. Transition agents from 2.4GHz/5GHz Wi-Fi to a **wired Cat5e/Cat6 Ethernet connection**.
2. Implement **QoS / DSCP Prioritization** on the local switch/router (mark VoIP packets as `EF` / DSCP 46).
3. If bandwidth is constrained, negotiate **Opus** or **G.729** instead of uncompressed G.711.

---

### 3.5. Call Fails Immediately: SIP 488 Not Acceptable Here (Codec Mismatch)

#### The Symptom
Call cannot be established; terminates with error tone within 100 milliseconds of dialing.

#### The Underlying Protocol Mechanics
- Caller sends an `INVITE` with an SDP offer containing only a specific codec (e.g. `G.729 payload type 18`).
- Callee or carrier trunk does not have licensing or transcoding support for that codec (e.g. only accepts `PCMU / PCMA / Opus`).
- Callee rejects the call with `SIP/2.0 488 Not Acceptable Here` with `Warning: 304 "Media type not supported"`.

#### Diagnosis in the Tool
1. In **PCAP Analyzer**, load capture or Preset 3.
2. In **Tab 1 (SIP Ladder)**: Note the immediate sequence: `INVITE ➔ 100 Trying ➔ 488 Not Acceptable Here ➔ ACK`.
3. Overview card highlights: `CRITICAL: SIP 488 CODEC MISMATCH`.
4. Inspection panel displays offered codecs vs rejected media format.

#### Remediation Steps
1. Add standard **G.711 u-law (PCMU)** and **G.711 a-law (PCMA)** to the endpoint’s allowed codec list.
2. Ensure trunk transcoding is enabled if legacy endpoints must communicate with WebRTC.

---

### 3.6. Call Fails Immediately: SIP 404 Not Found (Routing / PBX Dialplan)

#### The Symptom
Call fails immediately with "Number not in service" or fast busy tone.

#### The Underlying Protocol Mechanics
- `SIP/2.0 404 Not Found` indicates the terminating server has no matching route, extension, or dialplan context for the dialed URI.
- The `Server` header in the 404 response identifies the terminating entity (e.g. `Server: Asterisk PBX certified/13.21-cert2`).

#### Diagnosis in the Tool
1. In **PCAP Analyzer**, load capture (or user capture `Incoming_404Congestion.pcap`).
2. RCA card isolates: `CRITICAL: SIP 404 NOT FOUND`.
3. Identifies the responding node: `Asterisk PBX certified/13.21-cert2`.

#### Remediation Steps
1. Check dialed destination number format (Verify E.164 formatting: `+65...` vs local format `021...`).
2. Verify tenant trunk mapping and extension registration status on the terminating PBX.

---

### 3.7. Call Disconnected: SIP 486 Busy Here vs SIP 487 Request Terminated

#### The Symptom
Customer claims call failed or dropped, but logs show 486 or 487.

#### The Underlying Protocol Mechanics
- When an inbound call rings multiple devices simultaneously (Forked Branching / Ring Group):
  - **Device A (Desktop)**: User clicks "Decline" $\to$ Returns `486 Busy Here` (User Refusal).
  - **Device B (Mobile Phone)**: PBX sends `CANCEL` to terminate ringing $\to$ Returns `487 Request Terminated`.

#### Diagnosis in the Tool
1. In **Call Forensics**: Check **Forked Branches Table**.
2. Tool marks Desktop as `PRIMARY_REFUSAL (SIP 486 User Busy)`.
3. Tool marks Mobile as `CANCELLED_BY_FORK (SIP 487 Sibling Cancelled)`.
4. Culprit Hop: Isolated to the user who declined the call, clearing the network of any defect.

#### Remediation Steps
- Explain to the customer that the call was actively rejected by the desktop softphone user.

---

### 3.8. Customer Claims "Dropped Call" on Normal Hangup (Q.850 Cause 16)

#### The Symptom
Customer opens a severity-1 ticket claiming a call dropped midway, requesting a platform credit or investigation.

#### The Underlying Protocol Mechanics
- In telecommunications, `Q.850 Cause 16` indicates **Normal Call Clearing** (one party pressed "End Call").
- Customers often report normal hangups as "drops" when the remote party hangs up in frustration or without saying goodbye.

#### Diagnosis in the Tool
1. In **Call Forensics**, observe the **Symptom Correlation Badge**:
   - Displays: `DISCREPANCY: NORMAL USER HANGUP`.
   - Notes: Initiator of hangup was the Callee. Total duration was normal (e.g. 55 seconds).
2. Hop chain culprit hop: `NONE (NORMAL)`.

#### Remediation Steps
- Send the automated customer-facing explanation verifying normal termination.

---

## 4. Packet Capture (PCAP) Forensic Standards & Sniffer Handbook

### 4.1. Capture Readiness Scoring & Audit Rules

When a customer or field engineer provides a `.pcap` capture, open it in **PCAP Analyzer (Tab 5: Capture Toolkit)**. The auditor evaluates 4 dimensions:

| Plane | Evaluation Criteria | Maximum Points |
| :--- | :--- | :---: |
| **Signaling Plane** | Presence of SIP frames (5060/5070), full headers (INVITE, 200 OK, BYE). | 45 |
| **Media Plane** | Presence of bidirectional RTP streams (SSRC, continuous sequences). | 40 |
| **Telemetry Plane** | RTCP telemetry reports for loss, jitter, and round-trip delay. | 10 |
| **Packet Integrity** | Zero snaplen truncation (Full packet payload intact: `-s 0`). | 5 |
| **Total** | **Audit Readiness Score** | **100** |

- **Grade A (85–100)**: `EXCELLENT` — Full signaling and media. Definitive RCA possible.
- **Grade B (70–84)**: `GOOD` — Signaling and partial media present.
- **Grade C (40–69)**: `PARTIAL` — Signaling only. Can analyze call setup, but cannot analyze audio defects.
- **Grade D (<40)**: `DEFICIENT` — Missing signaling or truncated frames. Request a recapture.

---

### 4.2. Exact Sniffer Commands by Platform

Always provide these exact commands to customers or on-site IT teams:

#### 1. Linux Server / SBC Gateway (Recommended Standard)
```bash
sudo tcpdump -i any -s 0 -w voip_full_trace.pcap "udp and (port 5060 or port 5070 or (portrange 10000-30000))"
```
*Key parameters: `-s 0` captures full headers without truncation; `-i any` captures all interfaces.*

#### 2. Asterisk / FreePBX Server
```bash
sudo tcpdump -i eth0 -s 0 -w asterisk_sip_rtp.pcap "udp and (port 5060 or (portrange 10000-20000))"
```
*(Replace `eth0` with primary interface e.g. `ens3` or `bond0`)*

#### 3. FreeSWITCH / FusionPBX
```bash
sudo tcpdump -i any -s 0 -w freeswitch_trace.pcap "udp and (port 5060 or port 5080 or (portrange 16384-32768))"
```

#### 4. MikroTik RouterOS (Customer Perimeter Router)
```routeros
/tool sniffer set file-name=voip_router.pcap filter-ip-protocol=udp filter-port=5060,10000-20000
/tool sniffer start
# Make test call to reproduce the issue, then immediately execute:
/tool sniffer stop
```

#### 5. Cisco IOS / ASA Gateway
```cisco
monitor capture CAP_VOIP interface GigabitEthernet0/0 both
monitor capture CAP_VOIP match any
monitor capture CAP_VOIP buffer circular size 10
monitor capture CAP_VOIP start
# After test call:
monitor capture CAP_VOIP export flash:voip_cisco.pcap
```

#### 6. Wireshark GUI (macOS & Windows)
Paste into **Capture Filter** (green box) before starting capture:
```wireshark
udp port 5060 or udp portrange 10000-30000
```

---

### 4.3. Dual-Trace Demarcation (A/B) Methodology

To settle disputes between customer IT teams and service provider NOCs:
1. Coordinate two simultaneous packet captures:
   - **Trace A**: Taken on the customer LAN (e.g. switch SPAN port or handset IP).
   - **Trace B**: Taken on the provider ingress SBC / WAN edge.
2. In **PCAP Analyzer (Tab 4: Dual-Trace Demarcation)**:
   - Load Trace A on the left panel.
   - Load Trace B on the right panel.
3. The comparison engine matches SIP messages by normalized `Call-ID` and `CSeq`.
4. If a message exists in Trace A but not in Trace B, the tool highlights:
   - Status: `DROPPED_AT_BOUNDARY`
   - Fault Domain: `CUSTOMER_PREMISE_FIREWALL` (or `CARRIER_TRANSIT_ISP` if packet delay > 1500ms).

---

## 5. Voice Quality Impairment & E-Model Simulation Guide

Use the **Voice Simulator** module during customer review meetings:

### Recommended Demonstration Scenarios
1. **The Wi-Fi Reality Check**:
   - Customer says: *"Our fiber internet is 500 Mbps, so voice shouldn't stutter."*
   - Explanation: VoIP requires stable packet delivery, not raw bandwidth. A 500 Mbps connection over congested office Wi-Fi can have 5% packet loss and 80ms jitter.
   - Action: Load **"Crowded Office Wi-Fi"** preset in Voice Simulator and play audio.
2. **Codec Upgrades (Opus vs G.711)**:
   - Demonstrate how switching to Opus provides forward error correction (FEC), maintaining MOS 3.96 even under 4% packet drop.

---

## 6. Customer Communication & Field Incident Templates

### Template 1: 30-Second Call Drop (Missing SIP ACK / SIP ALG)

> **Subject**: Investigation Update: Resolution for Call Disconnection at ~30 Seconds
>
> Dear Customer,
>
> We have completed a deep packet inspection of the reported call (Call-ID: `{{callId}}`).
>
> **Root Cause**:
> The call disconnected at exactly 30 seconds because your local perimeter router/firewall did not deliver the final SIP acknowledgment (ACK) message to our voice gateway. Under standard VoIP protocols (RFC 3261), voice gateways must receive this confirmation, or the call is automatically terminated to prevent ghost audio sessions.
>
> **Recommended Resolution**:
> 1. Disable **SIP ALG (Application Layer Gateway)** on your office gateway/firewall.
> 2. Increase the UDP NAT session timeout to at least **180 seconds**.
>
> Please let us know once these router adjustments are made so we can perform a verification test call with you.

---

### Template 2: Normal Hangup Discrepancy (Q.850 Cause 16)

> **Subject**: Diagnostic Report: Verification for Call `{{callId}}`
>
> Dear Customer,
>
> We have reviewed the call quality and signaling logs for call `{{callId}}` from `{{caller}}` to `{{callee}}`.
>
> Our telemetry confirms that the platform network and audio stream maintained optimal performance throughout the call (MOS: 4.40, Packet Loss: 0.0%). The call was concluded intentionally by the recipient (remote party) pressing "End Call", as recorded by standard telecommunication disconnect code **Q.850 Cause 16 (Normal Call Clearing)**.
>
> There was no technical failure or unexpected network drop on the system.

---

### Template 3: Carrier Circuit Congestion / 503 Service Unavailable

> **Subject**: Investigation Report: Route Congestion Encountered for Call `{{callId}}`
>
> Dear Customer,
>
> We have completed the root cause analysis for the call attempt to `{{callee}}`.
>
> **Root Cause**:
> The call was rejected with SIP response `503 Service Unavailable / 404 Route Defect` by the downstream carrier transit interconnect due to temporary circuit congestion at the public telephone gateway.
>
> **Action Taken**:
> Automated routing optimization has redirected ongoing calls to secondary interconnect circuits. No configuration changes are required on your local network.

---

## 7. Escalation Matrix & Tier Handover Checklist

Before escalating a ticket from **Tier-1/Tier-2** to **Tier-3 Voice Core** or an **Upstream Carrier**, the following checklist must be attached:

### Pre-Escalation Checklist
- [ ] **Call Identification**: Exact UTC Timestamp, Source Number, Destination Number, Call-ID.
- [ ] **Telemetry / JSON**: Uploaded to Call Forensics and hop chain evaluated.
- [ ] **PCAP Audit Score $\ge 70$**: Captured with full snaplen (`-s 0`) and includes signaling + RTP.
- [ ] **Demarcation Isolation Completed**: LAN trace compared against SBC trace if boundary drop is suspected.
- [ ] **Network Probe / MTR Attached**: Globalping traceroute showing any packet loss on ISP peering hops.
- [ ] **Investigation Case Created**: Forwarded into Investigation Center and exported as Markdown dossier.

---

*Document Version: 2.0 (Modular Release) • Service Operations Team • Internal Technical Documentation*
