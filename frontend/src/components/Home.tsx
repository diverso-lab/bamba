import { useEffect, useMemo, useState } from 'react'
import { Copy, FileText, Image as ImageIcon, LayoutTemplate, MonitorPlay, MoreVertical, Plus, Presentation, Printer, Search, Share2, Sparkles, Trash2, Video } from 'lucide-react'
import { api } from '@/lib/api'
import { PRESET_CATEGORIES, SIZE_PRESETS, type SizePreset } from '@/lib/presets'
import { TEMPLATES, TEMPLATE_CATEGORIES, templatePreview } from '@/lib/templates'
import type { DesignMeta } from '@/lib/types'
import { navigate } from '@/App'
import { useEditor } from '@/store/editor'
import { Modal } from './ui'
import UserMenu from './UserMenu'
import { useAuth } from '@/store/auth'

const QUICK: { label: string; icon: any; preset: string }[] = [
  { label: 'Instagram', icon: Share2, preset: 'ig-post' },
  { label: 'Historia', icon: ImageIcon, preset: 'ig-story' },
  { label: 'Presentación', icon: Presentation, preset: 'presentation' },
  { label: 'Documento A4', icon: FileText, preset: 'a4-portrait' },
  { label: 'Póster', icon: Printer, preset: 'poster' },
  { label: 'YouTube', icon: Video, preset: 'yt-thumb' },
  { label: 'Tarjeta', icon: LayoutTemplate, preset: 'business-card' },
  { label: 'Pizarra', icon: MonitorPlay, preset: 'whiteboard' },
]

