from datetime import datetime

from app.extensions import db
from app.utils.constants import InvestigationState


class Investigation(db.Model):
    """A human analyst's investigation of an alert.

    This is where the analyst — not the AI — reaches a verdict. The state moves
    through the documented workflow (Open -> Assigned -> Investigating ->
    Needs Evidence -> False Positive / Confirmed -> Closed). Every analyst
    action here is itself part of the audit story (who investigated what).
    """
    __tablename__ = 'investigations'

    id = db.Column(db.Integer, primary_key=True)
    alert_id = db.Column(db.Integer, db.ForeignKey('alerts.id'),
                         nullable=False, index=True)
    analyst_id = db.Column(db.Integer, db.ForeignKey('users.id'),
                           nullable=True, index=True)   # who is investigating
    organization_id = db.Column(db.String(50), nullable=False, index=True)

    state = db.Column(db.String(30), nullable=False,
                      default=InvestigationState.OPEN)
    notes = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)
    closed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'alert_id': self.alert_id,
            'analyst_id': self.analyst_id,
            'state': self.state,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
        }

    def __repr__(self):
        return f'<Investigation {self.id} alert={self.alert_id} {self.state}>'
