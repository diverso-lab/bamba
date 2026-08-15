"""
bamba API
---------
- POST /api/remove-bg          → elimina el fondo de una imagen (rembg, CPU)
- GET  /api/proxy?url=         → proxy de imágenes externas (evita CORS / canvas "tainted")
- GET  /api/photos/search      → búsqueda de fotos de stock (Openverse, sin API key)
- CRUD /api/designs            → diseños guardados (JSON en /data/designs)
- CRUD /api/uploads            → ficheros subidos por el usuario (/data/uploads)
- GET/PUT /api/brand           → kit de marca (colores, fuentes, logos)
- GET  /api/health
"""
from __future__ import annotations

import io
import json
import os
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import ipaddress
import socket

import httpx
import asyncio

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from PIL import Image, ImageOps

from . import auth
from .auth import User, current_user

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)


def designs_dir(user: User) -> Path:
    d = user.dir / "designs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def uploads_dir(user: User) -> Path:
    d = user.dir / "uploads"
    d.mkdir(parents=True, exist_ok=True)
    return d


def brand_file(user: User) -> Path:
    return user.dir / "brand.json"

DEFAULT_MODEL = os.environ.get("REMBG_DEFAULT_MODEL", "isnet-general-use")
MAX_IMAGE_SIDE = int(os.environ.get("MAX_IMAGE_SIDE", "3000"))
ALLOWED_MODELS = {
    "isnet-general-use",  # mejor calidad general
    "u2net",
    "u2netp",             # rápido
    "u2net_human_seg",    # personas
    "u2net_cloth_seg",
    "silueta",
    "isnet-anime",
}
OPENVERSE_API = "https://api.openverse.org/v1/images/"

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "60")) * 1024 * 1024
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_MB", "40")) * 1024 * 1024
MAX_PROXY_BYTES = int(os.environ.get("MAX_PROXY_MB", "25")) * 1024 * 1024


def read_limited(upload: UploadFile, limit: int) -> bytes:
    """Lee un UploadFile con tope de tamaño (413 si se supera)."""
    chunks = []
    total = 0
    while True:
        chunk = upload.file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(413, f"Fichero demasiado grande (máx. {limit // (1024 * 1024)} MB)")
        chunks.append(chunk)
    return b"".join(chunks)


class RateLimiter:
    """Limitador simple en memoria por clave (IP): máx. `limit` eventos por `window` segundos."""

    def __init__(self, limit: int, window: int):
        self.limit = limit
        self.window = window
        self.hits: dict[str, list[float]] = {}
        self.lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.time()
        with self.lock:
            arr = [t for t in self.hits.get(key, []) if now - t < self.window]
            if len(arr) >= self.limit:
                raise HTTPException(429, "Demasiados intentos. Espera un momento.")
            arr.append(now)
            self.hits[key] = arr
            if len(self.hits) > 10000:  # evitar crecimiento infinito
                self.hits = {k: v for k, v in self.hits.items() if v and now - v[-1] < self.window}


auth_limiter = RateLimiter(limit=int(os.environ.get("AUTH_RATE_LIMIT", "15")), window=60)
_user_locks: dict[str, threading.Lock] = {}
_user_locks_guard = threading.Lock()


def user_lock(user_id: str) -> threading.Lock:
    with _user_locks_guard:
        lk = _user_locks.get(user_id)
        if lk is None:
            lk = _user_locks[user_id] = threading.Lock()
        return lk


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "?"


app = FastAPI(title="bamba API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------------------------------
# rembg sessions (lazy, thread-safe)
# ----------------------------------------------------------------------------
_sessions: dict[str, Any] = {}
_sessions_lock = threading.Lock()
_warming: dict[str, bool] = {}


def get_session(model: str):
    from rembg import new_session  # import perezoso: tarda en cargar

    with _sessions_lock:
        if model in _sessions:
            return _sessions[model]
    session = new_session(model)
    with _sessions_lock:
        _sessions[model] = session
    return session


def _warm(model: str) -> None:
    try:
        _warming[model] = True
        get_session(model)
    except Exception as exc:  # pragma: no cover
        print(f"[bamba] no se pudo precargar el modelo {model}: {exc}")
    finally:
        _warming[model] = False


@app.on_event("startup")
def _startup() -> None:
    auth.init_db()
    threading.Thread(target=_warm, args=(DEFAULT_MODEL,), daemon=True).start()


# ----------------------------------------------------------------------------
# Auth
# ----------------------------------------------------------------------------
@app.get("/api/auth/me")
def auth_me(request: Request):
    user = auth.optional_user(request)
    return {"user": user.public() if user else None, "registrationOpen": auth.ALLOW_REGISTRATION or auth.count_users() == 0}


@app.post("/api/auth/register", status_code=201)
def auth_register(payload: dict, response: Response, request: Request):
    auth_limiter.check(client_ip(request))
    if not auth.ALLOW_REGISTRATION and auth.count_users() > 0:
        raise HTTPException(403, "El registro está desactivado")
    user = auth.create_user(payload.get("email", ""), payload.get("name", ""), payload.get("password", ""))
    auth.set_session_cookie(response, user)
    return {"user": user.public()}


@app.post("/api/auth/login")
def auth_login(payload: dict, response: Response, request: Request):
    auth_limiter.check(client_ip(request))
    user = auth.authenticate(payload.get("email", ""), payload.get("password", ""))
    if not user:
        raise HTTPException(401, "Email o contraseña incorrectos")
    auth.set_session_cookie(response, user)
    return {"user": user.public()}


@app.post("/api/auth/logout")
def auth_logout(response: Response):
    auth.clear_session_cookie(response)
    return {"ok": True}


@app.put("/api/auth/me")
def auth_update(payload: dict, response: Response, user: User = Depends(current_user)):
    if payload.get("password"):
        if not auth.authenticate(user.email, payload.get("currentPassword", "")):
            raise HTTPException(400, "La contraseña actual no es correcta")
    auth.update_user(user.id, name=payload.get("name"), password=payload.get("password") or None)
    fresh = auth.get_user_by_id(user.id)
    if payload.get("password") and fresh:
        auth.set_session_cookie(response, fresh)  # el token va ligado a la contraseña
    return {"user": fresh.public() if fresh else user.public()}


# ----------------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {
        "ok": True,
        "default_model": DEFAULT_MODEL,
        "models_loaded": sorted(_sessions.keys()),
        "models_warming": [m for m, w in _warming.items() if w],
        "models_available": sorted(ALLOWED_MODELS),
    }