export default function Home() {
  const [designs, setDesigns] = useState<DesignMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [view, setView] = useState<'home' | 'projects' | 'templates'>('home')
  const [sort, setSort] = useState<'recent' | 'name'>('recent')
  const [tplCat, setTplCat] = useState<string | null>(null)
  const toast = useEditor((s) => s.toast)
  const user = useAuth((s) => s.user)

  const load = async () => {
    setLoading(true)
    try {
      setDesigns(await api.listDesigns())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const createFrom = async (p: SizePreset | { name: string; width: number; height: number }, templateId?: string) => {
    try {
      let pages: any = undefined
      if (templateId) {
        const tpl = TEMPLATES.find((t) => t.id === templateId)
        if (tpl) {
          // construimos la página con la plantilla usando un StaticCanvas para serializar
          const { StaticCanvas } = await import('fabric')
          const { makeGradient, CUSTOM_PROPS } = await import('@/lib/fabricUtils')
          const { background, objects } = tpl.build(p.width, p.height)
          const sc = new StaticCanvas(undefined, { width: p.width, height: p.height })
          sc.backgroundColor = typeof background === 'string' ? background : (makeGradient(background, p.width, p.height) as any)
          objects.forEach((o) => sc.add(o))
          pages = [{ id: Math.random().toString(36).slice(2, 10), json: sc.toObject(CUSTOM_PROPS as any), thumbnail: null }]
          sc.dispose()
        }
      }
      const d = await api.createDesign({ name: p.name, width: p.width, height: p.height, pages })
      navigate(`/design/${d.id}`)
    } catch (e: any) {
      toast(`No se pudo crear el diseño: ${e.message}`, 'error')
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return designs
    return designs.filter((d) => d.name.toLowerCase().includes(s))
  }, [designs, q])

  const presetsFiltered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return SIZE_PRESETS.filter((p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s))
  }, [q])

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-slate-200 bg-white/90 px-5 backdrop-blur">
        <Logo />
        <nav className="ml-4 hidden gap-1 text-sm md:flex">
          {(
            [
              ['home', 'Inicio'],
              ['projects', 'Proyectos'],
              ['templates', 'Plantillas'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} className={`rounded-md px-3 py-1.5 ${view === id ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button className="btn-primary" onClick={() => setCustomOpen(true)}>
            <Plus size={16} /> Crear un diseño
          </button>
          <UserMenu />
        </div>
      </header>

      {view === 'projects' && (
        <section className="mx-auto max-w-6xl px-5 pt-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Proyectos</h1>
            <span className="text-sm text-slate-500">{designs.length} diseño{designs.length === 1 ? '' : 's'}</span>
            <div className="ml-auto flex items-center gap-2">
              <input className="input w-64" placeholder="Buscar en tus proyectos" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                <option value="recent">Más recientes</option>
                <option value="name">Nombre</option>
              </select>
              <button className="btn-primary" onClick={() => setCustomOpen(true)}>
                <Plus size={16} /> Nuevo
              </button>
            </div>
          </div>
          <DesignGrid designs={[...filtered].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : (b.updatedAt || 0) - (a.updatedAt || 0)))} loading={loading} error={error} menuFor={menuFor} setMenuFor={setMenuFor} reload={load} />
        </section>
      )}
      {view === 'templates' && (
        <section className="mx-auto max-w-6xl px-5 pt-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Plantillas</h1>
            <input className="input ml-auto w-64" placeholder="Buscar plantillas" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setTplCat(null)} className={`rounded-full px-3 py-1 text-sm ${!tplCat ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
              Todas
            </button>
            {TEMPLATE_CATEGORIES.map((c) => (
              <button key={c} onClick={() => setTplCat(c)} className={`rounded-full px-3 py-1 text-sm ${tplCat === c ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 pb-10 sm:grid-cols-3 lg:grid-cols-4">
            {TEMPLATES.filter((t) => (!tplCat || t.category === tplCat) && (!q || t.name.toLowerCase().includes(q.toLowerCase()) || t.tags.some((x) => x.includes(q.toLowerCase())))).map((t) => (
              <TemplateCard key={t.id} tpl={t} onClick={() => createFrom({ name: t.name, width: t.size?.w || 1080, height: t.size?.h || 1080 }, t.id)} />
            ))}
          </div>
        </section>
      )}
      {view === 'home' && (
      <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-8">
        <div className="rounded-3xl bg-gradient-to-r from-brand-700 via-fuchsia-600 to-pink-500 p-8 text-white shadow-lg">
          <h1 className="text-3xl font-bold tracking-tight">{user ? `Hola, ${user.name.split(' ')[0]}. ` : ''}¿Qué vas a diseñar hoy?</h1>
          <p className="mt-1 text-white/85">Crea, edita y descarga tus diseños.</p>
          <div className="relative mt-5 max-w-2xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-full border-0 bg-white py-3 pl-11 pr-4 text-slate-800 shadow focus:outline-none focus:ring-4 focus:ring-white/40"
              placeholder="Busca tus diseños o un tipo de diseño (p. ej. «Instagram», «A4», «tarjeta»)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            {QUICK.map((qk) => {
              const p = SIZE_PRESETS.find((x) => x.id === qk.preset)!
              const Icon = qk.icon
              return (
                <button key={qk.preset} onClick={() => createFrom(p)} className="group flex w-24 flex-col items-center gap-2 text-center text-xs font-medium">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 transition group-hover:bg-white/30">
                    <Icon size={24} />
                  </span>
                  {qk.label}
                </button>
              )
            })}
            <button onClick={() => setCustomOpen(true)} className="group flex w-24 flex-col items-center gap-2 text-center text-xs font-medium">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 transition group-hover:bg-white/30">
                <Plus size={24} />
              </span>
              Tamaño personalizado
            </button>
          </div>
        </div>
      </section>

      {presetsFiltered.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-8">
          <h2 className="mb-3 text-lg font-semibold">Tipos de diseño</h2>
          <div className="flex flex-wrap gap-2">
            {presetsFiltered.map((p) => (
              <button key={p.id} onClick={() => createFrom(p)} className="btn-secondary">
                {p.name} <span className="text-slate-400">{p.width}×{p.height}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Designs */}
      <section className="mx-auto max-w-6xl px-5 pt-10">
        <h2 className="mb-3 text-lg font-semibold">Tus diseños</h2>
        <DesignGrid designs={filtered.slice(0, 10)} loading={loading} error={error} menuFor={menuFor} setMenuFor={setMenuFor} reload={load} />
        {filtered.length > 10 && (
          <button className="btn-secondary mt-3" onClick={() => setView('projects')}>
            Ver todos los proyectos ({filtered.length})
          </button>
        )}
      </section>

      {/* Templates */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles size={18} className="text-brand-600" /> Empieza con una plantilla
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {TEMPLATES.slice(0, 10).map((t) => (
            <TemplateCard key={t.id} tpl={t} onClick={() => createFrom({ name: t.name, width: t.size?.w || 1080, height: t.size?.h || 1080 }, t.id)} />
          ))}
        </div>
      </section>

      </>
      )}
      {customOpen && <CustomSizeModal onClose={() => setCustomOpen(false)} onCreate={(p) => createFrom(p)} />}
    </div>
  )
}


function DesignGrid({ designs, loading, error, menuFor, setMenuFor, reload }: { designs: DesignMeta[]; loading: boolean; error: string | null; menuFor: string | null; setMenuFor: (id: string | null) => void; reload: () => void }) {
  const filtered = designs
  const load = reload
  return (
    <>
        {error && (
          <div className="card mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No se pudo conectar con el backend ({error}). ¿Está levantado <code>docker compose up</code>?
          </div>
        )}
        {loading ? (
          <div className="text-sm text-slate-500">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-10 text-center text-slate-500">
            <LayoutTemplate size={36} className="text-slate-300" />
            <p>Aún no tienes diseños. Crea el primero desde arriba.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((d) => (
              <div key={d.id} className="group relative">
                <button onClick={() => navigate(`/design/${d.id}`)} className="card block w-full overflow-hidden text-left transition hover:shadow-md">
                  <div className="checker flex aspect-square items-center justify-center overflow-hidden bg-slate-100">
                    {d.thumbnail ? <img src={d.thumbnail} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-400">Sin vista previa</span>}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-1 truncate text-sm font-medium">
                      <span className="truncate">{d.name}</span>
                      {d.shared && <span className="shrink-0 rounded bg-brand-100 px-1 text-[10px] font-normal text-brand-700" title={`Compartido por ${d.owner}`}>{d.owner}</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {d.width}×{d.height} · {d.pageCount} pág. · {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                </button>
                <button
                  className="absolute right-2 top-2 rounded-md bg-white/90 p-1 opacity-0 shadow group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuFor(menuFor === d.id ? null : d.id)
                  }}
                >
                  <MoreVertical size={16} />
                </button>
                {menuFor === d.id && (
                  <div className="absolute right-2 top-10 z-10 w-40 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg" onMouseLeave={() => setMenuFor(null)}>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-50"
                      onClick={async () => {
                        setMenuFor(null)
                        await api.duplicateDesign(d.id)
                        void load()
                      }}
                    >
                      <Copy size={14} /> Duplicar
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        setMenuFor(null)
                        if (!confirm(`¿Eliminar «${d.name}»?`)) return
                        await api.deleteDesign(d.id)
                        void load()
                      }}
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </>
  )
}

export function Logo({ small, white, className = '' }: { small?: boolean; white?: boolean; className?: string }) {
  if (small) {
    return (
      <a href="#/" className={`inline-flex items-center ${className}`} title="bamba">
        <img src="/logo-mark.svg" alt="bamba" className="h-9 w-9" />
      </a>
    )
  }
  return (
    <a href="#/" className={`inline-flex items-center ${className}`} title="bamba">
      <img src={white ? '/logo-white.svg' : '/logo.svg'} alt="bamba" className="h-10 w-auto" />
    </a>
  )
}

function TemplateCard({ tpl, onClick }: { tpl: (typeof TEMPLATES)[number]; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    templatePreview(tpl, tpl.size?.w || 1080, tpl.size?.h || 1080, 300).then((u) => alive && setSrc(u)).catch(() => {})
    return () => {
      alive = false
    }
  }, [tpl])
  return (
    <button onClick={onClick} className="card group overflow-hidden text-left transition hover:shadow-md">
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-slate-100" style={{ background: tpl.swatch[0] }}>
        {src && <img src={src} alt={tpl.name} className="max-h-full max-w-full object-contain transition group-hover:scale-105" />}
      </div>
      <div className="p-2.5">
        <div className="truncate text-sm font-medium">{tpl.name}</div>
        <div className="text-xs text-slate-500">{tpl.category}</div>
      </div>
    </button>
  )
}

export function CustomSizeModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: { name: string; width: number; height: number }) => void }) {
  const [w, setW] = useState(1080)
  const [h, setH] = useState(1080)
  const [unit, setUnit] = useState<'px' | 'mm' | 'cm' | 'in'>('px')
  const [name, setName] = useState('Diseño personalizado')
  const [cat, setCat] = useState(PRESET_CATEGORIES[0])
  const toPx = (v: number) => (unit === 'px' ? v : unit === 'mm' ? Math.round((v / 25.4) * 300) : unit === 'cm' ? Math.round((v / 2.54) * 300) : Math.round(v * 300))
  return (
    <Modal title="Crear un diseño" onClose={onClose} width={640}>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {PRESET_CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${cat === c ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="mb-5 grid max-h-56 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
        {SIZE_PRESETS.filter((p) => p.category === cat).map((p) => (
          <button key={p.id} onClick={() => onCreate(p)} className="card p-3 text-left hover:border-brand-400">
            <div className="text-sm font-medium">{p.name}</div>
            <div className="text-xs text-slate-500">
              {p.width} × {p.height} px
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="mb-2 text-sm font-semibold">Tamaño personalizado</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            Nombre
            <input className="input mt-1 block w-44" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-xs text-slate-600">
            Ancho
            <input type="number" className="input mt-1 block w-24" value={w} onChange={(e) => setW(Number(e.target.value))} />
          </label>
          <label className="text-xs text-slate-600">
            Alto
            <input type="number" className="input mt-1 block w-24" value={h} onChange={(e) => setH(Number(e.target.value))} />
          </label>
          <label className="text-xs text-slate-600">
            Unidad
            <select className="select mt-1 block" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
              <option value="px">px</option>
              <option value="mm">mm (300 dpi)</option>
              <option value="cm">cm (300 dpi)</option>
              <option value="in">in (300 dpi)</option>
            </select>
          </label>
          <button className="btn-primary" onClick={() => onCreate({ name, width: Math.max(50, Math.min(8000, toPx(w))), height: Math.max(50, Math.min(8000, toPx(h))) })}>
            Crear diseño
          </button>
        </div>
      </div>
    </Modal>
  )
}
