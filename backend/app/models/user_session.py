from datetime import datetime

from app.extensions import db


class UserSession(db.Model):
    """One issued refresh token = one revocable 'device session'.

    The access token is short-lived and NOT individually revocable here (that
    would mean a DB lookup on every authenticated request); revoking a session
    stops it from minting new access tokens via /auth/refresh going forward.
    A revoked device is fully logged out once its current access token expires.
    """
    __tablename__ = 'user_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    jti = db.Column(db.String(64), unique=True, nullable=False, index=True)

    user_agent = db.Column(db.String(500))
    ip_address = db.Column(db.String(45))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used_at = db.Column(db.DateTime, default=datetime.utcnow)
    revoked_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<UserSession user={self.user_id} jti={self.jti[:8]}>'
