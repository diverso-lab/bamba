import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { addImageFromUrl } from '@/lib/actions'
import type { StockPhoto } from '@/lib/types'
import { SearchInput } from '@/components/ui'
import { useEditor } from '@/store/editor'

const SUGGESTIONS = ['naturaleza', 'ciudad', 'comida', 'oficina', 'playa', 'montaña', 'personas', 'tecnología', 'flores', 'animales', 'textura', 'cielo']

export default function PhotosPanel() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<StockPhoto[]>([])
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const frameTarget = useEditor((s) => s.frameTarget)

  const search = async (query: string, p = 1) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.searchPhotos(query, p)
      setResults(p === 1 ? r.results : [...results, ...r.results])
      setPage(r.page)
      setPageCount(r.page_count)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => q && search(q, 1), 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div>
      <SearchInput value={q} onChange={setQ} placeholder="Buscar fotos gratuitas (Openverse)" autoFocus />
      {frameTarget && <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 p-2 text-xs text-brand-800">Elige una foto para rellenar el marco seleccionado.</div>}
      {!q && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs hover:bg-slate-200" onClick={() => setQ(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-600">Error: {error}</p>}
      <div className="mt-3 columns-2 gap-2">
        {results.map((ph) => (
          <button
            key={ph.id}
            className="mb-2 block w-full overflow-hidden rounded-lg border border-slate-200 hover:border-brand-400"
            onClick={() => addImageFromUrl(ph.url)}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/bamba-image', ph.url)}
            title={`${ph.title}\n${ph.creator ? '© ' + ph.creator + ' · ' : ''}${ph.license}`}
          >
            <img src={ph.thumb} alt={ph.title} className="w-full" loading="lazy" style={{ aspectRatio: ph.width && ph.height ? `${ph.width}/${ph.height}` : undefined }} />
          </button>
        ))}
      </div>
      {loading && <p className="mt-2 text-xs text-slate-500">Buscando…</p>}
      {!loading && results.length > 0 && page < pageCount && (
        <button className="btn-secondary mt-2 w-full justify-center" onClick={() => search(q, page + 1)}>
          Cargar más
        </button>
      )}
      <p className="mt-4 text-[11px] text-slate-400">Fotos con licencias libres (CC0/CC-BY) vía Openverse. Revisa la atribución en el título de cada imagen.</p>
    </div>
  )
}
