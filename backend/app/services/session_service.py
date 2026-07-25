"""Session / device management.

Every login or registration issues a refresh token that is also recorded as a
UserSession row (keyed by a random jti embedded in both the refresh token and
its matching access token). This is what makes "sign out this device" real:
revoking a session stops /auth/refresh from minting further access tokens for
it, rather than "logout" being purely a client-side token deletion.
"""
import uuid
from datetime import datetime

from flask import request

from app.extensions import db
from app.models import UserSession
from app.utils.auth import TokenManager


def _device_label(user_agent):
    ua = (user_agent or '').lower()
    if 'android' in ua:
        os_label = 'Android'
    elif 'iphone' in ua or 'ipad' in ua:
        os_label = 'iOS'
    elif 'windows' in ua:
        os_label = 'Windows'
    elif 'mac os' in ua or 'macintosh' in ua:
        os_label = 'Mac'
    elif 'linux' in ua:
        os_label = 'Linux'
    else:
        os_label = 'Unknown device'

    if 'edg' in ua:
        browser = 'Edge'
    elif 'chrome' in ua:
        browser = 'Chrome'
    elif 'firefox' in ua:
        browser = 'Firefox'
    elif 'safari' in ua:
        browser = 'Safari'
    else:
        browser = 'Unknown browser'

    return f'{browser} on {os_label}'


def issue_tokens(user):
    """Create a new session + a matching access/refresh token pair."""
    jti = uuid.uuid4().hex
    session = UserSession(
        user_id=user.id, jti=jti,
        user_agent=request.headers.get('User-Agent', '')[:500],
        ip_address=request.remote_addr,
    )
    db.session.add(session)
    db.session.commit()

    access_token = TokenManager.generate_token(user.id, user.email, user.role, sid=jti)
    refresh_token = TokenManager.generate_refresh_token(user.id, jti=jti)
    return {'access_token': access_token, 'refresh_token': refresh_token}


def touch_session(jti):
    """Called on every successful /auth/refresh. Returns False if the session
    is unknown or has been revoked — the caller must then reject the refresh."""
    if not jti:
        return True   # old tokens issued before this feature carry no jti
    session = UserSession.query.filter_by(jti=jti).first()
    if session is None or session.revoked_at is not None:
        return False
    session.last_used_at = datetime.utcnow()
    db.session.commit()
    return True


def list_sessions(user_id, current_sid=None):
    sessions = (UserSession.query
                .filter_by(user_id=user_id, revoked_at=None)
                .order_by(UserSession.last_used_at.desc()).all())
    return [{
        'id': s.id,
        'device': _device_label(s.user_agent),
        'ip_address': s.ip_address,
        'created_at': s.created_at.isoformat() if s.created_at else None,
        'last_used_at': s.last_used_at.isoformat() if s.last_used_at else None,
        'is_current': s.jti == current_sid,
    } for s in sessions]


def revoke_session(user_id, session_id):
    session = UserSession.query.filter_by(id=session_id, user_id=user_id).first()
    if session is None:
        return False, 'Session not found'
    session.revoked_at = datetime.utcnow()
    db.session.commit()
    return True, None


def revoke_current_session(user_id, jti):
    """Called on logout: revoke the session tied to the access token's own
    sid, so the matching refresh token stops working too — logout is a real
    server-side sign-out, not just deleting tokens client-side."""
    if not jti:
        return   # old tokens issued before sessions existed carry no jti
    session = UserSession.query.filter_by(jti=jti, user_id=user_id).first()
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.utcnow()
        db.session.commit()
