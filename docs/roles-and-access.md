# Roles and Access Control

## Role Definitions

| Role | Typical User | Access Scope |
|---|---|---|
| **Investigator** | Station-level IO | Full read/write access to FIRs, offenders, victims, witnesses within their own station/district jurisdiction; can query the graph, view evidence trails, mark leads verified/rejected for their own cases |
| **Analyst** | District/SCRB analyst | Read access across districts (not station-restricted); can run cross-jurisdictional queries, view network graphs, generate pattern/trend reports; cannot edit case records directly |
| **Supervisor** | SP/DIG-level | Read access across their jurisdiction plus dashboard-level aggregate views (hotspot maps, risk score distributions); can approve/escalate flagged leads (e.g., witness protection referral, bail-review flag) |
| **Policymaker** | State-level (Home Dept/SCRB leadership) | Read-only access to aggregate, anonymized analytics (socio-demographic trends, hotspot evolution, state-wide offender network statistics) — no access to individually identifiable case-level detail unless specifically elevated |

## Enforcement Points
- **Catalyst API Gateway**: enforces role checks on every incoming request before it reaches a Function.
- **Catalyst Authentication**: issues role-scoped tokens at login; role is bound to the authenticated session, not client-supplied.
- **Data Store / NoSQL query layer**: row/field-level filtering applied server-side within Functions (e.g., an Investigator's queries are automatically scoped to their station/district; this is not a UI-only restriction).

## Principle of Least Privilege
Each role sees the minimum data necessary for its function. In particular:
- Policymakers should not see individually identifiable offender/victim/witness data by default — aggregate views only, consistent with governance requirement #10 in the original brief.
- Cross-jurisdictional visibility (Analyst role and above) is what enables the core "break the silo" value proposition — but is deliberately not extended to the Investigator role by default, to avoid unnecessary broad exposure of sensitive case data at the individual station level.

## Audit Logging
Every access, query, and verification action is logged with: user_id, role, timestamp, action_type, and affected record IDs — see `audit-and-verification-policy.md` for how this logging integrates with the "AI as lead, not evidence" governance model.

## Escalation Path
A Supervisor can temporarily elevate an Investigator's access scope for a specific active cross-district investigation (e.g., a joint task force), with the elevation itself logged and time-bound.
