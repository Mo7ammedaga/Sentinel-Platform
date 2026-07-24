"""Workspace domain business logic (projects, tasks, files, notes, messages).

Every mutating operation emits exactly ONE meaningful Event via EventLogger, so
the AI Engine sees real user behaviour. Routes stay thin and call these
functions; serialization to plain dicts happens here so responses are
consistent for the frontend.

Returns are (data, error) tuples: error is None on success, else a message and
data is None (the route maps it to 404/400).
"""
from app.extensions import db
from app.models import (
    User, Workspace, Project, Task, File, Note, Message,
)
from app.utils.event_logger import EventLogger


def _org_of(user_id):
    user = User.query.get(user_id)
    return user.organization_id if user else None


# --- serializers -------------------------------------------------------------
def s_workspace(w):
    return {'id': w.id, 'organization_id': w.organization_id, 'name': w.name,
            'description': w.description, 'owner_id': w.owner_id,
            'is_active': w.is_active,
            'created_at': w.created_at.isoformat() if w.created_at else None}


def s_project(p):
    return {'id': p.id, 'workspace_id': p.workspace_id, 'name': p.name,
            'description': p.description, 'owner_id': p.owner_id,
            'is_active': p.is_active,
            'created_at': p.created_at.isoformat() if p.created_at else None}


def s_task(t):
    return {'id': t.id, 'project_id': t.project_id, 'title': t.title,
            'description': t.description, 'assigned_to': t.assigned_to,
            'status': t.status, 'priority': t.priority,
            'created_at': t.created_at.isoformat() if t.created_at else None}


def s_file(f):
    return {'id': f.id, 'task_id': f.task_id, 'filename': f.filename,
            'file_path': f.file_path, 'uploaded_by': f.uploaded_by,
            'created_at': f.created_at.isoformat() if f.created_at else None}


def s_note(n):
    return {'id': n.id, 'task_id': n.task_id, 'content': n.content,
            'created_by': n.created_by,
            'created_at': n.created_at.isoformat() if n.created_at else None}


def s_message(m):
    return {'id': m.id, 'sender_id': m.sender_id, 'recipient_id': m.recipient_id,
            'content': m.content, 'is_read': m.is_read,
            'created_at': m.created_at.isoformat() if m.created_at else None}


def _emit(actor_id, action, resource_type, resource_id, description):
    """Log exactly one Event and commit (EventLogger commits the whole unit)."""
    EventLogger.log_event(
        user_id=actor_id, organization_id=_org_of(actor_id),
        action_type=action, resource_type=resource_type,
        resource_id=resource_id, description=description)


# --- Workspaces --------------------------------------------------------------
def create_workspace(actor_id, data):
    w = Workspace(organization_id=_org_of(actor_id), name=data['name'],
                  description=data.get('description'), owner_id=actor_id)
    db.session.add(w)
    db.session.flush()
    _emit(actor_id, 'create_workspace', 'workspace', w.id,
          f'Created workspace "{w.name}"')
    return s_workspace(w), None


def list_workspaces(actor_id):
    org = _org_of(actor_id)
    return Workspace.query.filter_by(organization_id=org, is_active=True) \
        .order_by(Workspace.created_at.desc())


# --- Projects ----------------------------------------------------------------
def create_project(actor_id, data):
    ws = Workspace.query.get(data['workspace_id'])
    if ws is None:
        return None, 'Workspace not found'
    p = Project(workspace_id=ws.id, name=data['name'],
                description=data.get('description'), owner_id=actor_id)
    db.session.add(p)
    db.session.flush()
    _emit(actor_id, 'create_project', 'project', p.id,
          f'Created project "{p.name}"')
    return s_project(p), None


def list_projects(actor_id, workspace_id=None):
    q = Project.query.filter_by(is_active=True)
    if workspace_id:
        q = q.filter_by(workspace_id=workspace_id)
    return q.order_by(Project.created_at.desc())


def get_project(project_id):
    p = Project.query.get(project_id)
    if p is None or not p.is_active:
        return None, 'Project not found'
    return s_project(p), None


def update_project(actor_id, project_id, data):
    p = Project.query.get(project_id)
    if p is None or not p.is_active:
        return None, 'Project not found'
    if 'name' in data:
        p.name = data['name']
    if 'description' in data:
        p.description = data['description']
    db.session.flush()
    _emit(actor_id, 'update_project', 'project', p.id,
          f'Updated project "{p.name}"')
    return s_project(p), None


def delete_project(actor_id, project_id):
    p = Project.query.get(project_id)
    if p is None or not p.is_active:
        return None, 'Project not found'
    p.is_active = False                 # soft delete
    db.session.flush()
    _emit(actor_id, 'delete_project', 'project', p.id,
          f'Deleted project "{p.name}"')
    return {'id': p.id, 'deleted': True}, None


# --- Tasks -------------------------------------------------------------------
def create_task(actor_id, data):
    project = Project.query.get(data['project_id'])
    if project is None or not project.is_active:
        return None, 'Project not found'
    t = Task(project_id=project.id, title=data['title'],
             description=data.get('description'),
             assigned_to=data.get('assigned_to'),
             priority=data.get('priority', 'medium'))
    db.session.add(t)
    db.session.flush()
    _emit(actor_id, 'create_task', 'task', t.id, f'Created task "{t.title}"')
    return s_task(t), None


