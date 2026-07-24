"""In-app notifications (doc 05 module 8).

Other services call notify() to create a notification; the notifications routes
let a user read and clear their own. Kept separate so it has no dependency on
the workspace service (avoids import cycles).
"""
from app.extensions import db
from app.models import Notification, User


def notify(user_id, notif_type, title, body=None, link=None):
    """Create a notification for a user. Best-effort: never raises into the
    caller's flow (a failed notification must not fail the underlying action)."""
    user = User.query.get(user_id)
    if user is None:
        return None
    n = Notification(user_id=user_id, organization_id=user.organization_id,
                     type=notif_type, title=title, body=body, link=link)
    db.session.add(n)
    return n


def list_for(user_id):
    return (Notification.query.filter_by(user_id=user_id)
            .order_by(Notification.created_at.desc()))


def unread_count(user_id):
    return Notification.query.filter_by(user_id=user_id, is_read=False).count()


def mark_read(user_id, notification_id):
    n = Notification.query.get(notification_id)
    if n is None or n.user_id != user_id:
        return None, 'Notification not found'
    n.is_read = True
    db.session.commit()
    return n, None


def mark_all_read(user_id):
    updated = (Notification.query
               .filter_by(user_id=user_id, is_read=False)
               .update({'is_read': True}, synchronize_session=False))
    db.session.commit()
    return updated
