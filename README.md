# bamba — tu propio Canva, autoalojado

Editor de diseño gráfico en el navegador (clon de Canva) que corre **entero en Docker**, sin suscripciones ni servicios de pago:
plantillas, elementos, stickers e ilustraciones, texto con efectos y **texto curvo**, fotos de stock, subidas (imágenes, SVG vectorial, vídeo),
**eliminación y desenfoque de fondos con IA**, efectos de foto (duotono, viñeta, sombras…), páginas múltiples, **animaciones**, marcos, gráficos,
códigos QR, kit de marca, cuentas de usuario, **colaboración en tiempo real**, **IA generativa** (texto e imagen) y exportación a
PNG / JPG / WebP / SVG / PDF / **MP4 / GIF / WebM**.

## Arranque rápido

```bash
make up          # o: docker compose up --build
```

- App: http://localhost:5173 (dev, con recarga en caliente)
- API: http://localhost:8000/docs

La primera vez que quites un fondo se descarga el modelo de IA (~170 MB) al volumen `rembg-models`; después es instantáneo.

Crea tu cuenta en la pantalla inicial. Cada usuario tiene sus propios diseños, subidas y kit de marca; puedes compartir diseños con otros usuarios del servidor (editor o lector) y editarlos a la vez.

### Desplegar en un servidor (detrás de tu proxy con dominio + SSL)

```bash
git clone … bamba && cd bamba
cp .env.example .env         # edita: COOKIE_SECURE=true, SECRET_KEY, BAMBA_PORT…
make prod                    # escucha en 127.0.0.1:8080 (cámbialo con BAMBA_PORT / BAMBA_BIND)
```

En tu proxy inverso apunta el dominio a `http://127.0.0.1:8080` y asegúrate de:
- **WebSocket**: reenviar las cabeceras `Upgrade`/`Connection` (colaboración en tiempo real, ruta `/api/ws/`).
- **Tamaño de subida**: permitir cuerpos de al menos 80 MB (vídeos y fotos grandes; en nginx `client_max_body_size 80m;`).
- **Timeouts**: lecturas de ≥300 s (quitar fondo y conversión de vídeo pueden tardar).

Ejemplos:

```nginx
# nginx del host
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    client_max_body_size 80m;
}
```

```
# Caddyfile
tu-dominio.com {
    reverse_proxy 127.0.0.1:8080
    request_body { max_size 80MB }
}
```

Tras crear tu cuenta pon `ALLOW_REGISTRATION=false` en `.env` y `make prod` de nuevo. Los datos viven en el volumen `bamba-prod_bamba-data`:

```bash
# copia de seguridad / restauración
docker run --rm -v bamba-prod_bamba-data:/data -v "$PWD":/backup alpine tar czf /backup/bamba-data.tgz -C /data .
docker run --rm -v bamba-prod_bamba-data:/data -v "$PWD":/backup alpine sh -c "cd /data && tar xzf /backup/bamba-data.tgz"
```

Actualizar: `git pull && make prod` (reconstruye imágenes; los datos se conservan). Requisitos: 2 CPU / 4 GB RAM (8 GB si activas la IA de texto local con `docker compose -f docker-compose.prod.yml --profile ai up -d`).

### IA de texto local (opcional)

```bash
make ai          # docker compose --profile ai up -d  → descarga Ollama + qwen2.5:1.5b (~1 GB, CPU)
```

