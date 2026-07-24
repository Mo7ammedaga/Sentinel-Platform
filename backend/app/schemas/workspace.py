"""Request schemas for workspace write endpoints.

Update schemas make every field optional (partial updates); create schemas
require the essentials. Enum-like fields are constrained with patterns so bad
values are rejected before they reach the service.
"""
from typing import Optional

from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectCreate(BaseModel):
    workspace_id: int
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None


class TaskCreate(BaseModel):
    project_id: int
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    priority: str = Field(default='medium', pattern='^(low|medium|high)$')


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    status: Optional[str] = Field(default=None,
                                  pattern='^(pending|in_progress|completed)$')
    priority: Optional[str] = Field(default=None, pattern='^(low|medium|high)$')


class FileCreate(BaseModel):
    task_id: int
    filename: str = Field(min_length=1, max_length=255)
    file_path: str = Field(min_length=1, max_length=500)


class NoteCreate(BaseModel):
    task_id: int
    content: str = Field(min_length=1)


class NoteUpdate(BaseModel):
    content: str = Field(min_length=1)


class MessageCreate(BaseModel):
    recipient_id: int
    content: str = Field(min_length=1)