# ----------------------------------------------------------------------------
# Quitar fondo
# ----------------------------------------------------------------------------
@app.post("/api/remove-bg")
def remove_bg(
    user: User = Depends(current_user),
    file: UploadFile = File(...),
    model: str = Query(DEFAULT_MODEL),
    post_process: bool = Query(False, description="Suaviza la máscara"),
    alpha_matting: bool = Query(False, description="Bordes finos (pelo). Más lento."),
):
    if model not in ALLOWED_MODELS:
        raise HTTPException(400, f"Modelo no permitido. Usa uno de: {sorted(ALLOWED_MODELS)}")
    from rembg import remove

    raw = read_limited(file, MAX_IMAGE_BYTES)
    if not raw:
        raise HTTPException(400, "Fichero vacío")
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGBA")
    except Exception:
        raise HTTPException(400, "No se pudo leer la imagen")

    # Limitamos el tamaño para no comernos la RAM del contenedor
    if max(img.size) > MAX_IMAGE_SIDE:
        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.LANCZOS)

    t0 = time.time()
    session = get_session(model)
    out = remove(
        img,
        session=session,
        post_process_mask=post_process,
        alpha_matting=alpha_matting,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
    )
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return Response(
        buf.getvalue(),
        media_type="image/png",
        headers={"X-Bamba-Model": model, "X-Bamba-Ms": str(int((time.time() - t0) * 1000))},
    )


# ----------------------------------------------------------------------------
# Desenfocar fondo / recolorear fondo (usa la máscara de rembg)
# ----------------------------------------------------------------------------
@app.post("/api/blur-bg")
def blur_bg(
    user: User = Depends(current_user),
    file: UploadFile = File(...),
    radius: int = Query(18, ge=1, le=80),
    model: str = Query(DEFAULT_MODEL),
    mode: str = Query("blur", description="blur | color | bw"),
    color: str = Query("#ffffff"),
):
    """Mantiene el sujeto nítido y desenfoca (o recolorea) el fondo."""
    from PIL import ImageFilter
    from rembg import remove

    if model not in ALLOWED_MODELS:
        raise HTTPException(400, "Modelo no permitido")
    raw = read_limited(file, MAX_IMAGE_BYTES)
    try:
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGBA")
    except Exception:
        raise HTTPException(400, "No se pudo leer la imagen")
    if max(img.size) > MAX_IMAGE_SIDE:
        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.LANCZOS)
    session = get_session(model)
    mask = remove(img, session=session, only_mask=True).convert("L")
    if mode == "blur":
        bg = img.filter(ImageFilter.GaussianBlur(radius))
    elif mode == "bw":
        bg = ImageOps.grayscale(img).convert("RGBA")
    else:
        try:
            bg = Image.new("RGBA", img.size, color)
        except ValueError:
            raise HTTPException(400, "Color no válido")
    out = Image.composite(img, bg, mask)
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return Response(buf.getvalue(), media_type="image/png")


# ----------------------------------------------------------------------------
# Proxy de imágenes (para poder pintarlas en el canvas sin "taint")
# ----------------------------------------------------------------------------
_ALLOWED_SCHEMES = {"http", "https"}
_BLOCKED_HOSTS = {"localhost", "backend", "frontend", "host.docker.internal", "metadata.google.internal"}


def _ip_is_public(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified or getattr(ip, "is_site_local", False))


def _validate_outbound_url(url: str) -> str:
    """Valida esquema/host y resuelve DNS: solo IPs públicas. Devuelve la URL normalizada."""
    try:
        parsed = httpx.URL(url)
    except Exception:
        raise HTTPException(400, "URL no válida")
    if parsed.scheme not in _ALLOWED_SCHEMES or not parsed.host:
        raise HTTPException(400, "URL no válida")
    if parsed.userinfo:
        raise HTTPException(400, "URL no válida")
    host = parsed.host.strip("[]").lower()
    if host in _BLOCKED_HOSTS or host.endswith((".local", ".internal", ".localhost")):
        raise HTTPException(400, "Host no permitido")
    try:
        literal = ipaddress.ip_address(host)
        ips = [literal]
    except ValueError:
        try:
            infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
        except socket.gaierror:
            raise HTTPException(400, "No se pudo resolver el host")
        ips = [ipaddress.ip_address(i[4][0]) for i in infos]
    if not ips or not all(_ip_is_public(ip) for ip in ips):
        raise HTTPException(400, "Host no permitido")
    return str(parsed)


@app.get("/api/proxy")
async def proxy(url: str = Query(...), user: User = Depends(current_user)):
    target = _validate_outbound_url(url)
    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) bamba/0.1 (self-hosted design tool; contact: admin@localhost)", "Accept": "image/*,*/*;q=0.8"}
    async with httpx.AsyncClient(follow_redirects=False, timeout=30) as client:
        for _ in range(4):  # seguimos redirecciones a mano, revalidando cada salto
            try:
                async with client.stream("GET", target, headers=headers) as r:
                    if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                        target = _validate_outbound_url(str(httpx.URL(target).join(r.headers["location"])))
                        continue
                    if r.status_code >= 400:
                        raise HTTPException(502, "El origen devolvió un error")
                    ctype = r.headers.get("content-type", "application/octet-stream").split(";")[0].strip().lower()
                    if not ctype.startswith("image/"):
                        raise HTTPException(415, "El recurso no es una imagen")
                    if int(r.headers.get("content-length") or 0) > MAX_PROXY_BYTES:
                        raise HTTPException(413, "Imagen demasiado grande")
                    buf = bytearray()
                    async for chunk in r.aiter_bytes():
                        buf.extend(chunk)
                        if len(buf) > MAX_PROXY_BYTES:
                            raise HTTPException(413, "Imagen demasiado grande")
                    return Response(bytes(buf), media_type=ctype, headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})
            except httpx.HTTPError as exc:
                raise HTTPException(502, f"No se pudo descargar: {exc}")
    raise HTTPException(502, "Demasiadas redirecciones")


