import {
  ActiveSelection,
  Canvas,
  Circle,
  Color,
  Ellipse,
  FabricImage,
  FabricObject,
  Gradient,
  Group,
  IText,
  Line,
  Path,
  Polygon,
  Rect,
  Shadow,
  Textbox,
  Triangle,
  filters,
  loadSVGFromString,
  util,
} from 'fabric'
import { ensureFont } from './fonts'
import { Duotone, EMBOSS_MATRIX, Vignette, sharpenMatrix } from './imageEffects'
import { CurvedText, isCurvedText } from './curvedText'
import { isVideo } from './video'

/** Propiedades personalizadas que se serializan en el JSON. */
export const CUSTOM_PROPS = [
  'id',
  'name',
  'locked',
  'bambaType',
  'bambaOriginalSrc',
  'frameShape',
  'isFrame',
  'textEffect',
  'chartData',
  'qrData',
  'selectable',
  'evented',
  'lockMovementX',
  'lockMovementY',
  'lockScalingX',
  'lockScalingY',
  'lockRotation',
  'hasControls',
  'hoverCursor',
  'perPixelTargetFind',
  'editable',
]

export const uid = () => Math.random().toString(36).slice(2, 10)

// Ajustes globales de controles (estilo Canva)
FabricObject.ownDefaults.transparentCorners = false
FabricObject.ownDefaults.cornerColor = '#ffffff'
FabricObject.ownDefaults.cornerStrokeColor = '#7c3aed'
FabricObject.ownDefaults.cornerStyle = 'circle'
FabricObject.ownDefaults.cornerSize = 10
FabricObject.ownDefaults.borderColor = '#7c3aed'
FabricObject.ownDefaults.borderScaleFactor = 1.5
FabricObject.ownDefaults.padding = 0
FabricObject.ownDefaults.objectCaching = true

export type AnyObj = FabricObject & Record<string, any>

export const asAny = (o: FabricObject) => o as AnyObj

export function isText(o: FabricObject | null | undefined): o is IText {
  return !!o && (o.isType('textbox') || o.isType('i-text') || o.isType('text'))
}
export function isImage(o: FabricObject | null | undefined): o is FabricImage {
  return !!o && o.isType('image')
}
export function isGroup(o: FabricObject | null | undefined): o is Group {
  return !!o && (o.isType('group'))
}
export function isActiveSelection(o: FabricObject | null | undefined): o is ActiveSelection {
  return !!o && o.isType('activeselection')
}
export function isLocked(o: FabricObject) {
  return !!asAny(o).locked
}
export function isFrame(o: FabricObject) {
  return !!asAny(o).isFrame && !isImage(o)
}
export function isFramedImage(o: FabricObject) {
  return isImage(o) && !!o.clipPath && !!asAny(o).frameShape
}

export function typeLabel(o: FabricObject): string {
  const a = asAny(o)
  if (a.bambaType === 'chart') return 'Gráfico'
  if (a.bambaType === 'qr') return 'Código QR'
  if (a.bambaType === 'icon') return 'Icono'
  if (a.bambaType === 'line') return 'Línea'
  if (a.bambaType === 'arrow') return 'Flecha'
  if (isFrame(o)) return 'Marco'
  if (isFramedImage(o)) return 'Foto en marco'
  if (isCurvedText(o)) return 'Texto curvo'
  if (isVideo(o)) return 'Vídeo'
  if (isText(o)) return 'Texto'
  if (isImage(o)) return 'Imagen'
  if (isGroup(o)) return 'Grupo'
  if (o.isType('rect')) return 'Rectángulo'
  if (o.isType('circle')) return 'Círculo'
  if (o.isType('ellipse')) return 'Elipse'
  if (o.isType('triangle')) return 'Triángulo'
  if (o.isType('polygon')) return 'Polígono'
  if (o.isType('line')) return 'Línea'
  if (o.isType('path')) return 'Trazo'
  return o.type
}

export function getName(o: FabricObject): string {
  const a = asAny(o)
  if (a.name) return a.name
  if (isCurvedText(o) || isText(o)) {
    const t = (o as IText).text || ''
    return t.length > 24 ? t.slice(0, 24) + '…' : t || 'Texto'
  }
  return typeLabel(o)
}

// ----------------------------------------------------------------------------
// Añadir / posicionar
// ----------------------------------------------------------------------------
export function centerObject(obj: FabricObject, W: number, H: number) {
  const br = obj.getBoundingRect()
  obj.set({ left: obj.left + (W / 2 - (br.left + br.width / 2)), top: obj.top + (H / 2 - (br.top + br.height / 2)) })
  obj.setCoords()
}

export function fitInto(obj: FabricObject, maxW: number, maxH: number) {
  const w = obj.width * (obj.scaleX || 1)
  const h = obj.height * (obj.scaleY || 1)
  const s = Math.min(maxW / w, maxH / h, 1)
  if (s < 1) obj.scale((obj.scaleX || 1) * s)
}

export function addObject(canvas: Canvas, obj: FabricObject, W: number, H: number, opts: { center?: boolean; select?: boolean; fit?: boolean } = {}) {
  const { center = true, select = true, fit = false } = opts
  const a = asAny(obj)
  if (!a.id) a.set('id', uid())
  if (fit) fitInto(obj, W * 0.7, H * 0.7)
  if (center) centerObject(obj, W, H)
  canvas.add(obj)
  if (select) canvas.setActiveObject(obj)
  canvas.requestRenderAll()
  return obj
}

// ----------------------------------------------------------------------------
// Texto
// ----------------------------------------------------------------------------
export type TextKind = 'heading' | 'subheading' | 'body'

export function createText(kind: TextKind, W: number, overrides: Record<string, any> = {}) {
  const base: Record<TextKind, Record<string, any>> = {
    heading: { text: 'Añade un título', fontSize: Math.round(W * 0.09), fontWeight: 'bold', fontFamily: 'Poppins' },
    subheading: { text: 'Añade un subtítulo', fontSize: Math.round(W * 0.05), fontWeight: '600', fontFamily: 'Poppins' },
    body: { text: 'Añade un poco de texto', fontSize: Math.round(W * 0.03), fontWeight: 'normal', fontFamily: 'Inter' },
  }
  const cfg = { ...base[kind], ...overrides }
  const tb = new Textbox(cfg.text, {
    width: Math.round(W * 0.7),
    fontSize: cfg.fontSize,
    fontWeight: cfg.fontWeight,
    fontFamily: cfg.fontFamily,
    fill: cfg.fill || '#111827',
    textAlign: cfg.textAlign || 'center',
    lineHeight: 1.16,
    charSpacing: 0,
    editable: true,
    splitByGrapheme: false,
    ...overrides,
  })
  asAny(tb).set({ id: uid(), bambaType: 'text' })
  void ensureFont(cfg.fontFamily)
  return tb
}

