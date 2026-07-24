from app.extensions import db
from app.utils.auth import PasswordManager
from datetime import datetime

class User(db.Model):
    """User model - represents a user in Sentinel Platform"""
    
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    organization_id = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='employee')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def set_password(self, password: str):
        """Hash and set password"""
        self.password_hash = PasswordManager.hash_password(password)
    
    def verify_password(self, password: str) -> bool:
        """Check if password is correct"""
        return PasswordManager.verify_password(password, self.password_hash)
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'
