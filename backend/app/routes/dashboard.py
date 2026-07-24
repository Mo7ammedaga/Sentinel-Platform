from datetime import datetime, timedelta

from flask import Blueprint, jsonify

from app.models import Event
from app.utils.auth import token_required
from app.utils.decorators import role_required
from app.utils.constants import SECURITY_ROLES

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/v1/dashboard')

@dashboard_bp.route('/stats', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def get_stats():
    """Dashboard statistics"""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    
    total_events = Event.query.filter(Event.created_at >= cutoff).count()
    critical_events = Event.query.filter(Event.status == 'critical', Event.created_at >= cutoff).count()
    suspicious_events = Event.query.filter(Event.status == 'suspicious', Event.created_at >= cutoff).count()
    normal_events = Event.query.filter(Event.status == 'normal', Event.created_at >= cutoff).count()
    
    return jsonify({
        'total_events': total_events,
        'critical': critical_events,
        'suspicious': suspicious_events,
        'normal': normal_events,
        'time_period': '24_hours'
    }), 200

@dashboard_bp.route('/alerts', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def get_alerts():
    """Critical and suspicious alerts only"""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    
    alerts = Event.query.filter(
        Event.status.in_(['critical', 'suspicious']),
        Event.created_at >= cutoff
    ).order_by(Event.created_at.desc()).limit(50).all()
    
    result = []
    for alert in alerts:
        result.append({
            'id': alert.id,
            'user_id': alert.user_id,
            'action': alert.action_type,
            'risk_score': alert.risk_score,
            'status': alert.status,
            'description': alert.description,
            'timestamp': alert.created_at.isoformat()
        })
    
    return jsonify({'alerts': result, 'count': len(result)}), 200

@dashboard_bp.route('/users/<int:user_id>/activity', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def get_user_activity(user_id):
    """Activity timeline for specific user"""
    cutoff = datetime.utcnow() - timedelta(days=7)
    
    events = Event.query.filter(
        Event.user_id == user_id,
        Event.created_at >= cutoff
    ).order_by(Event.created_at.desc()).limit(100).all()
    
    result = []
    for event in events:
        result.append({
            'action': event.action_type,
            'risk': event.risk_score,
            'status': event.status,
            'time': event.created_at.isoformat()
        })
    
    return jsonify({'user_id': user_id, 'activity': result}), 200
