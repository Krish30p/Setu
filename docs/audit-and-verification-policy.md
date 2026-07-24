# Audit and Verification Policy

## Core Principle
**Every AI-generated output in this platform is a lead requiring independent verification — never a standalone conclusion, and never courtroom-ready evidence on its own.**

This is not a legal disclaimer bolted on at the end. It is a design principle that shapes the data model (`explainability-template.md`, `data-dictionary.md` §10) and the UI from the start. An AI-surfaced correlation (e.g., "this phone number links two FIRs") is a statistical inference, not a chain-of-custody-verified fact — treating it otherwise would be both legally fragile and operationally reckless.

## Why This Matters
- Courts and internal disciplinary review require an evidentiary chain that an AI confidence score, by itself, does not provide.
- Overconfident AI-derived claims that are later found unreliable in court damage the credibility of the entire system, not just the individual case — this is a systemic risk, not just a per-case one.
- Investigators who cannot see *why* the system produced a link will not trust it, and will not use it — a lesson from analytics tools generally that are treated as black boxes and abandoned in practice.

## Policy Rules

1. **Every AI output carries a verification status**: `unverified`, `verified`, or `rejected` (see `explainability-template.md`). Only `verified` leads may be cited in chargesheets, case files, or any court-facing material.

2. **Verification requires independent action**: a lead is marked `verified` only after the investigator has taken a concrete, logged verification step (e.g., "confirmed phone ownership via telecom provider records," "confirmed vehicle registration via RTO"), not merely by clicking "accept."

3. **No auto-escalation without human review**: Anomaly flags, risk scores, and network links may trigger notifications (`Signals` + `Push Notifications`) to relevant supervisors, but must never automatically trigger an enforcement action (e.g., arrest recommendation, bail cancellation request) without human review and sign-off.

4. **Full audit trail retained**: every query, every AI output, every verification/rejection action is logged with user identity, timestamp, and role — retained per applicable data retention regulations for law-enforcement systems.

5. **Rejected leads are retained, not deleted**: a `rejected` status with investigator notes is itself valuable data (e.g., for future model evaluation and to avoid re-surfacing the same false lead), so rejected records are archived, not purged.

6. **Confidence must always be visible, never hidden**: no output is presented to a user without its confidence score and evidence trail visible in the same view — there is no "simplified mode" that hides this information.

7. **Model versioning is mandatory**: every AI output records which model/prompt version produced it, so that if a model is later found to have a systematic error, all outputs it produced can be identified and re-reviewed.

## Relationship to Explainability
This policy is the *governance* layer; `explainability-template.md` is the *technical* layer that implements it. Neither is meaningful without the other — a system can be technically explainable but still misused if there's no policy requiring verification before action, and a verification policy is unenforceable if the system can't actually show its reasoning.

## Framing for Judges
This is, deliberately, the cheapest and highest-credibility addition to the platform: it costs little in engineering effort but signals, to any judge who has seen technology fail in an evidentiary context, that this team understands how AI output is actually meant to be used in a law-enforcement setting — as an investigative accelerant, not a replacement for investigative judgment.