# ----------------------------------------------------------------------------
# Fotos de stock (Openverse: CC0 / CC-BY, sin API key)
# ----------------------------------------------------------------------------
@app.get("/api/photos/search")
async def photos_search(q: str = Query(..., min_length=1), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=20), user: User = Depends(current_user)):
    params = {
        "q": q,
        "page": page,
        "page_size": page_size,
        "license_type": "commercial,modification",
        "mature": "false",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            r = await client.get(OPENVERSE_API, params=params, headers={"User-Agent": "bamba/0.1"})
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Openverse no responde: {exc}")
    if r.status_code != 200:
        raise HTTPException(502, f"Openverse devolvió un error ({r.status_code})")
    data = r.json()
    results = []
    for it in data.get("results", []):
        full = it.get("url")
        if not full:
            continue
        results.append(
            {
                "id": it.get("id"),
                "title": it.get("title") or "",
                "thumb": f"/api/proxy?url={httpx.URL(it.get('thumbnail') or full)}",
                "url": f"/api/proxy?url={httpx.URL(full)}",
                "width": it.get("width"),
                "height": it.get("height"),
                "creator": it.get("creator") or "",
                "license": (it.get("license") or "").upper(),
                "source": it.get("source") or "",
                "attribution": it.get("attribution") or "",
            }
        )
    return {"results": results, "page": page, "page_count": data.get("page_count", 1), "result_count": data.get("result_count", 0)}


# ----------------------------------------------------------------------------
# Gráficos / stickers (Iconify: 200k+ SVG con licencias libres)
# ----------------------------------------------------------------------------
ICONIFY_API = "https://api.iconify.design"
GRAPHIC_SETS: dict[str, dict] = {
    "stickers": {"label": "Stickers", "prefixes": "noto,fluent-emoji-flat,twemoji,openmoji,emojione,streamline-emojis,fxemoji"},
    "illustrations": {"label": "Ilustraciones", "prefixes": "flat-color-icons,vscode-icons,devicon,skill-icons,logos,circum,healthicons,game-icons"},
    "logos": {"label": "Logos", "prefixes": "logos,simple-icons,skill-icons,devicon,cib"},
    "flags": {"label": "Banderas", "prefixes": "circle-flags,flag,flagpack,twemoji"},
    "icons": {"label": "Iconos", "prefixes": "lucide,tabler,ph,mdi,solar,heroicons,fluent,carbon,ri,iconoir"},
    "3d": {"label": "3D y color", "prefixes": "fluent-emoji,fluent-color,noto,streamline-color,streamline-plump-color,unjs"},
}
_svg_cache: dict[str, str] = {}
_ICON_RE = re.compile(r"^[a-z0-9-]+:[a-z0-9_-]+$")


@app.get("/api/graphics/sets")
def graphics_sets(user: User = Depends(current_user)):
    return [{"id": k, "label": v["label"]} for k, v in GRAPHIC_SETS.items()]


@app.get("/api/graphics/search")
async def graphics_search(q: str = Query(..., min_length=1), set_id: str = Query("stickers", alias="set"), limit: int = Query(64, ge=1, le=120), user: User = Depends(current_user)):
    cfg = GRAPHIC_SETS.get(set_id) or GRAPHIC_SETS["stickers"]
    params = {"query": q, "limit": limit, "prefixes": cfg["prefixes"]}
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(f"{ICONIFY_API}/search", params=params, headers={"User-Agent": "bamba/0.1"})
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Iconify no responde: {exc}")
    if r.status_code != 200:
        raise HTTPException(502, f"Iconify devolvió {r.status_code}")
    data = r.json()
    icons = data.get("icons", [])
    return {"results": [{"id": i, "url": f"/api/graphics/svg?icon={i}"} for i in icons], "total": data.get("total", len(icons))}


@app.get("/api/graphics/collection")
async def graphics_collection(prefix: str = Query(...), limit: int = Query(96, ge=1, le=200), user: User = Depends(current_user)):
    """Primeros iconos de una colección (para mostrar algo antes de buscar)."""
    if not re.match(r"^[a-z0-9-]+$", prefix):
        raise HTTPException(400, "prefix no válido")
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(f"{ICONIFY_API}/collection", params={"prefix": prefix}, headers={"User-Agent": "bamba/0.1"})
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Iconify no responde: {exc}")
    if r.status_code != 200:
        raise HTTPException(502, f"Iconify devolvió {r.status_code}")
    data = r.json()
    names: list[str] = []
    if isinstance(data.get("uncategorized"), list):
        names.extend(data["uncategorized"])
    for _cat, arr in (data.get("categories") or {}).items():
        names.extend(arr)
    names = names[:limit]
    return {"results": [{"id": f"{prefix}:{n}", "url": f"/api/graphics/svg?icon={prefix}:{n}"} for n in names]}


@app.get("/api/graphics/svg")
async def graphics_svg(icon: str = Query(...), user: User = Depends(current_user)):
    if not _ICON_RE.match(icon):
        raise HTTPException(400, "icono no válido")
    if icon in _svg_cache:
        return Response(_svg_cache[icon], media_type="image/svg+xml", headers={"Cache-Control": "private, max-age=604800"})
    prefix, name = icon.split(":", 1)
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(f"{ICONIFY_API}/{prefix}/{name}.svg", headers={"User-Agent": "bamba/0.1"})
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Iconify no responde: {exc}")
    if r.status_code != 200 or "<svg" not in r.text[:500]:
        raise HTTPException(404, "Gráfico no encontrado")
    svg = r.text
    if len(_svg_cache) > 5000:
        _svg_cache.clear()
    _svg_cache[icon] = svg
    return Response(svg, media_type="image/svg+xml", headers={"Cache-Control": "private, max-age=604800"})


# ----------------------------------------------------------------------------
# IA generativa (texto e imágenes)
#   - Por defecto usa Pollinations (gratis, sin clave). Los prompts se envían a ese servicio externo.
#   - Texto: OPENAI_BASE_URL + OPENAI_API_KEY (+ OPENAI_MODEL) → cualquier API OpenAI-compatible (OpenAI, Ollama, LM Studio, Groq…)
#   - Imagen: AI_IMAGE_URL → API de Stable Diffusion WebUI (A1111) /sdapi/v1/txt2img
# ----------------------------------------------------------------------------
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "").rstrip("/")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")
_ollama_ok: dict[str, float] = {"t": 0, "ok": 0}


