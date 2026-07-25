from datetime import datetime

from app.extensions import db


class IncidentEvidence(db.Model):
    """A real file attached to a confirmed incident (screenshot, log export,
    exfiltrated-file sample, etc.) — actual bytes on disk, same storage
    discipline as workspace Files: a random UUID on disk, the real name only
    ever shown back to the analyst.
    """
    __tablename__ = 'incident_evidence'

    id = db.Column(db.Integer, primary_key=True)
    investigation_id = db.Column(db.Integer, db.ForeignKey('investigations.id'),
                                 nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)      # original name, for display
    file_path = db.Column(db.String(500), nullable=False)     # stored name on disk (uuid-based)
    size_bytes = db.Column(db.Integer)
    description = db.Column(db.String(500), nullable=True)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'investigation_id': self.investigation_id,
            'filename': self.filename,
            'size_bytes': self.size_bytes,
            'description': self.description,
            'uploaded_by': self.uploaded_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<IncidentEvidence {self.filename} inv={self.investigation_id}>'
