"""Privacy & subject-access endpoints (Phase E).

- /privacy/notice is public: transparency about what is monitored.
- /me/events[/export] let ANY authenticated user see and export THEIR OWN data
  (a subject-access right) — no security role required, but only their own events.
"""
from flask import Blueprint, request, jsonify

from app.services import privacy_service
from app.utils.auth import token_required
from app.utils.api import paginate, paginated

privacy_bp = Blueprint('privacy', __name__, url_prefix='/api/v1')


@privacy_bp.route('/privacy/notice', methods=['GET'])
def privacy_notice():
    """Public monitoring notice — what is and isn't collected, and why."""
    return jsonify(privacy_service.MONITORING_NOTICE), 200


@privacy_bp.route('/me/events', methods=['GET'])
@token_required
def my_events():
    """The authenticated user's own event history (paginated)."""
    page = paginate(privacy_service.own_events_query(request.user_id))
    items = [privacy_service._serialize(e) for e in page.items]
    return jsonify(paginated(page, items)), 200


@privacy_bp.route('/me/events/export', methods=['GET'])
@token_required
def export_my_events():
    """Full export of the user's own event history as a downloadable file."""
    payload = privacy_service.export_own_events(request.user_id)
    resp = jsonify(payload)
    resp.headers['Content-Disposition'] = 'attachment; filename=my_events.json'
    return resp, 200
