import { useEffect, useMemo, useState } from 'react'
import { applyTemplate, TEMPLATES, TEMPLATE_CATEGORIES, templatePreview, type Template } from '@/lib/templates'
import { useEditor } from '@/store/editor'
import { SearchInput, Tabs } from '@/components/ui'
import { isText, fireModified, isImage } from '@/lib/fabricUtils'
import { ensureFont } from '@/lib/fonts'
import { addPage } from '@/lib/pages'

const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Violeta', colors: ['#0f172a', '#f8fafc', '#7c3aed', '#a78bfa', '#ec4899'] },
  { name: 'Océano', colors: ['#f0f9ff', '#0c4a6e', '#0ea5e9', '#38bdf8', '#0369a1'] },
  { name: 'Bosque', colors: ['#f7fee7', '#14532d', '#16a34a', '#84cc16', '#365314'] },
  { name: 'Atardecer', colors: ['#fff7ed', '#7c2d12', '#f97316', '#fb923c', '#ea580c'] },
  { name: 'Mono', colors: ['#ffffff', '#111827', '#374151', '#9ca3af', '#e5e7eb'] },
  { name: 'Caramelo', colors: ['#fdf2f8', '#831843', '#ec4899', '#f9a8d4', '#be185d'] },
  { name: 'Arena', colors: ['#fefce8', '#422006', '#ca8a04', '#facc15', '#a16207'] },
  { name: 'Noche neón', colors: ['#020617', '#e2e8f0', '#22d3ee', '#a3e635', '#f472b6'] },
]

const FONT_PAIRS: { name: string; heading: string; body: string }[] = [
  { name: 'Moderno', heading: 'Poppins', body: 'Inter' },
  { name: 'Editorial', heading: 'Playfair Display', body: 'Lato' },
  { name: 'Impacto', heading: 'Bebas Neue', body: 'Montserrat' },
  { name: 'Elegante', heading: 'Cormorant Garamond', body: 'Raleway' },
  { name: 'Divertido', heading: 'Fredoka', body: 'Nunito' },
  { name: 'Clásico', heading: 'DM Serif Display', body: 'Source Serif 4' },
  { name: 'Manuscrito', heading: 'Pacifico', body: 'Quicksand' },
  { name: 'Técnico', heading: 'Space Grotesk', body: 'Roboto Mono' },
]

export default function DesignPanel() {
  const [tab, setTab] = useState<'templates' | 'styles'>('templates')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const design = useEditor((s) => s.design)!
  const canvas = useEditor((s) => s.canvas)
  const history = useEditor((s) => s.history)
  const toast = useEditor((s) => s.toast)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return TEMPLATES.filter((t) => (!cat || t.category === cat) && (!s || t.name.toLowerCase().includes(s) || t.tags.some((x) => x.includes(s)) || t.category.toLowerCase().includes(s)))
  }, [q, cat])

  const apply = async (tpl: Template, asNewPage: boolean) => {
    if (!canvas) return
    const hasContent = canvas.getObjects().length > 0
    if (asNewPage || (hasContent && !confirm('¿Reemplazar el contenido de esta página con la plantilla? (Cancelar = añadir como página nueva)'))) {
      await addPage()
    }
    const c = useEditor.getState().canvas!
    history?.pause()
    await applyTemplate(c, tpl, design.width, design.height)
    history?.resume(true)
    useEditor.getState().bump()
  }

  const applyPalette = (colors: string[]) => {
    if (!canvas) return
    const [bg, text, ...accents] = colors
    canvas.backgroundColor = bg
    let i = 0
    canvas.getObjects().forEach((o) => {
      if (isText(o)) {
        o.set('fill', text)
        ;(o as any).textBaseFill = text
      } else if (!isImage(o) && !(o as any).isFrame) {
        if (o.fill && o.fill !== 'transparent') o.set('fill', accents[i++ % accents.length])
        if (o.stroke && (!o.fill || o.fill === 'transparent')) o.set('stroke', accents[i++ % accents.length])
      }
    })
    canvas.requestRenderAll()
    fireModified(canvas)
    toast('Paleta aplicada')
  }

  const applyFonts = async (pair: (typeof FONT_PAIRS)[number]) => {
    if (!canvas) return
    await Promise.all([ensureFont(pair.heading), ensureFont(pair.body)])
    const texts = canvas.getObjects().filter(isText) as any[]
    if (!texts.length) return
    const maxSize = Math.max(...texts.map((t) => t.fontSize))
    texts.forEach((t) => {
      t.set('fontFamily', t.fontSize >= maxSize * 0.6 ? pair.heading : pair.body)
      t.initDimensions?.()
    })
    canvas.requestRenderAll()
    fireModified(canvas)
    toast('Fuentes aplicadas')
  }

  return (
    <div>
      <SearchInput value={q} onChange={setQ} placeholder="Buscar plantillas" />
      <div className="mt-3">
        <Tabs tabs={[{ id: 'templates', label: 'Plantillas' }, { id: 'styles', label: 'Estilos' }]} value={tab} onChange={setTab} />
      </div>
      {tab === 'templates' && (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setCat(null)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${!cat ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
              Todas
            </button>
            {TEMPLATE_CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${cat === c ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {list.map((t) => (
              <TemplateThumb key={t.id} tpl={t} W={design.width} H={design.height} onApply={() => apply(t, false)} onNewPage={() => apply(t, true)} />
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Las plantillas se adaptan automáticamente al tamaño de tu diseño ({design.width}×{design.height}). Clic derecho = añadir como página nueva.</p>
        </>
      )}
      {tab === 'styles' && (
        <>
          <h4 className="mb-2 text-sm font-semibold">Paletas de colores</h4>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {PALETTES.map((p) => (
              <button key={p.name} onClick={() => applyPalette(p.colors)} className="card overflow-hidden text-left hover:border-brand-400">
                <div className="flex h-10">
                  {p.colors.map((c) => (
                    <span key={c} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
                <div className="px-2 py-1 text-xs">{p.name}</div>
              </button>
            ))}
          </div>
          <h4 className="mb-2 text-sm font-semibold">Combinaciones de fuentes</h4>
          <div className="space-y-2">
            {FONT_PAIRS.map((p) => (
              <button key={p.name} onClick={() => applyFonts(p)} className="card flex w-full items-center justify-between px-3 py-2 text-left hover:border-brand-400">
                <div>
                  <div className="text-lg leading-tight" style={{ fontFamily: p.heading }}>
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-500" style={{ fontFamily: p.body }}>
                    {p.heading} + {p.body}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function TemplateThumb({ tpl, W, H, onApply, onNewPage }: { tpl: Template; W: number; H: number; onApply: () => void; onNewPage: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    templatePreview(tpl, W, H, 300)
      .then((u) => alive && setSrc(u))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [tpl, W, H])
  return (
    <button
      onClick={onApply}
      onContextMenu={(e) => {
        e.preventDefault()
        onNewPage()
      }}
      className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left hover:border-brand-400 hover:shadow"
      title={`${tpl.name} · clic derecho: añadir como página`}
    >
      <div className="flex items-center justify-center overflow-hidden" style={{ aspectRatio: `${W}/${H}`, background: tpl.swatch[0] }}>
        {src && <img src={src} alt={tpl.name} className="h-full w-full object-cover" />}
      </div>
      <div className="truncate px-2 py-1 text-xs">{tpl.name}</div>
    </button>
  )
}
