# Anomaly Detection Notes — Pattern-Break Detection

## Why This Exists
Most crime-analytics tools (and, predictably, most hackathon submissions) build only pattern-*matching*: "find cases similar to this one." That rewards offenders who repeat themselves and is blind to offenders who don't — specifically, offenders sophisticated enough to change their behavior once they sense a pattern might be recognized. This document describes the complementary capability: detecting when an offender's established pattern **breaks**, which is itself a meaningful signal, not noise to be filtered out.

## Core Idea
For each offender with 2+ linked cases, maintain a rolling profile of their MO tags, time-of-day pattern, location pattern, and associate network. When a new linked case deviates significantly from this profile — while other identity signals (phone, vehicle, associate overlap) still connect it to the same offender — flag it as a **pattern-break event**, not just a routine update to their profile.

## What Counts as a Pattern Break
| Signal | Example |
|---|---|
| MO category shift | Offender historically tagged `chain_snatching` + `daytime`, new case tagged `house_breaking` + `nighttime` |
| Escalation | Offender shifts from `no_weapon` to `weapon_used` across cases |
| Geographic jump | Offender's cases were confined to one district for years, then a case appears in a distant district |
| Network change | Offender previously operated `solo`, new case shows `group` involvement with new, previously unlinked associates |
| Frequency change | Long dormancy period followed by a sudden cluster of activity |

## Detection Approach
1. Build a per-offender historical MO-tag sequence and associated metadata (time, location, group size, weapon use) from the knowledge graph.
2. For each new linked case, compute a **deviation score** against the offender's historical profile (e.g., using a simple distributional distance over tag frequencies, or a sequence model for offenders with longer histories).
3. Deviation score is combined with **identity confidence** (how sure we are this is genuinely the same offender, from `similarity-scoring-logic.md`'s identity-matching features) — a pattern break is only interesting if we're still confident it's the same person.
4. If deviation score exceeds a threshold AND identity confidence remains high, raise an `anomaly_flags` record (see `nosql-schema.md`) with a plain-language explanation of what changed.

## Why This Matters Operationally
- It directly operationalizes "proactive policing" in a way a hotspot map alone cannot — it says "this specific individual appears to be adapting," which is an investigative lead an IO can act on before the next incident, not just after a cluster has already formed.
- It signals to evaluators that the system models **offender behavior as strategic and adaptive**, not static — which is a more criminologically grounded assumption than treating all offenders as behaving the same way indefinitely.

## Honest Limitations (state these openly in the pitch, don't hide them)
- With sparse historical data (offenders with only 1-2 prior cases), deviation scoring is statistically weak — the system should surface a **confidence-qualified** flag ("possible pattern shift, based on limited history") rather than a false-certainty flag.
- Not every MO shift indicates evasion — some may simply reflect opportunity or circumstance. This is why the output is explicitly a flagged lead for investigator review, never an automated conclusion (see `audit-and-verification-policy.md`).
- This requires a genuinely realistic seed dataset, with at least one offender showing a deliberate MO shift across 3+ cases, to be demonstrable at all — build this into your sample data early.
