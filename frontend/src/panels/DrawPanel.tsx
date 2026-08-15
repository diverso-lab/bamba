import { useEffect, useState } from 'react'
import { Eraser, Highlighter, Pen, PenLine } from 'lucide-react'
import { setDrawingMode, updateBrush } from '@/lib/actions'
import { useEditor } from '@/store/editor'
import { ColorPicker, Slider } from '@/components/ui'
import { deleteSelection } from '@/lib/fabricUtils'

const TOOLS = [
  { id: 'pen', label: 'Bolígrafo', icon: Pen, width: 6, opacity: 1 },
  { id: 'marker', label: 'Rotulador', icon: PenLine, width: 16, opacity: 1 },
  { id: 'highlighter', label: 'Resaltador', icon: Highlighter, width: 28, opacity: 0.4 },
]

export default function DrawPanel() {
  const drawing = useEditor((s) => s.drawing)
  const canvas = useEditor((s) => s.canvas)
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#111827')
  const [width, setWidth] = useState(6)
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    if (drawing) updateBrush({ color, width, opacity })
  }, [color, width, opacity, drawing])

  useEffect(() => {
    return () => setDrawingMode(false)
  }, [])

  const pick = (t: (typeof TOOLS)[number]) => {
    setTool(t.id)
    setWidth(t.width)
    setOpacity(t.opacity)
    setDrawingMode(true, { color, width: t.width, opacity: t.opacity })
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {TOOLS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => pick(t)} className={`card flex flex-col items-center gap-1 p-3 text-xs hover:border-brand-400 ${drawing && tool === t.id ? 'border-brand-500 bg-brand-50' : ''}`}>
              <Icon size={20} />
              {t.label}
            </button>
          )
        })}
      </div>
      <button className={`mb-4 w-full ${drawing ? 'btn-secondary' : 'btn-primary'} justify-center`} onClick={() => setDrawingMode(!drawing, { color, width, opacity })}>
        {drawing ? 'Terminar de dibujar' : 'Empezar a dibujar'}
      </button>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="w-16 text-slate-600">Color</span>
        <ColorPicker value={color} onChange={(c) => typeof c === 'string' && setColor(c)} />
        <div className="ml-auto flex gap-1">
          {['#111827', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#7c3aed', '#ffffff'].map((c) => (
            <button key={c} className={`h-6 w-6 rounded-full border ${color === c ? 'ring-2 ring-brand-500' : 'border-slate-200'}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <Slider label="Grosor" value={width} min={1} max={80} onChange={setWidth} />
      <Slider label="Opacidad" value={Math.round(opacity * 100)} min={5} max={100} onChange={(v) => setOpacity(v / 100)} />
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <div className="mb-1 flex items-center gap-1 font-medium">
          <Eraser size={14} /> Borrar trazos
        </div>
        Termina de dibujar, selecciona el trazo y pulsa <span className="kbd">Supr</span>.
        <button className="btn-secondary mt-2 w-full justify-center" onClick={() => canvas && deleteSelection(canvas)}>
          Eliminar trazo seleccionado
        </button>
      </div>
    </div>
  )
}
