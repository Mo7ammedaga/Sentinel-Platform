import json
from datetime import datetime

from app.extensions import db


class AIAnalysis(db.Model):
    """One AI Engine analysis result for one event.

    This is the audit trail for every score the AI produces. When an analyst
    asks "why was this flagged?", the answer is READ FROM HERE — the stored
    feature vector and explanation — never recomputed. Events stay the immutable
    source of truth; this table records what the model concluded about them.
    """
    __tablename__ = 'ai_analyses'

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    organization_id = db.Column(db.String(50), nullable=False)

    risk_score = db.Column(db.Float, nullable=False, default=0.0)     # 0-100
    status = db.Column(db.String(50), nullable=False, default='normal')
    confidence = db.Column(db.Float, nullable=False, default=0.0)     # 0-1
    explanation = db.Column(db.Text)
    model_version = db.Column(db.String(50), nullable=False)
    feature_vector = db.Column(db.Text)                              # JSON
    insufficient_data = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_features(self, features: dict):
        self.feature_vector = json.dumps(features)

    def get_features(self) -> dict:
        return json.loads(self.feature_vector) if self.feature_vector else {}

    def __repr__(self):
        return f'<AIAnalysis event={self.event_id} {self.status} risk={self.risk_score}>'
