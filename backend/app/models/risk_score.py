from datetime import datetime

from app.extensions import db


class RiskScore(db.Model):
    """A user's CURRENT aggregate risk level (one row per user).

    Design note: per-event risk already lives in AIAnalysis. Duplicating that
    per event here would violate "don't duplicate" (constitution). Instead this
    is a per-USER rollup that powers the "High-Risk Users" dashboard view — a
    denormalized summary updated whenever analysis runs, cheap to query.
    """
    __tablename__ = 'risk_scores'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'),
                        nullable=False, unique=True, index=True)
    organization_id = db.Column(db.String(50), nullable=False, index=True)

    current_score = db.Column(db.Float, nullable=False, default=0.0)   # 0-100
    open_alerts = db.Column(db.Integer, nullable=False, default=0)
    last_flagged_at = db.Column(db.DateTime, nullable=True)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'organization_id': self.organization_id,
            'current_score': self.current_score,
            'open_alerts': self.open_alerts,
            'last_flagged_at': self.last_flagged_at.isoformat() if self.last_flagged_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<RiskScore user={self.user_id} score={self.current_score}>'
