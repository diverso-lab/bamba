import { PencilBrush, Textbox, type FabricImage, type FabricObject } from 'fabric'
import QRCode from 'qrcode'
import { useEditor } from '@/store/editor'
import { api } from './api'
import { createChart, type ChartData } from './charts'
import { resetCrop as resetCropLib, startCrop } from './crop'
import {
  addObject,
  asAny,
  blobToDataURL,
  createFrame,
  createFromSvgString,
  createImage,
  createShape,
  createText,
  fillFrame,
  fireModified,
  imageToBlob,
  isFrame,
  isFramedImage,
  isImage,
  replaceImageSrc,
  uid,
  type FrameKind,
  type ShapeKind,
  type TextKind,
} from './fabricUtils'
import { ensureFont } from './fonts'
import { iconSvg } from './icons'
import { createVideo, ensureVideoLoop } from './video'

function ctx() {
  const st = useEditor.getState()
  const W = st.design?.width || 1080
  const H = st.design?.height || 1080
  return { canvas: st.canvas, W, H, st }
}

export async function addText(kind: TextKind, overrides: Record<string, any> = {}) {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  const t = createText(kind, W, overrides)
  await ensureFont(t.fontFamily)
  ;(t as any).initDimensions()
  addObject(canvas, t, W, H)
  return t
}

export async function addStyledText(text: string, props: Record<string, any>) {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  await ensureFont(props.fontFamily || 'Inter')
  const t = new Textbox(text, { width: W * 0.7, textAlign: 'center', editable: true, ...props })
  asAny(t).set({ id: uid(), bambaType: 'text' })
  addObject(canvas, t, W, H)
  return t
}

export function addShape(kind: ShapeKind, color?: string) {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  const size = Math.round(Math.min(W, H) * 0.35)
  const s = createShape(kind, size, color)
  addObject(canvas, s, W, H)
  return s
}

export function addFrame(kind: FrameKind) {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  const f = createFrame(kind, Math.round(Math.min(W, H) * 0.45))
  addObject(canvas, f, W, H)
  return f
}

/** Añade una cuadrícula de N marcos. */
export function addGrid(cols: number, rows: number, gap = 12) {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  const margin = Math.round(Math.min(W, H) * 0.05)
  const cw = (W - margin * 2 - gap * (cols - 1)) / cols
  const ch = (H - margin * 2 - gap * (rows - 1)) / rows
  const objs: FabricObject[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const f = createFrame('square', 100)
      f.set({ width: cw, height: ch, scaleX: 1, scaleY: 1, left: margin + c * (cw + gap), top: margin + r * (ch + gap) })
      f.setCoords()
      canvas.add(f)
      objs.push(f)
    }
  }
  canvas.discardActiveObject()
  canvas.requestRenderAll()
}

