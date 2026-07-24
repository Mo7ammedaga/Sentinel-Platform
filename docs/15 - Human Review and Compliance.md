# 15 - Human Review and Compliance (Phase E)

## Purpose

Sentinel monitors real people. This document defines the human-safety and
compliance guarantees the platform must uphold. These are requirements, not
optional features.

---

# Core Principle: The AI Never Decides

Isolation Forest identifies behaviour that is **unusual relative to a user's own
baseline**. It does **not** determine intent, guilt, or malice.

- Every alert is a *signal for review*, never a verdict.
- A **human analyst** opens an Investigation and reaches the conclusion
  (Confirmed / False Positive).
- No automated consequence may be applied to a person based solely on an AI
  score. A documented human review is required before any action.

Enforced in the product:
- UI copy uses "unusual relative to this user's baseline", never "malicious".
- The AI explanation string and the public monitoring notice both state that a
  score is not a verdict.
- Investigations carry the analyst's identity and notes; the workflow terminal
  states are the analyst's decision.

---

# Transparency (E1 / E2)

`GET /api/v1/privacy/notice` (public) publishes, in plain language:
- **Why** monitoring exists (insider-threat detection via per-user baselines).
- **What is collected**: auth events, workspace actions, file upload/download,
  message metadata, and technical context (IP, user agent, timestamp).
- **What is NOT collected**: passwords in the clear (only bcrypt hashes), no
  keystroke logging, no screen capture, no message/file *content* as AI features.
- The AI disclaimer above.

---

# Subject Access (E4)

Any authenticated user can see and export **their own** data:
- `GET /api/v1/me/events` — paginated own event history.
- `GET /api/v1/me/events/export` — full JSON export.
Scoped strictly to the requester; no user can read another's events here.

---

# Auditing Analyst Actions (E5)

Analysts are themselves accountable. Opening or advancing an Investigation emits
an Event (`open_investigation`, `update_investigation`), so "who looked at whom"
is recorded like any other action.

---

# Data Retention (E3)

`POST /api/v1/admin/retention/purge?days=N` (System Administrator only) deletes
event telemetry older than `N` days (default 90) **except** events that have an
alert — investigated evidence is preserved. AIAnalysis rows are cascaded.

Trade-off (documented policy): purging old events also shortens the AI's
per-user baseline history, so retention length balances privacy against
detection quality.

---

# Consequences Require Human Review (E7)

Sentinel is a decision-support tool. Any organizational consequence for an
employee must be preceded by:
1. A human analyst investigation that reaches `confirmed`, with notes/evidence.
2. Review by an accountable owner (e.g., manager/HR) outside the AI.

The platform deliberately provides no mechanism to auto-act on a score.

---

# Status

Implemented in code (E1–E5) and enforced through UI language (E6). E7 is a
policy this document formalizes; the platform's design supports it by never
exposing an automated-action path.

Version 1.0