async def _ollama_available() -> bool:
    now = time.time()
    if now - _ollama_ok["t"] < 30:
        return bool(_ollama_ok["ok"])
    ok = False
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            ok = r.status_code == 200 and any((m.get("name") or "").startswith(OLLAMA_MODEL.split(":")[0]) for m in r.json().get("models", []))
    except Exception:
        ok = False
    _ollama_ok.update({"t": now, "ok": 1 if ok else 0})
    return ok
AI_IMAGE_URL = os.environ.get("AI_IMAGE_URL", "").rstrip("/")
AI_DISABLE_POLLINATIONS = os.environ.get("AI_DISABLE_POLLINATIONS", "false").lower() in {"1", "true", "yes"}
POLLINATIONS_TEXT = "https://text.pollinations.ai/"
POLLINATIONS_IMAGE = "https://image.pollinations.ai/prompt/"

_AI_MODES = {
    "generate": "Escribe el texto que se pide. Responde solo con el texto final, sin comillas ni explicaciones.",
    "rewrite": "Reescribe el siguiente texto mejorando claridad y estilo, manteniendo el significado y el idioma. Responde solo con el texto reescrito.",
    "shorten": "Acorta el siguiente texto manteniendo lo esencial. Responde solo con el texto acortado.",
    "expand": "Amplía el siguiente texto con más detalle, manteniendo tono e idioma. Responde solo con el texto ampliado.",
    "summarize": "Resume el siguiente texto en una o dos frases. Responde solo con el resumen.",
    "translate": "Traduce el siguiente texto al idioma indicado. Responde solo con la traducción.",
    "tone": "Reescribe el siguiente texto con el tono indicado. Responde solo con el texto.",
    "headline": "Propón 5 titulares cortos y potentes para lo que se describe, uno por línea, sin numerar.",
    "hashtags": "Propón 10 hashtags relevantes para lo que se describe, separados por espacios.",
}


@app.get("/api/ai/status")
async def ai_status(user: User = Depends(current_user)):
    text = "openai" if (OPENAI_BASE_URL or OPENAI_API_KEY) else ("ollama" if await _ollama_available() else ("pollinations" if not AI_DISABLE_POLLINATIONS else None))
    return {
        "text": text,
        "textModel": OPENAI_MODEL if text == "openai" else (OLLAMA_MODEL if text == "ollama" else None),
        "image": "sd" if AI_IMAGE_URL else ("pollinations" if not AI_DISABLE_POLLINATIONS else None),
        "hint": None if text else "Activa la IA local con: docker compose --profile ai up -d  (descarga Ollama y un modelo pequeño), o define OPENAI_BASE_URL/OPENAI_API_KEY.",
    }


