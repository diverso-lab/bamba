import { useMemo, useState } from 'react'
import { PRESET_CATEGORIES, SIZE_PRESETS } from '@/lib/presets'
import { cancelCropIfAny, commitCurrentPage, resizeDesign } from '@/lib/pages'
import { exportDesign, type ExportFormat } from '@/lib/export'
import { exportVideo } from '@/lib/videoExport'
import { useEditor } from '@/store/editor'
import { Modal } from './ui'
import { addChart, addQr, updateChart } from '@/lib/actions'
import { DEFAULT_CHART, type ChartData, type ChartType } from '@/lib/charts'
import type { FabricObject } from 'fabric'
import { Plus, Trash2 } from 'lucide-react'

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const design = useEditor((s) => s.design)!
  const pageIndex = useEditor((s) => s.pageIndex)
  const toast = useEditor((s) => s.toast)
  const [format, setFormat] = useState<ExportFormat | 'mp4' | 'gif' | 'webm'>('png')
  const [maxSide, setMaxSide] = useState(1080)
  const [fps, setFps] = useState(30)
  const [scale, setScale] = useState(1)
  const [quality, setQuality] = useState(0.92)
  const [transparent, setTransparent] = useState(false)
  const [pages, setPages] = useState<'current' | 'all'>(design.pages.length > 1 ? 'all' : 'current')
  const [progress, setProgress] = useState<string | null>(null)

  const isVideo = format === 'mp4' || format === 'gif' || format === 'webm'
  const run = async () => {
    try {
      cancelCropIfAny()
      commitCurrentPage()
      const d = useEditor.getState().design!
      setProgress('Preparando…')
      if (isVideo) {
        await exportVideo(d.name, d.pages, pageIndex, d.width, d.height, { format, fps, maxSide, pages }, (msg, frac) => setProgress(`${msg} ${Math.round(frac * 100)}%`))
        setProgress(null)
        onClose()
        return
      }
      await exportDesign(d.name, d.pages.map((p) => p.json), pageIndex, d.width, d.height, { format: format as ExportFormat, scale, quality, transparent, pages }, (i, n) => setProgress(`Renderizando página ${i} de ${n}…`))
      setProgress(null)
      onClose()
    } catch (e: any) {
      setProgress(null)
      toast(`Error al exportar: ${e.message}`, 'error')
    }
  }

  const formats: { id: ExportFormat | 'mp4' | 'gif' | 'webm'; label: string; desc: string }[] = [
    { id: 'png', label: 'PNG', desc: 'Alta calidad, admite transparencia' },
    { id: 'jpeg', label: 'JPG', desc: 'Archivo pequeño, sin transparencia' },
    { id: 'webp', label: 'WebP', desc: 'Moderno y ligero para web' },
    { id: 'pdf', label: 'PDF', desc: 'Documento con todas las páginas' },
    { id: 'svg', label: 'SVG', desc: 'Vectorial, editable' },
    { id: 'mp4', label: 'MP4 (vídeo)', desc: 'Con animaciones y vídeos, para redes' },
    { id: 'gif', label: 'GIF', desc: 'Animación en bucle, sin sonido' },
    { id: 'webm', label: 'WebM', desc: 'Vídeo ligero para web' },
  ]

  return (
    <Modal title="Descargar" onClose={onClose} width={480}>
      <label className="mb-1 block text-xs font-medium text-slate-600">Tipo de archivo</label>
      <div className="mb-4 grid grid-cols-1 gap-1.5">
        {formats.map((f) => (
          <button key={f.id} onClick={() => setFormat(f.id)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${format === f.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <span className="font-medium">{f.label}</span>
            <span className="text-xs text-slate-500">{f.desc}</span>
          </button>
        ))}
      </div>
      {isVideo && (
        <div className="mb-3 space-y-2">
          <label className="block text-xs font-medium text-slate-600">
            Resolución
            <select className="select mt-1 w-full" value={maxSide} onChange={(e) => setMaxSide(Number(e.target.value))}>
              <option value={720}>720p</option>
              <option value={1080}>1080p</option>
              <option value={1440}>1440p</option>
              <option value={1920}>1920 (máx.)</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Fotogramas por segundo
            <select className="select mt-1 w-full" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </label>
          <p className="text-[11px] text-slate-500">La grabación dura lo mismo que la presentación ({Math.round(design.pages.reduce((s, p) => s + (p.duration || 5000), 0) / 1000)} s en total). No cierres esta pestaña mientras se graba.</p>
        </div>
      )}
      {(format === 'png' || format === 'jpeg' || format === 'webp' || format === 'pdf') && (
        <div className="mb-3">
          <label className="mb-1 flex justify-between text-xs font-medium text-slate-600">
            <span>Tamaño</span>
            <span>
              {scale}× · {Math.round(design.width * scale)}×{Math.round(design.height * scale)} px
            </span>
          </label>
          <input type="range" className="range" min={0.25} max={4} step={0.25} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
        </div>
      )}
      {(format === 'jpeg' || format === 'webp') && (
        <div className="mb-3">
          <label className="mb-1 flex justify-between text-xs font-medium text-slate-600">
            <span>Calidad</span>
            <span>{Math.round(quality * 100)}%</span>
          </label>
          <input type="range" className="range" min={0.3} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
        </div>
      )}
      {(format === 'png' || format === 'svg') && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Fondo transparente
        </label>
      )}
      {design.pages.length > 1 && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Páginas</label>
          <div className="flex gap-2">
            <button onClick={() => setPages('all')} className={`btn ${pages === 'all' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100'}`}>
              Todas ({design.pages.length})
            </button>
            <button onClick={() => setPages('current')} className={`btn ${pages === 'current' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100'}`}>
              Solo la actual (pág. {pageIndex + 1})
            </button>
          </div>
        </div>
      )}
      <button className="btn-primary w-full justify-center py-2.5" onClick={run} disabled={!!progress}>
        {progress || 'Descargar'}
      </button>
    </Modal>
  )
}

