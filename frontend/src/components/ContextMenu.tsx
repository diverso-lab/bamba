import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FabricObject, IText } from 'fabric'
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, ChevronRight, Clipboard, ClipboardPaste, Copy, CopyPlus, Crop, Eye, EyeOff, Group as GroupIcon, Image as ImageIcon, Layers, Lock, MousePointerSquareDashed, Paintbrush, PaintbrushVertical, Pencil, Plus, Replace, Trash2, Ungroup, Unlock, Wand2, Type,
} from 'lucide-react'
import { useEditor } from '@/store/editor'
import {
  alignSelection, bringForward, bringToFront, copySelection, copyStyle, deleteSelection, duplicateSelection, getName, groupSelection, hasStyleClipboard, isActiveSelection, isFramedImage, isGroup, isImage, isLocked, isText, pasteClipboard, pasteStyle, sendBackward, sendToBack, selectAll, setAsBackground, setVisibility, showAllHidden, toggleLock, ungroupSelection, asAny, fireModified,
} from '@/lib/fabricUtils'
import { beginCrop, removeBackgroundOfSelection } from '@/lib/actions'
import { addPage } from '@/lib/pages'

export interface CtxMenuState {
  x: number
  y: number
  target: FabricObject | null
}

type Item =
  | { kind: 'sep' }
  | { kind: 'item'; label: string; icon?: ReactNode; hint?: string; danger?: boolean; disabled?: boolean; onClick: () => void }
  | { kind: 'sub'; label: string; icon?: ReactNode; items: Item[] }

