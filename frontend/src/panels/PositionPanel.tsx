import { useState } from 'react'
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceAround, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceAround, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Eye, EyeOff, Image as ImageIcon, Lock, Shapes, Type, Unlock, Group as GroupIcon, BarChart3, QrCode, Frame, Pencil } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { alignSelection, bringForward, bringToFront, distributeSelection, fireModified, getName, isFrame, isFramedImage, isGroup, isImage, isLocked, isText, sendBackward, sendToBack, setLocked, asAny } from '@/lib/fabricUtils'
import { IconBtn, NumberField, Tabs } from '@/components/ui'
import type { FabricObject } from 'fabric'
import { ActiveSelection } from 'fabric'

export default function PositionPanel() {
  const [tab, setTab] = useState<'arrange' | 'layers'>('arrange')
  return (
    <div>
      <Tabs tabs={[{ id: 'arrange', label: 'Organizar' }, { id: 'layers', label: 'Capas' }]} value={tab} onChange={setTab} />
      {tab === 'arrange' ? <Arrange /> : <Layers />}
    </div>
  )
}

function Arrange() {
  const canvas = useEditor((s) => s.canvas)
  const selection = useEditor((s) => s.selection)
  const design = useEditor((s) => s.design)!
  const version = useEditor((s) => s.version)
  void version
  const has = selection.length > 0
  const multi = selection.length > 1
  const active = canvas?.getActiveObject()
  const br = active?.getBoundingRect()

  const setGeom = (patch: { x?: number; y?: number; w?: number; h?: number; angle?: number }) => {
    if (!canvas || !active || !br) return
    if (patch.x !== undefined) active.set('left', active.left + (patch.x - br.left))
    if (patch.y !== undefined) active.set('top', active.top + (patch.y - br.top))
    if (patch.w !== undefined && br.width > 0) active.set('scaleX', (active.scaleX || 1) * (patch.w / br.width))
    if (patch.h !== undefined && br.height > 0) active.set('scaleY', (active.scaleY || 1) * (patch.h / br.height))
    if (patch.angle !== undefined) active.rotate(patch.angle)
    active.setCoords()
    canvas.requestRenderAll()
    fireModified(canvas, active)
  }

  const Btn = ({ title, onClick, children, disabled }: any) => (
    <button title={title} onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 p-2 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40">
      {children}
    </button>
  )
  const W = design.width
  const H = design.height

  return (
    <div className={has ? '' : 'pointer-events-none opacity-50'}>
      <h4 className="mb-2 text-sm font-semibold">Disposición</h4>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        <Btn title="Adelante" onClick={() => canvas && bringForward(canvas)}>
          <ArrowUp size={16} /> Adelante
        </Btn>
        <Btn title="Atrás" onClick={() => canvas && sendBackward(canvas)}>
          <ArrowDown size={16} /> Atrás
        </Btn>
        <Btn title="Traer al frente" onClick={() => canvas && bringToFront(canvas)}>
          <ArrowUpToLine size={16} /> Al frente
        </Btn>
        <Btn title="Enviar al fondo" onClick={() => canvas && sendToBack(canvas)}>
          <ArrowDownToLine size={16} /> Al fondo
        </Btn>
      </div>
      <h4 className="mb-2 text-sm font-semibold">{multi ? 'Alinear elementos' : 'Alinear con la página'}</h4>
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        <Btn title="Izquierda" onClick={() => canvas && alignSelection(canvas, 'left', W, H)}>
          <AlignStartVertical size={16} /> Izquierda
        </Btn>
        <Btn title="Centrar" onClick={() => canvas && alignSelection(canvas, 'centerH', W, H)}>
          <AlignCenterVertical size={16} /> Centro
        </Btn>
        <Btn title="Derecha" onClick={() => canvas && alignSelection(canvas, 'right', W, H)}>
          <AlignEndVertical size={16} /> Derecha
        </Btn>
        <Btn title="Arriba" onClick={() => canvas && alignSelection(canvas, 'top', W, H)}>
          <AlignStartHorizontal size={16} /> Arriba
        </Btn>
        <Btn title="Medio" onClick={() => canvas && alignSelection(canvas, 'centerV', W, H)}>
          <AlignCenterHorizontal size={16} /> Medio
        </Btn>
        <Btn title="Abajo" onClick={() => canvas && alignSelection(canvas, 'bottom', W, H)}>
          <AlignEndHorizontal size={16} /> Abajo
        </Btn>
      </div>
      {selection.length >= 3 && (
        <>
          <h4 className="mb-2 text-sm font-semibold">Distribuir</h4>
          <div className="mb-4 grid grid-cols-2 gap-1.5">
            <Btn onClick={() => canvas && distributeSelection(canvas, 'h')}>
              <AlignHorizontalSpaceAround size={16} /> Horizontal
            </Btn>
            <Btn onClick={() => canvas && distributeSelection(canvas, 'v')}>
              <AlignVerticalSpaceAround size={16} /> Vertical
            </Btn>
          </div>
        </>
      )}
      <h4 className="mb-2 text-sm font-semibold">Avanzado</h4>
      {br && active && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={br.left} onChange={(v) => setGeom({ x: v })} />
          <NumberField label="Y" value={br.top} onChange={(v) => setGeom({ y: v })} />
          <NumberField label="An" value={br.width} min={1} onChange={(v) => setGeom({ w: v })} />
          <NumberField label="Al" value={br.height} min={1} onChange={(v) => setGeom({ h: v })} />
          <NumberField label="Rot" value={active.angle || 0} suffix="°" onChange={(v) => setGeom({ angle: v })} />
        </div>
      )}
      {!has && <p className="mt-3 text-xs text-slate-500">Selecciona un elemento para organizarlo.</p>}
    </div>
  )
}

