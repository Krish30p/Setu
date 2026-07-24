# Catalyst Services Justification

This document maps every capability in the platform to a specific Zoho Catalyst service, with an explicit reason for the choice — not just a copy of the compliance table.

| Capability in Our Solution | Catalyst Service Used | Why This Service (Not an Alternative) |
|---|---|---|
| FIR ingestion, entity-linking, risk-scoring, anomaly-detection, report-generator, alerts logic | **Catalyst Serverless Functions** | Each is a discrete, event-driven, stateless operation (parse → extract → link → score). Functions scale independently per workload without managing servers, and integrate natively with Signals for event triggers. |
| Structured graph data — offenders, victims, FIRs, locations, edges | **Catalyst Data Store** | Relationships (offender↔FIR↔location↔MO) are inherently relational; Data Store's full-text search capability is also used directly for name/alias/keyword search across FIR text, avoiding a separate search service. |
| Unstructured/semi-structured case notes, raw extracted text, variable-schema case attributes | **Catalyst NoSQL** | FIR narrative text and case-specific attributes vary in structure case to case (e.g., financial crime cases have transaction fields property cases don't). Forcing this into a rigid relational schema would require constant migrations; NoSQL absorbs this variability. |
| Evidence documents, chargesheet scans, case photos | **Catalyst Stratus** | Binary/object storage is the correct fit for large unstructured files (S3-style), rather than storing blobs in the relational store. |
| Frontend chat + dashboard (SPA) | **Catalyst Slate / Web Client Hosting** | Static/SPA frontend hosting is lighter-weight and faster to deploy than a full managed runtime, appropriate since all heavy logic lives in Functions. |
| Conversational NLU, RAG-based answer generation over the graph | **Catalyst QuickML (LLM Serving, RAG)** | Query answering needs retrieval grounded in our own graph data (not general knowledge), which is exactly what RAG is designed for — keeps answers evidence-linked rather than hallucinated. |
| OCR on scanned FIRs/chargesheets, text analytics for entity extraction, speech-to-text and translation for Kannada voice queries | **Catalyst Zia Services** | These are precisely the listed Zia capabilities (OCR, Text Analytics, Voice) and match our multilingual, voice, and legacy-scanned-document requirements directly. |
| Offender reoffense risk scoring, witness tampering-risk scoring | **Catalyst Zia AutoML** | Tabular, feature-based prediction (graph-derived features: prior offense count, network centrality, recency) is a textbook AutoML use case — no custom model infrastructure needed. |
| PDF case summaries, conversation history export | **Catalyst SmartBrowz** | Headless browser/report generation is the documented fit for turning structured data + narrative into polished PDF output, avoiding a custom PDF-rendering pipeline. |
| Investigator/analyst/supervisor/policymaker login | **Catalyst Authentication** | Native, managed auth avoids building and securing a custom auth layer for sensitive law-enforcement data. |
| Routing, throttling, auth enforcement in front of Functions | **Catalyst API Gateway** | Centralizes role-based access control and rate limiting in one layer rather than duplicating checks inside every function. |
| Notifications on new cross-district linkage, hotspot spike, bail-status change | **Catalyst Signals + Event Functions** | These are reactive, in-project events (a DB insert or new linkage) — the exact use case Signals is designed for, avoiding manual polling. |
| Scheduled bulk re-scoring, periodic hotspot recalculation | **Catalyst Cron / Job Scheduling** | Risk scores and hotspot clusters don't need to be recomputed on every request; scheduled batch jobs are more efficient than on-demand recomputation. |
| Push notifications to investigators/supervisors | **Catalyst Push Notifications** | Native web/mobile push integration matches our alerting requirement without a third-party notification service. |
| Transactional email (e.g., PDF report delivery, account provisioning) | **Catalyst Mail** | Matches the transactional email requirement directly. |
| CI/CD for iterative development during and after the hackathon | **Catalyst Pipelines** | Keeps deployment consistent and auditable as the team iterates, which also demonstrates production-readiness to judges. |

## Why We Did Not Use Third-Party Alternatives
Per the hackathon rules, using a third-party service where a Catalyst equivalent exists risks submission validity. Beyond compliance, using the native Catalyst stack end-to-end also means every component shares the same authentication, logging, and event system — which materially simplifies the audit trail required for law-enforcement-grade explainability (see `audit-and-verification-policy.md`).
