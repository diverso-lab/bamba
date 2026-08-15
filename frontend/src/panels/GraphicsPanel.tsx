import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { addGraphic } from '@/lib/actions'
import { SearchInput } from '@/components/ui'

const SETS: { id: string; label: string; featured: string; suggestions: string[] }[] = [
  { id: 'stickers', label: 'Stickers', featured: 'noto', suggestions: ['party', 'heart', 'star', 'fire', 'cake', 'sun', 'flower', 'rocket', 'pizza', 'dog', 'music', 'money'] },
  { id: '3d', label: '3D y color', featured: 'fluent-emoji', suggestions: ['balloon', 'gift', 'trophy', 'sparkles', 'coffee', 'camera', 'plant', 'beach'] },
  { id: 'illustrations', label: 'Ilustraciones', featured: 'flat-color-icons', suggestions: ['business', 'idea', 'chart', 'calendar', 'shop', 'phone', 'team', 'globe'] },
  { id: 'logos', label: 'Logos', featured: 'logos', suggestions: ['instagram', 'youtube', 'tiktok', 'whatsapp', 'google', 'apple', 'spotify', 'github'] },
  { id: 'flags', label: 'Banderas', featured: 'circle-flags', suggestions: ['es', 'mx', 'ar', 'us', 'fr', 'de', 'it', 'br'] },
  { id: 'icons', label: 'Iconos', featured: 'tabler', suggestions: ['arrow', 'check', 'user', 'mail', 'phone', 'location', 'clock', 'shopping'] },
]

export default function GraphicsPanel() {
  const [set, setSet] = useState(SETS[0])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; url: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    const t = setTimeout(async () => {
      try {
        const r = q.trim() ? await api.graphicsSearch(q.trim(), set.id, 96) : await api.graphicsCollection(set.featured, 96)
        if (alive) setResults(r.results)
      } catch (e: any) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    }, q ? 400 : 0)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, set])

  return (
    <div>
      <SearchInput value={q} onChange={setQ} placeholder={`Buscar ${set.label.toLowerCase()} (en inglés funciona mejor)`} />
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {SETS.map((s) => (
          <button key={s.id} onClick={() => setSet(s)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${set.id === s.id ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {!q && (
        <div className="mt-2 flex flex-wrap gap-1">
          {set.suggestions.map((s) => (
            <button key={s} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700 hover:bg-brand-100" onClick={() => setQ(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-600">Error: {error}</p>}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {results.map((r) => (
          <button
            key={r.id}
            title={r.id}
            onClick={() => addGraphic(r.id)}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/bamba-graphic', r.id)}
            className="flex aspect-square items-center justify-center rounded-lg bg-slate-50 p-2 hover:bg-slate-100"
          >
            <img src={r.url} alt={r.id} className="h-full w-full object-contain" loading="lazy" />
          </button>
        ))}
      </div>
      {loading && <p className="mt-2 text-xs text-slate-500">Buscando…</p>}
      {!loading && results.length === 0 && !error && <p className="mt-2 text-xs text-slate-500">Sin resultados. Prueba en inglés (p. ej. «cat», «birthday»).</p>}
      <p className="mt-4 text-[11px] text-slate-400">Gráficos de colecciones abiertas (Noto, Twemoji, OpenMoji, Fluent, Tabler…) vía Iconify. Se insertan como vectores editables: puedes desagruparlos y recolorearlos.</p>
    </div>
  )
}
