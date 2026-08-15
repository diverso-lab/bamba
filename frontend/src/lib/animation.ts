import { Rect, StaticCanvas, type FabricObject } from 'fabric'
import { ensureFontsInJson } from './fonts'
import { CUSTOM_PROPS } from './fabricUtils'
import { isVideo } from './video'

/**
 * Animaciones estilo Canva: cada elemento puede tener `anim` y cada página una animación por defecto.
 * Se reproducen en modo presentación y al exportar vídeo.
 */
export type AnimType = 'none' | 'fade' | 'rise' | 'pan' | 'pop' | 'zoom' | 'drift' | 'tumble' | 'wipe' | 'blink' | 'bounce'

export interface AnimSpec {
  type: AnimType
  duration: number // ms
  delay: number // ms
}

export const ANIMATIONS: { id: AnimType; label: string; desc: string }[] = [
  { id: 'none', label: 'Ninguna', desc: '' },
  { id: 'fade', label: 'Fundido', desc: 'Aparece suavemente' },
  { id: 'rise', label: 'Ascenso', desc: 'Sube mientras aparece' },
  { id: 'pan', label: 'Deslizar', desc: 'Entra desde la izquierda' },
  { id: 'pop', label: 'Pop', desc: 'Aparece con rebote' },
  { id: 'zoom', label: 'Zoom', desc: 'Se acerca desde lejos' },
  { id: 'wipe', label: 'Barrido', desc: 'Se revela de izquierda a derecha' },
  { id: 'drift', label: 'Deriva', desc: 'Flota lentamente' },
  { id: 'tumble', label: 'Voltereta', desc: 'Gira al entrar' },
  { id: 'blink', label: 'Parpadeo', desc: 'Parpadea al aparecer' },
  { id: 'bounce', label: 'Rebote', desc: 'Cae y rebota' },
]

CUSTOM_PROPS.push('anim')

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const easeOutBack = (p: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}
const easeOutBounce = (p: number) => {
  const n1 = 7.5625
  const d1 = 2.75
  if (p < 1 / d1) return n1 * p * p
  if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75
  if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375
  return n1 * (p -= 2.625 / d1) * p + 0.984375
}

interface Base {
  left: number
  top: number
  scaleX: number
  scaleY: number
  opacity: number
  angle: number
  clipPath: any
}

export interface PagePlayer {
  canvas: StaticCanvas
  /** Duración total (ms) hasta que todas las animaciones han terminado */
  animEnd: number
  render: (t: number) => void
  /** arranca los vídeos de la página */
  start: () => void
  stop: () => void
  dispose: () => void
}

