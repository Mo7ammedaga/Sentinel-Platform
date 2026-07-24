#!/usr/bin/env python3
"""
A0 — Development Behavior Generator  (DEVELOPMENT TOOL ONLY)

This is NOT part of the product and NOT part of Phase A. It is a development
tool whose only job is to produce realistic per-user event history so we can
build and validate the AI Engine's per-user baseline anomaly detection (A1).

Guarantees
----------
- Development-only: refuses to run unless the app config is development.
- Deterministic: all variation comes from a seeded PRNG (random.Random(seed)).
  The same --seed produces the same history. A fingerprint is printed so you
  can confirm two runs match. The AI Engine never sees the seed or any random
  value — it only reads the resulting Event rows.
- Safe: it only ever creates / clears clearly-marked DEV accounts
  (emails ending in "@sentinel.test"). Real users and real events are untouched.

Usage (from backend/, with venv active)
---------------------------------------
    python scripts/dev_behavior_generator.py --list-scenarios
    python scripts/dev_behavior_generator.py --seed 42
    python scripts/dev_behavior_generator.py --seed 42 --scenario bulk_download
    python scripts/dev_behavior_generator.py --seed 7 --days 30 \
        --scenario impossible_travel --scenario-user dev.sysadmin@sentinel.test
"""
import argparse
import hashlib
import os
import random
import sys
from datetime import datetime, timedelta

# Make the backend package importable no matter where this script is launched
# from (scripts/ is on sys.path by default, backend/ is not).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import User, Event

DEV_DOMAIN = "@sentinel.test"
DEV_PASSWORD = "DevPassword123"          # dev accounts only; never production
ORG = "org_001"
UA_BASELINE = "Mozilla/5.0 (X11; Linux x86_64) DevBaseline"

# --- Development test accounts (NOT real employees) --------------------------
# events_per_day and active_hours differ on purpose: that per-person difference
# is exactly what a per-user baseline must learn.
PROFILES = [
    {
        "email": "dev.accountant" + DEV_DOMAIN,
        "first_name": "Dev", "last_name": "Accountant", "role": "employee",
        "events_per_day": 12, "active_hours": (9, 17), "ip": "10.0.0.11",
        "actions": ["login", "create_task", "upload_file", "download_file",
                    "send_message", "create_note"],
    },
    {
        "email": "dev.sysadmin" + DEV_DOMAIN,
        "first_name": "Dev", "last_name": "Sysadmin", "role": "employee",
        "events_per_day": 55, "active_hours": (7, 21), "ip": "10.0.0.12",
        "actions": ["login", "download_file", "upload_file", "delete",
                    "create_task", "send_message"],
    },
    {
        "email": "dev.manager" + DEV_DOMAIN,
        "first_name": "Dev", "last_name": "Manager", "role": "manager",
        "events_per_day": 20, "active_hours": (8, 18), "ip": "10.0.0.13",
        "actions": ["login", "create_task", "send_message", "create_note",
                    "upload_file"],
    },
]

RESOURCE_FOR_ACTION = {
    "login": "user", "create_task": "task", "upload_file": "file",
    "download_file": "file", "send_message": "message",
    "create_note": "note", "delete": "file",
}


def make_event(user, action, when, ip, user_agent, description):
    """Build one Event row using the real schema (no assumptions)."""
    return Event(
        user_id=user.id, organization_id=ORG,
        action_type=action, resource_type=RESOURCE_FOR_ACTION.get(action, "user"),
        description=description, ip_address=ip, user_agent=user_agent,
        created_at=when,
    )


# --- Baseline (normal) history -----------------------------------------------
def build_baseline(user, profile, days, seed, ref):
    """Deterministic per-user normal history for the last `days` days.

    Seeded per user with (seed, email) so adding/removing a user never shifts
    another user's data. All times are anchored to `ref` (today's midnight),
    so the same seed on the same day => identical output.
    """
    rng = random.Random(f"{seed}:{profile['email']}")
    start_h, end_h = profile["active_hours"]

    events = []
    for d in range(days, 0, -1):                      # days ago .. yesterday
        day = ref - timedelta(days=d)
        n = max(1, profile["events_per_day"] + rng.randint(-3, 3))
        for _ in range(n):
            hour = rng.randint(start_h, end_h - 1)
            minute = rng.randint(0, 59)
            second = rng.randint(0, 59)
            action = rng.choice(profile["actions"])
            when = day.replace(hour=hour, minute=minute, second=second)
            events.append(make_event(
                user, action, when, profile["ip"], UA_BASELINE,
                f"{profile['first_name']} {action}"))
    return events


# --- Scenario library ---------------------------------------------------------
# Each scenario returns a list of Event rows placed in the last ~24h, clearly
# labeled with "[SCENARIO:name]". Named after real threat patterns.
def scenario_bulk_download(user, profile, ref):
    """Abnormal volume: many downloads within a few minutes."""
    t0 = ref - timedelta(hours=2)                     # ~22:00 yesterday
    return [make_event(user, "download_file", t0 + timedelta(seconds=40 * i),
                       profile["ip"], UA_BASELINE,
                       f"[SCENARIO:bulk_download] download #{i + 1}")
            for i in range(8)]


