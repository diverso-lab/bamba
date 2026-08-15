import { useEditor } from '@/store/editor'
import { api } from './api'
import { CUSTOM_PROPS, uid } from './fabricUtils'
import { ensureFontsInJson } from './fonts'
import type { DesignData, PageData } from './types'

export const BLANK_PAGE = () => ({ version: '6.0.0', objects: [], background: '#ffffff' })

export function currentPageJson(): any | null {
  const { canvas } = useEditor.getState()
  if (!canvas) return null
  return canvas.toObject(CUSTOM_PROPS as any)
}

export function thumbnailFromCanvas(maxSide = 240): string | null {
  const { canvas, design, zoom } = useEditor.getState()
  if (!canvas || !design) return null
  try {
    // toDataURL de fabric v6 nunca dibuja controles: no hay que tocar la selección
    return canvas.toDataURL({ format: 'jpeg', quality: 0.6, multiplier: maxSide / Math.max(design.width, design.height) / (zoom || 1), enableRetinaScaling: false } as any)
  } catch {
    return null
  }
}

/** Vuelca el canvas actual en design.pages[pageIndex] (si el canvas contiene realmente esa página). */
export function commitCurrentPage() {
  const st = useEditor.getState()
  if (!st.canvas || !st.design) return
  if (st.cropSession) return // el modo recorte es transitorio: no se persiste
  const page = st.design.pages[st.pageIndex]
  if (!page || st.loadedPageId !== page.id) return // el canvas no contiene (todavía) esta página
  const json = currentPageJson()
  const thumb = thumbnailFromCanvas()
  const pages = st.design.pages.slice()
  pages[st.pageIndex] = { ...page, json, thumbnail: thumb ?? page.thumbnail }
  st.set({ design: { ...st.design, pages } })
}

export async function loadPageIntoCanvas(page: PageData) {
  const { canvas, history } = useEditor.getState()
  if (!canvas) return
  useEditor.getState().set({ loadedPageId: null, frameTarget: null })
  const json = page.json || BLANK_PAGE()
  await ensureFontsInJson(json)
  history?.pause()
  canvas.discardActiveObject()
  await canvas.loadFromJSON(json)
  canvas.requestRenderAll()
  history?.resume(false)
  history?.reset()
  useEditor.getState().set({ loadedPageId: page.id })
  import('./video').then((m) => m.ensureVideoLoop(canvas))
}

// Las operaciones de página se serializan en cola para que no se solapen
let pageQueue: Promise<unknown> = Promise.resolve()
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = pageQueue.then(fn, fn)
  pageQueue = run.catch(() => undefined)
  return run
}

/** Cancela el recorte en curso (si lo hay) antes de operaciones que serializan la página. */
export function cancelCropIfAny() {
  const st = useEditor.getState()
  if (st.cropSession) {
    st.cropSession.cancel()
    st.history?.resume(false)
    st.set({ cropSession: null })
  }
}

export function switchPage(index: number) {
  return enqueue(async () => {
    const st = useEditor.getState()
    if (!st.design || index === st.pageIndex || index < 0 || index >= st.design.pages.length) return
    cancelCropIfAny()
    commitCurrentPage()
    const design = useEditor.getState().design!
    st.set({ pageIndex: index })
    await loadPageIntoCanvas(design.pages[index])
    useEditor.getState().bump()
  })
}

export function addPage(afterIndex?: number, json?: any) {
  return enqueue(async () => {
    const st = useEditor.getState()
    if (!st.design) return
    cancelCropIfAny()
    commitCurrentPage()
    const design = useEditor.getState().design!
    const idx = (afterIndex ?? st.pageIndex) + 1
    const pages = design.pages.slice()
    pages.splice(idx, 0, { id: uid(), json: json ?? null, thumbnail: null, __dirtyJson: !!json } as any)
    st.set({ design: { ...design, pages }, pageIndex: idx })
    await loadPageIntoCanvas(pages[idx])
    scheduleSave()
    useEditor.getState().bump()
    import('./collab').then((m) => m.broadcastDesignMeta())
  })
}

