"""Workspace REST API: projects, tasks, files, notes, messages.

Thin routes only — validate the body (pydantic), enforce RBAC, call the
service, shape the response. All business logic and event emission live in
workspace_service. Errors flow through the centralized handler.
"""
from flask import Blueprint, request, jsonify

from app.services import workspace_service as ws
from app.utils.auth import token_required
from app.utils.decorators import role_required
from app.utils.constants import WORKSPACE_ROLES
from app.utils.api import paginate, paginated
from app.utils.validation import validate_body, validated_data
from app.schemas.workspace import (
    WorkspaceCreate, ProjectCreate, ProjectUpdate, TaskCreate, TaskUpdate,
    FileCreate, NoteCreate, NoteUpdate, MessageCreate,
)

workspace_bp = Blueprint('workspace', __name__, url_prefix='/api/v1')


def _result(data, error, ok_code=200):
    """Map a service (data, error) tuple to a JSON response."""
    if error:
        code = 400 if error.startswith('Missing') else 404
        return jsonify({'error': error}), code
    return jsonify(data), ok_code


# --- Workspaces --------------------------------------------------------------
@workspace_bp.route('/workspaces', methods=['POST'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(WorkspaceCreate)
def create_workspace():
    return _result(*ws.create_workspace(request.user_id, validated_data()), ok_code=201)


@workspace_bp.route('/workspaces', methods=['GET'])
@token_required
@role_required(*WORKSPACE_ROLES)
def list_workspaces():
    page = paginate(ws.list_workspaces(request.user_id))
    return jsonify(paginated(page, [ws.s_workspace(w) for w in page.items])), 200


# --- Projects ----------------------------------------------------------------
@workspace_bp.route('/projects', methods=['POST'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(ProjectCreate)
def create_project():
    return _result(*ws.create_project(request.user_id, validated_data()), ok_code=201)


@workspace_bp.route('/projects', methods=['GET'])
@token_required
@role_required(*WORKSPACE_ROLES)
def list_projects():
    q = ws.list_projects(request.user_id, request.args.get('workspace_id', type=int))
    page = paginate(q)
    return jsonify(paginated(page, [ws.s_project(p) for p in page.items])), 200


@workspace_bp.route('/projects/<int:project_id>', methods=['GET'])
@token_required
@role_required(*WORKSPACE_ROLES)
def get_project(project_id):
    return _result(*ws.get_project(project_id))


@workspace_bp.route('/projects/<int:project_id>', methods=['PUT'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(ProjectUpdate)
def update_project(project_id):
    return _result(*ws.update_project(request.user_id, project_id, validated_data()))


@workspace_bp.route('/projects/<int:project_id>', methods=['DELETE'])
@token_required
@role_required(*WORKSPACE_ROLES)
def delete_project(project_id):
    return _result(*ws.delete_project(request.user_id, project_id))


# --- Tasks -------------------------------------------------------------------
@workspace_bp.route('/tasks', methods=['POST'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(TaskCreate)
def create_task():
    return _result(*ws.create_task(request.user_id, validated_data()), ok_code=201)


@workspace_bp.route('/tasks', methods=['GET'])
@token_required
@role_required(*WORKSPACE_ROLES)
def list_tasks():
    q = ws.list_tasks(request.user_id, request.args.get('project_id', type=int))
    page = paginate(q)
    return jsonify(paginated(page, [ws.s_task(t) for t in page.items])), 200


@workspace_bp.route('/tasks/<int:task_id>', methods=['GET'])
@token_required
@role_required(*WORKSPACE_ROLES)
def get_task(task_id):
    return _result(*ws.get_task(task_id))


@workspace_bp.route('/tasks/<int:task_id>', methods=['PUT'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(TaskUpdate)
def update_task(task_id):
    return _result(*ws.update_task(request.user_id, task_id, validated_data()))


@workspace_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@token_required
@role_required(*WORKSPACE_ROLES)
def delete_task(task_id):
    return _result(*ws.delete_task(request.user_id, task_id))


# --- Files -------------------------------------------------------------------
@workspace_bp.route('/files', methods=['POST'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(FileCreate)
def upload_file():
    return _result(*ws.upload_file(request.user_id, validated_data()), ok_code=201)


@workspace_bp.route('/files', methods=['GET'])
@token_required
@role_required(*WORKSPACE_ROLES)
def list_files():
    q = ws.list_files(request.user_id, request.args.get('task_id', type=int))
    page = paginate(q)
    return jsonify(paginated(page, [ws.s_file(f) for f in page.items])), 200


@workspace_bp.route('/files/<int:file_id>/download', methods=['POST'])
@token_required
@role_required(*WORKSPACE_ROLES)
def download_file(file_id):
    return _result(*ws.download_file(request.user_id, file_id))


@workspace_bp.route('/files/<int:file_id>', methods=['DELETE'])
@token_required
@role_required(*WORKSPACE_ROLES)
def delete_file(file_id):
    return _result(*ws.delete_file(request.user_id, file_id))


# --- Notes -------------------------------------------------------------------
@workspace_bp.route('/notes', methods=['POST'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(NoteCreate)
def create_note():
    return _result(*ws.create_note(request.user_id, validated_data()), ok_code=201)


@workspace_bp.route('/notes', methods=['GET'])
@token_required
@role_required(*WORKSPACE_ROLES)
def list_notes():
    q = ws.list_notes(request.user_id, request.args.get('task_id', type=int))
    page = paginate(q)
    return jsonify(paginated(page, [ws.s_note(n) for n in page.items])), 200


@workspace_bp.route('/notes/<int:note_id>', methods=['PUT'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(NoteUpdate)
def update_note(note_id):
    return _result(*ws.update_note(request.user_id, note_id, validated_data()))


@workspace_bp.route('/notes/<int:note_id>', methods=['DELETE'])
@token_required
@role_required(*WORKSPACE_ROLES)
def delete_note(note_id):
    return _result(*ws.delete_note(request.user_id, note_id))


# --- Messages ----------------------------------------------------------------
@workspace_bp.route('/messages', methods=['POST'])
@token_required
@role_required(*WORKSPACE_ROLES)
@validate_body(MessageCreate)
def send_message():
    return _result(*ws.send_message(request.user_id, validated_data()), ok_code=201)


@workspace_bp.route('/messages', methods=['GET'])
@token_required
@role_required(*WORKSPACE_ROLES)
def list_messages():
    q = ws.list_messages(request.user_id, request.args.get('with', type=int))
    page = paginate(q)
    return jsonify(paginated(page, [ws.s_message(m) for m in page.items])), 200


@workspace_bp.route('/messages/<int:message_id>/read', methods=['POST'])
@token_required
@role_required(*WORKSPACE_ROLES)
def read_message(message_id):
    return _result(*ws.read_message(request.user_id, message_id))
