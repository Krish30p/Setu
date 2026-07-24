# Risk Scoring Methodology

## 1. Offender Reoffense Risk Score

### Purpose
Prioritize investigative attention and inform (not dictate) decisions like bail-review flagging, by estimating likelihood of continued/repeat criminal activity.

### Input Features (graph-derived)
| Feature | Rationale |
|---|---|
| Prior offense count | Established criminological correlate of recidivism |
| Recency of last offense | Recent activity is more predictive than distant history |
| Network centrality | Offenders central to larger networks (many co-accused links) associated with organized activity |
| MO diversity | Offenders operating across multiple MO categories may indicate more entrenched criminal activity |
| Geographic spread | Cross-district activity associated with organized/repeat patterns |
| Bail/custody history | Prior bail-jump or repeat-offense-while-on-bail history |

### Model Approach
Catalyst Zia AutoML on the above tabular features, trained on historical chargesheet outcomes (repeat offense within N months as the label, where available) — a standard supervised tabular classification/regression setup, chosen specifically because AutoML removes the need for custom model infrastructure for what is fundamentally a tabular prediction problem.

### Output
`risk_score` (0-1) + top contributing features (for explainability) + confidence band.

## 2. Witness Tampering / Intimidation Risk Score

### Purpose
Distinct from offender risk — this protects the **prosecution pipeline** by identifying witnesses at elevated risk of intimidation or non-cooperation before it results in case collapse.

### Input Features (graph-derived)
| Feature | Rationale |
|---|---|
| Graph hop-distance to offender network | A witness one hop from a known associate cluster is more exposed than one with no graph connection |
| Case severity/crime type | Organized crime and violent crime cases carry higher tampering incentive |
| Prior witness reliability signals | If contact_status has shifted toward "non-cooperative" in linked cases |
| Geographic proximity to offender's known locations | Physical accessibility is a real-world tampering enabler |

### Model Approach
Given likely limited labeled historical data on witness tampering specifically, start with a transparent, rule-weighted scoring approach (not a black-box model) so the reasoning is inherently explainable from day one; migrate to a trained model only once sufficient labeled outcomes exist.

### Output
`proximity_risk_score` (0-1) + explanation ("1 hop from offender network via shared associate in FIR-XXXX") + recommended action (e.g., "flag for witness protection review").

## 3. Governance Note (applies to both scores)
Both scores are explicitly designed as **decision-support inputs**, not automated determinations. Per `audit-and-verification-policy.md`, any action taken on the basis of a risk score (e.g., a bail-review flag, a witness protection referral) must be logged with the score, its contributing features, and the human decision-maker who acted on it.
