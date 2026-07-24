"""Unit tests for the AI engine (no DB needed — pure functions)."""
from datetime import datetime, timedelta
from types import SimpleNamespace

from app.ai.analyzer import analyze_user_events, MIN_HISTORY
from app.ai.feature_extractor import extract_user_features, is_sensitive_action


def _ev(dt, action='login', ip='10.0.0.1', ua='UA'):
    return SimpleNamespace(created_at=dt, action_type=action, user_id=1,
                           ip_address=ip, user_agent=ua)


def test_is_sensitive_action_prefixes():
    assert is_sensitive_action('download_file')
    assert is_sensitive_action('delete_project')
    assert is_sensitive_action('export_data')
    assert not is_sensitive_action('login')
    assert not is_sensitive_action('create_task')
    assert not is_sensitive_action(None)


def test_features_are_deterministic():
    base = datetime(2026, 1, 1, 9)
    events = [_ev(base + timedelta(hours=i)) for i in range(10)]
    r1, h1 = extract_user_features(events)
    r2, h2 = extract_user_features(events)
    assert r1 == r2 and h1 == h2


def test_insufficient_history_is_flagged():
    base = datetime(2026, 1, 1, 9)
    events = [_ev(base + timedelta(minutes=i)) for i in range(MIN_HISTORY - 1)]
    results = analyze_user_events(events)
    assert results and all(r.insufficient_data for r in results)
    assert all(r.status == 'normal' for r in results)


def test_off_hours_burst_is_flagged_against_baseline():
    base = datetime(2026, 1, 1)
    actions = ['login', 'create_task', 'send_message', 'upload_file']
    events = []
    # ~120 varied, work-hours events over 40 days (a realistic baseline)
    for d in range(1, 41):
        day = base + timedelta(days=d)
        for k in range(3):
            hour = 9 + ((d * 3 + k) % 8)                 # 9-16h
            minute = (d * 7 + k * 13) % 60
            action = actions[(d + k) % len(actions)]
            events.append(_ev(day.replace(hour=hour, minute=minute), action=action))
    # anomaly: off-hours + sensitive + new IP + new device (maximally unusual)
    night = base + timedelta(days=41, hours=3)
    for i in range(3):
        events.append(_ev(night + timedelta(minutes=i * 2), action='download_file',
                          ip='203.0.113.9', ua='NewDevice'))
    events.sort(key=lambda e: e.created_at)

    results = analyze_user_events(events)
    flagged = [r for r in results
               if r.event.action_type == 'download_file' and r.status != 'normal']
    assert flagged, 'the off-hours download burst should be flagged'
    # and normal logins should overwhelmingly stay normal
    normal_logins = [r for r in results if r.event.action_type == 'login']
    assert sum(r.status == 'normal' for r in normal_logins) > 0.9 * len(normal_logins)
    # explanations must never claim malice
    for r in flagged:
        assert 'malicious' not in r.explanation.lower()