// ----------------------------------------------------------------------------
// Formas
// ----------------------------------------------------------------------------
export type ShapeKind =
  | 'rect'
  | 'rounded'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star'
  | 'star4'
  | 'heart'
  | 'arrowRight'
  | 'chevron'
  | 'speech'
  | 'cross'
  | 'ring'
  | 'halfCircle'
  | 'parallelogram'
  | 'trapezoid'
  | 'line'
  | 'lineDashed'
  | 'arrowLine'
  | 'arrowDouble'
  | 'lineDotted'

const regularPolygon = (sides: number, r: number, rotate = -Math.PI / 2) => {
  const pts = []
  for (let i = 0; i < sides; i++) {
    const a = rotate + (i * 2 * Math.PI) / sides
    pts.push({ x: r + r * Math.cos(a), y: r + r * Math.sin(a) })
  }
  return pts
}
const starPoints = (points: number, outer: number, inner: number) => {
  const pts = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / points
    pts.push({ x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) })
  }
  return pts
}

export const SHAPE_NAMES: Record<ShapeKind, string> = {
  rect: 'Cuadrado', rounded: 'Rectángulo redondeado', circle: 'Círculo', ellipse: 'Elipse', triangle: 'Triángulo', diamond: 'Rombo', pentagon: 'Pentágono', hexagon: 'Hexágono', octagon: 'Octógono', star: 'Estrella', star4: 'Destello', heart: 'Corazón', arrowRight: 'Flecha', chevron: 'Chevrón', speech: 'Bocadillo', cross: 'Cruz', ring: 'Anillo', halfCircle: 'Semicírculo', parallelogram: 'Paralelogramo', trapezoid: 'Trapecio', line: 'Línea', lineDashed: 'Línea discontinua', arrowLine: 'Flecha', arrowDouble: 'Flecha doble', lineDotted: 'Línea punteada',
}