function iconFor(o: FabricObject) {
  const a = asAny(o)
  if (a.bambaType === 'chart') return <BarChart3 size={14} />
  if (a.bambaType === 'qr') return <QrCode size={14} />
  if (isFrame(o) || isFramedImage(o)) return <Frame size={14} />
  if (isText(o)) return <Type size={14} />
  if (isImage(o)) return <ImageIcon size={14} />
  if (isGroup(o)) return <GroupIcon size={14} />
  if (o.isType('path')) return <Pencil size={14} />
  return <Shapes size={14} />
}

function Layers() {
  const canvas = useEditor((s) => s.canvas)
  const version = useEditor((s) => s.version)
  const selection = useEditor((s) => s.selection)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  void version
  if (!canvas) return null
  const objs = canvas.getObjects().slice().reverse()

  const select = (o: FabricObject, e: React.MouseEvent) => {
    if (e.shiftKey && selection.length) {
      const set = new Set(selection)
      if (set.has(o)) set.delete(o)
      else set.add(o)
      canvas.discardActiveObject()
      const arr = Array.from(set)
      if (arr.length === 1) canvas.setActiveObject(arr[0])
      else if (arr.length > 1) canvas.setActiveObject(new ActiveSelection(arr, { canvas }))
    } else {
      canvas.setActiveObject(o)
    }
    canvas.requestRenderAll()
  }

  const rename = (o: FabricObject) => {
    const n = prompt('Nombre de la capa', getName(o))
    if (n !== null) {
      asAny(o).set('name', n)
      fireModified(canvas, o)
      useEditor.getState().bump()
    }
  }

  const onDrop = (toVisualIdx: number) => {
    if (dragIdx === null || dragIdx === toVisualIdx) return
    const list = canvas.getObjects()
    const fromReal = list.length - 1 - dragIdx
    const toReal = list.length - 1 - toVisualIdx
    const obj = list[fromReal]
    canvas.moveObjectTo(obj, toReal)
    canvas.requestRenderAll()
    fireModified(canvas, obj)
    setDragIdx(null)
  }

  return (
    <div>
      {objs.length === 0 && <p className="text-xs text-slate-500">La página está vacía.</p>}
      <ul className="space-y-0.5">
        {objs.map((o, i) => {
          const sel = selection.includes(o)
          const locked = isLocked(o)
          return (
            <li
              key={asAny(o).id || i}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onClick={(e) => select(o, e)}
              onDoubleClick={() => rename(o)}
              className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${sel ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50'} ${o.visible === false ? 'opacity-50' : ''}`}
            >
              <span className="text-slate-500">{iconFor(o)}</span>
              <span className="flex-1 truncate">{getName(o)}</span>
              <span className="text-[10px] text-slate-400">{Math.round(o.getScaledWidth())}×{Math.round(o.getScaledHeight())}</span>
              <IconBtn
                size="sm"
                title={o.visible === false ? 'Mostrar' : 'Ocultar'}
                onClick={(e) => {
                  e.stopPropagation()
                  o.set('visible', o.visible === false ? true : false)
                  canvas.requestRenderAll()
                  fireModified(canvas, o)
                }}
              >
                {o.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
              </IconBtn>
              <IconBtn
                size="sm"
                title={locked ? 'Desbloquear' : 'Bloquear'}
                className={locked ? '' : 'opacity-0 group-hover:opacity-100'}
                onClick={(e) => {
                  e.stopPropagation()
                  setLocked(o, !locked)
                  canvas.requestRenderAll()
                  fireModified(canvas, o)
                }}
              >
                {locked ? <Lock size={14} /> : <Unlock size={14} />}
              </IconBtn>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">Arrastra para reordenar · Doble clic para renombrar · Shift+clic para selección múltiple.</p>
    </div>
  )
}