export function ResizeDialog({ onClose }: { onClose: () => void }) {
  const design = useEditor((s) => s.design)!
  const [w, setW] = useState(design.width)
  const [h, setH] = useState(design.height)
  const [scaleContent, setScaleContent] = useState(true)
  const [cat, setCat] = useState(PRESET_CATEGORIES[0])
  const [q, setQ] = useState('')
  const list = useMemo(() => SIZE_PRESETS.filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : p.category === cat)), [cat, q])
  return (
    <Modal title="Redimensionar diseño" onClose={onClose} width={560}>
      <input className="input mb-3 w-full" placeholder="Buscar un tamaño…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {PRESET_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${cat === c ? 'bg-brand-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="mb-4 max-h-48 space-y-1 overflow-auto">
        {list.map((p) => (
          <button key={p.id} onClick={() => { setW(p.width); setH(p.height) }} className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm hover:bg-slate-50 ${w === p.width && h === p.height ? 'bg-brand-50 text-brand-700' : ''}`}>
            <span>{p.name}</span>
            <span className="text-xs text-slate-500">
              {p.width} × {p.height} px
            </span>
          </button>
        ))}
      </div>
      <div className="mb-3 flex items-end gap-3">
        <label className="text-xs text-slate-600">
          Ancho (px)
          <input type="number" className="input mt-1 block w-28" value={w} onChange={(e) => setW(Number(e.target.value))} />
        </label>
        <label className="text-xs text-slate-600">
          Alto (px)
          <input type="number" className="input mt-1 block w-28" value={h} onChange={(e) => setH(Number(e.target.value))} />
        </label>
        <button className="btn-secondary" onClick={() => { setW(h); setH(w) }}>
          Girar
        </button>
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={scaleContent} onChange={(e) => setScaleContent(e.target.checked)} /> Escalar el contenido al nuevo tamaño (redimensión mágica)
      </label>
      <button
        className="btn-primary w-full justify-center py-2.5"
        onClick={async () => {
          const W = Math.max(50, Math.min(10000, Math.round(w)))
          const H = Math.max(50, Math.min(10000, Math.round(h)))
          await resizeDesign(W, H, scaleContent)
          onClose()
        }}
      >
        Redimensionar a {w} × {h}
      </button>
    </Modal>
  )
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['Ctrl/⌘ + Z', 'Deshacer'],
    ['Ctrl/⌘ + Shift + Z', 'Rehacer'],
    ['Ctrl/⌘ + C / V', 'Copiar / pegar'],
    ['Ctrl/⌘ + D', 'Duplicar'],
    ['Ctrl/⌘ + A', 'Seleccionar todo'],
    ['Ctrl/⌘ + G / Shift+G', 'Agrupar / desagrupar'],
    ['Ctrl/⌘ + S', 'Guardar'],
    ['Ctrl/⌘ + rueda', 'Zoom'],
    ['Ctrl/⌘ + 0', 'Ajustar a la ventana'],
    ['Supr / Retroceso', 'Eliminar'],
    ['Flechas (+Shift)', 'Mover 1 px (10 px)'],
    ['T', 'Añadir texto'],
    ['R / C / L', 'Rectángulo / círculo / línea'],
    ['Doble clic', 'Editar texto / rellenar marco'],
    ['Esc', 'Deseleccionar'],
  ]
  return (
    <Modal title="Atajos de teclado" onClose={onClose} width={420}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-3">
                <span className="kbd">{k}</span>
              </td>
              <td className="py-1.5 text-slate-600">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}

// ----------------------------------------------------------------------------
// Gráficos
// ----------------------------------------------------------------------------
export function ChartDialog({ onClose, target }: { onClose: () => void; target?: FabricObject }) {
  const initial: ChartData = (target as any)?.chartData ? { ...DEFAULT_CHART, ...(target as any).chartData } : DEFAULT_CHART
  const [data, setData] = useState<ChartData>(JSON.parse(JSON.stringify(initial)))
  const types: { id: ChartType; label: string }[] = [
    { id: 'column', label: 'Columnas' },
    { id: 'bar', label: 'Barras' },
    { id: 'line', label: 'Líneas' },
    { id: 'pie', label: 'Tarta' },
    { id: 'donut', label: 'Anillo' },
  ]
  const setRow = (i: number, k: 'label' | 'value', v: string) => {
    const labels = data.labels.slice()
    const values = data.values.slice()
    if (k === 'label') labels[i] = v
    else values[i] = Number(v) || 0
    setData({ ...data, labels, values })
  }
  return (
    <Modal title={target ? 'Editar gráfico' : 'Añadir gráfico'} onClose={onClose} width={520}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button key={t.id} onClick={() => setData({ ...data, type: t.id })} className={`btn ${data.type === t.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mb-3 max-h-56 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1 text-left">Etiqueta</th>
              <th className="px-2 py-1 text-left">Valor</th>
              <th className="px-2 py-1">Color</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.labels.map((l, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="p-1">
                  <input className="input w-full py-0.5" value={l} onChange={(e) => setRow(i, 'label', e.target.value)} />
                </td>
                <td className="p-1">
                  <input type="number" className="input w-24 py-0.5" value={data.values[i]} onChange={(e) => setRow(i, 'value', e.target.value)} />
                </td>
                <td className="p-1 text-center">
                  <input
                    type="color"
                    className="h-7 w-9 cursor-pointer rounded border border-slate-200 p-0.5"
                    value={data.colors[i % data.colors.length]}
                    onChange={(e) => {
                      const colors = data.colors.slice()
                      while (colors.length <= i) colors.push(colors[colors.length % data.colors.length])
                      colors[i] = e.target.value
                      setData({ ...data, colors })
                    }}
                  />
                </td>
                <td className="p-1">
                  <button
                    className="icon-btn h-7 w-7"
                    onClick={() => setData({ ...data, labels: data.labels.filter((_, j) => j !== i), values: data.values.filter((_, j) => j !== i) })}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn-secondary mb-3" onClick={() => setData({ ...data, labels: [...data.labels, `Dato ${data.labels.length + 1}`], values: [...data.values, 10] })}>
        <Plus size={14} /> Añadir fila
      </button>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={data.showValues} onChange={(e) => setData({ ...data, showValues: e.target.checked })} /> Mostrar valores
      </label>
      <button
        className="btn-primary w-full justify-center py-2.5"
        onClick={() => {
          if (target) updateChart(target, data)
          else addChart(data)
          onClose()
        }}
      >
        {target ? 'Actualizar gráfico' : 'Añadir al diseño'}
      </button>
    </Modal>
  )
}

export function QrDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('https://')
  const [dark, setDark] = useState('#000000')
  const [light, setLight] = useState('#ffffff')
  return (
    <Modal title="Generador de códigos QR" onClose={onClose} width={420}>
      <label className="mb-3 block text-sm">
        URL o texto
        <input className="input mt-1 w-full" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </label>
      <div className="mb-4 flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          Color <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          Fondo <input type="color" value={light} onChange={(e) => setLight(e.target.value)} />
        </label>
      </div>
      <button className="btn-primary w-full justify-center py-2.5" onClick={async () => { await addQr(text, dark, light); onClose() }}>
        Generar QR
      </button>
    </Modal>
  )
}