export function createShape(kind: ShapeKind, size = 300, color = '#7c3aed'): FabricObject {
  const common = { fill: color, stroke: '', strokeWidth: 0, strokeUniform: true }
  let obj: FabricObject
  switch (kind) {
    case 'rect':
      obj = new Rect({ ...common, width: size, height: size })
      break
    case 'rounded':
      obj = new Rect({ ...common, width: size, height: size, rx: size * 0.15, ry: size * 0.15 })
      break
    case 'circle':
      obj = new Circle({ ...common, radius: size / 2 })
      break
    case 'ellipse':
      obj = new Ellipse({ ...common, rx: size / 2, ry: size / 3 })
      break
    case 'triangle':
      obj = new Triangle({ ...common, width: size, height: size })
      break
    case 'diamond':
      obj = new Polygon(regularPolygon(4, size / 2), common)
      break
    case 'pentagon':
      obj = new Polygon(regularPolygon(5, size / 2), common)
      break
    case 'hexagon':
      obj = new Polygon(regularPolygon(6, size / 2, 0), common)
      break
    case 'octagon':
      obj = new Polygon(regularPolygon(8, size / 2, Math.PI / 8), common)
      break
    case 'star':
      obj = new Polygon(starPoints(5, size / 2, size / 5), common)
      break
    case 'star4':
      obj = new Polygon(starPoints(4, size / 2, size / 6), common)
      break
    case 'heart':
      obj = new Path('M50 88 L14 52 C0 38 4 14 26 12 C38 11 46 18 50 26 C54 18 62 11 74 12 C96 14 100 38 86 52 Z', common)
      obj.scaleToWidth(size)
      break
    case 'arrowRight':
      obj = new Polygon(
        [
          { x: 0, y: 30 },
          { x: 60, y: 30 },
          { x: 60, y: 0 },
          { x: 100, y: 50 },
          { x: 60, y: 100 },
          { x: 60, y: 70 },
          { x: 0, y: 70 },
        ],
        common,
      )
      obj.scaleToWidth(size)
      break
    case 'chevron':
      obj = new Polygon(
        [
          { x: 0, y: 0 },
          { x: 70, y: 0 },
          { x: 100, y: 50 },
          { x: 70, y: 100 },
          { x: 0, y: 100 },
          { x: 30, y: 50 },
        ],
        common,
      )
      obj.scaleToWidth(size)
      break
    case 'speech':
      obj = new Path('M10 0 H90 A10 10 0 0 1 100 10 V60 A10 10 0 0 1 90 70 H40 L20 90 V70 H10 A10 10 0 0 1 0 60 V10 A10 10 0 0 1 10 0 Z', common)
      obj.scaleToWidth(size)
      break
    case 'cross':
      obj = new Polygon(
        [
          { x: 33, y: 0 },
          { x: 67, y: 0 },
          { x: 67, y: 33 },
          { x: 100, y: 33 },
          { x: 100, y: 67 },
          { x: 67, y: 67 },
          { x: 67, y: 100 },
          { x: 33, y: 100 },
          { x: 33, y: 67 },
          { x: 0, y: 67 },
          { x: 0, y: 33 },
          { x: 33, y: 33 },
        ],
        common,
      )
      obj.scaleToWidth(size)
      break
    case 'ring':
      obj = new Circle({ radius: size / 2, fill: 'transparent', stroke: color, strokeWidth: size * 0.14, strokeUniform: false })
      break
    case 'halfCircle':
      obj = new Path('M0 50 A50 50 0 0 1 100 50 Z', common)
      obj.scaleToWidth(size)
      break
    case 'parallelogram':
      obj = new Polygon(
        [
          { x: 25, y: 0 },
          { x: 100, y: 0 },
          { x: 75, y: 100 },
          { x: 0, y: 100 },
        ],
        common,
      )
      obj.scaleToWidth(size)
      break
    case 'trapezoid':
      obj = new Polygon(
        [
          { x: 20, y: 0 },
          { x: 80, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        common,
      )
      obj.scaleToWidth(size)
      break
    case 'line':
    case 'lineDashed':
    case 'lineDotted': {
      const l = new Line([0, 0, size, 0], {
        stroke: '#111827',
        strokeWidth: 6,
        strokeUniform: true,
        strokeLineCap: 'round',
        strokeDashArray: kind === 'lineDashed' ? [18, 14] : kind === 'lineDotted' ? [1, 14] : undefined,
        padding: 8,
      })
      asAny(l).set('bambaType', 'line')
      l.setControlsVisibility({ mt: false, mb: false, tl: false, tr: false, bl: false, br: false })
      obj = l
      break
    }
    case 'arrowLine':
    case 'arrowDouble': {
      const w = size
      const head = 22
      const th = 6
      const parts: FabricObject[] = []
      const line = new Line([kind === 'arrowDouble' ? head : 0, 0, w - head, 0], { stroke: '#111827', strokeWidth: th, strokeLineCap: 'round' })
      parts.push(line)
      const tri = new Triangle({ width: head * 1.4, height: head, fill: '#111827', angle: 90, left: w, top: -head * 0.7 })
      parts.push(tri)
      if (kind === 'arrowDouble') {
        const tri2 = new Triangle({ width: head * 1.4, height: head, fill: '#111827', angle: -90, left: 0, top: head * 0.7 })
        parts.push(tri2)
      }
      const g = new Group(parts, { padding: 8 })
      asAny(g).set('bambaType', 'arrow')
      g.setControlsVisibility({ mt: false, mb: false })
      obj = g
      break
    }
    default:
      obj = new Rect({ ...common, width: size, height: size })
  }
  asAny(obj).set({ id: uid(), name: SHAPE_NAMES[kind] })
  return obj
}

// ----------------------------------------------------------------------------
// Imágenes
// ----------------------------------------------------------------------------
export async function createImage(url: string, opts: Record<string, any> = {}): Promise<FabricImage> {
  const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' }, { ...opts })
  asAny(img).set({ id: uid(), bambaType: 'image' })
  return img
}

/** Sustituye la imagen conservando el tamaño visual. */
export async function replaceImageSrc(img: FabricImage, url: string) {
  const w0 = img.getScaledWidth()
  const h0 = img.getScaledHeight()
  const hadCrop = { cropX: img.cropX, cropY: img.cropY, width: img.width, height: img.height }
  await img.setSrc(url, { crossOrigin: 'anonymous' })
  // Reajustamos crop si las dimensiones coinciden con el original; si no, quitamos crop
  const { width: nw, height: nh } = img.getOriginalSize()
  if (hadCrop.cropX || hadCrop.cropY || hadCrop.width !== nw || hadCrop.height !== nh) {
    if (hadCrop.cropX + hadCrop.width <= nw && hadCrop.cropY + hadCrop.height <= nh) {
      img.set({ cropX: hadCrop.cropX, cropY: hadCrop.cropY, width: hadCrop.width, height: hadCrop.height })
    }
  }
  img.set({ scaleX: w0 / img.width, scaleY: h0 / img.height })
  img.setCoords()
}

export interface FilterValues {
  brightness: number // -1..1
  contrast: number // -1..1
  saturation: number // -1..1
  vibrance: number // -1..1
  hue: number // -1..1
  blur: number // 0..1
  noise: number // 0..1000
  pixelate: number // 0..50
  grayscale: boolean
  sepia: boolean
  invert: boolean
  blackwhite: boolean
  vintage: boolean
  kodachrome: boolean
  technicolor: boolean
  polaroid: boolean
  duotone: { dark: string; light: string } | null
  vignette: number // 0..1
  vignetteSize: number // 0..1
  sharpen: number // 0..1
  emboss: boolean
  tint: string | null
  tintAmount: number // 0..1
}

export const DEFAULT_FILTERS: FilterValues = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  hue: 0,
  blur: 0,
  noise: 0,
  pixelate: 0,
  grayscale: false,
  sepia: false,
  invert: false,
  blackwhite: false,
  vintage: false,
  kodachrome: false,
  technicolor: false,
  polaroid: false,
  duotone: null,
  vignette: 0,
  vignetteSize: 0.5,
  sharpen: 0,
  emboss: false,
  tint: null,
  tintAmount: 0.5,
}

export function getImageFilters(img: FabricImage): FilterValues {
  const v = { ...DEFAULT_FILTERS }
  for (const f of img.filters || []) {
    if (f instanceof filters.Brightness) v.brightness = f.brightness
    else if (f instanceof filters.Contrast) v.contrast = f.contrast
    else if (f instanceof filters.Saturation) v.saturation = f.saturation
    else if (f instanceof filters.Vibrance) v.vibrance = f.vibrance
    else if (f instanceof filters.HueRotation) v.hue = f.rotation
    else if (f instanceof filters.Blur) v.blur = f.blur
    else if (f instanceof filters.Noise) v.noise = f.noise
    else if (f instanceof filters.Pixelate) v.pixelate = f.blocksize
    else if (f instanceof filters.Grayscale) v.grayscale = true
    else if (f instanceof filters.Sepia) v.sepia = true
    else if (f instanceof filters.Invert) v.invert = true
    else if (f instanceof filters.BlackWhite) v.blackwhite = true
    else if (f instanceof filters.Vintage) v.vintage = true
    else if (f instanceof filters.Kodachrome) v.kodachrome = true
    else if (f instanceof filters.Technicolor) v.technicolor = true
    else if (f instanceof filters.Polaroid) v.polaroid = true
    else if (f instanceof Duotone) v.duotone = { dark: f.dark, light: f.light }
    else if (f instanceof Vignette) {
      v.vignette = f.amount
      v.vignetteSize = f.size
    } else if (f instanceof filters.Convolute) {
      const m = f.matrix || []
      if (m.length === 9 && m[4] === 0.7) v.emboss = true
      else if (m.length === 9 && m[1] < 0) v.sharpen = -m[1]
    } else if (f instanceof filters.BlendColor && f.mode === 'tint') {
      v.tint = f.color
      v.tintAmount = f.alpha
    }
  }
  return v
}

export function setImageFilters(img: FabricImage, v: Partial<FilterValues>) {
  const cur = { ...getImageFilters(img), ...v }
  const list: any[] = []
  if (cur.brightness) list.push(new filters.Brightness({ brightness: cur.brightness }))
  if (cur.contrast) list.push(new filters.Contrast({ contrast: cur.contrast }))
  if (cur.saturation) list.push(new filters.Saturation({ saturation: cur.saturation }))
  if (cur.vibrance) list.push(new filters.Vibrance({ vibrance: cur.vibrance }))
  if (cur.hue) list.push(new filters.HueRotation({ rotation: cur.hue }))
  if (cur.blur) list.push(new filters.Blur({ blur: cur.blur }))
  if (cur.noise) list.push(new filters.Noise({ noise: cur.noise }))
  if (cur.pixelate) list.push(new filters.Pixelate({ blocksize: cur.pixelate }))
  if (cur.grayscale) list.push(new filters.Grayscale())
  if (cur.sepia) list.push(new filters.Sepia())
  if (cur.invert) list.push(new filters.Invert())
  if (cur.blackwhite) list.push(new filters.BlackWhite())
  if (cur.vintage) list.push(new filters.Vintage())
  if (cur.kodachrome) list.push(new filters.Kodachrome())
  if (cur.technicolor) list.push(new filters.Technicolor())
  if (cur.polaroid) list.push(new filters.Polaroid())
  if (cur.tint) list.push(new filters.BlendColor({ color: cur.tint, mode: 'tint', alpha: cur.tintAmount }))
  if (cur.duotone) list.push(new Duotone({ dark: cur.duotone.dark, light: cur.duotone.light }))
  if (cur.sharpen) list.push(new filters.Convolute({ matrix: sharpenMatrix(cur.sharpen) }))
  if (cur.emboss) list.push(new filters.Convolute({ matrix: EMBOSS_MATRIX }))
  if (cur.vignette) list.push(new Vignette({ amount: cur.vignette, size: cur.vignetteSize }))
  img.filters = list
  img.applyFilters()
}

// ----------------------------------------------------------------------------
// Efectos de objeto para imágenes: sombra/brillo, esquinas redondeadas, borde
// ----------------------------------------------------------------------------
export type ImageShadowKind = 'none' | 'drop' | 'glow' | 'outline'

export function getImageShadow(img: FabricImage): { kind: ImageShadowKind; color: string; blur: number; offset: number } {
  const sh = img.shadow as Shadow | null
  if (!sh) return { kind: 'none', color: '#000000', blur: 20, offset: 12 }
  const kind: ImageShadowKind = (asAny(img).imageShadowKind as ImageShadowKind) || (sh.offsetX || sh.offsetY ? 'drop' : 'glow')
  return { kind, color: sh.color || '#000000', blur: sh.blur || 0, offset: Math.max(Math.abs(sh.offsetX || 0), Math.abs(sh.offsetY || 0)) }
}

export function setImageShadow(img: FabricImage, kind: ImageShadowKind, opts: { color?: string; blur?: number; offset?: number } = {}) {
  const cur = getImageShadow(img)
  const color = opts.color ?? cur.color
  const blur = opts.blur ?? cur.blur
  const offset = opts.offset ?? cur.offset
  if (kind === 'none') img.set('shadow', null)
  else if (kind === 'drop') img.set('shadow', new Shadow({ color: toRgba(color, 0.55), blur, offsetX: offset, offsetY: offset, nonScaling: false }))
  else if (kind === 'glow') img.set('shadow', new Shadow({ color: toRgba(color, 0.9), blur: Math.max(blur, 8), offsetX: 0, offsetY: 0 }))
  else if (kind === 'outline') img.set('shadow', new Shadow({ color: color, blur: 2, offsetX: 0, offsetY: 0 }))
  asAny(img).set('imageShadowKind', kind)
  img.set('dirty', true)
}

function toRgba(hex: string, a: number) {
  const c = new Color(hex).getSource()
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

export function getImageCornerRadius(img: FabricImage): number {
  const cp = img.clipPath as any
  if (!cp || !asAny(img).roundedCorners) return 0
  return cp.rx || 0
}

export function setImageCornerRadius(img: FabricImage, radius: number) {
  if (isFramedImage(img)) return
  if (radius <= 0) {
    img.clipPath = undefined
    asAny(img).set('roundedCorners', 0)
  } else {
    const r = new Rect({ width: img.width, height: img.height, rx: radius, ry: radius, originX: 'center', originY: 'center', left: 0, top: 0, absolutePositioned: false })
    img.clipPath = r
    asAny(img).set('roundedCorners', radius)
  }
  img.set('dirty', true)
}

export function setImageBorder(img: FabricImage, color: string | null, width: number) {
  img.set({ stroke: color || '', strokeWidth: color ? width : 0, strokeUniform: true })
  img.set('dirty', true)
}
CUSTOM_PROPS.push('imageShadowKind', 'roundedCorners')

/** Obtiene un Blob con la imagen original (sin filtros) para enviarla al backend. */
export async function imageToBlob(img: FabricImage): Promise<Blob> {
  const src = img.getSrc()
  if (src && (src.startsWith('data:') || src.startsWith('/') || src.startsWith(window.location.origin))) {
    const r = await fetch(src)
    if (r.ok) return r.blob()
  }
  const el = ((img as any)._originalElement || img.getElement()) as HTMLImageElement | HTMLCanvasElement
  const c = document.createElement('canvas')
  const w = (el as HTMLImageElement).naturalWidth || el.width
  const h = (el as HTMLImageElement).naturalHeight || el.height
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(el, 0, 0)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo leer la imagen'))), 'image/png'))
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(blob)
  })
}

