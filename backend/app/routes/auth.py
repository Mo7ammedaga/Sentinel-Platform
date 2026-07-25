import os

from flask import Blueprint, request, jsonify, send_from_directory
from app.models import User
from app.extensions import db, limiter
from app.utils.auth import TokenManager, token_required
from app.utils.event_logger import EventLogger
from app.utils.validation import validate_body, validated_data
from app.utils.constants import Roles
from app.schemas.auth import RegisterRequest, ProfileUpdate, PasswordChange
from app.services import profile_service, session_service

auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

# MVP is single-organization; new sign-ups join it.
DEFAULT_ORG = 'org_001'


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

    tokens = session_service.issue_tokens(user)   # auto-login on signup
    return jsonify({**tokens, 'token': tokens['access_token'],
                    'user': _user_dict(user)}), 201

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """
    Login endpoint
    Takes: email, password
    Returns: JWT token
    """
    data = request.get_json()

    # Check required fields
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400

    # Normalize exactly like register() does — without this, an account
    # created/looked-up as "user@x.com" silently fails to match a login
    # attempt typed as "User@X.com" or with stray whitespace, and that
    # "no such row" case returns the exact same generic 401 as a wrong
    # password, making the two indistinguishable from the outside.
    email = data['email'].strip().lower()
    user = User.query.filter_by(email=email).first()

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

    # Issue tokens AND record this as a revocable device session.
    tokens = session_service.issue_tokens(user)

    # Every successful login is a meaningful event for behaviour analytics.
    EventLogger.log_event(
        user_id=user.id, organization_id=user.organization_id,
        action_type='login', resource_type='user',
        description='User logged in')

    return jsonify({
        **tokens,
        'token': tokens['access_token'],     # backward-compatible alias
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

    jti = payload.get('jti')
    if not session_service.touch_session(jti):
        return jsonify({'error': 'This session has been signed out'}), 401

    user = User.query.get(payload['user_id'])
    if not user or not user.is_active:
        return jsonify({'error': 'User not found or inactive'}), 401

    access_token = TokenManager.generate_token(user.id, user.email, user.role, sid=jti)
    return jsonify({'access_token': access_token, 'token': access_token}), 200


def _full_profile_dict(user):
    return {
        'id': user.id,
        'email': user.email,
        'name': user.get_full_name(),
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'organization': user.organization_id,
        'bio': user.bio,
        'avatar_url': f'/api/v1/auth/avatar/{user.id}' if user.avatar_path else None,
    }


@auth_bp.route('/profile', methods=['GET'])
@token_required
def profile():
    """Protected route — returns the current user's full profile."""
    user = User.query.get(request.user_id)
    return jsonify({'user': _full_profile_dict(user)}), 200


@auth_bp.route('/profile', methods=['PATCH'])
@token_required
@validate_body(ProfileUpdate)
def update_profile():
    """Update your own name/bio. Email and role are never editable here."""
    user = User.query.get(request.user_id)
    user = profile_service.update_profile(user, validated_data())
    return jsonify({'user': _full_profile_dict(user)}), 200


@auth_bp.route('/change-password', methods=['POST'])
@token_required
@limiter.limit("5 per minute")
@validate_body(PasswordChange)
def change_password():
    user = User.query.get(request.user_id)
    data = validated_data()
    ok, error = profile_service.change_password(
        user, data['current_password'], data['new_password'])
    if not ok:
        return jsonify({'error': error}), 400
    return jsonify({'message': 'Password updated'}), 200


@auth_bp.route('/avatar', methods=['POST'])
@token_required
def upload_avatar():
    """multipart/form-data: 'file' — the real image picked on the user's device."""
    user = User.query.get(request.user_id)
    upload = request.files.get('file')
    user, error = profile_service.save_avatar(user, upload)
    if error:
        return jsonify({'error': error}), 400
    return jsonify({'user': _full_profile_dict(user)}), 200


@auth_bp.route('/avatar/<int:user_id>', methods=['GET'])
def get_avatar(user_id):
    """Serves the actual image bytes. Deliberately NOT token_required — a
    profile photo isn't sensitive, and this lets plain <img src> tags work."""
    user = User.query.get(user_id)
    if user is None or not user.avatar_path:
        return jsonify({'error': 'No avatar'}), 404
    disk_path = profile_service.avatar_disk_path(user.avatar_path)
    if not os.path.isfile(disk_path):
        return jsonify({'error': 'No avatar'}), 404
    directory, name = os.path.split(disk_path)
    return send_from_directory(directory, name)


@auth_bp.route('/sessions', methods=['GET'])
@token_required
def list_sessions():
    """Your active device sessions — each one a distinct login (browser/device)."""
    sessions = session_service.list_sessions(request.user_id, current_sid=request.sid)
    return jsonify({'sessions': sessions}), 200


@auth_bp.route('/sessions/<int:session_id>', methods=['DELETE'])
@token_required
def revoke_session(session_id):
    """Sign out one device. Revoking the current session logs this device out
    too, once its (already-issued) access token expires."""
    ok, error = session_service.revoke_session(request.user_id, session_id)
    if not ok:
        return jsonify({'error': error}), 404
    return jsonify({'id': session_id, 'revoked': True}), 200
