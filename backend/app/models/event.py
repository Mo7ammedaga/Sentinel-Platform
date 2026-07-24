from app.extensions import db
from datetime import datetime

class Event(db.Model):
    """Event log - every action creates an event"""
    __tablename__ = 'events'
    
    id = db.Column(db.Integer, primary_key=True)
    # Indexed: the events table is queried constantly by user, org, status and
    # time window (per-user history, 24h dashboards, purge). See docs/14.
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    organization_id = db.Column(db.String(50), nullable=False, index=True)

    # What happened
    action_type = db.Column(db.String(50), nullable=False)  # login, create_task, upload_file, etc
    resource_type = db.Column(db.String(50), nullable=False)  # user, task, file, message, etc
    resource_id = db.Column(db.Integer)  # ID of the resource

    # Details
    description = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)

    # Status
    status = db.Column(db.String(50), default='normal', index=True)  # normal, suspicious, critical
    risk_score = db.Column(db.Float, default=0.0)  # 0-100

    # Timestamp
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def __repr__(self):
        return f'<Event {self.action_type} by user {self.user_id}>'