Sin esto, «Texto mágico» no está disponible (las imágenes mágicas usan un servicio gratuito externo). También puedes usar cualquier API
OpenAI-compatible (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`) o Stable Diffusion WebUI (`AI_IMAGE_URL`) desde `docker-compose.yml`.

### Producción (nginx + backend)

```bash
make prod        # http://localhost:8080  (proyecto compose "bamba-prod", con sus propios volúmenes)
```

Dev y prod usan volúmenes distintos (`bamba_bamba-data` vs `bamba-prod_bamba-data`), así que pueden convivir.

Variables útiles (`.env` o entorno): `ALLOW_REGISTRATION=false` (cerrar el registro tras crear tu cuenta),
`SECRET_KEY=...` (firma de sesiones; si no se define se genera y persiste en el volumen), `COOKIE_SECURE=true` (si sirves por HTTPS),
`REMBG_DEFAULT_MODEL` (`isnet-general-use`, `u2net`, `u2netp`, `u2net_human_seg`, `silueta`, `isnet-anime`), `MAX_IMAGE_SIDE`.

## Qué incluye

| Área | Funciones |
|---|---|
| Diseños | Cuentas de usuario, biblioteca de diseños con miniaturas, duplicar/eliminar, autosave, tamaños predefinidos (redes, vídeo, impresión, documentos…) y personalizados (px/mm/cm/in), **redimensión mágica** que escala el contenido |
| Páginas | Diseños multipágina, añadir/duplicar/eliminar/reordenar, tira de miniaturas, **modo presentación** a pantalla completa |
| Diseño | Plantillas que se adaptan a cualquier tamaño, paletas de color y combinaciones de fuentes aplicables al diseño |
| Elementos | Formas, líneas y flechas, 1.700+ iconos (lucide), **stickers, ilustraciones, logos y banderas** (200k+ SVG vía Iconify, insertados como vectores editables), marcos con forma para fotos, cuadrículas, gráficos de datos (columnas, barras, líneas, tarta, anillo), emojis, tablas, SVG propios como vectores |
| Texto | Títulos/subtítulos/cuerpo, 40+ fuentes Google + fuentes de marca subidas, negrita/cursiva/subrayado/tachado, alineación, espaciado, interlineado, **efectos** (sombra, elevar, hueco, empalme, contorno, eco, neón, fondo), **texto curvo** con control de curvatura, combinaciones de estilos |
| Imágenes | Subidas, fotos de stock (Openverse, licencias libres), **quitar fondo con IA (rembg)**, **desenfocar / recolorear fondo**, restaurar, recorte, panel «Editar foto» (ajustes, 16 filtros, **duotono**, viñeta, enfoque, tinte, sombra/brillo/contorno, esquinas redondeadas, borde, relieve), reemplazar imagen, voltear, establecer como fondo |
| Edición | **Menú contextual estilo Canva** (clic derecho), selección múltiple, agrupar/desagrupar, capas (visibilidad, bloqueo, renombrar, arrastrar, mostrar todo lo oculto), alinear/distribuir, posición numérica, transparencia, copiar/pegar estilo, deshacer/rehacer, copiar/pegar/duplicar, guías inteligentes con imantación, atajos de teclado, zoom |
| Animación y vídeo | Animaciones por elemento y por página (fundido, ascenso, pop, zoom, barrido, rebote…), duración por página, **presentación animada** con reproducción automática, **vídeos como elementos**, exportar a **MP4 / GIF / WebM** |
| Colaboración | Compartir con otros usuarios (editor/lector), edición simultánea en tiempo real (WebSocket), avatares y cursores de los conectados, guardado por página para no pisarse |
| IA | Imagen mágica (texto → imagen), texto mágico (escribir, titulares, hashtags, reescribir, acortar, ampliar, resumir, traducir, cambiar tono) con modelo local opcional |
| Fondo | Colores, degradados predefinidos y personalizados, transparente, imagen |
| Dibujo | Bolígrafo, rotulador y resaltador con color/grosor/opacidad |
| Marca | Colores, fuentes (.ttf/.otf/.woff) y logos reutilizables en todos los diseños |
| Apps | Código QR, gráficos, quitar fondo, tablas… |
| Exportar | PNG (con transparencia), JPG, WebP, SVG, PDF multipágina, MP4, GIF, WebM; escala hasta 4×; todas las páginas en ZIP |

Límites conocidos: la colaboración es "última escritura gana" por página (no fusiona cambios dentro de la misma página al milisegundo); la IA gratuita de imágenes es un servicio externo (Pollinations); el LLM local es pequeño (1,5B) y va a la velocidad de tu CPU.

## Arquitectura

```
frontend/   React + Vite + TypeScript + Tailwind v4 + fabric.js 6 (+ clases propias: texto curvo, vídeo, filtros WebGL) + zustand
backend/    FastAPI + rembg (onnxruntime CPU) + Pillow + httpx + ffmpeg + SQLite (usuarios) + WebSockets
ollama/     (opcional, perfil "ai") LLM local para el texto mágico
```

- El frontend habla solo con `/api/*` (proxy de Vite en dev, nginx en prod).
- Datos en el volumen `bamba-data`: `/data/bamba.db` (usuarios), `/data/users/<id>/designs/*.json`, `/data/users/<id>/uploads/`, `/data/users/<id>/brand.json`.
- Sesión: cookie HttpOnly `SameSite=Lax` firmada con HMAC y ligada al hash de la contraseña (cambiarla invalida sesiones); contraseñas con PBKDF2-SHA256; límite de intentos de login/registro por IP.
- Seguridad: proxy de imágenes con validación DNS (solo IPs públicas, redirecciones revalidadas, tope de tamaño), subidas validadas por contenido (Pillow/firmas), SVG servidos con CSP, tamaños máximos en quitar-fondo/convertir, escrituras por usuario con bloqueo.

## Comandos

```bash
make up / make up-d / make down / make logs / make restart
make prod / make prod-down
make ai           # IA de texto local (Ollama)
make lock         # regenera frontend/package-lock.json
make clean        # borra contenedores/imágenes de dev (conserva datos)
make clean-all    # ¡borra también usuarios, diseños y modelos!
```

## Atajos

`Ctrl+Z / Ctrl+Shift+Z` deshacer/rehacer · `Ctrl+C/V/D` copiar/pegar/duplicar · `Ctrl+A` todo · `Ctrl+G` agrupar · `Supr` eliminar ·
flechas mover · `T` texto · `R/C/L` rectángulo/círculo/línea · `Ctrl+rueda` zoom · `Ctrl+0` ajustar · doble clic = editar texto / rellenar marco.