export function duplicatePage(index?: number) {
  return enqueue(async () => {
    const st = useEditor.getState()
    if (!st.design) return
    cancelCropIfAny()
    commitCurrentPage()
    const design = useEditor.getState().design!
    const i = index ?? st.pageIndex
    const src = design.pages[i]
    const idx = i + 1
    const pages = design.pages.slice()
    pages.splice(idx, 0, { id: uid(), json: src.json ? JSON.parse(JSON.stringify(src.json)) : null, thumbnail: src.thumbnail || null, __dirtyJson: true } as any)
    st.set({ design: { ...design, pages }, pageIndex: idx })
    await loadPageIntoCanvas(pages[idx])
    scheduleSave()
    useEditor.getState().bump()
    import('./collab').then((m) => m.broadcastDesignMeta())
  })
}

export function deletePage(index?: number) {
  return enqueue(async () => {
    const st = useEditor.getState()
    if (!st.design) return
    cancelCropIfAny()
    const i = index ?? st.pageIndex
    if (st.design.pages.length <= 1) {
      // vaciar la única página
      const { canvas } = st
      if (canvas) {
        canvas.discardActiveObject()
        canvas.remove(...canvas.getObjects())
        canvas.backgroundColor = '#ffffff'
        canvas.requestRenderAll()
        st.history?.save()
      }
      return
    }
    commitCurrentPage()
    const design = useEditor.getState().design!
    const pages = design.pages.slice()
    pages.splice(i, 1)
    const newIndex = Math.max(0, Math.min(st.pageIndex >= i ? st.pageIndex - 1 : st.pageIndex, pages.length - 1))
    st.set({ design: { ...design, pages }, pageIndex: newIndex })
    await loadPageIntoCanvas(pages[newIndex])
    scheduleSave()
    useEditor.getState().bump()
    import('./collab').then((m) => m.broadcastDesignMeta())
  })
}

export function movePage(index: number, dir: -1 | 1) {
  return enqueue(async () => {
    const st = useEditor.getState()
    if (!st.design) return
    const j = index + dir
    if (j < 0 || j >= st.design.pages.length) return
    cancelCropIfAny()
    commitCurrentPage()
    const design = useEditor.getState().design!
    const pages = design.pages.slice()
    const [p] = pages.splice(index, 1)
    pages.splice(j, 0, p)
    let pageIndex = st.pageIndex
    if (pageIndex === index) pageIndex = j
    else if (pageIndex === j) pageIndex = index
    st.set({ design: { ...design, pages }, pageIndex })
    scheduleSave()
    useEditor.getState().bump()
    import('./collab').then((m) => m.broadcastDesignMeta())
  })
}

// ----------------------------------------------------------------------------
// Guardado
// ----------------------------------------------------------------------------
let saveTimer: number | null = null
let saveInFlight: Promise<boolean> | null = null

export function scheduleSave(delay = 1500) {
  const st = useEditor.getState()
  st.set({ dirty: true, changeSeq: st.changeSeq + 1 })
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveDesign(), delay)
}

export function cancelScheduledSave() {
  if (saveTimer) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
}

/** Payload de guardado: metadatos + estructura de páginas; solo la página cargada lleva su JSON
 *  (el servidor conserva el JSON del resto, así dos colaboradores no se pisan). */
function designPayload(design: DesignData) {
  const st = useEditor.getState()
  const loaded = st.loadedPageId
  return {
    name: design.name,
    width: design.width,
    height: design.height,
    pages: design.pages.map((p) => {
      const { json, ...rest } = p
      // páginas nunca cargadas en esta sesión pero con json local (p. ej. duplicadas / plantillas) también se envían
      return p.id === loaded || (json && (p as any).__dirtyJson) ? { ...rest, json } : rest
    }),
    thumbnail: design.pages[0]?.thumbnail || null,
    folder: design.folder,
  }
}

