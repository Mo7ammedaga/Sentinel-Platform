# Demo video script

A shot-by-shot storyboard for a ~3–4 minute walkthrough. Record with any
screen recorder (OBS, QuickTime, Loom); no editing skill required — it's one
continuous take per section, cut between sections if you like.

**Setup before recording:** don't demo against your real dev database. Seed a
clean throwaway one so the story is coherent instead of showing whatever test
data happens to be lying around:

```bash
cd backend
python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
DATABASE_URL="sqlite:////tmp/demo.db" FLASK_APP=run.py flask db upgrade
DATABASE_URL="sqlite:////tmp/demo.db" python scripts/dev_behavior_generator.py --seed 42 --scenario bulk_download
DATABASE_URL="sqlite:////tmp/demo.db" python run.py    # :5000
```
Then register two accounts through the UI: one you'll promote to `analyst`
(via `PATCH /api/v1/admin/users/<id>/role` — you'll need one `admin` too;
easiest is to set one directly in the DB), and use the dev accounts the
generator created (`dev.accountant@sentinel.test` / `DevPassword123`) as the
employee whose alert you'll investigate.

---

## 1. Cold open — the problem (10s)

**Show:** the login screen.
**Say:** "Sentinel is a User Behavior Analytics platform — it watches for
insider threats, but every score it produces is explainable, and the AI never
takes action. It only ever flags; a human always decides."

## 2. Security Dashboard (30s)

**Do:** log in as the analyst → land on `/dashboard`.
**Say:** "This is the analyst's home base. Nothing here is synthetic —
every number traces back to real events." Point at:
- The four stat cards (events, critical, suspicious, normal)
- The risk trend chart — "risk over time, not just a snapshot"
- The activity heatmap — "90 days of real behavioral density"

**Click** the "Critical" stat card to show it deep-links straight into a
filtered Alerts view — a small but real UX detail.

## 3. An alert, explained (30s)

**Show:** `/alerts`, scroll to the flagged download-burst alert.
**Say:** "Here's the anomaly the generator injected — a burst of downloads
outside this user's normal hours. Read the explanation out loud:" ("8 events
in 5 min vs this user's typical 1; activity at 22:00, outside this user's
usual 07–20h; a sensitive action.") "That's not a canned message — it's
generated from the actual feature vector that fed the model, and it's stored
permanently. An analyst can always ask 'why was this flagged' and get the real
answer."

## 4. Investigate → Confirm (30s)

**Click** "Investigate" → the quick-transition modal opens.
**Say:** "The analyst reviews and reaches a verdict — false positive, or
confirmed. I'll confirm this one." Type a short note, click **Confirmed**.
**Say (as the modal changes):** "Notice it doesn't just close. Confirming a
real threat opens the incident-response phase — this is the same case file,
not a new screen."

## 5. Incident Response workflow — the centerpiece (60–90s)

This is the newest and most substantial feature — give it the most time.

**Do, narrating each step:**
1. Set **Severity** to High. *"The analyst assigns their own severity — separate from the AI's alert severity."*
2. **Escalate** to the admin account, with a short note. *"One click hands this to an administrator, who gets a real notification — no automated action, just a routed decision."*
3. Log a **Containment** action ("Revoked active sessions and reset credentials.") *"Every step is timestamped and attributed — this becomes the audit trail."*
4. Log a **Remediation** action.
5. Attach a piece of **Evidence** (any small file) with a caption. *"Real bytes on disk, downloadable later — not just a filename."*
6. Move the state to **Containing**, then show the **Resolution summary** field. *"Closing a confirmed incident requires a summary — you can't archive a real case with no record of what happened."*
7. Scroll the **Response timeline** to show the full chronological log in one place.

**Say (wrap):** "That whole sequence — confirm, assign severity, escalate,
contain, remediate, attach evidence, resolve — is one continuous, permanent
record on a single case. Nothing here is hidden or overwritten."

## 6. Incidents view (15s)

**Show:** `/incidents`.
**Say:** "This is the case-management view — every confirmed incident, filterable by phase, separate from the raw alert inbox."

## 7. The other side: Workspace (30s)

**Do:** log in as (or switch to) an employee account → `/workspace`.
**Say:** "This is what generates the behavioral signal in the first place —
a real Kanban workspace. Every create, upload, download, and status change is
exactly one Event." Open a project, drag/move a task, open a task to show
notes and a real file upload.

## 8. Team Chat + Account (20s)

**Show:** `/chat` — send a message, point out the read receipt.
**Show:** `/account` — profile tabs, sessions list.
**Say:** "Real-time messaging and session management round out the workspace
side — this is a product employees would actually use daily, which is what
makes the behavioral data real instead of synthetic."

## 9. Close (10s)

**Say:** "Flask, SQLAlchemy, and a real per-user Isolation Forest on the
backend; React and TypeScript on the front. 71 backend tests, 17 frontend
tests, CI on every push. Repo and docs are linked below."

---

### Shot list (if you'd rather capture stills than record video)

Matches `docs/screenshots/`: login → dashboard → alerts → incident detail
(mid-workflow, evidence attached) → incidents list → user management →
workspace → kanban board → chat → account → notifications.
