from flask import Blueprint, request, jsonify
from app.models import User
from app.extensions import db, limiter
from app.utils.auth import TokenManager
from app.utils.event_logger import EventLogger

auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """
    Login endpoint
    Takes: email, password
    Returns: JWT token
    
    العربي: نقطة تسجيل الدخول - تأخذ بريد وكلمة مرور وترجع token
    """
    data = request.get_json()
    
    # Check required fields
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400
    
    # Find user by email
    user = User.query.filter_by(email=data['email']).first()
    
    # Wrong password on a known account: record a failed-login event.
    # (Unknown emails have no user_id to attach to, so they are not logged here.)
    if user and not user.verify_password(data['password']):
        EventLogger.log_event(
            user_id=user.id, organization_id=user.organization_id,
            action_type='failed_login', resource_type='user',
            description='Failed login attempt')
        return jsonify({'error': 'Invalid email or password'}), 401

    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401

    # Generate an access token (short-lived) and a refresh token (long-lived).
    access_token = TokenManager.generate_token(user.id, user.email, user.role)
    refresh_token = TokenManager.generate_refresh_token(user.id)

    # Every successful login is a meaningful event for behaviour analytics.
    EventLogger.log_event(
        user_id=user.id, organization_id=user.organization_id,
        action_type='login', resource_type='user',
        description='User logged in')
    
    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token': access_token,               # backward-compatible alias
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.get_full_name(),
            'role': user.role
        }
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@limiter.limit("20 per minute")
def refresh():
    """Exchange a valid refresh token for a new access token."""
    data = request.get_json(silent=True) or {}
    token = data.get('refresh_token')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
    if not token:
        return jsonify({'error': 'refresh_token required'}), 400

    payload = TokenManager.verify_token(token)
    if not payload or payload.get('type') != 'refresh':
        return jsonify({'error': 'Invalid or expired refresh token'}), 401

    user = User.query.get(payload['user_id'])
    if not user or not user.is_active:
        return jsonify({'error': 'User not found or inactive'}), 401

    access_token = TokenManager.generate_token(user.id, user.email, user.role)
    return jsonify({'access_token': access_token, 'token': access_token}), 200


@auth_bp.route('/profile', methods=['GET'])
def profile():
    """
    Protected route - returns current user profile
    Requires: JWT token in Authorization header
    
    العربي: مسار محمي - يرجع بيانات الـ user الحالي
    """
    from app.utils.auth import token_required
    
    @token_required
    def get_profile():
        user = User.query.get(request.user_id)
        return jsonify({
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.get_full_name(),
                'role': user.role,
                'organization': user.organization_id
            }
        }), 200
    
    return get_profile()