// ----------------------------------------------------------------------------
// SVG
// ----------------------------------------------------------------------------
export async function createFromSvgString(svg: string): Promise<FabricObject> {
  const { objects, options } = await loadSVGFromString(svg)
  const objs = objects.filter(Boolean) as FabricObject[]
  const obj = util.groupSVGElements(objs, options)
  asAny(obj).set({ id: uid() })
  return obj
}

// ----------------------------------------------------------------------------
// Marcos (frames)
// ----------------------------------------------------------------------------
export type FrameKind = 'square' | 'rounded' | 'circle' | 'heart' | 'star' | 'hexagon' | 'triangle' | 'diamond' | 'arch' | 'blob' | 'portrait' | 'landscape' | 'pill'

export function createFrame(kind: FrameKind, size = 320): FabricObject {
  const style = { fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 2, strokeDashArray: [10, 8], strokeUniform: true }
  let obj: FabricObject
  switch (kind) {
    case 'circle':
      obj = new Circle({ ...style, radius: size / 2 })
      break
    case 'rounded':
      obj = new Rect({ ...style, width: size, height: size, rx: size * 0.12, ry: size * 0.12 })
      break
    case 'pill':
      obj = new Rect({ ...style, width: size * 1.6, height: size * 0.7, rx: size * 0.35, ry: size * 0.35 })
      break
    case 'portrait':
      obj = new Rect({ ...style, width: size * 0.75, height: size })
      break
    case 'landscape':
      obj = new Rect({ ...style, width: size * 1.5, height: size })
      break
    case 'heart':
      obj = new Path('M50 88 L14 52 C0 38 4 14 26 12 C38 11 46 18 50 26 C54 18 62 11 74 12 C96 14 100 38 86 52 Z', style)
      obj.scaleToWidth(size)
      break
    case 'star':
      obj = new Polygon(starPoints(5, size / 2, size / 4.5), style)
      break
    case 'hexagon':
      obj = new Polygon(regularPolygon(6, size / 2, 0), style)
      break
    case 'triangle':
      obj = new Triangle({ ...style, width: size, height: size })
      break
    case 'diamond':
      obj = new Polygon(regularPolygon(4, size / 2), style)
      break
    case 'arch':
      obj = new Path('M0 50 A50 50 0 0 1 100 50 V140 H0 Z', style)
      obj.scaleToWidth(size)
      break
    case 'blob':
      obj = new Path('M43.9 -55.5C58.6 -47.6 73.2 -36.4 78.5 -21.6C83.8 -6.8 79.7 11.7 71.1 26.7C62.6 41.7 49.5 53.3 34.7 60.6C19.9 67.9 3.3 71 -13.6 68.9C-30.6 66.8 -47.9 59.4 -59.4 46.6C-70.9 33.7 -76.6 15.4 -75.5 -2.2C-74.4 -19.9 -66.6 -36.9 -54.2 -45.4C-41.8 -53.9 -24.9 -53.9 -9.4 -55.7C6.1 -57.5 29.2 -63.4 43.9 -55.5Z', style)
      obj.scaleToWidth(size)
      break
    default:
      obj = new Rect({ ...style, width: size, height: size })
  }
  asAny(obj).set({ id: uid(), isFrame: true, frameShape: kind, bambaType: 'frame' })
  return obj
}

