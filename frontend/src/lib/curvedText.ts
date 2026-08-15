import { FabricObject, Shadow, classRegistry, type TClassProperties } from 'fabric'

/**
 * Texto curvo: dibuja cada carácter a lo largo de un arco.
 * curve: -100..100  (0 = casi recto, ±100 = circunferencia completa). Positivo = arco hacia arriba (texto sobre el círculo).
 */
export interface CurvedTextProps {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: string | number
  fontStyle: string
  fill: string
  stroke: string
  strokeWidth: number
  charSpacing: number
  curve: number
  underline: boolean
}

const curvedDefaults: CurvedTextProps = {
  text: 'Texto curvo',
  fontFamily: 'Poppins',
  fontSize: 60,
  fontWeight: 'bold',
  fontStyle: 'normal',
  fill: '#111827',
  stroke: '',
  strokeWidth: 0,
  charSpacing: 0,
  curve: 50,
  underline: false,
}

const CURVED_PROPS = Object.keys(curvedDefaults) as (keyof CurvedTextProps)[]

let measureCtx: CanvasRenderingContext2D | null = null
function getMeasureCtx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!
  return measureCtx
}

interface Glyph {
  ch: string
  w: number
  angle: number // ángulo del centro del glifo (rad)
}

interface Layout {
  glyphs: Glyph[]
  r: number
  theta: number // ángulo total del arco
  up: boolean // arco hacia arriba
  width: number
  height: number
  cy: number // desplazamiento vertical del centro del círculo respecto al centro del objeto
}

export class CurvedText extends FabricObject {
  declare text: string
  declare fontFamily: string
  declare fontSize: number
  declare fontWeight: string | number
  declare fontStyle: string
  declare charSpacing: number
  declare curve: number
  declare underline: boolean

  static type = 'CurvedText'
  static ownDefaults = { ...curvedDefaults, objectCaching: true, strokeUniform: false }
  static cacheProperties = [...FabricObject.cacheProperties, ...CURVED_PROPS]

  private _layout: Layout | null = null

  static getDefaults(): Record<string, any> {
    return { ...super.getDefaults(), ...CurvedText.ownDefaults }
  }

  constructor(options: Partial<CurvedTextProps & TClassProperties<FabricObject>> = {}) {
    super()
    Object.assign(this, CurvedText.ownDefaults)
    this.setOptions(options)
    this.initDimensions()
  }

  get fontString() {
    return `${this.fontStyle || 'normal'} ${this.fontWeight || 'normal'} ${this.fontSize}px "${this.fontFamily}"`
  }

