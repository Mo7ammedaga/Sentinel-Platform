"""
Per-user baseline anomaly analyzer.

Trains an Isolation Forest on each user's OWN historical behavior and scores
their events relative to that personal baseline. For each scored event it
produces:
  - risk_score (0-100): how unusual this event is vs the user's own history
                        (a percentile: "more unusual than X% of their activity")
  - status: normal / suspicious / critical
  - confidence (0-1): how much history backs the baseline
  - explanation: a human-readable reason, in baseline-relative language
  - features + model_version: kept for audit / later persistence

IMPORTANT (constitution): Isolation Forest flags behaviour that is UNUSUAL for
the user. It does NOT determine malicious intent, and its output must never be
described as "malicious" or "threat". A human analyst makes the judgment.
"""
import numpy as np
from sklearn.ensemble import IsolationForest

from app.ai.feature_extractor import (
    FEATURE_NAMES,
    extract_user_features,
    rows_to_matrix,
)

MODEL_VERSION = "iforest-peruser-v1"
MIN_HISTORY = 50            # below this there is no reliable baseline (N=50)
SUSPICIOUS_RISK = 60.0
CRITICAL_RISK = 80.0


class UserBaselineResult:
    """The scoring result for a single event."""

    def __init__(self, event, risk_score, status, confidence, explanation,
                 features, insufficient_data=False):
        self.event = event
        self.risk_score = risk_score
        self.status = status
        self.confidence = confidence
        self.explanation = explanation
        self.features = features
        self.model_version = MODEL_VERSION
        self.insufficient_data = insufficient_data


def _explain(features, medians, baseline_hours):
    """Human-readable explanation comparing this event to the user's typical
    values. Baseline-relative language only — never 'malicious'."""
    idx = {name: k for k, name in enumerate(FEATURE_NAMES)}
    clauses = []

    v5 = features["events_last_5_min"]
    m5 = medians[idx["events_last_5_min"]]
    if v5 >= max(5, m5 * 3) and v5 > m5:
        clauses.append(f"{int(v5)} events in 5 min vs this user's typical {int(m5)}")

    if features["outside_baseline_hours"] == 1.0:
        lo, hi = baseline_hours
        clauses.append(f"activity at {int(features['hour_of_day']):02d}:00, "
                       f"outside this user's usual {int(lo):02d}-{int(hi):02d}h")

    if features["is_new_ip_for_user"] == 1.0:
        clauses.append("first activity from a new IP for this user")

    if features["is_new_user_agent_for_user"] == 1.0:
        clauses.append("a device/browser this user hasn't used before")

    dh = features["distinct_actions_last_hour"]
    mdh = medians[idx["distinct_actions_last_hour"]]
    if dh >= max(4, mdh * 2) and dh > mdh:
        clauses.append(f"{int(dh)} distinct action types in the last hour "
                       f"(typical {int(mdh)})")

    if features["is_sensitive_action"] == 1.0:
        clauses.append("a sensitive action (download/delete)")

    if not clauses:
        return "No strong deviation from this user's baseline."
    return "Unusual relative to this user's baseline: " + "; ".join(clauses) + "."


def analyze_user_events(events, score_indices=None):
    """Analyze ONE user's events (sorted ascending by created_at).

    score_indices: indices of the events to return results for (e.g. the last
    24h). If None, every event is scored. Returns list[UserBaselineResult].
    """
    n = len(events)
    if score_indices is None:
        score_indices = range(n)
    score_indices = list(score_indices)

    rows, baseline_hours = extract_user_features(events)

    # Insufficient history: no reliable baseline -> neutral + flagged.
    if n < MIN_HISTORY:
        conf = round(min(1.0, n / (2 * MIN_HISTORY)), 3)
        return [UserBaselineResult(
            event=events[i], risk_score=0.0, status="normal", confidence=conf,
            explanation=f"Insufficient history for a reliable baseline "
                        f"({n} events; need {MIN_HISTORY}).",
            features=rows[i], insufficient_data=True)
            for i in score_indices]

    X = rows_to_matrix(rows)
    model = IsolationForest(n_estimators=200, random_state=42)
    model.fit(X)

    # Anomaly score per event (higher = more anomalous for THIS user).
    anomaly = -model.score_samples(X)

    # Robust z-score against the user's OWN score distribution. Using the median
    # and MAD (not mean/std) keeps a handful of real outliers from inflating the
    # threshold and hiding themselves. This gives an ABSOLUTE "how unusual for
    # this user" signal, so a user with no anomalies gets nothing flagged.
    med = float(np.median(anomaly))
    mad = float(np.median(np.abs(anomaly - med)))
    if mad > 1e-9:
        scale = 1.4826 * mad                 # MAD -> std-equivalent
    elif anomaly.std() > 1e-9:
        scale = float(anomaly.std())
    else:
        scale = 1.0
    z = (anomaly - med) / scale
    risk_all = np.clip(z * 20.0, 0.0, 100.0)   # z=3 -> 60 (susp), z=4 -> 80 (crit)

    confidence = round(min(1.0, n / 200.0), 3)
    medians = np.median(X, axis=0)

    results = []
    for i in score_indices:
        risk = float(risk_all[i])
        if risk >= CRITICAL_RISK:
            status = "critical"
        elif risk >= SUSPICIOUS_RISK:
            status = "suspicious"
        else:
            status = "normal"
        results.append(UserBaselineResult(
            event=events[i], risk_score=round(risk, 1), status=status,
            confidence=confidence,
            explanation=_explain(rows[i], medians, baseline_hours),
            features=rows[i]))
    return results
