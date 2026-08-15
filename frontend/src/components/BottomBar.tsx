import { useState } from 'react'
import { Grid3X3, Maximize, Minus, Plus, MonitorPlay, X, Copy, Trash2 } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { addPage, deletePage, duplicatePage, switchPage } from '@/lib/pages'
import { IconBtn } from './ui'

export default function BottomBar() {
  const zoom = useEditor((s) => s.zoom)
  const set = useEditor((s) => s.set)
  const design = useEditor((s) => s.design)!
  const pageIndex = useEditor((s) => s.pageIndex)
  const version = useEditor((s) => s.version)
  const [strip, setStrip] = useState(false)
  void version

  const fit = () => {
    const el = document.querySelector('[data-bg="1"]')?.parentElement
    if (!el) return
    const z = Math.min((el.clientWidth - 96) / design.width, (el.clientHeight - 120) / design.height, 3)
    set({ zoom: Math.max(0.05, Math.round(z * 1000) / 1000), zoomMode: 'fit' })
  }
  const setZoom = (z: number) => set({ zoom: Math.max(0.05, Math.min(5, z)), zoomMode: 'manual' })

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white">
      {strip && (
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-2">
          {design.pages.map((p, i) => (
            <div key={p.id} className="group relative shrink-0">
              <button
                onClick={() => switchPage(i)}
                className={`flex h-20 items-center justify-center overflow-hidden rounded-md border-2 bg-white ${i === pageIndex ? 'border-brand-500' : 'border-slate-200 hover:border-slate-400'}`}
                style={{ aspectRatio: `${design.width}/${design.height}` }}
                title={`Página ${i + 1}`}
              >
                {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-contain" /> : <span className="text-[10px] text-slate-400">{i + 1}</span>}
              </button>
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">{i + 1}</span>
              <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                <button className="rounded bg-white/90 p-0.5 shadow" title="Duplicar" onClick={() => void duplicatePage(i)}>
                  <Copy size={12} />
                </button>
                <button className="rounded bg-white/90 p-0.5 shadow" title="Eliminar" onClick={() => void deletePage(i)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => void addPage(design.pages.length - 1)} className="flex h-20 w-16 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-700" title="Añadir página">
            <Plus size={18} />
          </button>
        </div>
      )}
      <div className="flex h-10 items-center gap-2 px-3 text-xs text-slate-600">
        <button className="btn-ghost text-xs" onClick={() => setStrip(!strip)}>
          {strip ? <X size={14} /> : <Grid3X3 size={14} />} Páginas ({design.pages.length})
        </button>
        <span>
          Página {pageIndex + 1} / {design.pages.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn size="sm" title="Alejar" onClick={() => setZoom(zoom / 1.2)}>
            <Minus size={14} />
          </IconBtn>
          <input type="range" className="range w-32" min={5} max={300} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} />
          <IconBtn size="sm" title="Acercar" onClick={() => setZoom(zoom * 1.2)}>
            <Plus size={14} />
          </IconBtn>
          <button className="w-12 rounded px-1 py-0.5 text-right hover:bg-slate-100" onClick={fit} title="Ajustar a la ventana (Ctrl+0)">
            {Math.round(zoom * 100)}%
          </button>
          <IconBtn size="sm" title="Ajustar" onClick={fit}>
            <Maximize size={14} />
          </IconBtn>
          <IconBtn size="sm" title="Presentar" onClick={() => set({ present: true })}>
            <MonitorPlay size={14} />
          </IconBtn>
        </div>
      </div>
    </div>
  )
}