/** Prepara una página para animarla: carga el JSON y guarda las transformaciones base. */
export async function createPagePlayer(json: any, W: number, H: number, opts: { scale?: number; pageAnim?: AnimSpec | null; canvasEl?: HTMLCanvasElement } = {}): Promise<PagePlayer> {
  const scale = opts.scale || 1
  await ensureFontsInJson(json)
  const sc = new StaticCanvas(opts.canvasEl, { width: W * scale, height: H * scale, enableRetinaScaling: false })
  sc.setZoom(scale)
  if (json) await sc.loadFromJSON(json)
  if (!sc.backgroundColor) sc.backgroundColor = '#ffffff'
  const objs = sc.getObjects()
  const bases = new Map<FabricObject, Base>()
  const specs = new Map<FabricObject, AnimSpec>()
  let animEnd = 0
  objs.forEach((o, i) => {
    bases.set(o, { left: o.left, top: o.top, scaleX: o.scaleX, scaleY: o.scaleY, opacity: o.opacity, angle: o.angle, clipPath: o.clipPath })
    let spec: AnimSpec | null = (o as any).anim || null
    if ((!spec || spec.type === 'none') && opts.pageAnim && opts.pageAnim.type !== 'none') {
      spec = { ...opts.pageAnim, delay: (opts.pageAnim.delay || 0) + i * 120 }
    }
    if (spec && spec.type !== 'none') {
      specs.set(o, spec)
      animEnd = Math.max(animEnd, (spec.delay || 0) + (spec.duration || 800))
    }
  })

  const render = (t: number) => {
    for (const o of objs) {
      const b = bases.get(o)!
      const s = specs.get(o)
      if (!s) continue
      const dur = Math.max(50, s.duration || 800)
      let p = (t - (s.delay || 0)) / dur
      p = Math.max(0, Math.min(1, p))
      const e = easeOutCubic(p)
      // reset
      o.set({ left: b.left, top: b.top, scaleX: b.scaleX, scaleY: b.scaleY, opacity: b.opacity, angle: b.angle })
      o.clipPath = b.clipPath
      switch (s.type) {
        case 'fade':
          o.set('opacity', b.opacity * e)
          break
        case 'rise':
          o.set({ opacity: b.opacity * e, top: b.top + (1 - e) * H * 0.08 })
          break
        case 'pan':
          o.set({ opacity: b.opacity * Math.min(1, e * 1.5), left: b.left - (1 - e) * W * 0.12 })
          break
        case 'pop': {
          const k = 0.4 + 0.6 * easeOutBack(p)
          scaleAround(o, b, k)
          o.set('opacity', b.opacity * Math.min(1, p * 3))
          break
        }
        case 'zoom': {
          const k = 1.35 - 0.35 * e
          scaleAround(o, b, k)
          o.set('opacity', b.opacity * e)
          break
        }
        case 'drift':
          o.set({ opacity: b.opacity * e, left: b.left - (1 - e) * W * 0.03, top: b.top + (1 - e) * H * 0.03 })
          break
        case 'tumble':
          o.set({ opacity: b.opacity * e, angle: b.angle - (1 - e) * 25, top: b.top + (1 - e) * H * 0.06 })
          break
        case 'blink':
          o.set('opacity', p >= 1 ? b.opacity : b.opacity * (Math.floor(p * 6) % 2 === 0 ? 0.15 : 1))
          break
        case 'bounce':
          o.set({ opacity: b.opacity * Math.min(1, p * 4), top: b.top - (1 - easeOutBounce(p)) * H * 0.15 })
          break
        case 'wipe': {
          if (p < 1) {
            // clip progresivo en el espacio local del objeto
            const w = o.width
            const h = o.height
            const rect = new Rect({ left: -w / 2, top: -h / 2 - 5, width: Math.max(0.01, w * e), height: h + 10, originX: 'left', originY: 'top', absolutePositioned: false })
            o.clipPath = rect
          }
          o.set('opacity', b.opacity)
          break
        }
      }
      o.setCoords()
    }
    sc.renderAll()
  }

  const videos = objs.filter(isVideo)
  const start = () => {
    for (const v of videos) {
      const el = (v as any).videoEl as HTMLVideoElement | null
      if (el) {
        try {
          el.currentTime = 0
        } catch {
          /* ignore */
        }
        void el.play().catch(() => {})
      }
    }
  }
  const stop = () => {
    for (const v of videos) (v as any).videoEl?.pause?.()
  }
  return {
    canvas: sc,
    animEnd,
    render,
    start,
    stop,
    dispose: () => {
      stop()
      sc.dispose()
    },
  }
}

function scaleAround(o: FabricObject, b: Base, k: number) {
  // escala manteniendo el centro
  const cx = b.left + (b.scaleX * o.width * (o.originX === 'center' ? 0 : 1)) / 2
  const cy = b.top + (b.scaleY * o.height * (o.originY === 'center' ? 0 : 1)) / 2
  o.set({ scaleX: b.scaleX * k, scaleY: b.scaleY * k })
  if (o.originX !== 'center') o.set('left', cx - (b.scaleX * k * o.width) / 2)
  if (o.originY !== 'center') o.set('top', cy - (b.scaleY * k * o.height) / 2)
}

