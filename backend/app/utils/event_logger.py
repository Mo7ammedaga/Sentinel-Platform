import logging

from app.models import Event
from app.extensions import db
from flask import request

logger = logging.getLogger(__name__)


class EventLogger:
    """Log events for audit trail and security monitoring"""
    
    @staticmethod
    def log_event(
        user_id: int,
        organization_id: str,
        action_type: str,
        resource_type: str,
        resource_id: int = None,
        description: str = None,
        status: str = 'normal',
        risk_score: float = 0.0
    ):
        """
        Log an event to database

        Example:
        EventLogger.log_event(
            user_id=1,
            organization_id='org_001',
            action_type='login',
            resource_type='user',
            description='User logged in'
        )
        """
        try:
            event = Event(
                user_id=user_id,
                organization_id=organization_id,
                action_type=action_type,
                resource_type=resource_type,
                resource_id=resource_id,
                description=description,
                ip_address=request.remote_addr if request else None,
                user_agent=request.headers.get('User-Agent') if request else None,
                status=status,
                risk_score=risk_score
            )
            
            db.session.add(event)
            db.session.commit()
            
            return event
        except Exception as e:
            db.session.rollback()
            logger.error("Error logging event: %s", e)
            return None