async def _ai_chat(messages: list[dict]) -> str:
    if OPENAI_BASE_URL or OPENAI_API_KEY:
        base = OPENAI_BASE_URL or "https://api.openai.com/v1"
        headers = {"Content-Type": "application/json"}
        if OPENAI_API_KEY:
            headers["Authorization"] = f"Bearer {OPENAI_API_KEY}"
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(f"{base}/chat/completions", headers=headers, json={"model": OPENAI_MODEL, "messages": messages, "temperature": 0.7})
        if r.status_code != 200:
            raise HTTPException(502, f"El proveedor de IA devolvió {r.status_code}: {r.text[:200]}")
        data = r.json()
        return (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    if await _ollama_available():
        async with httpx.AsyncClient(timeout=300) as client:
            r = await client.post(f"{OLLAMA_URL}/v1/chat/completions", json={"model": OLLAMA_MODEL, "messages": messages, "temperature": 0.7})
        if r.status_code != 200:
            raise HTTPException(502, f"Ollama devolvió {r.status_code}: {r.text[:200]}")
        return (r.json().get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    if AI_DISABLE_POLLINATIONS:
        raise HTTPException(503, "IA de texto no configurada. Levanta la IA local con: docker compose --profile ai up -d")
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(POLLINATIONS_TEXT + "openai", json={"messages": messages, "model": "openai", "seed": int(time.time()) % 100000}, headers={"User-Agent": "bamba/0.1"})
    if r.status_code != 200:
        raise HTTPException(503, "El servicio gratuito de texto no está disponible. Activa la IA local: docker compose --profile ai up -d  (o configura OPENAI_BASE_URL/OPENAI_API_KEY).")
    try:
        data = r.json()
        return (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    except Exception:
        return r.text.strip()


@app.post("/api/ai/text")
async def ai_text(payload: dict, user: User = Depends(current_user)):
    mode = payload.get("mode", "generate")
    prompt = str(payload.get("prompt") or "")[:4000]
    text = str(payload.get("text") or "")[:8000]
    lang = str(payload.get("lang") or "español")[:40]
    tone = str(payload.get("tone") or "profesional")[:40]
    if mode not in _AI_MODES:
        raise HTTPException(400, "Modo no válido")
    if not prompt and not text:
        raise HTTPException(400, "Falta el texto o la instrucción")
    system = "Eres un asistente de redacción para diseños gráficos (redes sociales, carteles, presentaciones). Sé conciso. " + _AI_MODES[mode]
    user_msg = ""
    if mode == "generate" or mode in {"headline", "hashtags"}:
        user_msg = prompt or text
    elif mode == "translate":
        user_msg = f"Idioma destino: {lang}.\n\nTexto:\n{text or prompt}"
    elif mode == "tone":
        user_msg = f"Tono: {tone}.\n\nTexto:\n{text or prompt}"
    else:
        user_msg = (f"Instrucciones adicionales: {prompt}\n\n" if prompt and text else "") + f"Texto:\n{text or prompt}"
    out = await _ai_chat([{"role": "system", "content": system}, {"role": "user", "content": user_msg}])
    return {"text": out}


@app.post("/api/ai/image")
async def ai_image(payload: dict, user: User = Depends(current_user)):
    prompt = str(payload.get("prompt") or "").strip()[:1500]
    if not prompt:
        raise HTTPException(400, "Falta la descripción")
    width = int(payload.get("width") or 1024)
    height = int(payload.get("height") or 1024)
    width = max(256, min(1536, width))
    height = max(256, min(1536, height))
    style = str(payload.get("style") or "").strip()[:200]
    full_prompt = f"{prompt}, {style}" if style else prompt
    seed = int(payload.get("seed") or int(time.time()) % 1000000)

    if AI_IMAGE_URL:
        async with httpx.AsyncClient(timeout=600) as client:
            r = await client.post(f"{AI_IMAGE_URL}/sdapi/v1/txt2img", json={"prompt": full_prompt, "width": width, "height": height, "steps": 25, "seed": seed})
        if r.status_code != 200:
            raise HTTPException(502, f"Stable Diffusion devolvió {r.status_code}")
        import base64

        images = r.json().get("images") or []
        if not images:
            raise HTTPException(502, "Sin imagen")
        raw = base64.b64decode(images[0].split(",", 1)[-1])
        ext = ".png"
    else:
        if AI_DISABLE_POLLINATIONS:
            raise HTTPException(503, "IA de imagen no configurada")
        url = POLLINATIONS_IMAGE + httpx.URL(f"https://x/{full_prompt}").path[1:]
        async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
            r = await client.get(url, params={"width": width, "height": height, "nologo": "true", "seed": seed, "model": "flux"}, headers={"User-Agent": "bamba/0.1"})
        if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/"):
            raise HTTPException(502, f"El servicio de imágenes devolvió {r.status_code}")
        raw = r.content
        ext = ".jpg" if "jpeg" in r.headers.get("content-type", "") else ".png"

    # Guardamos el resultado como subida del usuario
    file_id = uuid.uuid4().hex[:12]
    stored = f"{file_id}{ext}"
    (uploads_dir(user) / stored).write_bytes(raw)
    w = h = None
    try:
        with Image.open(io.BytesIO(raw)) as im:
            w, h = im.size
    except Exception:
        pass
    item = {"id": file_id, "name": f"IA · {prompt[:40]}", "kind": "image", "url": f"/api/uploads/file/{user.id}/{stored}", "size": len(raw), "width": w, "height": h, "createdAt": int(time.time() * 1000), "ai": True, "prompt": prompt}
    with user_lock(user.id):
        items = _load_upload_index(user)
        items.append(item)
        _save_upload_index(user, items)
    return item


# ----------------------------------------------------------------------------
# Diseños
# ----------------------------------------------------------------------------
_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


SHARES_FILE = DATA_DIR / "shares.json"
_shares_lock = threading.Lock()


def _load_shares() -> dict:
    """{design_id: {"owner": uid, "users": {uid: {"role": "edit"|"view", "email": ..., "name": ...}}}}"""
    if SHARES_FILE.exists():
        try:
            return _read_json(SHARES_FILE)
        except Exception:
            return {}
    return {}


def _save_shares(d: dict) -> None:
    _write_json(SHARES_FILE, d)


def _own_design_path(user: User, design_id: str) -> Path:
    if not _ID_RE.match(design_id):
        raise HTTPException(400, "id no válido")
    return designs_dir(user) / f"{design_id}.json"


def resolve_design(user: User, design_id: str, need_edit: bool = False) -> tuple[Path, User, str]:
    """Devuelve (ruta, propietario, rol) si el usuario es dueño o colaborador."""
    p = _own_design_path(user, design_id)
    if p.exists():
        return p, user, "owner"
    share = _load_shares().get(design_id)
    if share and user.id in share.get("users", {}):
        role = share["users"][user.id].get("role", "view")
        if need_edit and role != "edit":
            raise HTTPException(403, "Solo tienes permiso de lectura en este diseño")
        owner = auth.get_user_by_id(share["owner"])
        if owner:
            op = designs_dir(owner) / f"{design_id}.json"
            if op.exists():
                return op, owner, role
    raise HTTPException(404, "Diseño no encontrado")


def _design_path(user: User, design_id: str) -> Path:
    return resolve_design(user, design_id, need_edit=True)[0]


def can_access_files(user: User, owner_id: str) -> bool:
    if user.id == owner_id:
        return True
    for _did, share in _load_shares().items():
        users = share.get("users", {})
        if (share.get("owner") == owner_id and user.id in users) or (share.get("owner") == user.id and owner_id in users):
            return True
    return False


def _read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _write_json(path: Path, data: dict) -> None:
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)
    tmp.replace(path)


def _meta(d: dict) -> dict:
    return {
        "id": d["id"],
        "name": d.get("name", "Sin título"),
        "width": d.get("width"),
        "height": d.get("height"),
        "pageCount": len(d.get("pages", [])) or 1,
        "thumbnail": d.get("thumbnail"),
        "createdAt": d.get("createdAt"),
        "updatedAt": d.get("updatedAt"),
        "folder": d.get("folder"),
    }


@app.get("/api/designs")
def list_designs(user: User = Depends(current_user)):
    items = []
    for p in designs_dir(user).glob("*.json"):
        try:
            items.append(_meta(_read_json(p)))
        except Exception:
            continue
    # compartidos conmigo
    for did, share in _load_shares().items():
        if user.id in share.get("users", {}):
            owner = auth.get_user_by_id(share.get("owner", ""))
            if not owner:
                continue
            op = designs_dir(owner) / f"{did}.json"
            if op.exists():
                try:
                    m = _meta(_read_json(op))
                    m["shared"] = True
                    m["owner"] = owner.name
                    m["role"] = share["users"][user.id].get("role", "view")
                    items.append(m)
                except Exception:
                    continue
    items.sort(key=lambda m: m.get("updatedAt") or 0, reverse=True)
    return items


def _dim(v, default=1080) -> int:
    try:
        n = int(float(v)) if v is not None and v != "" else default
    except (TypeError, ValueError):
        raise HTTPException(400, "Dimensiones no válidas")
    if not 16 <= n <= 20000:
        raise HTTPException(400, "Dimensiones fuera de rango (16–20000 px)")
    return n


@app.post("/api/designs", status_code=201)
def create_design(payload: dict, user: User = Depends(current_user)):
    design_id = uuid.uuid4().hex[:12]
    now = int(time.time() * 1000)
    if not isinstance(payload, dict):
        raise HTTPException(400, "Cuerpo no válido")
    data = {
        "id": design_id,
        "name": str(payload.get("name") or "Sin título")[:200],
        "width": _dim(payload.get("width")),
        "height": _dim(payload.get("height")),
        "pages": payload.get("pages") or [{"id": uuid.uuid4().hex[:8], "json": None, "thumbnail": None}],
        "thumbnail": payload.get("thumbnail"),
        "folder": payload.get("folder"),
        "createdAt": now,
        "updatedAt": now,
    }
    _write_json(_own_design_path(user, design_id), data)
    return data


@app.get("/api/designs/{design_id}")
def get_design(design_id: str, user: User = Depends(current_user)):
    p, owner, role = resolve_design(user, design_id)
    data = _read_json(p)
    data["role"] = role
    data["ownerId"] = owner.id
    data["ownerName"] = owner.name
    return data


@app.put("/api/designs/{design_id}")
def update_design(design_id: str, payload: dict, user: User = Depends(current_user)):
    p, owner, _role = resolve_design(user, design_id, need_edit=True)
    with user_lock(owner.id):
        if not p.exists():
            raise HTTPException(404, "Diseño no encontrado")
        data = _read_json(p)
        for key in ("name", "thumbnail", "folder"):
            if key in payload:
                data[key] = payload[key]
        if isinstance(payload.get("pages"), list):
            # Fusión por página: si una página llega sin "json" conservamos el contenido guardado
            existing = {pg.get("id"): pg for pg in data.get("pages", []) if isinstance(pg, dict)}
            merged = []
            for pg in payload["pages"]:
                if not isinstance(pg, dict) or not pg.get("id"):
                    continue
                prev = existing.get(pg["id"], {})
                new_pg = {**prev, **{k: v for k, v in pg.items() if k != "json"}}
                if "json" in pg and pg["json"] is not None:
                    new_pg["json"] = pg["json"]
                elif "json" not in new_pg:
                    new_pg["json"] = None
                merged.append(new_pg)
            data["pages"] = merged
        if "width" in payload:
            data["width"] = _dim(payload["width"])
        if "height" in payload:
            data["height"] = _dim(payload["height"])
        if "name" in data:
            data["name"] = str(data["name"] or "Sin título")[:200]
        data["id"] = design_id
        data["updatedAt"] = int(time.time() * 1000)
        _write_json(p, data)
    return _meta(data)


@app.put("/api/designs/{design_id}/pages/{page_id}")
def update_page(design_id: str, page_id: str, payload: dict, user: User = Depends(current_user)):
    """Guarda solo una página (colaboración): evita que dos usuarios se pisen páginas distintas."""
    p, owner, _role = resolve_design(user, design_id, need_edit=True)
    with user_lock(owner.id):
        data = _read_json(p)
        found = False
        for pg in data.get("pages", []):
            if pg.get("id") == page_id:
                if "json" in payload:
                    pg["json"] = payload["json"]
                if "thumbnail" in payload:
                    pg["thumbnail"] = payload["thumbnail"]
                for k in ("duration", "anim", "transition"):
                    if k in payload:
                        pg[k] = payload[k]
                found = True
        if not found:
            raise HTTPException(404, "Página no encontrada")
        if data.get("pages") and data["pages"][0].get("id") == page_id and payload.get("thumbnail"):
            data["thumbnail"] = payload["thumbnail"]
        data["updatedAt"] = int(time.time() * 1000)
        _write_json(p, data)
    return {"ok": True, "updatedAt": data["updatedAt"]}


@app.delete("/api/designs/{design_id}", status_code=204)
def delete_design(design_id: str, user: User = Depends(current_user)):
    p = _own_design_path(user, design_id)
    if p.exists():
        p.unlink()
        with _shares_lock:
            shares = _load_shares()
            if design_id in shares:
                del shares[design_id]
                _save_shares(shares)
    else:
        # un colaborador "elimina" = deja de verlo
        with _shares_lock:
            shares = _load_shares()
            if design_id in shares and user.id in shares[design_id].get("users", {}):
                del shares[design_id]["users"][user.id]
                _save_shares(shares)
    return Response(status_code=204)


# ---- Compartir ----
@app.get("/api/designs/{design_id}/share")
def get_share(design_id: str, user: User = Depends(current_user)):
    p, owner, role = resolve_design(user, design_id)
    share = _load_shares().get(design_id, {"owner": owner.id, "users": {}})
    return {"owner": {"id": owner.id, "name": owner.name, "email": owner.email}, "role": role, "users": [{"id": uid, **info} for uid, info in share.get("users", {}).items()]}


@app.post("/api/designs/{design_id}/share")
def add_share(design_id: str, payload: dict, user: User = Depends(current_user)):
    p = _own_design_path(user, design_id)
    if not p.exists():
        raise HTTPException(403, "Solo el propietario puede compartir")
    email = str(payload.get("email") or "").strip().lower()
    role = "edit" if payload.get("role", "edit") == "edit" else "view"
    target = auth.get_user_by_email(email)
    if not target:
        raise HTTPException(404, "No existe ningún usuario con ese email en este servidor")
    if target.id == user.id:
        raise HTTPException(400, "Ya eres el propietario")
    with _shares_lock:
        shares = _load_shares()
        entry = shares.setdefault(design_id, {"owner": user.id, "users": {}})
        entry["users"][target.id] = {"role": role, "email": target.email, "name": target.name}
        _save_shares(shares)
    return {"id": target.id, "role": role, "email": target.email, "name": target.name}


@app.delete("/api/designs/{design_id}/share/{target_id}", status_code=204)
def remove_share(design_id: str, target_id: str, user: User = Depends(current_user)):
    p = _own_design_path(user, design_id)
    if not p.exists() and target_id != user.id:
        raise HTTPException(403, "Solo el propietario puede gestionar el acceso")
    with _shares_lock:
        shares = _load_shares()
        if design_id in shares:
            shares[design_id].get("users", {}).pop(target_id, None)
            _save_shares(shares)
    return Response(status_code=204)


@app.post("/api/designs/{design_id}/duplicate", status_code=201)
def duplicate_design(design_id: str, user: User = Depends(current_user)):
    p, _owner, _role = resolve_design(user, design_id)
    data = _read_json(p)
    new_id = uuid.uuid4().hex[:12]
    now = int(time.time() * 1000)
    data.update({"id": new_id, "name": f"{data.get('name', 'Diseño')} (copia)", "createdAt": now, "updatedAt": now})
    _write_json(_own_design_path(user, new_id), data)
    return data


# ----------------------------------------------------------------------------
# Subidas (imágenes, fuentes, svg)
# ----------------------------------------------------------------------------
_upload_lock = threading.Lock()
_ALLOWED_UPLOAD_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ttf", ".otf", ".woff", ".woff2", ".mp4", ".webm", ".mov", ".m4v"}
_VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}


def _upload_index(user: User) -> Path:
    return uploads_dir(user) / "index.json"


def _load_upload_index(user: User) -> list[dict]:
    p = _upload_index(user)
    if p.exists():
        try:
            return _read_json(p)["items"]
        except Exception:
            return []
    return []


def _save_upload_index(user: User, items: list[dict]) -> None:
    _write_json(_upload_index(user), {"items": items})


@app.get("/api/uploads")
def list_uploads(kind: Optional[str] = None, user: User = Depends(current_user)):
    items = _load_upload_index(user)
    if kind:
        items = [i for i in items if i.get("kind") == kind]
    items.sort(key=lambda i: i.get("createdAt") or 0, reverse=True)
    return items


@app.post("/api/uploads", status_code=201)
def upload_file(user: User = Depends(current_user), file: UploadFile = File(...)):
    name = file.filename or "archivo"
    ext = Path(name).suffix.lower()
    if ext not in _ALLOWED_UPLOAD_EXT:
        raise HTTPException(415, f"Extensión no permitida: {ext}")
    raw = read_limited(file, MAX_UPLOAD_BYTES)
    if not raw:
        raise HTTPException(400, "Fichero vacío")
    # Validación de contenido (no solo por extensión)
    if ext == ".svg":
        head = raw[:4096].lstrip().lower()
        if b"<svg" not in head and b"<?xml" not in head:
            raise HTTPException(415, "El fichero no es un SVG válido")
    elif ext in {".ttf", ".otf", ".woff", ".woff2"}:
        if raw[:4] not in {b"\x00\x01\x00\x00", b"OTTO", b"true", b"wOFF", b"wOF2"}:
            raise HTTPException(415, "El fichero no es una fuente válida")
    elif ext in _VIDEO_EXT:
        if not (raw[4:8] == b"ftyp" or raw[:4] == b"\x1a\x45\xdf\xa3"):
            raise HTTPException(415, "El fichero no es un vídeo válido (MP4/WebM)")
    else:
        try:
            with Image.open(io.BytesIO(raw)) as im:
                im.verify()
        except Exception:
            raise HTTPException(415, "El fichero no es una imagen válida")

    file_id = uuid.uuid4().hex[:12]
    stored = f"{file_id}{ext}"
    (uploads_dir(user) / stored).write_bytes(raw)

    kind = "font" if ext in {".ttf", ".otf", ".woff", ".woff2"} else ("video" if ext in _VIDEO_EXT else "image")
    width = height = None
    if kind == "image" and ext != ".svg":
        try:
            with Image.open(io.BytesIO(raw)) as im:
                width, height = im.size
        except Exception:
            pass

    item = {
        "id": file_id,
        "name": name,
        "kind": kind,
        "url": f"/api/uploads/file/{user.id}/{stored}",
        "size": len(raw),
        "width": width,
        "height": height,
        "createdAt": int(time.time() * 1000),
    }
    with user_lock(user.id):
        items = _load_upload_index(user)
        items.append(item)
        _save_upload_index(user, items)
    return item


@app.delete("/api/uploads/{file_id}", status_code=204)
def delete_upload(file_id: str, user: User = Depends(current_user)):
    with user_lock(user.id):
        items = _load_upload_index(user)
        keep = []
        for it in items:
            if it["id"] == file_id:
                try:
                    (uploads_dir(user) / Path(it["url"]).name).unlink(missing_ok=True)
                except Exception:
                    pass
            else:
                keep.append(it)
        _save_upload_index(user, keep)
    return Response(status_code=204)


_FILE_RE = re.compile(r"^[a-f0-9]{12}\.[a-z0-9]{2,5}$")


@app.post("/api/video/convert")
def video_convert(user: User = Depends(current_user), file: UploadFile = File(...), fmt: str = Query("mp4"), fps: int = Query(24, ge=5, le=60), width: int = Query(0, ge=0, le=4096)):
    """Convierte un WebM grabado en el navegador a MP4 (H.264) o GIF con ffmpeg."""
    import shutil
    import subprocess
    import tempfile

    if fmt not in {"mp4", "gif"}:
        raise HTTPException(400, "Formato no soportado")
    if not shutil.which("ffmpeg"):
        raise HTTPException(503, "ffmpeg no está instalado en el backend (reconstruye la imagen)")
    raw = read_limited(file, 500 * 1024 * 1024)
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "in.webm"
        src.write_bytes(raw)
        out = Path(td) / f"out.{fmt}"
        scale = f"scale={width}:-2:flags=lanczos," if width else ""
        if fmt == "mp4":
            cmd = ["ffmpeg", "-y", "-i", str(src), "-vf", f"{scale}fps={fps},format=yuv420p,pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", "-an", str(out)]
        else:
            cmd = ["ffmpeg", "-y", "-i", str(src), "-vf", f"{scale}fps={min(fps, 20)},split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer", str(out)]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=600)
        except subprocess.CalledProcessError as exc:
            raise HTTPException(500, f"ffmpeg falló: {exc.stderr[-400:].decode(errors='ignore')}")
        except subprocess.TimeoutExpired:
            raise HTTPException(504, "La conversión tardó demasiado")
        data = out.read_bytes()
    return Response(data, media_type="video/mp4" if fmt == "mp4" else "image/gif")


