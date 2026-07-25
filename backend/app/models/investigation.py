from datetime import datetime

from app.extensions import db
from app.utils.constants import InvestigationState


class Investigation(db.Model):
    """A human analyst's investigation of an alert.

    This is where the analyst — not the AI — reaches a verdict. The state moves
    through the documented workflow (Open -> Assigned -> Investigating ->
    Needs Evidence -> False Positive / Confirmed). Confirming a real threat
    does not end the case: it opens the incident-response phase (Confirmed ->
    Containing -> Resolved -> Closed), same record throughout, so the full
    lifecycle stays on one audit trail. Every analyst action here is itself
    part of the audit story (who investigated what, and what they did about it).
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

    # Incident-response phase (populated once the analyst confirms a real
    # threat — constitution: the analyst decides, the AI never acts).
    severity = db.Column(db.String(20), nullable=True)     # low/medium/high/critical
    resolution_summary = db.Column(db.Text, nullable=True)  # required before Closed
    escalated_to_id = db.Column(db.Integer, db.ForeignKey('users.id'),
                                nullable=True)              # must be an admin
    escalated_at = db.Column(db.DateTime, nullable=True)
    escalation_note = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)
    confirmed_at = db.Column(db.DateTime, nullable=True)   # verdict reached
    resolved_at = db.Column(db.DateTime, nullable=True)    # response complete
    closed_at = db.Column(db.DateTime, nullable=True)      # archived

    def to_dict(self):
        return {
            'id': self.id,
            'alert_id': self.alert_id,
            'analyst_id': self.analyst_id,
            'state': self.state,
            'notes': self.notes,
            'severity': self.severity,
            'resolution_summary': self.resolution_summary,
            'escalated_to_id': self.escalated_to_id,
            'escalated_at': self.escalated_at.isoformat() if self.escalated_at else None,
            'escalation_note': self.escalation_note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
        }

    def __repr__(self):
        return f'<Investigation {self.id} alert={self.alert_id} {self.state}>'
