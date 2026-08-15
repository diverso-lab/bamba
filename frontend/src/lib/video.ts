import { FabricImage, classRegistry, type Canvas } from 'fabric'
import { asAny, uid } from './fabricUtils'

/**
 * Elemento de vídeo: una FabricImage cuyo elemento fuente es un <video>.
 * Se serializa con `videoSrc` y se reconstruye al cargar el JSON.
 */
export class VideoImage extends FabricImage {
  declare videoSrc: string
  declare muted: boolean
  declare loop: boolean
  static type = 'VideoImage'

  get videoEl(): HTMLVideoElement | null {
    const el = this.getElement() as any
    return el && el.tagName === 'VIDEO' ? (el as HTMLVideoElement) : null
  }

  toObject(propertiesToInclude: any[] = []) {
    const o = super.toObject(['videoSrc', 'muted', 'loop', ...propertiesToInclude] as any) as any
    o.type = 'VideoImage'
    // src no sirve para reconstruir un vídeo; lo sustituimos por un poster vacío
    o.src = ''
    return o
  }

  static async fromObject(object: any): Promise<VideoImage> {
    const { videoSrc, src: _src, type: _t, filters: _f, ...rest } = object || {}
    const el = await loadVideoElement(videoSrc)
    const v = new VideoImage(el, { ...rest, objectCaching: false })
    v.videoSrc = videoSrc
    if (rest.width) v.width = rest.width
    if (rest.height) v.height = rest.height
    return v
  }
}
classRegistry.setClass(VideoImage)

export function isVideo(o: any): o is VideoImage {
  return !!o && (o instanceof VideoImage || (typeof o.isType === 'function' && o.isType('VideoImage')))
}

export function loadVideoElement(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video')
    el.crossOrigin = 'anonymous'
    el.muted = true
    el.loop = true
    el.playsInline = true
    el.preload = 'auto'
    el.src = src
    const done = () => {
      el.width = el.videoWidth
      el.height = el.videoHeight
      // primer frame visible
      try {
        el.currentTime = 0.01
      } catch {
        /* ignore */
      }
      resolve(el)
    }
    el.addEventListener('loadeddata', done, { once: true })
    el.addEventListener('error', () => reject(new Error('No se pudo cargar el vídeo')), { once: true })
    el.load()
  })
}

export async function createVideo(src: string): Promise<VideoImage> {
  const el = await loadVideoElement(src)
  const v = new VideoImage(el, { objectCaching: false })
  v.videoSrc = src
  v.width = el.videoWidth
  v.height = el.videoHeight
  asAny(v).set({ id: uid(), bambaType: 'video', name: 'Vídeo' })
  return v
}

// Bucle de render mientras haya vídeos reproduciéndose
const loops = new WeakMap<Canvas, number>()
export function ensureVideoLoop(canvas: Canvas) {
  if (loops.has(canvas)) return
  const tick = () => {
    const vids = canvas.getObjects().filter(isVideo) as VideoImage[]
    const playing = vids.some((v) => v.videoEl && !v.videoEl.paused && !v.videoEl.ended)
    if (playing) canvas.requestRenderAll()
    if (vids.length) loops.set(canvas, requestAnimationFrame(tick))
    else loops.delete(canvas)
  }
  loops.set(canvas, requestAnimationFrame(tick))
}

export function stopVideoLoop(canvas: Canvas) {
  const id = loops.get(canvas)
  if (id) cancelAnimationFrame(id)
  loops.delete(canvas)
}
