"""
Per-user behavioral feature extraction for the AI Engine.

Every feature is derived from recorded rows in the `events` table — there is no
randomness anywhere. Features are computed RELATIVE TO THE ACTING USER, so the
model can judge "unusual for THIS user," not "unusual across all humans." That
is the core principle of user-behavior analytics: an accountant's normal is not
a sysadmin's normal.

Performance note: features are computed in a single O(n) pass over the user's
events (loaded once from the DB), not with one SQL query per feature. The values
are identical to per-event SQL aggregates; this is just the efficient way to
compute them.
"""
from collections import Counter
from datetime import timedelta

import numpy as np

# Actions that carry higher exfiltration / impact risk.
SENSITIVE_ACTIONS = {"download_file", "delete"}

# The feature vector layout. The analyzer relies on this order.
FEATURE_NAMES = [
    "hour_of_day",
    "is_weekend",
    "events_last_5_min",
    "events_last_1_hour",
    "distinct_actions_last_hour",
    "is_sensitive_action",
    "is_new_ip_for_user",
    "is_new_user_agent_for_user",
    "minutes_since_prev_event",
    "outside_baseline_hours",
]


def baseline_hour_range(events):
    """This user's typical active-hours band (5th-95th percentile of hours).

    Derived from the user's OWN history — deliberately NOT a hardcoded 9-5.
    The 5/95 band keeps ordinary edge-of-day activity from being flagged while
    still catching genuinely off-hours behaviour (e.g. 03:00 for a 9-5 user).
    """
    hours = np.array([e.created_at.hour for e in events], dtype=float)
    return float(np.percentile(hours, 5)), float(np.percentile(hours, 95))


def extract_user_features(events):
    """Compute a feature dict for each of ONE user's events.

    `events`: list of Event rows for a single user, sorted ascending by
    created_at. Returns (rows, baseline_hours) where rows is a list of
    {feature_name: value} dicts in the same order as `events`.
    """
    if not events:
        return [], (0.0, 23.0)

    lo_h, hi_h = baseline_hour_range(events)

    rows = []
    seen_ips = set()
    seen_uas = set()
    prev_time = None
    action_window = Counter()      # action_type -> count within the last hour
    p1 = 0                         # left edge of the 1-hour window
    p5 = 0                         # left edge of the 5-minute window

    for i, e in enumerate(events):
        t = e.created_at
        action_window[e.action_type] += 1

        one_hour_ago = t - timedelta(hours=1)
        while events[p1].created_at < one_hour_ago:
            a = events[p1].action_type
            action_window[a] -= 1
            if action_window[a] == 0:
                del action_window[a]
            p1 += 1

        five_min_ago = t - timedelta(minutes=5)
        while events[p5].created_at < five_min_ago:
            p5 += 1

        gap_min = 0.0 if prev_time is None else (t - prev_time).total_seconds() / 60.0
        gap_min = min(gap_min, 1440.0)   # cap at 24h

        rows.append({
            "hour_of_day": float(t.hour),
            "is_weekend": 1.0 if t.weekday() >= 5 else 0.0,
            "events_last_5_min": float(i - p5 + 1),
            "events_last_1_hour": float(i - p1 + 1),
            "distinct_actions_last_hour": float(len(action_window)),
            "is_sensitive_action": 1.0 if e.action_type in SENSITIVE_ACTIONS else 0.0,
            "is_new_ip_for_user": 0.0 if e.ip_address in seen_ips else 1.0,
            "is_new_user_agent_for_user": 0.0 if e.user_agent in seen_uas else 1.0,
            "minutes_since_prev_event": gap_min,
            "outside_baseline_hours": 1.0 if (t.hour < lo_h or t.hour > hi_h) else 0.0,
        })

        seen_ips.add(e.ip_address)
        seen_uas.add(e.user_agent)
        prev_time = t

    return rows, (lo_h, hi_h)


def rows_to_matrix(rows):
    """Convert feature dicts into a numeric matrix for the model."""
    return np.array([[r[name] for name in FEATURE_NAMES] for r in rows], dtype=float)
