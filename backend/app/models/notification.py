from datetime import datetime

from app.extensions import db


class Notification(db.Model):
    """An in-app notification for one user (task assigned, message received, …)."""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'),
                        nullable=False, index=True)          # recipient
    organization_id = db.Column(db.String(50), nullable=False, index=True)

    type = db.Column(db.String(50), nullable=False)          # task_assigned, message_received, system
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text)
    link = db.Column(db.String(255))                         # e.g. /workspace, /chat
    is_read = db.Column(db.Boolean, nullable=False, default=False, index=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'body': self.body,
            'link': self.link,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
