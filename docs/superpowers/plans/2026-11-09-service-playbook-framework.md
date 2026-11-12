# Implementation Plan: Service Team Playbook & Multi-Pod Issue Management Framework

**Feature**: Service Team Playbook, Dynamic Troubleshooting Guidelines & Smart Ticket Ingest  
**Target Date**: 2026-11-09  
**Specification**: Transform `Cloud Telephony & Omnichannel Troubleshooting Guideline.xlsx` into an interactive, multi-pod troubleshooting hub with automated ticket ingestion, completeness auditing, diagnostic matrices, and escalation generation.

---

## 1. Objectives & User Needs

1. **First-Class Investigation Entry Point**: Provide a standardized entry point for the Service Team to intake tickets, audit required data points, and route issues.
2. **Eliminate Manual Copy-Paste**: Implement a Smart Clipboard & Raw Text Ingestion parser that extracts Org UUID, Domain, Call TXN, Call-ID, phone numbers, timestamps, and error codes in under 3 seconds.
3. **Enforce Completeness Before Escalation**: Automatically compare parsed ticket entities against the required data points matrix (from the CCB reference spreadsheet). Score completeness and generate polite customer clarification requests for missing items.
4. **Interactive Diagnostic Decision Trees**: Render product-specific matrices (Bizphone, MS Teams, Contact Center, Phone System, Virtual Line, Auto Attendant, Fax) with interactive checklists and direct launchers into Call Forensics and PCAP Analyzer.
5. **Standardized Replication & Escalation**: Structured replication generator producing clean Jira/Zendesk Markdown following the writing guidelines (plain English, no fillers, concise bullets).
6. **Multi-Pod Architecture**: Modular registry allowing CCB Pod, CPaaS/Messaging Pod, Billing Pod, and Carrier Interconnect Pod to plug in their own guidelines without code changes.

---

## 2. Proposed Architecture & File Structure

```
src/
├── modules/
│   └── playbook/
│       ├── types/
│       │   └── playbookTypes.ts               # Core data types for pods, checklists, tickets
│       ├── data/
│       │   ├── ccbPodData.ts                  # CCB Pod reference data extracted from XLSX
│       │   └── podRegistry.ts                 # Multi-pod registry with local caching & remote sync
│       ├── services/
│       │   └── ticketIntakeParser.ts          # Regex/NLP entity extraction, audit, clarification generator
│       ├── components/
│       │   ├── SmartIntakeCard.tsx            # Raw ticket input, parsed entity badges, completeness gauge
│       │   ├── WorkflowSlaCard.tsx            # 5-stage pipeline, SLA calculator, channels
│       │   ├── DataPointAuditCard.tsx         # Category selector, 9-question voice quality questionnaire
│       │   ├── DiagnosticMatrixCard.tsx       # Product decision trees (Bizphone, Teams, etc.)
│       │   ├── ReplicationEscalationCard.tsx  # Reproduction form, Markdown generator
│       │   └── ToolsHandbookCard.tsx          # Audit app, Kibana, Zoiper, App/SIP log guides
│       └── PlaybookView.tsx                   # Main container with pod selector & sub-navigation
├── shared/
│   ├── types/
│   │   └── navigation.ts                      # Added 'playbook' navigation tab
│   └── components/
│       └── Navbar.tsx                         # Added Playbook tab with 'SOP' badge
└── tests/
    └── playbookService.test.ts                # Unit tests for parser, audit, clarification, and registry
```

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Core Types & CCB Reference Data Model
- Define `PlaybookPod`, `WorkflowStep`, `SlaTier`, `DataPointItem`, `ProductMatrixItem`, `ReplicationTemplate`, `ToolCheat`, and `IngestedTicket`.
- Populate `ccbPodData.ts` with exact content from `Cloud Telephony & Omnichannel Troubleshooting Guideline.xlsx`:
  - 5 workflow steps (Response <10m, Clarification 30m rule, Identification <1h, Replication, Escalation).
  - SLA tiers (Enterprise vs Standard, Sev 1 to Sev 4).
  - Data points required for Call, Voice Quality, App, Auth, Fax, DNC, Billing.
  - 9 voice quality diagnostic questions.
  - Diagnostic decision trees for Bizphone, Contact Center, MS Teams, Phone System, Virtual Line, Auto Attendant, Fax.
  - Zoiper auto-provisioning QR code instructions.
  - Writing tips & escalation channels.
- Implement `podRegistry.ts` supporting CCB Pod and placeholder slots for CPaaS, Billing, Carrier.

### Task 2: Smart Ticket Ingestion & Completeness Engine
- Create `src/modules/playbook/services/ticketIntakeParser.ts`:
  - Regex & pattern matching for:
    - Org UUID (`[a-f0-9]{8}-[a-f0-9]{4}...`)
    - SIP/Portal Domain (`sipsg02.b3networks.com`, `*.b3networks.com`, etc.)
    - Call TXN and SIP Call-ID
    - Phone numbers (E.164 `+65...` and local extensions)
    - Timestamps (UTC, SGT, ISO formats, relative "today 11:15 AM")
    - Direction (inbound, outbound, forwarding)
    - Error codes (SIP 4xx/5xx/6xx, HTTP, SMPP)
  - Auto-pod classification based on keyword weights.
  - Completeness calculation against pod requirements.
  - `generateCustomerClarification()`: Pre-formatted English request for missing fields.
  - `generateEscalationMarkdown()`: Formatted Jira/Zendesk bug report.

### Task 3: Unit Tests (`playbookService.test.ts`)
- Write tests in `src/tests/playbookService.test.ts` verifying:
  - Entity extraction from messy customer tickets.
  - Incomplete ticket audit (<100% score with missing TXN flagged).
  - Complete ticket audit (100% score).
  - Clarification generator output.
  - Escalation Markdown structure.
  - Pod registry retrieval.
- Update `package.json` test script to include `playbookService.test.ts`.

### Task 4: Interactive UI Components
- Build `SmartIntakeCard.tsx` with clipboard ingest, parsed fields display, and 1-click actions.
- Build `WorkflowSlaCard.tsx` with interactive SLA/Severity calculator.
- Build `DataPointAuditCard.tsx` with the 9-question voice quality questionnaire.
- Build `DiagnosticMatrixCard.tsx` with interactive step-by-step checklists.
- Build `ReplicationEscalationCard.tsx` with copy-to-clipboard Markdown generator.
- Build `ToolsHandbookCard.tsx` with tool cheat-sheets.
- Build `PlaybookView.tsx` assembling all cards with a clean tabbed layout and Pod selector.

### Task 5: Integration into App Navigation
- Update `src/shared/types/navigation.ts` to include `'playbook'`.
- Update `src/shared/components/Navbar.tsx` to add Playbook as the first navigation tab next to Dashboard with badge `'SOP'`.
- Update `src/App.tsx` to render `PlaybookView`.
- Update `src/modules/dashboard/DashboardView.tsx` with a direct shortcut card: *"Open Service Team Playbook"*.

### Task 6: Verification & Packaging
- Run `npm test` ensuring all 8 test suites pass.
- Run `npm run build` ensuring TypeScript and Vite compile with 0 errors.
- Package the updated macOS `.dmg` using `npm run electron:build`.