@app.get("/api/uploads/file/{owner_id}/{filename}")
def get_upload_file(owner_id: str, filename: str, user: User = Depends(current_user)):
    # El propietario y sus colaboradores pueden leer los ficheros
    if not _FILE_RE.match(filename) or not can_access_files(user, owner_id):
        raise HTTPException(404, "No encontrado")
    owner = user if owner_id == user.id else auth.get_user_by_id(owner_id)
    if not owner:
        raise HTTPException(404, "No encontrado")
    p = uploads_dir(owner) / filename
    if not p.exists():
        raise HTTPException(404, "No encontrado")
    headers = {"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"}
    if filename.endswith(".svg"):
        # evita que un SVG con <script> se ejecute si se abre directamente
        headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:"
    return FileResponse(p, headers=headers)


# ----------------------------------------------------------------------------
# Kit de marca
# ----------------------------------------------------------------------------
_DEFAULT_BRAND = {"colors": [], "fonts": [], "logos": []}


@app.get("/api/brand")
def get_brand(user: User = Depends(current_user)):
    bf = brand_file(user)
    if bf.exists():
        try:
            return _read_json(bf)
        except Exception:
            pass
    return _DEFAULT_BRAND


@app.put("/api/brand")
def put_brand(payload: dict, user: User = Depends(current_user)):
    data = {**_DEFAULT_BRAND, **{k: payload.get(k, v) for k, v in _DEFAULT_BRAND.items()}}
    _write_json(brand_file(user), data)
    return data


