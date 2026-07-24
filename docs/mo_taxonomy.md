# Modus Operandi (MO) Taxonomy

This taxonomy is the controlled vocabulary used to tag FIRs and offenders, enabling consistent MO-based matching (`similarity-scoring-logic.md`) and MO-shift detection (`anomaly-detection-notes.md`). It should be extended in collaboration with SCRB subject-matter experts before production use — this is a starting structure, not a final legal classification.

## Category: Property Crime
| MO Tag | Description |
|---|---|
| chain_snatching | Theft of jewelry/valuables from a person, typically involving a vehicle for quick escape |
| house_breaking_day | Burglary during daylight hours, typically when premises are unoccupied |
| house_breaking_night | Burglary during night hours |
| vehicle_theft | Theft of a motor vehicle |
| pickpocketing | Theft from a person's belongings without their knowledge, no confrontation |
| atm_related_theft | Theft or fraud involving ATM machines/cards |

## Category: Financial Crime
| MO Tag | Description |
|---|---|
| online_fraud | Digital/cyber-enabled financial fraud |
| ponzi_investment_fraud | Fraudulent investment schemes |
| money_laundering | Layering/structuring of illicit funds |
| identity_theft_financial | Use of stolen identity for financial gain |

## Category: Organized / Gang Activity
| MO Tag | Description |
|---|---|
| repeat_offender_cluster | Pattern indicating coordinated activity by a known group |
| cross_district_operation | Crimes committed by the same network across multiple districts |
| recruitment_pattern | Indicators of recruitment of new members into criminal activity |

## Category: Violent Crime
| MO Tag | Description |
|---|---|
| assault | Physical assault |
| armed_robbery | Robbery involving a weapon |
| extortion | Threat-based coercion for money/property |

## Category: Behavioral/Temporal Modifiers (attached alongside primary MO tag)
| Modifier | Description |
|---|---|
| daytime / nighttime | Time-of-day pattern |
| solo / group | Whether offense was committed alone or with associates |
| weapon_used / no_weapon | Presence of weapon |
| repeat_location / new_location | Whether offense occurred at a previously used location |

## Usage Notes
- Each FIR can carry multiple MO tags (primary category + modifiers).
- MO tags are extracted via NLP from FIR narrative text (see `entity-extraction-prompts.md`) and can be manually corrected by an analyst — corrections should feed back into extraction model evaluation.
- MO-tag sequences over time, per offender, are the primary input to anomaly/pattern-break detection.