/** Rellena un marco (placeholder o foto ya enmarcada) con una imagen. */
export async function fillFrame(canvas: Canvas, frame: FabricObject, url: string): Promise<FabricImage> {
  const target = frame
  // tamaño del marco sin contar su borde punteado (el clip no tiene borde)
  const fw = target.width * (target.scaleX || 1)
  const fh = target.height * (target.scaleY || 1)
  const center = target.getCenterPoint()
  const angle = target.angle || 0
  const idx = canvas.getObjects().indexOf(target)

  const img = await createImage(url)

  let shape: FabricObject
  let scale = Math.max(fw / img.width, fh / img.height)
  if (isImage(target) && target.clipPath) {
    // reemplazar foto en marco existente: el área visible es la del clipPath (en escena)
    const old = target.clipPath as FabricObject
    const tsx = target.scaleX || 1
    const tsy = target.scaleY || 1
    const visW = old.getScaledWidth() * tsx
    const visH = old.getScaledHeight() * tsy
    scale = Math.max(visW / img.width, visH / img.height)
    shape = await old.clone()
    shape.set({ scaleX: ((old.scaleX || 1) * tsx) / scale, scaleY: ((old.scaleY || 1) * tsy) / scale })
  } else {
    shape = await target.clone()
    shape.set({
      strokeWidth: 0,
      stroke: '',
      strokeDashArray: undefined,
      scaleX: (target.scaleX || 1) / scale,
      scaleY: (target.scaleY || 1) / scale,
      angle: 0,
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
    })
  }
  shape.set({ absolutePositioned: false, left: 0, top: 0, originX: 'center', originY: 'center', angle: 0 })

  img.set({
    scaleX: scale,
    scaleY: scale,
    originX: 'center',
    originY: 'center',
    left: center.x,
    top: center.y,
    angle,
    clipPath: shape,
  })
  asAny(img).set({ id: uid(), frameShape: asAny(target).frameShape || 'custom', bambaType: 'framedImage', isFrame: false })
  canvas.remove(target)
  canvas.insertAt(Math.max(0, idx), img)
  img.setCoords()
  canvas.setActiveObject(img)
  canvas.requestRenderAll()
  return img
}

// ----------------------------------------------------------------------------
// Selección / disposición
// ----------------------------------------------------------------------------
export function getSelectionObjects(canvas: Canvas): FabricObject[] {
  return canvas.getActiveObjects()
}

/** Ejecuta fn con la selección "desagrupada" (coords absolutas) y la restaura. */
export function withFlatSelection(canvas: Canvas, fn: (objs: FabricObject[]) => void) {
  const active = canvas.getActiveObject()
  const objs = canvas.getActiveObjects()
  if (!objs.length) return
  const multi = isActiveSelection(active)
  if (multi) canvas.discardActiveObject()
  fn(objs)
  objs.forEach((o) => o.setCoords())
  if (multi) {
    const sel = new ActiveSelection(objs, { canvas })
    canvas.setActiveObject(sel)
  } else if (active) {
    canvas.setActiveObject(active)
  }
  canvas.requestRenderAll()
}

export function fireModified(canvas: Canvas, target?: FabricObject) {
  const t = target || canvas.getActiveObject()
  canvas.fire('object:modified', { target: t } as any)
}

export function setSelectionProps(canvas: Canvas, props: Record<string, any>) {
  const objs = canvas.getActiveObjects()
  objs.forEach((o) => {
    o.set(props)
    if (isText(o) && (props.fontFamily || props.fontSize !== undefined || props.fontWeight || props.fontStyle)) {
      ;(o as any).initDimensions?.()
    }
    o.setCoords()
  })
  canvas.requestRenderAll()
  fireModified(canvas)
}

export type AlignWhere = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom'