export default function ContextMenu({ state, onClose }: { state: CtxMenuState; onClose: () => void }) {
  const canvas = useEditor((s) => s.canvas)
  const design = useEditor((s) => s.design)!
  const set = useEditor((s) => s.set)
  const toast = useEditor((s) => s.toast)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: state.x, y: state.y })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let x = state.x
    let y = state.y
    if (x + r.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - r.width - 8)
    if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8)
    setPos({ x, y })
  }, [state.x, state.y])

  useEffect(() => {
    const openedAt = performance.now()
    const onDoc = (e: MouseEvent) => {
      // el mismo mousedown del clic derecho que abrió el menú no debe cerrarlo
      if (performance.now() - openedAt < 150) return
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onScroll = () => onClose()
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  if (!canvas) return null
  const W = design.width
  const H = design.height
  const target = state.target
  const sel = canvas.getActiveObjects()
  const active = canvas.getActiveObject()
  const run = (fn: () => unknown) => () => {
    onClose()
    void fn()
  }

  let items: Item[]
  if (!target) {
    // ---- lienzo vacío ----
    const hidden = canvas.getObjects().filter((o) => o.visible === false).length
    items = [
      { kind: 'item', label: 'Pegar', icon: <ClipboardPaste size={16} />, hint: 'Ctrl+V', onClick: run(() => pasteClipboard(canvas)) },
      { kind: 'item', label: 'Seleccionar todo', icon: <MousePointerSquareDashed size={16} />, hint: 'Ctrl+A', onClick: run(() => selectAll(canvas)) },
      { kind: 'sep' },
      { kind: 'item', label: 'Añadir página', icon: <Plus size={16} />, onClick: run(() => addPage()) },
      { kind: 'item', label: 'Color de fondo…', icon: <Paintbrush size={16} />, onClick: run(() => set({ activeTab: 'background' })) },
      { kind: 'sep' },
      { kind: 'item', label: `Mostrar todo lo oculto${hidden ? ` (${hidden})` : ''}`, icon: <Eye size={16} />, disabled: !hidden, onClick: run(() => showAllHidden(canvas)) },
      { kind: 'item', label: 'Mostrar capas', icon: <Layers size={16} />, onClick: run(() => set({ activeTab: 'position' })) },
    ]
  } else {
    const locked = isLocked(target)
    const single = sel.length === 1
    const multi = sel.length > 1
    const img = isImage(target)
    const txt = isText(target)
    const hiddenCount = canvas.getObjects().filter((o) => o.visible === false).length
    const layerItems: Item[] = [
      { kind: 'item', label: 'Traer al frente', icon: <ArrowUpToLine size={16} />, hint: 'Ctrl+]', onClick: run(() => bringToFront(canvas)) },
      { kind: 'item', label: 'Adelante', icon: <ArrowUp size={16} />, onClick: run(() => bringForward(canvas)) },
      { kind: 'item', label: 'Atrás', icon: <ArrowDown size={16} />, onClick: run(() => sendBackward(canvas)) },
      { kind: 'item', label: 'Enviar al fondo', icon: <ArrowDownToLine size={16} />, hint: 'Ctrl+[', onClick: run(() => sendToBack(canvas)) },
      { kind: 'sep' },
      { kind: 'item', label: 'Ocultar', icon: <EyeOff size={16} />, onClick: run(() => setVisibility(canvas, sel, false)) },
      { kind: 'item', label: `Mostrar todo lo oculto${hiddenCount ? ` (${hiddenCount})` : ''}`, icon: <Eye size={16} />, disabled: !hiddenCount, onClick: run(() => showAllHidden(canvas)) },
      { kind: 'sep' },
      { kind: 'item', label: 'Mostrar capas', icon: <Layers size={16} />, onClick: run(() => set({ activeTab: 'position' })) },
    ]
    const alignItems: Item[] = [
      { kind: 'item', label: 'Izquierda', icon: <AlignStartVertical size={16} />, onClick: run(() => alignSelection(canvas, 'left', W, H)) },
      { kind: 'item', label: 'Centro', icon: <AlignCenterVertical size={16} />, onClick: run(() => alignSelection(canvas, 'centerH', W, H)) },
      { kind: 'item', label: 'Derecha', icon: <AlignEndVertical size={16} />, onClick: run(() => alignSelection(canvas, 'right', W, H)) },
      { kind: 'sep' },
      { kind: 'item', label: 'Arriba', icon: <AlignStartHorizontal size={16} />, onClick: run(() => alignSelection(canvas, 'top', W, H)) },
      { kind: 'item', label: 'Medio', icon: <AlignCenterHorizontal size={16} />, onClick: run(() => alignSelection(canvas, 'centerV', W, H)) },
      { kind: 'item', label: 'Abajo', icon: <AlignEndHorizontal size={16} />, onClick: run(() => alignSelection(canvas, 'bottom', W, H)) },
    ]
    items = [
      { kind: 'item', label: 'Copiar', icon: <Copy size={16} />, hint: 'Ctrl+C', onClick: run(() => copySelection(canvas)) },
      { kind: 'item', label: 'Pegar', icon: <ClipboardPaste size={16} />, hint: 'Ctrl+V', onClick: run(() => pasteClipboard(canvas)) },
      { kind: 'item', label: 'Duplicar', icon: <CopyPlus size={16} />, hint: 'Ctrl+D', disabled: locked, onClick: run(() => duplicateSelection(canvas)) },
      { kind: 'item', label: 'Eliminar', icon: <Trash2 size={16} />, hint: 'Supr', danger: true, disabled: locked, onClick: run(() => deleteSelection(canvas)) },
      { kind: 'sep' },
      { kind: 'sub', label: 'Capa', icon: <Layers size={16} />, items: layerItems },
      { kind: 'sub', label: multi ? 'Alinear elementos' : 'Alinear con la página', icon: <AlignCenterVertical size={16} />, items: alignItems },
      { kind: 'sep' },
    ]
    if (img && single) {
      items.push(
        { kind: 'item', label: 'Editar foto (efectos)', icon: <Paintbrush size={16} />, onClick: run(() => set({ activeTab: 'photo' })) },
        { kind: 'item', label: 'Establecer como fondo', icon: <ImageIcon size={16} />, disabled: locked, onClick: run(() => setAsBackground(canvas, target, W, H)) },
        { kind: 'item', label: 'Quitar fondo', icon: <Wand2 size={16} />, disabled: locked, onClick: run(() => removeBackgroundOfSelection()) },
        { kind: 'item', label: 'Reemplazar imagen…', icon: <Replace size={16} />, disabled: locked, onClick: run(() => set({ activeTab: 'uploads', frameTarget: isFramedImage(target) ? target : null })) },
      )
      if (!isFramedImage(target)) items.push({ kind: 'item', label: 'Recortar', icon: <Crop size={16} />, disabled: locked, onClick: run(() => beginCrop()) })
      items.push({ kind: 'sep' })
    }
    if (txt && single) {
      items.push(
        {
          kind: 'item',
          label: 'Editar texto',
          icon: <Type size={16} />,
          disabled: locked,
          onClick: run(() => {
            canvas.setActiveObject(target)
            ;(target as IText).enterEditing()
            ;(target as IText).selectAll()
            canvas.requestRenderAll()
          }),
        },
        { kind: 'sep' },
      )
    }
    if (isActiveSelection(active)) items.push({ kind: 'item', label: 'Agrupar', icon: <GroupIcon size={16} />, hint: 'Ctrl+G', onClick: run(() => groupSelection(canvas)) })
    if (single && isGroup(target) && !isActiveSelection(target) && !['icon', 'chart', 'arrow'].includes(asAny(target).bambaType)) items.push({ kind: 'item', label: 'Desagrupar', icon: <Ungroup size={16} />, hint: 'Ctrl+Shift+G', onClick: run(() => ungroupSelection(canvas)) })
    items.push(
      { kind: 'item', label: 'Copiar estilo', icon: <Paintbrush size={16} />, onClick: run(() => { copyStyle(target); toast('Estilo copiado: haz clic derecho en otro elemento → Pegar estilo') }) },
      { kind: 'item', label: 'Pegar estilo', icon: <PaintbrushVertical size={16} />, disabled: !hasStyleClipboard() || locked, onClick: run(() => pasteStyle(canvas)) },
      { kind: 'sep' },
      { kind: 'item', label: locked ? 'Desbloquear' : 'Bloquear', icon: locked ? <Unlock size={16} /> : <Lock size={16} />, onClick: run(() => toggleLock(canvas)) },
      {
        kind: 'item',
        label: 'Renombrar capa…',
        icon: <Pencil size={16} />,
        onClick: run(() => {
          const n = prompt('Nombre de la capa', getName(target))
          if (n !== null) {
            asAny(target).set('name', n)
            fireModified(canvas, target)
            useEditor.getState().bump()
          }
        }),
      },
    )
    if (single) {
      const br = target.getBoundingRect()
      items.push({ kind: 'sep' }, { kind: 'item', label: `${getName(target)} · ${Math.round(br.width)}×${Math.round(br.height)} px`, disabled: true, onClick: () => {} })
    }
  }

  return (
    <div ref={ref} className="fade-in fixed z-[85]" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      <MenuList items={items} />
    </div>
  )
}

function MenuList({ items, sub }: { items: Item[]; sub?: boolean }) {
  const [openSub, setOpenSub] = useState<number | null>(null)
  return (
    <div className={`min-w-[220px] rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-xl ${sub ? '' : ''}`}>
      {items.map((it, i) => {
        if (it.kind === 'sep') return <div key={i} className="my-1 border-t border-slate-100" />
        if (it.kind === 'sub') {
          return (
            <div key={i} className="relative" onMouseEnter={() => setOpenSub(i)} onMouseLeave={() => setOpenSub(null)}>
              <button className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-100 ${openSub === i ? 'bg-slate-100' : ''}`} onClick={() => setOpenSub(openSub === i ? null : i)}>
                <span className="w-4 text-slate-500">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
              {openSub === i && (
                <div className="absolute left-full top-0 -ml-1 pl-1">
                  <MenuList items={it.items} sub />
                </div>
              )}
            </div>
          )
        }
        return (
          <button
            key={i}
            disabled={it.disabled}
            onClick={it.onClick}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-100 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent ${it.danger ? 'text-red-600' : ''}`}
          >
            <span className="w-4 text-slate-500">{it.icon}</span>
            <span className="flex-1 truncate">{it.label}</span>
            {it.hint && <span className="kbd ml-3">{it.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
