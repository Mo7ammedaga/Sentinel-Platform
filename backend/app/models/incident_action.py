from datetime import datetime

from app.extensions import db


class IncidentAction(db.Model):
    """One entry in a confirmed incident's audit trail — containment steps,
    remediation, escalation, evidence attached, analyst notes, and status
    changes all land here in one chronological timeline. Append-only: nothing
    here is ever edited or deleted, so the record stays trustworthy.
    """
    __tablename__ = 'incident_actions'

    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(db.Integer, db.ForeignKey('investigations.id'),
                                 nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    action_type = db.Column(db.String(30), nullable=False)
    description = db.Column(db.Text, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'investigation_id': self.investigation_id,
            'actor_id': self.actor_id,
            'action_type': self.action_type,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<IncidentAction {self.id} {self.action_type} inv={self.investigation_id}>'