/** Añade una imagen. Si hay un marco seleccionado, lo rellena. */
export async function addImageFromUrl(url: string, opts: { select?: boolean } = {}) {
  const { canvas, W, H, st } = ctx()
  if (!canvas) return
  const active = canvas.getActiveObject()
  const frameTarget = st.frameTarget && canvas.getObjects().includes(st.frameTarget) ? st.frameTarget : null
  if (st.frameTarget && !frameTarget) st.set({ frameTarget: null })
  const target = frameTarget || active
  if (target && (isFrame(target) || isFramedImage(target))) {
    st.set({ busy: 'Colocando la imagen en el marco…' })
    try {
      const img = await fillFrame(canvas, target, url)
      st.set({ frameTarget: null })
      fireModified(canvas, img)
      return img
    } finally {
      st.set({ busy: null })
    }
  }
  // SVG: lo importamos como vector editable (grupo de trazados)
  if (/\.svg(\?|#|$)/i.test(url)) {
    st.set({ busy: 'Importando SVG…' })
    try {
      const res = await fetch(url)
      if (res.ok) {
        const text = await res.text()
        if (/<svg[\s>]/i.test(text)) {
          const obj = await createFromSvgString(text)
          asAny(obj).set({ bambaType: 'svg', name: 'SVG' })
          if (obj.getScaledWidth() < W * 0.15) obj.scaleToWidth(Math.round(Math.min(W, H) * 0.3))
          addObject(canvas, obj, W, H, { fit: true, select: opts.select ?? true })
          return obj as any
        }
      }
    } catch {
      /* caemos a imagen rasterizada */
    } finally {
      st.set({ busy: null })
    }
  }
  st.set({ busy: 'Cargando imagen…' })
  try {
    const img = await createImage(url)
    addObject(canvas, img, W, H, { fit: true, select: opts.select ?? true })
    return img
  } finally {
    st.set({ busy: null })
  }
}

export async function addVideoFromUrl(url: string) {
  const { canvas, W, H, st } = ctx()
  if (!canvas) return
  st.set({ busy: 'Cargando vídeo…' })
  try {
    const v = await createVideo(url)
    addObject(canvas, v, W, H, { fit: true })
    ensureVideoLoop(canvas)
    return v
  } catch (e: any) {
    st.toast(`No se pudo cargar el vídeo: ${e.message}`, 'error')
  } finally {
    st.set({ busy: null })
  }
}

export async function uploadAndAdd(files: FileList | File[]) {
  const st = useEditor.getState()
  const list = Array.from(files)
  const out = []
  for (const f of list) {
    try {
      st.set({ busy: `Subiendo ${f.name}…` })
      const item = await api.upload(f)
      out.push(item)
      if (item.kind === 'image') await addImageFromUrl(item.url)
      else if (item.kind === 'video') await addVideoFromUrl(item.url)
    } catch (e: any) {
      st.toast(`Error al subir ${f.name}: ${e.message}`, 'error')
    } finally {
      st.set({ busy: null })
    }
  }
  return out
}

export async function addIcon(name: string, color = '#111827') {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  const svg = iconSvg(name, color, 2, 24)
  if (!svg) return
  const obj = await createFromSvgString(svg)
  obj.scaleToWidth(Math.round(Math.min(W, H) * 0.25))
  asAny(obj).set({ bambaType: 'icon', name: `Icono ${name}` })
  addObject(canvas, obj, W, H)
  return obj
}

export async function addSvgString(svg: string, name = 'SVG', opts: { widthRatio?: number } = {}) {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  // quitamos width/height del <svg> raíz (p. ej. "1em") y dejamos que mande el viewBox
  const cleaned = svg.replace(/<svg([^>]*)>/i, (m, attrs) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/gi, '')}>`)
  const obj = await createFromSvgString(cleaned)
  asAny(obj).set({ name, bambaType: 'svg' })
  obj.scaleToWidth(Math.round(Math.min(W, H) * (opts.widthRatio ?? 0.3)))
  addObject(canvas, obj, W, H)
  return obj
}

/** Inserta un gráfico de la biblioteca (Iconify) como vector. */
export async function addGraphic(iconId: string) {
  const st = useEditor.getState()
  st.set({ busy: 'Insertando gráfico…' })
  try {
    const svg = await api.graphicsSvg(iconId)
    return await addSvgString(svg, iconId.split(':')[1] || 'Gráfico', { widthRatio: 0.28 })
  } catch (e: any) {
    st.toast(`No se pudo insertar: ${e.message}`, 'error')
  } finally {
    st.set({ busy: null })
  }
}

export async function addEmoji(char: string) {
  const { W } = ctx()
  return addText('heading', { text: char, fontSize: Math.round(W * 0.2), fontFamily: 'Inter', width: Math.round(W * 0.3) })
}

export function addChart(data: ChartData) {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  const g = createChart(data, Math.round(Math.min(W, H) * 0.7))
  addObject(canvas, g, W, H)
  return g
}

export function updateChart(target: FabricObject, data: ChartData) {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  const idx = canvas.getObjects().indexOf(target)
  const center = target.getCenterPoint()
  const g = createChart(data, Math.round(Math.min(W, H) * 0.7))
  g.scaleToWidth(target.width * (target.scaleX || 1))
  g.set({ angle: target.angle })
  g.setPositionByOrigin(center, 'center', 'center')
  canvas.remove(target)
  canvas.insertAt(Math.max(0, idx), g)
  canvas.setActiveObject(g)
  canvas.requestRenderAll()
  fireModified(canvas, g)
}

export async function addQr(text: string, dark = '#000000', light = '#ffffff') {
  const { canvas, W, H } = ctx()
  if (!canvas) return
  const url = await QRCode.toDataURL(text || 'https://bamba.app', { width: 1024, margin: 1, color: { dark, light } })
  const img = await createImage(url)
  img.scaleToWidth(Math.round(Math.min(W, H) * 0.35))
  asAny(img).set({ bambaType: 'qr', qrData: { text, dark, light }, name: 'Código QR' })
  addObject(canvas, img, W, H)
  return img
}

// ----------------------------------------------------------------------------
// Imagen: quitar fondo, recorte
// ----------------------------------------------------------------------------
export async function removeBackgroundOfSelection(opts: { model?: string; alphaMatting?: boolean; postProcess?: boolean } = {}) {
  const { canvas, st } = ctx()
  if (!canvas) return
  const imgs = canvas.getActiveObjects().filter(isImage) as FabricImage[]
  if (!imgs.length) {
    st.toast('Selecciona una imagen primero', 'info')
    return
  }
  st.set({ busy: 'Quitando el fondo con IA… (la primera vez tarda más porque se descarga el modelo)' })
  try {
    for (const img of imgs) {
      const blob = await imageToBlob(img)
      const out = await api.removeBg(blob, opts)
      const dataUrl = await blobToDataURL(out)
      const a = asAny(img)
      if (!a.bambaOriginalSrc) a.set('bambaOriginalSrc', img.getSrc())
      // subimos el resultado al backend para no inflar el JSON con base64
      let url = dataUrl
      try {
        const file = new File([out], 'sin-fondo.png', { type: 'image/png' })
        const item = await api.upload(file)
        url = item.url
      } catch {
        /* nos quedamos con dataURL */
      }
      await replaceImageSrc(img, url)
      canvas.requestRenderAll()
      fireModified(canvas, img)
    }
    st.toast('Fondo eliminado ✨', 'success')
  } catch (e: any) {
    st.toast(`No se pudo quitar el fondo: ${e.message}`, 'error')
  } finally {
    st.set({ busy: null })
  }
}

/** Desenfoca / recolorea el fondo manteniendo el sujeto (IA). */
export async function blurBackgroundOfSelection(opts: { radius?: number; mode?: 'blur' | 'color' | 'bw'; color?: string } = {}) {
  const { canvas, st } = ctx()
  if (!canvas) return
  const img = canvas.getActiveObject()
  if (!img || !isImage(img)) return
  st.set({ busy: 'Separando el sujeto del fondo con IA…' })
  try {
    const a = asAny(img)
    const srcUrl = a.bambaOriginalSrc || (img as FabricImage).getSrc()
    // partimos siempre del original para no acumular desenfoques
    let blob: Blob
    try {
      const r = await fetch(srcUrl)
      blob = await r.blob()
    } catch {
      blob = await imageToBlob(img as FabricImage)
    }
    const out = await api.blurBg(blob, opts)
    if (!a.bambaOriginalSrc) a.set('bambaOriginalSrc', (img as FabricImage).getSrc())
    let url = await blobToDataURL(out)
    try {
      const item = await api.upload(new File([out], 'fondo-editado.png', { type: 'image/png' }))
      url = item.url
    } catch {
      /* dataURL */
    }
    await replaceImageSrc(img as FabricImage, url)
    canvas.requestRenderAll()
    fireModified(canvas, img)
  } catch (e: any) {
    st.toast(`No se pudo procesar el fondo: ${e.message}`, 'error')
  } finally {
    st.set({ busy: null })
  }
}

export async function restoreBackgroundOfSelection() {
  const { canvas, st } = ctx()
  if (!canvas) return
  const imgs = canvas.getActiveObjects().filter(isImage) as FabricImage[]
  for (const img of imgs) {
    const a = asAny(img)
    if (a.bambaOriginalSrc) {
      st.set({ busy: 'Restaurando…' })
      try {
        await replaceImageSrc(img, a.bambaOriginalSrc)
        a.set('bambaOriginalSrc', null)
        canvas.requestRenderAll()
        fireModified(canvas, img)
      } finally {
        st.set({ busy: null })
      }
    }
  }
}

export function beginCrop() {
  const { canvas, st } = ctx()
  if (!canvas) return
  const img = canvas.getActiveObject()
  if (!img || !isImage(img) || st.cropSession) return
  // El recorte es transitorio: pausamos el historial (y con él el autosave) mientras dura
  st.history?.pause()
  const session = startCrop(canvas, img as FabricImage)
  st.set({ cropSession: session })
}
export function applyCrop() {
  const st = useEditor.getState()
  if (!st.cropSession) return
  st.cropSession.apply()
  st.set({ cropSession: null })
  st.history?.resume(true)
}
export function cancelCrop() {
  const st = useEditor.getState()
  if (!st.cropSession) return
  st.cropSession.cancel()
  st.set({ cropSession: null })
  st.history?.resume(false)
}
export function resetCrop() {
  const { canvas } = ctx()
  if (!canvas) return
  const img = canvas.getActiveObject()
  if (img && isImage(img)) resetCropLib(canvas, img as FabricImage)
}

/** Sustituye la imagen seleccionada por otra URL (mantiene tamaño). */
export async function replaceSelectedImage(url: string) {
  const { canvas, st } = ctx()
  if (!canvas) return
  const img = canvas.getActiveObject()
  if (!img || !isImage(img)) return
  st.set({ busy: 'Reemplazando imagen…' })
  try {
    if (isFramedImage(img)) await fillFrame(canvas, img, url)
    else {
      await replaceImageSrc(img as FabricImage, url)
      asAny(img).set('bambaOriginalSrc', null)
    }
    canvas.requestRenderAll()
    fireModified(canvas)
  } finally {
    st.set({ busy: null })
  }
}

// ----------------------------------------------------------------------------
// Dibujo libre
// ----------------------------------------------------------------------------
export interface DrawOptions {
  color: string
  width: number
  opacity: number
}

export function setDrawingMode(on: boolean, opts?: DrawOptions) {
  const { canvas, st } = ctx()
  if (!canvas) return
  canvas.isDrawingMode = on
  if (on) {
    const brush = new PencilBrush(canvas)
    brush.color = hexWithAlpha(opts?.color || '#111827', opts?.opacity ?? 1)
    brush.width = opts?.width ?? 8
    brush.decimate = 2
    canvas.freeDrawingBrush = brush
    canvas.discardActiveObject()
    canvas.requestRenderAll()
  }
  st.set({ drawing: on })
}

export function updateBrush(opts: DrawOptions) {
  const { canvas } = ctx()
  if (!canvas || !canvas.freeDrawingBrush) return
  canvas.freeDrawingBrush.color = hexWithAlpha(opts.color, opts.opacity)
  canvas.freeDrawingBrush.width = opts.width
}

function hexWithAlpha(hex: string, alpha: number) {
  if (alpha >= 1) return hex
  const c = hex.replace('#', '')
  if (c.length !== 6) return hex
  const n = parseInt(c, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