export function alignSelection(canvas: Canvas, where: AlignWhere, W: number, H: number) {
  const objs = canvas.getActiveObjects()
  if (!objs.length) return
  const multi = objs.length > 1
  withFlatSelection(canvas, (list) => {
    // límites de referencia
    let refL = 0,
      refT = 0,
      refR = W,
      refB = H
    if (multi) {
      refL = Math.min(...list.map((o) => o.getBoundingRect().left))
      refT = Math.min(...list.map((o) => o.getBoundingRect().top))
      refR = Math.max(...list.map((o) => o.getBoundingRect().left + o.getBoundingRect().width))
      refB = Math.max(...list.map((o) => o.getBoundingRect().top + o.getBoundingRect().height))
    }
    list.forEach((o) => {
      const br = o.getBoundingRect()
      let dx = 0,
        dy = 0
      switch (where) {
        case 'left':
          dx = refL - br.left
          break
        case 'centerH':
          dx = (refL + refR) / 2 - (br.left + br.width / 2)
          break
        case 'right':
          dx = refR - (br.left + br.width)
          break
        case 'top':
          dy = refT - br.top
          break
        case 'centerV':
          dy = (refT + refB) / 2 - (br.top + br.height / 2)
          break
        case 'bottom':
          dy = refB - (br.top + br.height)
          break
      }
      o.set({ left: o.left + dx, top: o.top + dy })
    })
  })
  fireModified(canvas)
}

export function distributeSelection(canvas: Canvas, axis: 'h' | 'v') {
  const objs = canvas.getActiveObjects()
  if (objs.length < 3) return
  withFlatSelection(canvas, (list) => {
    const items = list.map((o) => ({ o, br: o.getBoundingRect() }))
    if (axis === 'h') {
      items.sort((a, b) => a.br.left - b.br.left)
      const first = items[0]
      const last = items[items.length - 1]
      const totalW = items.reduce((s, i) => s + i.br.width, 0)
      const span = last.br.left + last.br.width - first.br.left
      const gap = (span - totalW) / (items.length - 1)
      let x = first.br.left
      items.forEach((it) => {
        it.o.set({ left: it.o.left + (x - it.br.left) })
        x += it.br.width + gap
      })
    } else {
      items.sort((a, b) => a.br.top - b.br.top)
      const first = items[0]
      const last = items[items.length - 1]
      const totalH = items.reduce((s, i) => s + i.br.height, 0)
      const span = last.br.top + last.br.height - first.br.top
      const gap = (span - totalH) / (items.length - 1)
      let y = first.br.top
      items.forEach((it) => {
        it.o.set({ top: it.o.top + (y - it.br.top) })
        y += it.br.height + gap
      })
    }
  })
  fireModified(canvas)
}

export function flipSelection(canvas: Canvas, axis: 'x' | 'y') {
  canvas.getActiveObjects().forEach((o) => {
    if (axis === 'x') o.set('flipX', !o.flipX)
    else o.set('flipY', !o.flipY)
  })
  canvas.requestRenderAll()
  fireModified(canvas)
}

export function bringForward(canvas: Canvas) {
  canvas
    .getActiveObjects()
    .slice()
    .reverse()
    .forEach((o) => canvas.bringObjectForward(o))
  canvas.requestRenderAll()
  fireModified(canvas)
}
export function sendBackward(canvas: Canvas) {
  canvas.getActiveObjects().forEach((o) => canvas.sendObjectBackwards(o))
  canvas.requestRenderAll()
  fireModified(canvas)
}
export function bringToFront(canvas: Canvas) {
  canvas.getActiveObjects().forEach((o) => canvas.bringObjectToFront(o))
  canvas.requestRenderAll()
  fireModified(canvas)
}
export function sendToBack(canvas: Canvas) {
  canvas
    .getActiveObjects()
    .slice()
    .reverse()
    .forEach((o) => canvas.sendObjectToBack(o))
  canvas.requestRenderAll()
  fireModified(canvas)
}

export function setLocked(o: FabricObject, locked: boolean) {
  o.set({
    locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
    hasControls: !locked,
    hoverCursor: locked ? 'not-allowed' : 'move',
    editable: !locked,
  } as any)
}

export function toggleLock(canvas: Canvas) {
  const objs = canvas.getActiveObjects()
  if (!objs.length) return
  const lock = !objs.every(isLocked)
  objs.forEach((o) => setLocked(o, lock))
  canvas.requestRenderAll()
  fireModified(canvas)
}

export function deleteSelection(canvas: Canvas) {
  const objs = canvas.getActiveObjects().filter((o) => !isLocked(o))
  if (!objs.length) return
  canvas.discardActiveObject()
  canvas.remove(...objs)
  canvas.requestRenderAll()
}

let clipboard: FabricObject | null = null

export async function copySelection(canvas: Canvas) {
  const active = canvas.getActiveObject()
  if (!active) return
  clipboard = await active.clone(CUSTOM_PROPS as any)
}

export async function pasteClipboard(canvas: Canvas, offset = 20) {
  if (!clipboard) return
  const cloned = await clipboard.clone(CUSTOM_PROPS as any)
  canvas.discardActiveObject()
  cloned.set({ left: cloned.left + offset, top: cloned.top + offset, evented: true })
  if (isActiveSelection(cloned)) {
    cloned.canvas = canvas
    cloned.forEachObject((o) => {
      asAny(o).set('id', uid())
      canvas.add(o)
    })
    cloned.setCoords()
  } else {
    asAny(cloned).set('id', uid())
    canvas.add(cloned)
  }
  clipboard.set({ left: clipboard.left + offset, top: clipboard.top + offset })
  canvas.setActiveObject(cloned)
  canvas.requestRenderAll()
}

export async function duplicateSelection(canvas: Canvas) {
  const active = canvas.getActiveObject()
  if (!active) return
  const cloned = await active.clone(CUSTOM_PROPS as any)
  canvas.discardActiveObject()
  cloned.set({ left: cloned.left + 24, top: cloned.top + 24, evented: true })
  if (isActiveSelection(cloned)) {
    cloned.canvas = canvas
    cloned.forEachObject((o) => {
      asAny(o).set('id', uid())
      canvas.add(o)
    })
    cloned.setCoords()
  } else {
    asAny(cloned).set('id', uid())
    canvas.add(cloned)
  }
  canvas.setActiveObject(cloned)
  canvas.requestRenderAll()
}