# ----------------------------------------------------------------------------
# Utilidad: convertir imagen (p.ej. HEIC no, pero sí redimensionar/format)
# ----------------------------------------------------------------------------
@app.post("/api/image/convert")
def convert_image(user: User = Depends(current_user), file: UploadFile = File(...), fmt: str = Query("png"), quality: int = Query(90, ge=1, le=100), max_side: int = Query(0, ge=0)):
    fmt = fmt.lower()
    if fmt not in {"png", "jpeg", "jpg", "webp"}:
        raise HTTPException(400, "Formato no soportado")
    raw = read_limited(file, MAX_IMAGE_BYTES)
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
    except Exception:
        raise HTTPException(400, "No se pudo leer la imagen")
    if max_side and max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = io.BytesIO()
    if fmt in {"jpeg", "jpg"}:
        img.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True)
        media = "image/jpeg"
    elif fmt == "webp":
        img.save(buf, "WEBP", quality=quality)
        media = "image/webp"
    else:
        img.save(buf, "PNG", optimize=True)
        media = "image/png"
    return Response(buf.getvalue(), media_type=media)


# ----------------------------------------------------------------------------
# Colaboración en tiempo real (WebSocket por diseño)
# ----------------------------------------------------------------------------
class Room:
    def __init__(self) -> None:
        self.clients: dict[WebSocket, dict] = {}


