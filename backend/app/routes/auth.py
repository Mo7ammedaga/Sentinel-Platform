from flask import Blueprint, request, jsonify
from app.models import User
from app.extensions import db, limiter
from app.utils.auth import TokenManager, token_required
from app.utils.event_logger import EventLogger
from app.utils.validation import validate_body, validated_data
from app.utils.constants import Roles
from app.schemas.auth import RegisterRequest

auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

# MVP is single-organization; new sign-ups join it.
DEFAULT_ORG = 'org_001'


def _tokens_for(user):
    return {
        'access_token': TokenManager.generate_token(user.id, user.email, user.role),
        'refresh_token': TokenManager.generate_refresh_token(user.id),
    }


def _user_dict(user):
    return {'id': user.id, 'email': user.email, 'name': user.get_full_name(),
            'role': user.role}


@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
@validate_body(RegisterRequest)
def register():
    """Public self-registration. Always creates an EMPLOYEE — elevated roles
    (manager/analyst/admin) are assigned by an administrator, never self-chosen.
    """
    data = validated_data()
    email = data['email'].strip().lower()
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(email=email, first_name=data['first_name'],
                last_name=data['last_name'], role=Roles.EMPLOYEE,
                organization_id=DEFAULT_ORG)
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    EventLogger.log_event(
        user_id=user.id, organization_id=user.organization_id,
        action_type='register', resource_type='user',
        description='User registered')

    tokens = _tokens_for(user)          # auto-login on signup
    return jsonify({**tokens, 'token': tokens['access_token'],
                    'user': _user_dict(user)}), 201

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
@token_required
def profile():
    """Protected route — returns the current user's profile."""
    user = User.query.get(request.user_id)
    return jsonify({
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.get_full_name(),
            'role': user.role,
            'organization': user.organization_id,
        }
    }), 200
