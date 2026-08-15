import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, type FabricObject, type IText } from 'fabric'
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { History } from '@/lib/history'
import { attachSnapping } from '@/lib/snapping'
import { addPage, deletePage, duplicatePage, loadPageIntoCanvas, movePage, scheduleSave } from '@/lib/pages'
import { copySelection, deleteSelection, duplicateSelection, groupSelection, isText, pasteClipboard, selectAll, ungroupSelection, isFrame, isFramedImage } from '@/lib/fabricUtils'
import { uploadAndAdd, cancelCrop, applyCrop } from '@/lib/actions'
import { IconBtn } from './ui'
import ContextMenu, { type CtxMenuState } from './ContextMenu'

export default function CanvasArea() {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const design = useEditor((s) => s.design)
  const pageIndex = useEditor((s) => s.pageIndex)
  const zoom = useEditor((s) => s.zoom)
  const set = useEditor((s) => s.set)
  const bump = useEditor((s) => s.bump)
  const W = design?.width || 1080
  const H = design?.height || 1080
  const pageCount = design?.pages.length || 1

  // Crear canvas
  useEffect(() => {
    if (!design || !canvasElRef.current) return
    const canvas = new Canvas(canvasElRef.current, {
      preserveObjectStacking: true,
      backgroundColor: '#ffffff',
      selection: true,
      controlsAboveOverlay: true,
      selectionColor: 'rgba(124,58,237,0.12)',
      selectionBorderColor: '#7c3aed',
      selectionLineWidth: 1.5,
      stopContextMenu: true,
      fireRightClick: true,
      enableRetinaScaling: true,
      imageSmoothingEnabled: true,
    })
    canvas.setDimensions({ width: W, height: H })

    const history = new History(canvas, (reason) => {
      const st = useEditor.getState()
      st.set({ canUndo: history.canUndo, canRedo: history.canRedo })
      st.bump()
      // 'reset' = carga de página (no hay cambios); 'load' = undo/redo (sí los hay)
      if (reason !== 'reset') {
        scheduleSave()
        import('@/lib/collab').then((m) => m.broadcastCurrentPage())
      }
    })

    const record = () => history.save()
    const updateSelection = () => {
      const objs = canvas.getActiveObjects()
      const active = canvas.getActiveObject()
      const st = useEditor.getState()
      // el marco objetivo deja de serlo si el usuario selecciona otra cosa
      if (st.frameTarget && active && active !== st.frameTarget) st.set({ frameTarget: null })
      // una selección múltiple con algún objeto bloqueado no se puede mover/escalar
      if (active && active.isType('activeselection')) {
        const anyLocked = objs.some((o) => (o as any).locked)
        active.set({ lockMovementX: anyLocked, lockMovementY: anyLocked, lockScalingX: anyLocked, lockScalingY: anyLocked, lockRotation: anyLocked, hasControls: !anyLocked })
      }
      set({ selection: objs })
      bump()
    }
    canvas.on('object:added', record)
    canvas.on('object:removed', record)
    canvas.on('object:modified', record)
    canvas.on('path:created', record)
    canvas.on('text:editing:exited', record)
    canvas.on('selection:created', updateSelection)
    canvas.on('selection:updated', updateSelection)
    canvas.on('selection:cleared', updateSelection)
    canvas.on('object:moving', bump)
    canvas.on('object:scaling', bump)
    canvas.on('object:rotating', bump)
    canvas.on('text:changed', bump)
    canvas.on('mouse:move', (e) => {
      if (useEditor.getState().peers.length) {
        const p = canvas.getScenePoint(e.e as any)
        import('@/lib/collab').then((m) => m.broadcastCursor(p.x, p.y))
      }
    })
    canvas.on('mouse:up', () => import('@/lib/collab').then((m) => m.flushDeferredRemote()))
    canvas.on('text:editing:exited', () => import('@/lib/collab').then((m) => m.flushDeferredRemote()))

    // doble clic en marco vacío → abrir subidas; doble clic en imagen → recortar
    canvas.on('mouse:dblclick', (e) => {
      const t = e.target as FabricObject | undefined
      if (!t) return
      if (isFrame(t)) {
        useEditor.getState().set({ activeTab: 'uploads', frameTarget: t })
      }
    })

    const detachSnap = attachSnapping(canvas, () => {
      const d = useEditor.getState().design
      return { W: d?.width || 1080, H: d?.height || 1080 }
    })

    set({ canvas, history })
    void (async () => {
      const page = useEditor.getState().design!.pages[useEditor.getState().pageIndex]
      await loadPageIntoCanvas(page)
      fitZoom()
      bump()
    })()

    return () => {
      detachSnap()
      canvas.dispose()
      set({ canvas: null, history: null, selection: [] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.id])

  // Aplicar zoom / tamaño
  useEffect(() => {
    const { canvas } = useEditor.getState()
    if (!canvas) return
    canvas.setDimensions({ width: W * zoom, height: H * zoom })
    canvas.setZoom(zoom)
    canvas.requestRenderAll()
  }, [zoom, W, H, design?.id])

  const fitZoom = useCallback((force = false) => {
    const el = containerRef.current
    const st = useEditor.getState()
    const d = st.design
    if (!el || !d) return
    if (!force && st.zoomMode === 'manual') return
    const cw = el.clientWidth - 96
    const ch = el.clientHeight - 120
    const z = Math.min(cw / d.width, ch / d.height, 3)
    set({ zoom: Math.max(0.05, Math.round(z * 1000) / 1000), zoomMode: 'fit' })
  }, [set])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => fitZoom(false))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [fitZoom, design?.id])

  // Reajustar al cambiar el tamaño del diseño (redimensionar) o al abrir un diseño
  useEffect(() => {
    fitZoom(true)
  }, [W, H, design?.id, fitZoom])

  // Rueda: ctrl/cmd + rueda = zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const st = useEditor.getState()
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      st.set({ zoom: Math.max(0.05, Math.min(5, st.zoom * factor)), zoomMode: 'manual' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Atajos de teclado
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const st = useEditor.getState()
      const canvas = st.canvas
      if (!canvas) return
      if (st.present) return // en modo presentación no se edita
      if (document.querySelector('[data-modal="1"]')) return // hay un diálogo abierto
      if (st.readOnly && !((e.ctrlKey || e.metaKey) && ['=', '+', '-', '0'].includes(e.key))) return
      const target = e.target as HTMLElement
      const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      const active = canvas.getActiveObject()
      const editing = active && isText(active) && (active as IText).isEditing
      if (inInput || editing) {
        if (e.key === 'Escape' && editing) (active as IText).exitEditing()
        return
      }
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (st.cropSession) {
        if (e.key === 'Enter') applyCrop()
        if (e.key === 'Escape') cancelCrop()
        return
      }
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) await st.history?.redo()
        else await st.history?.undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        await st.history?.redo()
        return
      }
      if (mod && key === 's') {
        e.preventDefault()
        scheduleSave(0)
        return
      }
      if (mod && key === 'c') {
        e.preventDefault()
        await copySelection(canvas)
        return
      }
      if (mod && key === 'v') {
        e.preventDefault()
        await pasteClipboard(canvas)
        return
      }
      if (mod && key === 'd') {
        e.preventDefault()
        await duplicateSelection(canvas)
        return
      }
      if (mod && key === 'a') {
        e.preventDefault()
        selectAll(canvas)
        return
      }
      if (mod && key === ']') {
        e.preventDefault()
        const m = await import('@/lib/fabricUtils')
        if (e.shiftKey || e.altKey) m.bringForward(canvas)
        else m.bringToFront(canvas)
        return
      }
      if (mod && key === '[') {
        e.preventDefault()
        const m = await import('@/lib/fabricUtils')
        if (e.shiftKey || e.altKey) m.sendBackward(canvas)
        else m.sendToBack(canvas)
        return
      }
      if (mod && key === 'g') {
        e.preventDefault()
        if (e.shiftKey) ungroupSelection(canvas)
        else groupSelection(canvas)
        return
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault()
        st.set({ zoom: Math.min(5, st.zoom * 1.2), zoomMode: 'manual' })
        return
      }
      if (mod && key === '-') {
        e.preventDefault()
        st.set({ zoom: Math.max(0.05, st.zoom / 1.2), zoomMode: 'manual' })
        return
      }
      if (mod && key === '0') {
        e.preventDefault()
        fitZoom(true)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (active) {
          e.preventDefault()
          deleteSelection(canvas)
        }
        return
      }
      if (e.key === 'Escape') {
        canvas.discardActiveObject()
        canvas.requestRenderAll()
        set({ frameTarget: null })
        return
      }
      if (e.key.startsWith('Arrow') && active && !(active as any).locked && !canvas.getActiveObjects().some((o) => (o as any).locked)) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        if (e.key === 'ArrowLeft') active.set('left', active.left - step)
        if (e.key === 'ArrowRight') active.set('left', active.left + step)
        if (e.key === 'ArrowUp') active.set('top', active.top - step)
        if (e.key === 'ArrowDown') active.set('top', active.top + step)
        active.setCoords()
        canvas.requestRenderAll()
        canvas.fire('object:modified', { target: active } as any)
        return
      }
      if (key === 't' && !mod) {
        // atajo Canva: T añade texto
        const { addText } = await import('@/lib/actions')
        void addText('body')
      }
      if (key === 'r' && !mod) {
        const { addShape } = await import('@/lib/actions')
        addShape('rect')
      }
      if (key === 'c' && !mod) {
        const { addShape } = await import('@/lib/actions')
        addShape('circle')
      }
      if (key === 'l' && !mod) {
        const { addShape } = await import('@/lib/actions')
        addShape('line')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fitZoom, set])

  // Drag & drop de ficheros e imágenes de paneles
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const graphic = e.dataTransfer.getData('text/bamba-graphic')
    if (graphic) {
      const { addGraphic } = await import('@/lib/actions')
      const { canvas } = useEditor.getState()
      const obj = await addGraphic(graphic)
      if (obj && canvas) {
        const p = canvas.getScenePoint({ clientX: e.clientX, clientY: e.clientY } as any)
        obj.set({ left: p.x - obj.getScaledWidth() / 2, top: p.y - obj.getScaledHeight() / 2 })
        obj.setCoords()
        canvas.requestRenderAll()
      }
      return
    }
    const url = e.dataTransfer.getData('text/bamba-image')
    const { canvas } = useEditor.getState()
    if (url && canvas) {
      // si soltamos sobre un marco, lo rellenamos
      const rect = (canvas as any).upperCanvasEl.getBoundingClientRect()
      const p = canvas.getScenePoint({ clientX: e.clientX, clientY: e.clientY } as any)
      void rect
      const targetObj = canvas.getObjects().reverse().find((o) => (isFrame(o) || isFramedImage(o)) && o.containsPoint(p))
      const { addImageFromUrl } = await import('@/lib/actions')
      if (targetObj) {
        canvas.setActiveObject(targetObj)
        await addImageFromUrl(url)
      } else {
        const img = await addImageFromUrl(url)
        if (img) {
          img.set({ left: p.x - img.getScaledWidth() / 2, top: p.y - img.getScaledHeight() / 2 })
          img.setCoords()
          canvas.requestRenderAll()
        }
      }
      return
    }
    if (e.dataTransfer.files?.length) await uploadAndAdd(e.dataTransfer.files)
  }

  const cropSession = useEditor((s) => s.cropSession)
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)
  const readOnly = useEditor((s) => s.readOnly)
  const cursors = useEditor((s) => s.cursors)
  const version = useEditor((s) => s.version)
  void version

  // Solo lectura: nada es seleccionable
  useEffect(() => {
    const { canvas } = useEditor.getState()
    if (!canvas) return
    canvas.selection = !readOnly
    canvas.skipTargetFind = readOnly
    canvas.discardActiveObject()
    canvas.requestRenderAll()
  }, [readOnly, design?.id, pageIndex])

  // Menú contextual (clic derecho) sobre el lienzo
  useEffect(() => {
    const { canvas } = useEditor.getState()
    if (!canvas) return
    const onDown = (opt: any) => {
      const e = opt.e as MouseEvent
      if (!e || e.button !== 2) {
        if (e && e.button === 0) setCtxMenu(null)
        return
      }
      if (useEditor.getState().cropSession) return
      const target = (opt.target as FabricObject | undefined) || null
      if (target && !canvas.getActiveObjects().includes(target)) {
        canvas.setActiveObject(target)
        canvas.requestRenderAll()
      }
      if (!target) {
        canvas.discardActiveObject()
        canvas.requestRenderAll()
      }
      setCtxMenu({ x: e.clientX, y: e.clientY, target })
    }
    canvas.on('mouse:down', onDown)
    return () => {
      canvas.off('mouse:down', onDown)
    }
  }, [design?.id])

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 flex-col overflow-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onMouseDown={(e) => {
        // clic en el fondo gris → deseleccionar
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg === '1') {
          const { canvas } = useEditor.getState()
          canvas?.discardActiveObject()
          canvas?.requestRenderAll()
        }
      }}
    >
      <div className="mx-auto flex flex-col items-center px-10 py-6" data-bg="1" style={{ minWidth: '100%' }}>
        {/* Cabecera de página estilo Canva */}
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500" style={{ width: Math.max(W * zoom, 260) }}>
          <span className="font-medium">
            Página {pageIndex + 1} de {pageCount}
          </span>
          <div className="flex items-center gap-0.5 opacity-70 hover:opacity-100">
            <IconBtn size="sm" title="Subir página" disabled={pageIndex === 0} onClick={() => movePage(pageIndex, -1)}>
              <ChevronUp size={14} />
            </IconBtn>
            <IconBtn size="sm" title="Bajar página" disabled={pageIndex >= pageCount - 1} onClick={() => movePage(pageIndex, 1)}>
              <ChevronDown size={14} />
            </IconBtn>
            <IconBtn size="sm" title="Duplicar página" onClick={() => void duplicatePage()}>
              <Copy size={14} />
            </IconBtn>
            <IconBtn size="sm" title="Eliminar página" onClick={() => void deletePage()}>
              <Trash2 size={14} />
            </IconBtn>
            <IconBtn size="sm" title="Añadir página" onClick={() => void addPage()}>
              <Plus size={14} />
            </IconBtn>
          </div>
        </div>
        <div className="checker relative rounded-sm" style={{ width: W * zoom, height: H * zoom }}>
          <canvas ref={canvasElRef} />
          {/* cursores de colaboradores */}
          {Object.entries(cursors)
            .filter(([, c]) => c.pageId === design?.pages[pageIndex]?.id && Date.now() - c.t < 15000)
            .map(([id, c]) => (
              <div key={id} className="pointer-events-none absolute z-10 transition-transform duration-75" style={{ transform: `translate(${c.x * zoom}px, ${c.y * zoom}px)` }}>
                <svg width="16" height="20" viewBox="0 0 16 20" fill={c.color} stroke="#fff" strokeWidth="1.5"><path d="M1 1 L15 9 L8 10.5 L4.5 18 Z" /></svg>
                <span className="ml-3 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ background: c.color }}>{c.name}</span>
              </div>
            ))}
          {readOnly && <div className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/70 px-2 py-1 text-xs text-white">Solo lectura</div>}
          {cropSession && (
            <div className="absolute -top-10 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-lg bg-white p-1 shadow-lg">
              <button className="btn-ghost" onClick={cancelCrop}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={applyCrop}>
                Aplicar recorte
              </button>
            </div>
          )}
        </div>
        <button className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 py-2 text-sm text-slate-600 hover:border-brand-400 hover:text-brand-700" onClick={() => void addPage()}>
          <Plus size={16} /> Añadir página
        </button>
      </div>
      {ctxMenu && <ContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </div>
  )
}
