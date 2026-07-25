"""User profile logic: name/bio updates, password changes, avatar storage.

Avatar images are stored the same way task files are (UUID-named on disk,
original name never trusted as a path) but kept in their own 'avatars'
subfolder and served WITHOUT authentication (see routes/auth.py) — a profile
photo is not sensitive data, and this lets plain <img src> tags work without
extra client-side plumbing.
"""
import os
import uuid

from flask import current_app

from app.extensions import db
from app.utils.event_logger import EventLogger

# The stored extension is chosen from this map, NEVER from the client-supplied
# filename — the avatar route serves files inline (no attachment header) with
# no auth, so trusting a client-claimed ".html"/".svg" extension there would
# be a stored-XSS hole. mimetype is checked against this same allowlist below.
AVATAR_EXT_BY_MIMETYPE = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
}
ALLOWED_AVATAR_TYPES = set(AVATAR_EXT_BY_MIMETYPE)


def _avatar_dir():
    base = current_app.config.get('UPLOAD_FOLDER') or os.path.join(
        current_app.instance_path, 'uploads')
    path = os.path.join(base, 'avatars')
    os.makedirs(path, exist_ok=True)
    return path


def update_profile(user, data):
    for field in ('first_name', 'last_name', 'bio'):
        if field in data and data[field] is not None:
            setattr(user, field, data[field])
    db.session.commit()
    return user


def change_password(user, current_password, new_password):
    if not user.verify_password(current_password):
        return False, 'Current password is incorrect'
    user.set_password(new_password)
    db.session.commit()
    EventLogger.log_event(
        user_id=user.id, organization_id=user.organization_id,
        action_type='change_password', resource_type='user',
        description='User changed their password')
    return True, None


def save_avatar(user, upload):
    if upload is None or not upload.filename:
        return None, 'No file provided'
    if upload.mimetype not in ALLOWED_AVATAR_TYPES:
        return None, 'Unsupported image type'

    old_stored_name = user.avatar_path
    ext = AVATAR_EXT_BY_MIMETYPE[upload.mimetype]
    stored_name = f'{uuid.uuid4().hex}{ext}'
    upload.save(os.path.join(_avatar_dir(), stored_name))

    user.avatar_path = stored_name
    db.session.commit()

    if old_stored_name:      # remove the previous image only after the swap commits
        old_disk = os.path.join(_avatar_dir(), old_stored_name)
        if os.path.isfile(old_disk):
            os.remove(old_disk)
    return user, None


def avatar_disk_path(stored_name):
    return os.path.join(_avatar_dir(), stored_name)
