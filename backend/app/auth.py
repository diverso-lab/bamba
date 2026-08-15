"""
Autenticación sencilla y autocontenida para bamba:
- Usuarios en SQLite (/data/bamba.db) con contraseñas PBKDF2-SHA256.
- Sesión mediante cookie HttpOnly firmada con HMAC (sin dependencias externas).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
DB_PATH = DATA_DIR / "bamba.db"
SECRET_FILE = DATA_DIR / "secret.key"
SESSION_COOKIE = "bamba_session"
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "30"))
ALLOW_REGISTRATION = os.environ.get("ALLOW_REGISTRATION", "true").lower() in {"1", "true", "yes"}
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() in {"1", "true", "yes"}
PBKDF2_ITERS = 200_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _secret() -> bytes:
    env = os.environ.get("SECRET_KEY")
    if env:
        return env.encode()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if SECRET_FILE.exists():
        return SECRET_FILE.read_bytes()
    key = secrets.token_bytes(32)
    SECRET_FILE.write_bytes(key)
    try:
        SECRET_FILE.chmod(0o600)
    except Exception:
        pass
    return key


SECRET = _secret()


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )


# ----------------------------------------------------------------------------
# Passwords
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERS)
    return f"pbkdf2_sha256${PBKDF2_ITERS}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_b64, dk_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(dk_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iters))
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


# ----------------------------------------------------------------------------
# Tokens de sesión: base64(payload).firma
# ----------------------------------------------------------------------------
def _sign(data: bytes) -> str:
    return base64.urlsafe_b64encode(hmac.new(SECRET, data, hashlib.sha256).digest()).decode().rstrip("=")


def _pw_fingerprint(user_id: str) -> str:
    with db() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return ""
    return hmac.new(SECRET, row["password_hash"].encode(), hashlib.sha256).hexdigest()[:16]


def make_token(user_id: str) -> str:
    payload = json.dumps({"uid": user_id, "exp": int(time.time()) + SESSION_DAYS * 86400, "pw": _pw_fingerprint(user_id), "n": secrets.token_hex(4)}).encode()
    b = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    return f"{b}.{_sign(payload)}"


def read_token(token: Optional[str]) -> Optional[str]:
    if not token or "." not in token:
        return None
    b, sig = token.rsplit(".", 1)
    try:
        payload = base64.urlsafe_b64decode(b + "=" * (-len(b) % 4))
    except Exception:
        return None
    if not hmac.compare_digest(_sign(payload), sig):
        return None
    try:
        data = json.loads(payload)
    except Exception:
        return None
    if data.get("exp", 0) < time.time():
        return None
    uid = data.get("uid")
    # Cambiar la contraseña invalida las sesiones anteriores
    if not uid or not hmac.compare_digest(data.get("pw", ""), _pw_fingerprint(uid)):
        return None
    return uid


# ----------------------------------------------------------------------------
# Usuarios
# ----------------------------------------------------------------------------
@dataclass
class User:
    id: str
    email: str
    name: str
    created_at: int

    def public(self) -> dict:
        return {"id": self.id, "email": self.email, "name": self.name, "createdAt": self.created_at}

    @property
    def dir(self) -> Path:
        d = DATA_DIR / "users" / self.id
        d.mkdir(parents=True, exist_ok=True)
        return d


def _row_to_user(row: sqlite3.Row) -> User:
    return User(id=row["id"], email=row["email"], name=row["name"], created_at=row["created_at"])


def get_user_by_id(uid: str) -> Optional[User]:
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    return _row_to_user(row) if row else None


def get_user_by_email(email: str) -> Optional[User]:
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    return _row_to_user(row) if row else None


def create_user(email: str, name: str, password: str) -> User:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Email no válido")
    if len(password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    name = (name or email.split("@")[0]).strip()[:80]
    uid = secrets.token_hex(8)
    now = int(time.time() * 1000)
    try:
        with db() as conn:
            conn.execute("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)", (uid, email, name, hash_password(password), now))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Ya existe una cuenta con ese email")
    return User(id=uid, email=email, name=name, created_at=now)


def authenticate(email: str, password: str) -> Optional[User]:
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        return None
    return _row_to_user(row)


def update_user(uid: str, name: Optional[str] = None, password: Optional[str] = None) -> None:
    with db() as conn:
        if name is not None:
            conn.execute("UPDATE users SET name = ? WHERE id = ?", (name.strip()[:80], uid))
        if password is not None:
            if len(password) < 6:
                raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), uid))


def count_users() -> int:
    with db() as conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


# ----------------------------------------------------------------------------
# Cookies / dependencias
# ----------------------------------------------------------------------------
def set_session_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        make_token(user.id),
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


def optional_user(request: Request) -> Optional[User]:
    uid = read_token(request.cookies.get(SESSION_COOKIE))
    if not uid:
        return None
    return get_user_by_id(uid)


def current_user(request: Request) -> User:
    user = optional_user(request)
    if not user:
        raise HTTPException(401, "No has iniciado sesión")
    return user


CurrentUser = Depends(current_user)
