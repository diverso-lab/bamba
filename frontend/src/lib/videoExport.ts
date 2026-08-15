import { createPagePlayer, type AnimSpec } from './animation'
import type { PageData } from './types'
import { downloadBlob } from './export'

export interface VideoExportOptions {
  format: 'webm' | 'mp4' | 'gif'
  fps: number
  maxSide: number // p. ej. 1080 / 1280 / 1920
  pages: 'current' | 'all'
}

function pickMime() {
  const cands = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  for (const c of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  return ''
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'bamba'

/**
 * Graba las páginas (con animaciones y vídeos) en tiempo real usando MediaRecorder
 * sobre un canvas y descarga WebM; MP4/GIF se convierten en el backend (ffmpeg).
 */
export async function exportVideo(name: string, pages: PageData[], currentIndex: number, W: number, H: number, opts: VideoExportOptions, onProgress?: (msg: string, frac: number) => void) {
  const mime = pickMime()
  if (!mime) throw new Error('Este navegador no soporta la grabación de vídeo (MediaRecorder)')
  const list = opts.pages === 'all' ? pages : [pages[currentIndex]]
  const scale = Math.min(1, opts.maxSide / Math.max(W, H))
  const cw = Math.round(W * scale)
  const ch = Math.round(H * scale)
  const rec = document.createElement('canvas')
  rec.width = cw
  rec.height = ch
  const ctx = rec.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, cw, ch)
  const stream = rec.captureStream(opts.fps)
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }))
  })
  const total = list.reduce((s, p) => s + (p.duration || 5000), 0)
  let elapsedBefore = 0

  onProgress?.('Preparando…', 0)
  // pre-cargar la primera página
  recorder.start(250)
  for (let i = 0; i < list.length; i++) {
    const page = list[i]
    const dur = page.duration || 5000
    const player = await createPagePlayer(page.json, W, H, { scale, pageAnim: (page.anim as AnimSpec) || null })
    const src = player.canvas.lowerCanvasEl
    const start = performance.now()
    player.render(0)
    player.start()
    await new Promise<void>((resolve) => {
      const frame = () => {
        const t = performance.now() - start
        player.render(Math.min(t, dur))
        // transición: fundido de entrada 300 ms
        ctx.globalAlpha = 1
        ctx.drawImage(src, 0, 0, cw, ch)
        if (t < 300 && i > 0) {
          ctx.globalAlpha = 1 - t / 300
          ctx.fillStyle = '#000'
          ctx.fillRect(0, 0, cw, ch)
          ctx.globalAlpha = 1
        }
        onProgress?.(`Grabando página ${i + 1} de ${list.length}…`, Math.min(0.9, (elapsedBefore + t) / total))
        if (t >= dur) resolve()
        else requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    elapsedBefore += dur
    player.dispose()
  }
  recorder.stop()
  const webm = await done
  const base = slug(name)
  if (opts.format === 'webm') {
    downloadBlob(webm, `${base}.webm`)
    onProgress?.('Listo', 1)
    return
  }
  onProgress?.(`Convirtiendo a ${opts.format.toUpperCase()}…`, 0.92)
  const fd = new FormData()
  fd.append('file', webm, 'video.webm')
  const res = await fetch(`/api/video/convert?fmt=${opts.format}&fps=${opts.fps}`, { method: 'POST', body: fd })
  if (!res.ok) {
    let msg = res.statusText
    try {
      msg = (await res.json()).detail || msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  downloadBlob(await res.blob(), `${base}.${opts.format}`)
  onProgress?.('Listo', 1)
}