export async function saveDesign(): Promise<boolean> {
  const st = useEditor.getState()
  if (!st.design) return false
  if (st.readOnly) {
    st.set({ dirty: false })
    return true
  }
  if (saveInFlight) {
    // esperamos al guardado en curso y volvemos a guardar si hubo cambios después
    await saveInFlight
    if (!useEditor.getState().dirty) return true
  }
  cancelScheduledSave()
  const run = (async () => {
    commitCurrentPage()
    const cur = useEditor.getState()
    const design = cur.design!
    const seq = cur.changeSeq
    cur.set({ saving: true })
    try {
      await api.updateDesign(design.id, designPayload(design))
      const after = useEditor.getState()
      if (after.design) after.set({ design: { ...after.design, pages: after.design.pages.map((p) => { const { __dirtyJson, ...rest } = p as any; return rest }) } })
      // solo limpiamos "dirty" si no ha habido cambios mientras guardábamos
      after.set({ saving: false, dirty: after.changeSeq !== seq, lastSaved: Date.now() })
      if (after.changeSeq !== seq) scheduleSave(800)
      return true
    } catch (e: any) {
      useEditor.getState().set({ saving: false })
      useEditor.getState().toast(`No se pudo guardar: ${e.message}`, 'error')
      return false
    }
  })()
  saveInFlight = run
  try {
    return await run
  } finally {
    saveInFlight = null
  }
}

/** Guardado síncrono "de emergencia" al desmontar el editor / cerrar pestaña (fetch keepalive). */
export function flushSave() {
  const st = useEditor.getState()
  if (!st.design || !st.canvas || st.readOnly) return
  cancelScheduledSave()
  if (!st.dirty && !st.cropSession) return
  cancelCropIfAny()
  commitCurrentPage()
  const design = useEditor.getState().design!
  try {
    void fetch(`/api/designs/${design.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(designPayload(design)),
      keepalive: true,
    })
  } catch {
    /* sin red */
  }
}

/** Redimensiona el diseño (todas las páginas), opcionalmente escalando el contenido. */
function rescaleGradient(bg: any, sx: number, sy: number) {
  if (!bg || typeof bg !== 'object' || !bg.coords) return bg
  const c = { ...bg.coords }
  for (const k of ['x1', 'x2']) if (typeof c[k] === 'number') c[k] *= sx
  for (const k of ['y1', 'y2']) if (typeof c[k] === 'number') c[k] *= sy
  for (const k of ['r1', 'r2']) if (typeof c[k] === 'number') c[k] *= Math.max(sx, sy)
  return { ...bg, coords: c }
}

export function resizeDesign(newW: number, newH: number, scaleContent: boolean) {
  return enqueue(async () => {
  const st = useEditor.getState()
  if (!st.design || !st.canvas) return
  cancelCropIfAny()
  commitCurrentPage()
  const design = useEditor.getState().design!
  const oldW = design.width
  const oldH = design.height
  const sx = newW / oldW
  const sy = newH / oldH
  const s = Math.min(sx, sy)
  const pages = design.pages.map((p) => {
    if (!p.json) return p
    const json = JSON.parse(JSON.stringify(p.json))
    json.background = rescaleGradient(json.background, sx, sy)
    if (!scaleContent) return { ...p, json }
    for (const o of json.objects || []) {
      // escalamos alrededor del centro de la página
      const cx = (o.left ?? 0) - oldW / 2
      const cy = (o.top ?? 0) - oldH / 2
      o.left = newW / 2 + cx * s
      o.top = newH / 2 + cy * s
      o.scaleX = (o.scaleX ?? 1) * s
      o.scaleY = (o.scaleY ?? 1) * s
    }
    return { ...p, json }
  })
  st.set({ design: { ...design, width: newW, height: newH, pages: pages.map((p) => ({ ...p, __dirtyJson: true }) as any) } })
  await loadPageIntoCanvas(pages[st.pageIndex])
  scheduleSave(200)
  useEditor.getState().bump()
  import('./collab').then((m) => { m.broadcastDesignMeta(); m.broadcastCurrentPage() })
  })
}
