import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env before any config class reads os.environ.
# Without this, running via `python run.py` silently falls back to the default
# secrets, which makes JWTs signed with the .env secret fail verification (401).
load_dotenv()


class Config:
    """Base configuration"""
    DEBUG = False
    TESTING = False
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///sentinel.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    
    # CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000')
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///sentinel_dev.db')
    # Off by default (query logs bury real errors). Enable when debugging SQL:
    #   SQLALCHEMY_ECHO=true python run.py
    SQLALCHEMY_ECHO = os.environ.get('SQLALCHEMY_ECHO', 'false').lower() == 'true'
    # Longer access tokens in development for convenience (doc 12). Production
    # uses the short base-config value (15 min) plus the refresh-token flow.
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    # Dev is intentionally permissive (the file:// dashboard sends Origin: null,
    # and the React dev server origin varies). Production uses a strict allowlist.
    CORS_ORIGINS = '*'


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = False
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    SQLALCHEMY_ECHO = False
    # Connection pooling for a managed PostgreSQL cluster (doc 12). pool_pre_ping
    # avoids handing out dead connections after a DB restart/idle timeout.
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 20,
        'max_overflow': 10,
        'pool_timeout': 30,
        'pool_recycle': 3600,
        'pool_pre_ping': True,
    }
    # CORS must be an explicit allowlist in production (comma-separated env).
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '')