  /** Recalcula la disposición de los glifos y el tamaño del objeto. */
  initDimensions() {
    const ctx = getMeasureCtx()
    ctx.font = this.fontString
    const chars = Array.from(this.text || ' ')
    const spacing = (this.charSpacing / 1000) * this.fontSize
    const widths = chars.map((c) => ctx.measureText(c).width)
    const L = widths.reduce((s, w) => s + w, 0) + spacing * Math.max(0, chars.length - 1)
    const c = Math.max(-100, Math.min(100, this.curve || 0))
    const up = c >= 0
    // 0 -> arco casi recto (θ pequeño), 100 -> circunferencia completa
    const theta = Math.max(0.02, (Math.abs(c) / 100) * Math.PI * 2)
    const r = Math.max(L / theta, 1)
    const glyphs: Glyph[] = []
    let acc = -L / 2
    for (let i = 0; i < chars.length; i++) {
      const w = widths[i]
      const center = acc + w / 2
      glyphs.push({ ch: chars[i], w, angle: center / r })
      acc += w + spacing
    }
    // caja: puntos exteriores e interiores de cada glifo
    const fs = this.fontSize
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    const consider = (x: number, y: number) => {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    const half = theta / 2
    const steps = Math.max(8, glyphs.length * 2)
    for (let i = 0; i <= steps; i++) {
      const a = -half + (theta * i) / steps
      const s = Math.sin(a)
      const co = Math.cos(a)
      // línea base a radio r; parte alta de las letras hacia fuera (up) o hacia dentro (down)
      const rOut = up ? r + fs * 0.8 : r + fs * 0.25
      const rIn = up ? r - fs * 0.25 : r - fs * 0.8
      if (up) {
        consider(rOut * s, -rOut * co)
        consider(rIn * s, -rIn * co)
      } else {
        consider(rOut * s, rOut * co)
        consider(rIn * s, rIn * co)
      }
    }
    const width = Math.max(1, maxX - minX)
    const height = Math.max(1, maxY - minY)
    // el centro del círculo respecto al centro de la caja
    const cy = -(minY + maxY) / 2
    this._layout = { glyphs, r, theta, up, width, height, cy }
    this.width = width
    this.height = height
    this.dirty = true
    this.setCoords()
  }

  _set(key: string, value: any) {
    const r = super._set(key, value)
    if ((CURVED_PROPS as string[]).includes(key) && this._layout) this.initDimensions()
    return r
  }

  _render(ctx: CanvasRenderingContext2D) {
    const lay = this._layout || (this.initDimensions(), this._layout!)
    ctx.save()
    ctx.font = this.fontString
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.translate(0, lay.cy)
    for (const g of lay.glyphs) {
      ctx.save()
      if (lay.up) {
        ctx.rotate(g.angle)
        ctx.translate(0, -lay.r)
      } else {
        ctx.rotate(-g.angle)
        ctx.translate(0, lay.r)
      }
      if (this.fill) {
        ctx.fillStyle = this.fill as string
        ctx.fillText(g.ch, 0, 0)
      }
      if (this.stroke && this.strokeWidth) {
        ctx.lineWidth = this.strokeWidth
        ctx.strokeStyle = this.stroke as string
        ctx.strokeText(g.ch, 0, 0)
      }
      if (this.underline) {
        ctx.fillStyle = (this.fill as string) || (this.stroke as string)
        ctx.fillRect(-g.w / 2, this.fontSize * 0.08, g.w, Math.max(1, this.fontSize * 0.06))
      }
      ctx.restore()
    }
    ctx.restore()
  }

  toObject(propertiesToInclude: any[] = []) {
    return super.toObject([...CURVED_PROPS, ...propertiesToInclude] as any)
  }

  _toSVG(): string[] {
    const lay = this._layout || (this.initDimensions(), this._layout!)
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const parts: string[] = [`<g transform="translate(0 ${lay.cy})">`]
    for (const g of lay.glyphs) {
      const deg = ((lay.up ? g.angle : -g.angle) * 180) / Math.PI
      const ty = lay.up ? -lay.r : lay.r
      parts.push(
        `<text transform="rotate(${deg.toFixed(3)}) translate(0 ${ty.toFixed(3)})" text-anchor="middle" font-family="${esc(this.fontFamily)}" font-size="${this.fontSize}" font-weight="${this.fontWeight}" font-style="${this.fontStyle}" fill="${this.fill}"${this.stroke && this.strokeWidth ? ` stroke="${this.stroke}" stroke-width="${this.strokeWidth}"` : ''}>${esc(g.ch)}</text>`,
      )
    }
    parts.push('</g>')
    return parts
  }

  static fromObject(object: any) {
    const { shadow, type: _t, ...rest } = object || {}
    const c = new CurvedText(rest)
    if (shadow) c.set('shadow', shadow instanceof Shadow ? shadow : new Shadow(shadow))
    return Promise.resolve(c)
  }
}

classRegistry.setClass(CurvedText)
classRegistry.setSVGClass(CurvedText)

export function isCurvedText(o: any): o is CurvedText {
  return !!o && (o instanceof CurvedText || (typeof o.isType === 'function' && o.isType('CurvedText')))
}