export function groupSelection(canvas: Canvas) {
  const active = canvas.getActiveObject()
  if (!isActiveSelection(active)) return
  const objs = active.getObjects()
  const all = canvas.getObjects()
  const topIdx = Math.max(...objs.map((o) => all.indexOf(o)))
  canvas.discardActiveObject()
  canvas.remove(...objs)
  const group = new Group(objs)
  asAny(group).set({ id: uid(), name: 'Grupo' })
  canvas.insertAt(Math.max(0, Math.min(topIdx - objs.length + 1, canvas.getObjects().length)), group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
}

export function ungroupSelection(canvas: Canvas) {
  const active = canvas.getActiveObject()
  if (!active || !isGroup(active) || isActiveSelection(active)) return
  const group = active as Group
  const idx = canvas.getObjects().indexOf(group)
  const objs = group.removeAll()
  canvas.remove(group)
  canvas.insertAt(Math.max(0, idx), ...objs)
  const sel = new ActiveSelection(objs, { canvas })
  canvas.setActiveObject(sel)
  canvas.requestRenderAll()
}

export function selectAll(canvas: Canvas) {
  const objs = canvas.getObjects().filter((o) => o.selectable !== false)
  if (!objs.length) return
  canvas.discardActiveObject()
  const sel = new ActiveSelection(objs, { canvas })
  canvas.setActiveObject(sel)
  canvas.requestRenderAll()
}

// ----------------------------------------------------------------------------
// Fondo
// ----------------------------------------------------------------------------
export interface GradientSpec {
  type: 'linear' | 'radial'
  angle?: number // grados, linear
  stops: { offset: number; color: string }[]
}

export function makeGradient(spec: GradientSpec, w: number, h: number): Gradient<'linear' | 'radial'> {
  if (spec.type === 'radial') {
    return new Gradient({
      type: 'radial',
      coords: { x1: w / 2, y1: h / 2, r1: 0, x2: w / 2, y2: h / 2, r2: Math.max(w, h) / 1.4 },
      colorStops: spec.stops,
    })
  }
  const a = ((spec.angle ?? 90) * Math.PI) / 180
  const cx = w / 2,
    cy = h / 2
  const len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))
  const dx = (Math.cos(a) * len) / 2,
    dy = (Math.sin(a) * len) / 2
  return new Gradient({
    type: 'linear',
    coords: { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy },
    colorStops: spec.stops,
  })
}

export function setCanvasBackground(canvas: Canvas, fill: string | GradientSpec | null, W: number, H: number) {
  if (!fill) {
    canvas.backgroundColor = ''
  } else if (typeof fill === 'string') {
    canvas.backgroundColor = fill
  } else {
    canvas.backgroundColor = makeGradient(fill, W, H) as any
  }
  canvas.requestRenderAll()
  fireModified(canvas)
}

// ----------------------------------------------------------------------------
// Efectos de texto
// ----------------------------------------------------------------------------
export type TextEffect = 'none' | 'shadow' | 'lift' | 'hollow' | 'splice' | 'outline' | 'echo' | 'neon' | 'background'

export const TEXT_EFFECTS: { id: TextEffect; label: string }[] = [
  { id: 'none', label: 'Ninguno' },
  { id: 'shadow', label: 'Sombra' },
  { id: 'lift', label: 'Elevar' },
  { id: 'hollow', label: 'Hueco' },
  { id: 'splice', label: 'Empalme' },
  { id: 'outline', label: 'Contorno' },
  { id: 'echo', label: 'Eco' },
  { id: 'neon', label: 'Neón' },
  { id: 'background', label: 'Fondo' },
]

function darken(hex: string, amt = 0.35) {
  const c = hex.replace('#', '')
  if (c.length !== 6) return '#000000'
  const n = parseInt(c, 16)
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)))
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)))
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function applyTextEffect(o: IText, effect: TextEffect, opts: { color?: string; intensity?: number } = {}) {
  const a = asAny(o)
  const baseColor = (a.textBaseFill as string) || (typeof o.fill === 'string' ? o.fill : '#111827')
  if (!a.textBaseFill) a.set('textBaseFill', baseColor)
  const fs = o.fontSize || 40
  const intensity = opts.intensity ?? 50
  const k = intensity / 50 // 0..2
  const accent = opts.color || darken(baseColor, 0.4)
  const reset = { shadow: null as any, stroke: '', strokeWidth: 0, paintFirst: 'fill' as const, textBackgroundColor: '', fill: baseColor }
  switch (effect) {
    case 'none':
      o.set(reset)
      break
    case 'shadow':
      o.set({ ...reset, shadow: new Shadow({ color: 'rgba(0,0,0,0.45)', blur: fs * 0.05 * k, offsetX: fs * 0.05 * k, offsetY: fs * 0.05 * k }) })
      break
    case 'lift':
      o.set({ ...reset, shadow: new Shadow({ color: 'rgba(0,0,0,0.35)', blur: fs * 0.25 * k, offsetX: 0, offsetY: fs * 0.06 * k }) })
      break
    case 'hollow':
      o.set({ ...reset, fill: 'transparent', stroke: baseColor, strokeWidth: Math.max(1, fs * 0.03 * k) })
      break
    case 'splice':
      o.set({
        ...reset,
        stroke: baseColor,
        strokeWidth: Math.max(1, fs * 0.03 * k),
        fill: 'transparent',
        shadow: new Shadow({ color: accent, blur: 0, offsetX: fs * 0.06 * k, offsetY: fs * 0.06 * k }),
      })
      break
    case 'outline':
      o.set({ ...reset, stroke: accent, strokeWidth: Math.max(1, fs * 0.05 * k), paintFirst: 'stroke' })
      break
    case 'echo':
      o.set({ ...reset, shadow: new Shadow({ color: accent, blur: 0, offsetX: fs * 0.08 * k, offsetY: fs * 0.08 * k }) })
      break
    case 'neon':
      o.set({ ...reset, shadow: new Shadow({ color: baseColor, blur: fs * 0.4 * k, offsetX: 0, offsetY: 0 }) })
      break
    case 'background':
      o.set({ ...reset, textBackgroundColor: opts.color || '#fde047' })
      break
  }
  a.set('textEffect', effect)
  a.set('textEffectColor', opts.color || '')
  a.set('textEffectIntensity', intensity)
  o.dirty = true
}

CUSTOM_PROPS.push('textBaseFill', 'textEffectColor', 'textEffectIntensity')