def list_tasks(actor_id, project_id=None):
    q = Task.query
    if project_id:
        q = q.filter_by(project_id=project_id)
    return q.order_by(Task.created_at.desc())


def get_task(task_id):
    t = Task.query.get(task_id)
    if t is None:
        return None, 'Task not found'
    return s_task(t), None


def update_task(actor_id, task_id, data):
    t = Task.query.get(task_id)
    if t is None:
        return None, 'Task not found'
    completing = data.get('status') == 'completed' and t.status != 'completed'
    for field in ('title', 'description', 'assigned_to', 'status', 'priority'):
        if field in data:
            setattr(t, field, data[field])
    db.session.flush()
    # Completing a task is its own meaningful action.
    action = 'complete_task' if completing else 'update_task'
    _emit(actor_id, action, 'task', t.id,
          f'{"Completed" if completing else "Updated"} task "{t.title}"')
    return s_task(t), None


def delete_task(actor_id, task_id):
    t = Task.query.get(task_id)
    if t is None:
        return None, 'Task not found'
    title = t.title
    db.session.delete(t)
    db.session.flush()
    _emit(actor_id, 'delete_task', 'task', task_id, f'Deleted task "{title}"')
    return {'id': task_id, 'deleted': True}, None


# --- Files (metadata; download is a first-class behavioural action) ----------
def upload_file(actor_id, data):
    task = Task.query.get(data['task_id'])
    if task is None:
        return None, 'Task not found'
    f = File(task_id=task.id, filename=data['filename'],
             file_path=data['file_path'], uploaded_by=actor_id)
    db.session.add(f)
    db.session.flush()
    _emit(actor_id, 'upload_file', 'file', f.id, f'Uploaded "{f.filename}"')
    return s_file(f), None


def list_files(actor_id, task_id=None):
    q = File.query
    if task_id:
        q = q.filter_by(task_id=task_id)
    return q.order_by(File.created_at.desc())


def download_file(actor_id, file_id):
    f = File.query.get(file_id)
    if f is None:
        return None, 'File not found'
    _emit(actor_id, 'download_file', 'file', f.id, f'Downloaded "{f.filename}"')
    return s_file(f), None


def delete_file(actor_id, file_id):
    f = File.query.get(file_id)
    if f is None:
        return None, 'File not found'
    name = f.filename
    db.session.delete(f)
    db.session.flush()
    _emit(actor_id, 'delete_file', 'file', file_id, f'Deleted "{name}"')
    return {'id': file_id, 'deleted': True}, None


# --- Notes -------------------------------------------------------------------
def create_note(actor_id, data):
    task = Task.query.get(data['task_id'])
    if task is None:
        return None, 'Task not found'
    n = Note(task_id=task.id, content=data['content'], created_by=actor_id)
    db.session.add(n)
    db.session.flush()
    _emit(actor_id, 'create_note', 'note', n.id, 'Created a note')
    return s_note(n), None


def list_notes(actor_id, task_id=None):
    q = Note.query
    if task_id:
        q = q.filter_by(task_id=task_id)
    return q.order_by(Note.created_at.desc())


def update_note(actor_id, note_id, data):
    n = Note.query.get(note_id)
    if n is None:
        return None, 'Note not found'
    n.content = data['content']
    db.session.flush()
    _emit(actor_id, 'update_note', 'note', n.id, 'Updated a note')
    return s_note(n), None


def delete_note(actor_id, note_id):
    n = Note.query.get(note_id)
    if n is None:
        return None, 'Note not found'
    db.session.delete(n)
    db.session.flush()
    _emit(actor_id, 'delete_note', 'note', note_id, 'Deleted a note')
    return {'id': note_id, 'deleted': True}, None


# --- Messages (privacy: only the sender/recipient can see them) --------------
def send_message(actor_id, data):
    recipient = User.query.get(data['recipient_id'])
    if recipient is None:
        return None, 'Recipient not found'
    m = Message(sender_id=actor_id, recipient_id=recipient.id,
                content=data['content'])
    db.session.add(m)
    db.session.flush()
    _emit(actor_id, 'send_message', 'message', m.id,
          f'Sent a message to user {recipient.id}')
    return s_message(m), None


def list_messages(actor_id, with_user_id=None):
    q = Message.query.filter(
        (Message.sender_id == actor_id) | (Message.recipient_id == actor_id))
    if with_user_id:
        q = q.filter(
            (Message.sender_id == with_user_id) |
            (Message.recipient_id == with_user_id))
    return q.order_by(Message.created_at.desc())


def read_message(actor_id, message_id):
    m = Message.query.get(message_id)
    if m is None or m.recipient_id != actor_id:
        return None, 'Message not found'
    if not m.is_read:
        m.is_read = True
        db.session.flush()
        _emit(actor_id, 'read_message', 'message', m.id, 'Read a message')
    return s_message(m), None


def list_directory(actor_id):
    """Colleagues in the same organization (for choosing a chat recipient)."""
    org = _org_of(actor_id)
    users = (User.query.filter_by(organization_id=org, is_active=True)
             .order_by(User.first_name).all())
    return [{'id': u.id, 'name': u.get_full_name(), 'role': u.role}
            for u in users if u.id != actor_id]