_rooms: dict[str, Room] = {}
_COLORS = ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4"]


async def _broadcast(room: Room, message: dict, exclude: WebSocket | None = None) -> None:
    dead = []
    for ws in list(room.clients.keys()):
        if ws is exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        room.clients.pop(ws, None)


def _presence(room: Room) -> list[dict]:
    return [{"clientId": info["clientId"], "id": info["id"], "name": info["name"], "color": info["color"], "role": info["role"], "pageId": info.get("pageId")} for info in room.clients.values()]


@app.websocket("/api/ws/design/{design_id}")
async def ws_design(websocket: WebSocket, design_id: str):
    uid = auth.read_token(websocket.cookies.get(auth.SESSION_COOKIE))
    user = auth.get_user_by_id(uid) if uid else None
    if not user:
        await websocket.close(code=4401)
        return
    try:
        _p, _owner, role = resolve_design(user, design_id)
    except HTTPException:
        await websocket.close(code=4404)
        return
    await websocket.accept()
    room = _rooms.setdefault(design_id, Room())
    client_id = uuid.uuid4().hex[:8]
    color = _COLORS[len(room.clients) % len(_COLORS)]
    room.clients[websocket] = {"clientId": client_id, "id": user.id, "name": user.name, "color": color, "role": role, "pageId": None}
    await websocket.send_json({"type": "hello", "clientId": client_id, "color": color, "role": role, "presence": _presence(room)})
    await _broadcast(room, {"type": "presence", "presence": _presence(room)}, exclude=websocket)
    try:
        while True:
            msg = await websocket.receive_json()
            t = msg.get("type")
            info = room.clients.get(websocket)
            if not info:
                break
            if t == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if role == "view" and t in {"page", "design"}:
                continue  # los lectores no editan
            if t == "cursor":
                info["pageId"] = msg.get("pageId")
            out = {**msg, "from": {"clientId": client_id, "id": user.id, "name": user.name, "color": color}}
            await _broadcast(room, out, exclude=websocket)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        room.clients.pop(websocket, None)
        await _broadcast(room, {"type": "presence", "presence": _presence(room)})
        if not room.clients:
            _rooms.pop(design_id, None)


@app.get("/")
def root():
    return JSONResponse({"name": "bamba API", "docs": "/docs"})