// ----------------------------------------------------------------------------
// Colores del documento
// ----------------------------------------------------------------------------
export function collectDocumentColors(canvas: Canvas): string[] {
  const set = new Set<string>()
  const add = (c: any) => {
    if (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) set.add(c.toLowerCase())
  }
  add(canvas.backgroundColor)
  const walk = (o: FabricObject) => {
    add(o.fill)
    add(o.stroke)
    if (isGroup(o)) o.getObjects().forEach(walk)
  }
  canvas.getObjects().forEach(walk)
  return Array.from(set).slice(0, 24)
}

// ----------------------------------------------------------------------------
// Copiar / pegar estilo
// ----------------------------------------------------------------------------
let styleClipboard: Record<string, any> | null = null

const STYLE_PROPS_COMMON = ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'opacity', 'shadow', 'rx', 'ry']
const STYLE_PROPS_TEXT = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'textAlign', 'charSpacing', 'lineHeight', 'textBackgroundColor', 'paintFirst', 'textEffect', 'textBaseFill', 'textEffectColor', 'textEffectIntensity']

export function copyStyle(o: FabricObject) {
  const a = asAny(o)
  const out: Record<string, any> = { _isText: isText(o) }
  for (const k of [...STYLE_PROPS_COMMON, ...STYLE_PROPS_TEXT]) {
    if (a[k] !== undefined) out[k] = a[k] instanceof Shadow ? { ...(a[k] as any).toObject() } : a[k]
  }
  styleClipboard = out
}

export function hasStyleClipboard() {
  return !!styleClipboard
}

export function pasteStyle(canvas: Canvas) {
  if (!styleClipboard) return
  const src = styleClipboard
  canvas.getActiveObjects().forEach((o) => {
    if (isImage(o) || isGroup(o)) {
      if (src.opacity !== undefined) o.set('opacity', src.opacity)
      if (src.shadow !== undefined) o.set('shadow', src.shadow ? new Shadow(src.shadow) : null)
      return
    }
    const props: Record<string, any> = {}
    for (const k of STYLE_PROPS_COMMON) if (src[k] !== undefined) props[k] = k === 'shadow' ? (src[k] ? new Shadow(src[k]) : null) : src[k]
    if (isText(o) && src._isText) for (const k of STYLE_PROPS_TEXT) if (src[k] !== undefined) props[k] = src[k]
    if (!isText(o)) {
      // no pegar el relleno "transparent" de textos huecos a formas
      if (props.fill === 'transparent' && src._isText) delete props.fill
    }
    o.set(props)
    if (isText(o)) (o as any).initDimensions?.()
    o.set('dirty', true)
  })
  canvas.requestRenderAll()
  fireModified(canvas)
}

export function setVisibility(canvas: Canvas, objs: FabricObject[], visible: boolean) {
  objs.forEach((o) => o.set('visible', visible))
  if (!visible) canvas.discardActiveObject()
  canvas.requestRenderAll()
  fireModified(canvas)
}

export function showAllHidden(canvas: Canvas) {
  const hidden = canvas.getObjects().filter((o) => o.visible === false)
  if (!hidden.length) return 0
  hidden.forEach((o) => o.set('visible', true))
  canvas.requestRenderAll()
  fireModified(canvas)
  return hidden.length
}

/** Convierte una imagen en fondo de página: cubre la página, va al fondo y se bloquea. */
export function setAsBackground(canvas: Canvas, img: FabricObject, W: number, H: number) {
  const w = img.width * (img.scaleX || 1)
  const h = img.height * (img.scaleY || 1)
  const s = Math.max(W / w, H / h)
  img.set({ angle: 0, scaleX: (img.scaleX || 1) * s, scaleY: (img.scaleY || 1) * s })
  img.setCoords()
  centerObject(img, W, H)
  canvas.sendObjectToBack(img)
  setLocked(img, true)
  asAny(img).set({ name: 'Fondo' })
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  fireModified(canvas, img)
}

// ----------------------------------------------------------------------------
// Texto curvo <-> texto normal
// ----------------------------------------------------------------------------
export function textToCurved(canvas: Canvas, t: IText, curve = 50): CurvedText {
  const idx = canvas.getObjects().indexOf(t)
  const center = t.getCenterPoint()
  const c = new CurvedText({
    text: (t.text || '').replace(/\n/g, ' '),
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight as any,
    fontStyle: t.fontStyle,
    fill: typeof t.fill === 'string' ? t.fill : '#111827',
    stroke: typeof t.stroke === 'string' ? t.stroke : '',
    strokeWidth: t.strokeWidth || 0,
    charSpacing: t.charSpacing || 0,
    underline: !!t.underline,
    curve,
    angle: t.angle,
    scaleX: t.scaleX,
    scaleY: t.scaleY,
    opacity: t.opacity,
    shadow: t.shadow as any,
  } as any)
  asAny(c).set({ id: uid(), bambaType: 'curvedText', name: asAny(t).name })
  c.setPositionByOrigin(center, 'center', 'center')
  canvas.remove(t)
  canvas.insertAt(Math.max(0, idx), c)
  c.setCoords()
  canvas.setActiveObject(c)
  canvas.requestRenderAll()
  fireModified(canvas, c)
  return c
}

export function curvedToText(canvas: Canvas, c: CurvedText): Textbox {
  const idx = canvas.getObjects().indexOf(c)
  const center = c.getCenterPoint()
  const t = new Textbox(c.text, {
    fontFamily: c.fontFamily,
    fontSize: c.fontSize,
    fontWeight: c.fontWeight as any,
    fontStyle: c.fontStyle as any,
    fill: c.fill,
    stroke: c.stroke,
    strokeWidth: c.strokeWidth,
    charSpacing: c.charSpacing,
    underline: c.underline,
    angle: c.angle,
    scaleX: c.scaleX,
    scaleY: c.scaleY,
    opacity: c.opacity,
    textAlign: 'center',
    editable: true,
  })
  asAny(t).set({ id: uid(), bambaType: 'text', name: asAny(c).name })
  ;(t as any).initDimensions()
  t.setPositionByOrigin(center, 'center', 'center')
  canvas.remove(c)
  canvas.insertAt(Math.max(0, idx), t)
  t.setCoords()
  canvas.setActiveObject(t)
  canvas.requestRenderAll()
  fireModified(canvas, t)
  return t
}
