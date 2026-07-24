# Demo Script

## Objective
In under 5 minutes, show judges the one moment that no other team will show: an offender network surfacing across districts, an explainable evidence trail, and a pattern-break flag — ending on an operational recommendation, not just a visualization.

## Setup (before judges arrive)
- **Role Selection**: Authenticate on the Login Page with the **Analyst** operational role ("Analyst (Cross-District Read)"). Cross-jurisdictional read access is required so multi-district offender networks are fully visible during the pitch.
- Seed dataset loaded: ~50 realistic, deliberately messy synthetic FIRs across at least 3 districts, including:
  - One offender with name variants ("Mohd Rafiq" / "Md. Rafique" / "Rafiq bhai") across 3 FIRs in different districts.
  - Shared phone number appearing in 2 unrelated-looking FIRs.
  - One offender whose MO shifts mid-sequence (from daytime chain-snatching to night-time house-breaking) — the anomaly demo.
  - One witness who shares a graph edge (common associate) with the accused in a separate case — the witness-risk demo.

## Demo Flow

**Step 1 — The Problem, in 20 seconds**
"Here are three FIRs, filed in three different districts, months apart. To any single IO, these look unrelated." (Show 3 FIR summaries side by side, as they'd appear today — isolated.)

**Step 2 — Ask the System**
Type or speak (English or Kannada): *"Show me cases linked to FIR [X]."*
→ System returns a network graph: the same offender (under name variants), same phone number, same MO tag, connecting all 3 FIRs across districts.

**Step 3 — Explainability Moment**
Click on the connecting edge. System shows: *"Linked via phone number ending 4521, appearing in FIR-2024-0117 (Tumkur) and FIR-2024-0298 (Bengaluru Rural), confidence 91%. Source text highlighted below."*
→ This is the moment that separates you from teams with a "black box" graph.

**Step 4 — The Pattern-Break (your differentiator)**
Switch to the anomaly view: *"This offender's MO has shifted from daytime chain-snatching to night-time house-breaking over the last 4 months — flagged as adaptive evasion, not coincidence."*
→ Narrate: "Most systems would only tell you when a pattern repeats. Ours tells you when it changes — because that's when offenders are trying to stay ahead of detection."

**Step 5 — Witness-Risk (second differentiator)**
*"This witness in Case Y is one hop away, in the graph, from the accused's known associate network in Case Z — flagged for tampering risk."*
→ Narrate: "This isn't about catching the criminal. It's about making sure the case doesn't collapse before trial."

**Step 6 — The Governance Line (closes the pitch)**
*"Every one of these is logged as a lead, not a conclusion — with a full evidence trail an IO can independently verify. This is designed to survive scrutiny, not just look good in a demo."*

**Step 7 — Close on Impact**
"This isn't ten separate features. It's one graph, doing five jobs — network analysis, pattern discovery, offender profiling, witness protection, and proactive alerting — all explainable, all deployed on Catalyst."

## Fallback Plan (if live demo fails)
Have a 60-second screen recording of the exact flow above, ready to play with zero setup dependency.

## Q&A Prep — Likely Judge Questions
- *"How do you handle false positives in entity matching?"* → Confidence scoring + mandatory investigator verification step before any lead is actionable.
- *"Why Kannada specifically?"* → Primary regional language for FIR narratives in Karnataka; extraction pipeline is designed to be extensible to other regional languages.
- *"How would this scale state-wide?"* → Catalyst Functions and Data Store scale independently; ingestion is event-driven, not batch-dependent.
- *"Isn't this just a chatbot?"* → No — the chatbot is the interface; the graph, anomaly detection, and risk scoring are the actual intelligence layer underneath it.
