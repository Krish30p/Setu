# Solution Overview

## Name
**Setu** — *Cross-Jurisdictional Criminal Intelligence Platform*
(Working name; "Setu" = bridge, reflecting the core function: bridging silos between stations, districts, and data types.)

## One-Line Pitch
A conversational AI platform that automatically links offenders, victims, locations, vehicles, phone numbers, and financial trails across every police station in Karnataka — turning isolated FIRs into a single, explainable criminal intelligence graph.

## The Insight That Shapes Everything
Every capability requested in the KSP brief — pattern discovery, network analysis, socio-demographic insight, offender profiling, proactive prevention, predictive dashboards — is not ten separate features. It is **one knowledge graph** (offenders–victims–locations–incidents–financial accounts–witnesses), queried and visualized in different ways. Building ten disconnected modules is what most competing teams will do. Building one coherent graph, with a conversational and visual layer on top, is what will differentiate this solution.

## What It Does
1. **Ingests** FIR text (structured + unstructured, English and Kannada) and extracts entities using NLP.
2. **Links** entities into a live graph — same phone number, same MO, same associate, same location, same financial trail.
3. **Answers** natural language / voice queries: "Show me cases similar to FIR 2024/117," "Which offenders are linked to this phone number across districts?"
4. **Visualizes** the network, geospatial hotspots, and socio-economic overlays.
5. **Scores risk** for offenders (reoffense likelihood) and, distinctively, for **witnesses** (intimidation/tampering risk based on proximity to offender networks).
6. **Flags anomalies** — not just matches, but MO *changes*, which indicate deliberate evasion.
7. **Explains itself** — every output cites the source FIR(s) and fields that produced it, and is logged as a "lead for verification," never as standalone evidence.

## The Three Differentiators (see `anomaly-detection-notes.md`, `audit-and-verification-policy.md`)
- **Pattern-break detection**, not just pattern-match detection — catches offenders adapting their MO to evade recognition.
- **Witness-risk scoring** — protects the prosecution pipeline, not just the investigation.
- **Explicit "AI as lead, not evidence" design** — built into the audit trail from day one, aligning with how AI-derived correlations are actually treated under Indian evidentiary standards.

## Target Users
Investigators (station level), Analysts (district/SCRB level), Supervisors (SP/DIG level), Policymakers (state level) — each with role-scoped access to the same underlying graph.

## Deployment
100% on Zoho Catalyst, per hackathon mandate. See `catalyst-services-justification.md` for the full service mapping.
