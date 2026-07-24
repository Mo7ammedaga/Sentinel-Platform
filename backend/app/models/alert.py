from datetime import datetime

from app.extensions import db
from app.utils.constants import AlertStatus


class Alert(db.Model):
    """An AI-raised alert about one anomalous event.

    Alerts are NOT conclusions (constitution). The AI raises an Alert when an
    event crosses the suspicious/critical threshold; a human analyst then opens
    an Investigation from it and makes the final judgment.

    One Alert per triggering event (event_id is unique) — re-analysis updates
    the existing Alert rather than piling up duplicates.
    """
    __tablename__ = 'alerts'

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'),
                         nullable=False, unique=True, index=True)
    ai_analysis_id = db.Column(db.Integer, db.ForeignKey('ai_analyses.id'),
                               nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'),
                        nullable=False, index=True)   # the subject user
    organization_id = db.Column(db.String(50), nullable=False, index=True)

    severity = db.Column(db.String(20), nullable=False)      # suspicious|critical
    risk_score = db.Column(db.Float, nullable=False, default=0.0)
    title = db.Column(db.String(255))
    explanation = db.Column(db.Text)
    status = db.Column(db.String(20), nullable=False, default=AlertStatus.OPEN)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    investigations = db.relationship('Investigation', backref='alert',
                                     lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'user_id': self.user_id,
            'severity': self.severity,
            'risk_score': self.risk_score,
            'title': self.title,
            'explanation': self.explanation,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<Alert {self.id} {self.severity} user={self.user_id}>'