def scenario_night_activity(user, profile, ref):
    """Activity at ~3am — outside this user's normal active hours."""
    night = ref - timedelta(hours=21)                 # ~03:00 yesterday
    actions = ["login", "download_file", "upload_file", "download_file", "delete"]
    return [make_event(user, a, night + timedelta(minutes=7 * i),
                       profile["ip"], UA_BASELINE,
                       f"[SCENARIO:night_activity] {a} at night")
            for i, a in enumerate(actions)]


def scenario_impossible_travel(user, profile, ref):
    """Two logins minutes apart from far-apart IPs — physically impossible."""
    t = ref - timedelta(hours=3)                      # ~21:00 yesterday
    return [
        make_event(user, "login", t, profile["ip"], UA_BASELINE,
                   "[SCENARIO:impossible_travel] login from office IP"),
        make_event(user, "login", t + timedelta(minutes=8), "203.0.113.55",
                   UA_BASELINE,
                   "[SCENARIO:impossible_travel] login from distant IP"),
    ]


def scenario_new_device(user, profile, ref):
    """A login from a user-agent this user has never used before."""
    t = ref - timedelta(hours=1)                      # ~23:00 yesterday
    new_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) NewDevice"
    return [make_event(user, "login", t, profile["ip"], new_ua,
                       "[SCENARIO:new_device] login from unknown device")]


SCENARIOS = {
    "none": None,
    "bulk_download": scenario_bulk_download,
    "night_activity": scenario_night_activity,
    "impossible_travel": scenario_impossible_travel,
    "new_device": scenario_new_device,
}


def fingerprint(events):
    """Stable short hash over events — same seed/day => same fingerprint."""
    h = hashlib.sha256()
    for e in sorted(events, key=lambda ev: (ev.user_id, ev.created_at, ev.action_type)):
        h.update(f"{e.user_id}|{e.created_at.isoformat()}|{e.action_type}|{e.ip_address}".encode())
    return h.hexdigest()[:16]


def main():
    parser = argparse.ArgumentParser(
        description="A0 Development Behavior Generator (development only)")
    parser.add_argument("--seed", type=int, default=42,
                        help="PRNG seed; same seed => same data (default 42)")
    parser.add_argument("--days", type=int, default=30,
                        help="days of baseline history per user (default 30)")
    parser.add_argument("--scenario", default="none", choices=list(SCENARIOS),
                        help="anomaly scenario to inject (default: none)")
    parser.add_argument("--scenario-user", default="dev.accountant" + DEV_DOMAIN,
                        help="which dev account the scenario applies to")
    parser.add_argument("--list-scenarios", action="store_true",
                        help="list available scenarios and exit")
    args = parser.parse_args()

    if args.list_scenarios:
        print("Available scenarios:")
        for name in SCENARIOS:
            print(f"  - {name}")
        return

    app = create_app()

    # --- production safety guard -------------------------------------------
    env = os.environ.get("SENTINEL_ENVIRONMENT", "development").lower()
    if env == "production" or not app.config.get("DEBUG", False):
        print("REFUSING TO RUN: development-only tool, but the current config is "
              "not development (DEBUG off / SENTINEL_ENVIRONMENT=production).")
        sys.exit(1)

    # One deterministic reference time for the whole run (today's midnight),
    # so every timestamp — baseline and scenario — is reproducible for the day.
    ref = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    with app.app_context():
        all_dev_events = []
        for profile in PROFILES:
            user = User.query.filter_by(email=profile["email"]).first()
            if user is None:
                user = User(email=profile["email"],
                            first_name=profile["first_name"],
                            last_name=profile["last_name"],
                            role=profile["role"], organization_id=ORG)
                user.set_password(DEV_PASSWORD)          # real bcrypt hash
                db.session.add(user)
                db.session.flush()                       # assign user.id
            else:
                # regenerate cleanly: clear only THIS dev user's events
                Event.query.filter_by(user_id=user.id).delete()

            events = build_baseline(user, profile, args.days, args.seed, ref)
            db.session.add_all(events)
            all_dev_events.extend(events)
            print(f"  {profile['email']:34s} {len(events):5d} baseline events "
                  f"({profile['events_per_day']}/day, "
                  f"{profile['active_hours'][0]:02d}-{profile['active_hours'][1]:02d}h)")

        injected = 0
        if args.scenario != "none":
            target = User.query.filter_by(email=args.scenario_user).first()
            if target is None:
                print(f"Scenario user {args.scenario_user} not found.")
                sys.exit(1)
            profile = next(p for p in PROFILES if p["email"] == args.scenario_user)
            scenario_events = SCENARIOS[args.scenario](target, profile, ref)
            db.session.add_all(scenario_events)
            all_dev_events.extend(scenario_events)
            injected = len(scenario_events)

        # Compute the fingerprint BEFORE commit — commit expires the ORM objects
        # and their attributes would no longer be readable.
        fp = fingerprint(all_dev_events)
        total = len(all_dev_events)
        db.session.commit()

    print("-" * 60)
    print(f"Scenario injected : {args.scenario} "
          f"({injected} events on {args.scenario_user})"
          if injected else "Scenario injected : none")
    print(f"Total dev events  : {total}")
    print(f"Seed / days       : {args.seed} / {args.days}")
    print(f"Fingerprint       : {fp}  (same seed+day => same fingerprint)")
    print("Real user and real events were NOT touched.")


if __name__ == "__main__":
    main()
