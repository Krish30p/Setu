# Problem Statement

## Title
Cross-Jurisdictional Criminal Network & Repeat-Offender Linkage Engine with Conversational Crime Intelligence Interface

## The Core Problem
Karnataka's crime records are accurate at the level of a single FIR but blind at the level of the state.

An offender who commits a crime in one police station's jurisdiction and reappears — under a slightly different name, a new phone number, a different vehicle — in another district's FIR is, today, invisible as a *pattern*. Each FIR is investigated in isolation by an Investigating Officer (IO) who has no practical way to know that the same phone number, the same associate, or the same modus operandi (MO) appears in a case 300 km away. The State Crime Records Bureau (SCRB) receives fragmented, delayed, and manually compiled data, which makes state-wide pattern discovery close to impossible using current Excel-based workflows.

This is not a technology-absence problem alone — it is a **structural silo problem**. Data exists. It is simply never connected.

## Why This Matters Operationally
- A small percentage of repeat/habitual offenders are responsible for a disproportionate share of property crime, chain-snatching, and organized theft — a pattern well documented in criminology and in NCRB-style repeat-offender statistics.
- Organized crime and gang networks deliberately exploit jurisdictional and departmental silos — operating across station/district boundaries specifically because cross-referencing rarely happens in practice.
- Current policing is structurally **reactive**: FIR → investigation → chargesheet, with no systemic mechanism to flag "this offender/location/MO is trending" before another crime occurs.
- Witnesses and complainants in linked cases are not cross-checked against known offender networks, contributing to case attrition through witness intimidation that goes undetected until trial.

## What Needs to Change
Investigators, analysts, and policymakers need a single conversational interface, backed by a live cross-jurisdictional knowledge graph, that:
1. Automatically extracts entities (names, aliases, phone numbers, vehicle numbers, MO, locations, financial trails) from unstructured FIR text.
2. Links these entities across every station and district in near real time.
3. Surfaces hidden connections, repeat-offender clusters, and emerging patterns — including when an offender's behavior *changes* to evade detection.
4. Supports natural-language querying in English and Kannada, including voice.
5. Produces outputs that are explainable and evidentiary-safe — every AI-generated lead must be traceable to source data and treated as a lead for investigator verification, not as courtroom-ready proof.

## Scope Boundary for This Solution
This solution deliberately does not attempt to replace the IO's judgment or automate arrests/charges. It automates the **discovery of connections** that are theoretically present in the data but practically undiscoverable by manual review — and hands investigators a verified, explainable, actionable lead.

## Success Criteria
- An investigator can type or speak a query about an FIR and receive linked cases, offender network visualization, and risk-scored leads within seconds.
- Every AI-surfaced connection carries a visible evidence trail (source FIR, matched field, confidence score).
- The system flags not only known repeat patterns but also *pattern breaks* — offenders whose MO shifts, indicating adaptive evasion.
- The platform is fully deployed on Zoho Catalyst per hackathon requirements, with all applicable capabilities mapped to their corresponding Catalyst service.
