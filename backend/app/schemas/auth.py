"""Request schemas for authentication."""
from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    # A light email-shaped check (avoids adding the email-validator dependency).
    email: str = Field(min_length=3, max_length=255,
                       pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class RoleUpdate(BaseModel):
    role: str = Field(pattern=r'^(employee|manager|analyst|admin)$')
