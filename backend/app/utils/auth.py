import bcrypt
import jwt
from datetime import datetime, timedelta
from flask import current_app

class PasswordManager:
    @staticmethod
    def hash_password(password: str) -> str:
        salt = bcrypt.gensalt(rounds=10)
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hash_password: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), hash_password.encode('utf-8'))

class TokenManager:
    @staticmethod
    def generate_token(user_id: int, user_email: str, role: str, sid: str = None) -> str:
        """Short-lived ACCESS token used to call protected endpoints.

        `sid` (session id) links this token back to the UserSession/refresh
        token that produced it, so /auth/sessions can mark "this device".
        """
        expires = current_app.config.get('JWT_ACCESS_TOKEN_EXPIRES',
                                          timedelta(hours=24))
        payload = {
            'user_id': user_id,
            'email': user_email,
            'role': role,
            'type': 'access',
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + expires
        }
        if sid:
            payload['sid'] = sid
        return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')

    @staticmethod
    def generate_refresh_token(user_id: int, jti: str = None) -> str:
        """Long-lived REFRESH token, used only to obtain a new access token.

        `jti` is the UserSession's unique id — this is what makes a session
        individually revocable (see routes/auth.py /auth/sessions).
        """
        expires = current_app.config.get('JWT_REFRESH_TOKEN_EXPIRES',
                                          timedelta(days=7))
        payload = {
            'user_id': user_id,
            'type': 'refresh',
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + expires
        }
        if jti:
            payload['jti'] = jti
        return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    @staticmethod
    def verify_token(token: str) -> dict:
        try:
            payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None


from functools import wraps
from flask import request

def token_required(f):
    """
    Decorator to protect routes
    Checks if token is valid before allowing access
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return {'error': 'Invalid token format'}, 401
        
        if not token:
            return {'error': 'Token is missing'}, 401
        
        # Verify token
        payload = TokenManager.verify_token(token)
        if not payload:
            return {'error': 'Invalid or expired token'}, 401

        # A refresh token must not be usable as an access token.
        if payload.get('type') == 'refresh':
            return {'error': 'Cannot use a refresh token to access resources'}, 401

        # Pass payload to the route function
        request.user_id = payload['user_id']
        request.user_email = payload['email']
        request.user_role = payload['role']
        request.sid = payload.get('sid')      # which session/device issued this token
        
        return f(*args, **kwargs)
    
    return decorated
