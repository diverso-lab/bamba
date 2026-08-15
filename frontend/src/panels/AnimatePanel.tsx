import { useState } from 'react'
import { Play } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { ANIMATIONS, type AnimSpec, type AnimType } from '@/lib/animation'
import { fireModified, asAny } from '@/lib/fabricUtils'
import { scheduleSave } from '@/lib/pages'
import { Slider, Tabs } from '@/components/ui'

export default function AnimatePanel() {
  const canvas = useEditor((s) => s.canvas)
  const selection = useEditor((s) => s.selection)
  const design = useEditor((s) => s.design)!
  const pageIndex = useEditor((s) => s.pageIndex)
  const set = useEditor((s) => s.set)
  const version = useEditor((s) => s.version)
  const [tab, setTab] = useState<'element' | 'page'>(selection.length ? 'element' : 'page')
  const [, force] = useState(0)
  void version
  const page = design.pages[pageIndex]
  const pageAnim: AnimSpec = (page.anim as AnimSpec) || { type: 'none', duration: 800, delay: 0 }
  const pageDuration = page.duration || 5000
  const first = selection[0]
  const elAnim: AnimSpec = (first && (asAny(first).anim as AnimSpec)) || { type: 'none', duration: 800, delay: 0 }

  const setElAnim = (patch: Partial<AnimSpec>) => {
    if (!canvas) return
    selection.forEach((o) => {
      const cur = (asAny(o).anim as AnimSpec) || { type: 'none', duration: 800, delay: 0 }
      asAny(o).set('anim', { ...cur, ...patch })
    })
    fireModified(canvas)
    force((x) => x + 1)
  }
  const setPage = (patch: Partial<{ anim: AnimSpec | null; duration: number }>) => {
    const pages = design.pages.slice()
    pages[pageIndex] = { ...pages[pageIndex], ...patch }
    set({ design: { ...design, pages } })
    scheduleSave(500)
    force((x) => x + 1)
  }
  const preview = () => set({ present: true })

  const Grid = ({ value, onPick }: { value: AnimType; onPick: (t: AnimType) => void }) => (
    <div className="grid grid-cols-3 gap-1.5">
      {ANIMATIONS.map((a) => (
        <button key={a.id} onClick={() => onPick(a.id)} title={a.desc} className={`rounded-lg border p-2 text-center text-xs hover:bg-slate-50 ${value === a.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
          <span className={`anim-demo anim-${a.id} mx-auto mb-1 block h-6 w-6 rounded bg-brand-500`} />
          {a.label}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      <h3 className="mb-2 text-base font-semibold">Animar</h3>
      <Tabs tabs={[{ id: 'element', label: 'Elemento' }, { id: 'page', label: 'Página' }]} value={tab} onChange={setTab} />
      {tab === 'element' ? (
        !first ? (
          <p className="text-sm text-slate-500">Selecciona uno o varios elementos para animarlos.</p>
        ) : (
          <>
            <Grid value={elAnim.type} onPick={(t) => setElAnim({ type: t })} />
            {elAnim.type !== 'none' && (
              <div className="mt-3">
                <Slider label="Duración (ms)" value={elAnim.duration} min={100} max={4000} step={50} onChange={(v) => setElAnim({ duration: v })} />
                <Slider label="Retardo (ms)" value={elAnim.delay} min={0} max={8000} step={50} onChange={(v) => setElAnim({ delay: v })} />
              </div>
            )}
          </>
        )
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">La animación de página se aplica a todos los elementos sin animación propia (con un pequeño escalonado).</p>
          <Grid value={pageAnim.type as AnimType} onPick={(t) => setPage({ anim: t === 'none' ? null : { ...pageAnim, type: t } })} />
          {pageAnim.type !== 'none' && (
            <div className="mt-3">
              <Slider label="Duración (ms)" value={pageAnim.duration} min={100} max={4000} step={50} onChange={(v) => setPage({ anim: { ...pageAnim, duration: v } })} />
            </div>
          )}
          <div className="mt-3">
            <Slider label="Duración de la página (s)" value={pageDuration / 1000} min={1} max={30} step={0.5} onChange={(v) => setPage({ duration: Math.round(v * 1000) })} />
          </div>
        </>
      )}
      <button className="btn-secondary mt-4 w-full justify-center" onClick={preview}>
        <Play size={14} /> Previsualizar (Presentar)
      </button>
      <p className="mt-3 text-[11px] text-slate-400">Las animaciones se ven en «Presentar» y al descargar como vídeo (MP4/GIF/WebM).</p>
    </div>
  )
}
