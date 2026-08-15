import { useEditor } from '@/store/editor'
import { CUSTOM_PROPS } from './fabricUtils'
import { ensureFontsInJson } from './fonts'
import type { PageData } from './types'

/**
 * Colaboración en tiempo real: un WebSocket por diseño.
 * - Enviamos la página actual (JSON completo) tras cada cambio (debounce corto).
 * - Recibimos páginas de otros y las aplicamos si no estamos en mitad de una transformación.
 * - Presencia (avatares) y cursores.
 */
let ws: WebSocket | null = null
let designId: string | null = null
let sendTimer: number | null = null
let pending: any = null
let clientId = ''
let reconnectTimer: number | null = null
let cursorTimer = 0

export function connectCollab(id: string) {
  disconnectCollab()
  designId = id
  const st = useEditor.getState()
  st.set({ collabStatus: 'connecting' })
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const sock = new WebSocket(`${proto}://${location.host}/api/ws/design/${id}`)
  ws = sock
  sock.onopen = () => useEditor.getState().set({ collabStatus: 'online' })
  sock.onclose = () => {
    if (ws === sock) {
      useEditor.getState().set({ collabStatus: 'off', peers: [], cursors: {} })
      if (designId === id && !reconnectTimer) {
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null
          if (designId === id) connectCollab(id)
        }, 3000)
      }
    }
  }
  sock.onerror = () => {}
  sock.onmessage = (ev) => {
    let msg: any
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    handle(msg)
  }
}

export function disconnectCollab() {
  designId = null
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    const s = ws
    ws = null
    try {
      s.close()
    } catch {
      /* ignore */
    }
  }
  useEditor.getState().set({ collabStatus: 'off', peers: [], cursors: {} })
}

function send(msg: any) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

/** Llamado tras cada commit del historial local. */
export function broadcastCurrentPage() {
  const st = useEditor.getState()
  if (!ws || ws.readyState !== WebSocket.OPEN || !st.canvas || !st.design || st.readOnly) return
  const page = st.design.pages[st.pageIndex]
  if (!page || st.loadedPageId !== page.id) return
  pending = { type: 'page', pageId: page.id, json: st.canvas.toObject(CUSTOM_PROPS as any) }
  if (sendTimer) return
  sendTimer = window.setTimeout(() => {
    sendTimer = null
    if (pending) send(pending)
    pending = null
  }, 250)
}

/** Estructura del diseño (páginas añadidas/borradas/reordenadas, nombre, tamaño). */
export function broadcastDesignMeta() {
  const st = useEditor.getState()
  if (!st.design || st.readOnly) return
  send({
    type: 'design',
    name: st.design.name,
    width: st.design.width,
    height: st.design.height,
    pages: st.design.pages.map((p) => ({ id: p.id, duration: p.duration, anim: p.anim, transition: p.transition })),
  })
}

export function broadcastCursor(x: number, y: number) {
  const now = performance.now()
  if (now - cursorTimer < 60) return
  cursorTimer = now
  const st = useEditor.getState()
  const page = st.design?.pages[st.pageIndex]
  send({ type: 'cursor', x, y, pageId: page?.id || null })
}

let applying = false
const deferred: Map<string, any> = new Map()

async function applyRemotePage(pageId: string, json: any) {
  const st = useEditor.getState()
  if (!st.design) return
  const idx = st.design.pages.findIndex((p) => p.id === pageId)
  if (idx < 0) return
  const pages = st.design.pages.slice()
  pages[idx] = { ...pages[idx], json }
  st.set({ design: { ...st.design, pages } })
  if (st.loadedPageId === pageId && st.canvas) {
    const canvas = st.canvas
    const busy = !!(canvas as any)._currentTransform || (canvas.getActiveObject() as any)?.isEditing || st.cropSession
    if (busy) {
      deferred.set(pageId, json)
      return
    }
    applying = true
    try {
      const activeIds = canvas.getActiveObjects().map((o) => (o as any).id)
      await ensureFontsInJson(json)
      st.history?.pause()
      canvas.discardActiveObject()
      await canvas.loadFromJSON(json)
      const objs = canvas.getObjects().filter((o) => activeIds.includes((o as any).id))
      if (objs.length === 1) canvas.setActiveObject(objs[0])
      canvas.requestRenderAll()
      st.history?.resume(false)
      st.history?.reset()
      st.bump()
    } finally {
      applying = false
    }
  }
}

/** Aplica actualizaciones diferidas (tras soltar el ratón / salir de edición). */
export function flushDeferredRemote() {
  if (!deferred.size) return
  const entries = Array.from(deferred.entries())
  deferred.clear()
  for (const [pid, json] of entries) void applyRemotePage(pid, json)
}

function handle(msg: any) {
  const st = useEditor.getState()
  switch (msg.type) {
    case 'hello':
      clientId = msg.clientId
      st.set({ peers: (msg.presence || []).filter((p: any) => p.clientId !== clientId) })
      break
    case 'presence': {
      st.set({ peers: (msg.presence || []).filter((p: any) => p.clientId !== clientId) })
      const ids = new Set((msg.presence || []).map((p: any) => p.clientId))
      const cursors = { ...useEditor.getState().cursors }
      for (const k of Object.keys(cursors)) if (!ids.has(k)) delete cursors[k]
      st.set({ cursors })
      break
    }
    case 'cursor':
      st.set({ cursors: { ...st.cursors, [msg.from.clientId]: { x: msg.x, y: msg.y, pageId: msg.pageId, name: msg.from.name, color: msg.from.color, t: Date.now() } } })
      break
    case 'page':
      if (!applying) void applyRemotePage(msg.pageId, msg.json)
      break
    case 'design': {
      if (!st.design) return
      const byId = new Map(st.design.pages.map((p) => [p.id, p]))
      const pages: PageData[] = (msg.pages || []).map((p: any) => ({ ...(byId.get(p.id) || { id: p.id, json: null, thumbnail: null }), duration: p.duration, anim: p.anim, transition: p.transition }))
      const curId = st.design.pages[st.pageIndex]?.id
      let pageIndex = pages.findIndex((p) => p.id === curId)
      if (pageIndex < 0) pageIndex = Math.min(st.pageIndex, pages.length - 1)
      st.set({ design: { ...st.design, name: msg.name ?? st.design.name, width: msg.width ?? st.design.width, height: msg.height ?? st.design.height, pages }, pageIndex: Math.max(0, pageIndex) })
      if (curId && !pages.some((p) => p.id === curId)) {
        import('./pages').then((m) => m.loadPageIntoCanvas(pages[Math.max(0, pageIndex)]))
      }
      st.bump()
      break
    }
  }
}

export const isApplyingRemote = () => applying
