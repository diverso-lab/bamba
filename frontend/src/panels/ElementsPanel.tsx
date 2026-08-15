import { useMemo, useState } from 'react'
import { addChart, addEmoji, addFrame, addGrid, addIcon, addShape } from '@/lib/actions'
import { DEFAULT_CHART } from '@/lib/charts'
import type { FrameKind, ShapeKind } from '@/lib/fabricUtils'
import { EMOJI_SETS, iconSvg, searchIcons } from '@/lib/icons'
import { SearchInput, SectionTitle } from '@/components/ui'
import { ChartDialog } from '@/components/dialogs'
import { useEditor } from '@/store/editor'

const SHAPES: { id: ShapeKind; label: string; svg: string }[] = [
  { id: 'rect', label: 'Cuadrado', svg: '<rect x="4" y="4" width="40" height="40"/>' },
  { id: 'rounded', label: 'Redondeado', svg: '<rect x="4" y="4" width="40" height="40" rx="8"/>' },
  { id: 'circle', label: 'Círculo', svg: '<circle cx="24" cy="24" r="20"/>' },
  { id: 'ellipse', label: 'Elipse', svg: '<ellipse cx="24" cy="24" rx="21" ry="14"/>' },
  { id: 'triangle', label: 'Triángulo', svg: '<polygon points="24,4 44,44 4,44"/>' },
  { id: 'diamond', label: 'Rombo', svg: '<polygon points="24,3 45,24 24,45 3,24"/>' },
  { id: 'pentagon', label: 'Pentágono', svg: '<polygon points="24,3 44,18 36,44 12,44 4,18"/>' },
  { id: 'hexagon', label: 'Hexágono', svg: '<polygon points="14,4 34,4 45,24 34,44 14,44 3,24"/>' },
  { id: 'octagon', label: 'Octógono', svg: '<polygon points="16,4 32,4 44,16 44,32 32,44 16,44 4,32 4,16"/>' },
  { id: 'star', label: 'Estrella', svg: '<polygon points="24,3 30,17 45,18 34,28 37,44 24,36 11,44 14,28 3,18 18,17"/>' },
  { id: 'star4', label: 'Destello', svg: '<polygon points="24,2 29,19 46,24 29,29 24,46 19,29 2,24 19,19"/>' },
  { id: 'heart', label: 'Corazón', svg: '<path d="M24 43 L7 26 C0 19 3 7 13 6 C18 6 22 9 24 13 C26 9 30 6 35 6 C45 7 48 19 41 26 Z"/>' },
  { id: 'arrowRight', label: 'Flecha', svg: '<polygon points="4,17 28,17 28,6 45,24 28,42 28,31 4,31"/>' },
  { id: 'chevron', label: 'Chevrón', svg: '<polygon points="4,4 30,4 44,24 30,44 4,44 16,24"/>' },
  { id: 'speech', label: 'Bocadillo', svg: '<path d="M8 4 H40 A6 6 0 0 1 46 10 V30 A6 6 0 0 1 40 36 H20 L10 45 V36 H8 A6 6 0 0 1 2 30 V10 A6 6 0 0 1 8 4 Z"/>' },
  { id: 'cross', label: 'Cruz', svg: '<polygon points="17,3 31,3 31,17 45,17 45,31 31,31 31,45 17,45 17,31 3,31 3,17 17,17"/>' },
  { id: 'ring', label: 'Anillo', svg: '<circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="7"/>' },
  { id: 'halfCircle', label: 'Semicírculo', svg: '<path d="M4 30 A20 20 0 0 1 44 30 Z"/>' },
  { id: 'parallelogram', label: 'Paralelogramo', svg: '<polygon points="14,6 46,6 34,42 2,42"/>' },
  { id: 'trapezoid', label: 'Trapecio', svg: '<polygon points="12,6 36,6 46,42 2,42"/>' },
]

const LINES: { id: ShapeKind; label: string; svg: string }[] = [
  { id: 'line', label: 'Línea', svg: '<line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' },
  { id: 'lineDashed', label: 'Discontinua', svg: '<line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="4" stroke-dasharray="8 6" stroke-linecap="round"/>' },
  { id: 'lineDotted', label: 'Punteada', svg: '<line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="4" stroke-dasharray="1 8" stroke-linecap="round"/>' },
  { id: 'arrowLine', label: 'Flecha', svg: '<line x1="4" y1="24" x2="36" y2="24" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><polygon points="34,14 46,24 34,34"/>' },
  { id: 'arrowDouble', label: 'Flecha doble', svg: '<line x1="12" y1="24" x2="36" y2="24" stroke="currentColor" stroke-width="4"/><polygon points="34,14 46,24 34,34"/><polygon points="14,14 2,24 14,34"/>' },
]

const FRAMES: { id: FrameKind; label: string; svg: string }[] = [
  { id: 'square', label: 'Cuadrado', svg: '<rect x="4" y="4" width="40" height="40"/>' },
  { id: 'rounded', label: 'Redondeado', svg: '<rect x="4" y="4" width="40" height="40" rx="9"/>' },
  { id: 'circle', label: 'Círculo', svg: '<circle cx="24" cy="24" r="20"/>' },
  { id: 'portrait', label: 'Vertical', svg: '<rect x="10" y="3" width="28" height="42"/>' },
  { id: 'landscape', label: 'Horizontal', svg: '<rect x="3" y="10" width="42" height="28"/>' },
  { id: 'pill', label: 'Píldora', svg: '<rect x="3" y="12" width="42" height="24" rx="12"/>' },
  { id: 'heart', label: 'Corazón', svg: '<path d="M24 43 L7 26 C0 19 3 7 13 6 C18 6 22 9 24 13 C26 9 30 6 35 6 C45 7 48 19 41 26 Z"/>' },
  { id: 'star', label: 'Estrella', svg: '<polygon points="24,3 30,17 45,18 34,28 37,44 24,36 11,44 14,28 3,18 18,17"/>' },
  { id: 'hexagon', label: 'Hexágono', svg: '<polygon points="14,4 34,4 45,24 34,44 14,44 3,24"/>' },
  { id: 'triangle', label: 'Triángulo', svg: '<polygon points="24,4 44,44 4,44"/>' },
  { id: 'diamond', label: 'Rombo', svg: '<polygon points="24,3 45,24 24,45 3,24"/>' },
  { id: 'arch', label: 'Arco', svg: '<path d="M6 22 A18 18 0 0 1 42 22 V45 H6 Z"/>' },
  { id: 'blob', label: 'Orgánico', svg: '<path d="M30 6 C40 8 46 18 44 28 C42 38 32 46 22 44 C10 42 2 32 5 20 C8 10 20 4 30 6 Z"/>' },
]

const GRIDS: { cols: number; rows: number; label: string }[] = [
  { cols: 2, rows: 1, label: '2 columnas' },
  { cols: 1, rows: 2, label: '2 filas' },
  { cols: 3, rows: 1, label: '3 columnas' },
  { cols: 2, rows: 2, label: '2×2' },
  { cols: 3, rows: 2, label: '3×2' },
  { cols: 3, rows: 3, label: '3×3' },
]

function Tile({ svg, label, onClick, color = '#334155', draggable, onDragStart }: { svg: string; label: string; onClick: () => void; color?: string; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void }) {
  return (
    <button
      title={label}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className="flex aspect-square items-center justify-center rounded-lg bg-slate-50 p-2 hover:bg-slate-100"
      style={{ color }}
    >
      <svg viewBox="0 0 48 48" className="h-full w-full" fill="currentColor" dangerouslySetInnerHTML={{ __html: svg }} />
    </button>
  )
}

export default function ElementsPanel() {
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [chartOpen, setChartOpen] = useState(false)
  const [iconColor] = useState('#111827')
  const toast = useEditor((s) => s.toast)

  const iconResults = useMemo(() => searchIcons(q, expanded === 'icons' || q ? 240 : 24), [q, expanded])
  const s = q.trim().toLowerCase()
  const shapesF = SHAPES.filter((x) => !s || x.label.toLowerCase().includes(s))
  const linesF = LINES.filter((x) => !s || x.label.toLowerCase().includes(s) || 'línea'.includes(s))
  const framesF = FRAMES.filter((x) => !s || x.label.toLowerCase().includes(s) || 'marco'.includes(s))
  const emojisF = EMOJI_SETS.flatMap((set) => set.items)

  const Section = ({ id, title, children, count }: { id: string; title: string; children: React.ReactNode; count?: number }) => {
    if (expanded && expanded !== id) return null
    return (
      <div className="mb-2">
        <SectionTitle
          action={
            count && count > 0 ? (
              <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setExpanded(expanded === id ? null : id)}>
                {expanded === id ? 'Volver' : 'Ver todo'}
              </button>
            ) : null
          }
        >
          {title}
        </SectionTitle>
        {children}
      </div>
    )
  }

  const limit = (arr: any[], n: number) => (expanded || s ? arr : arr.slice(0, n))

  return (
    <div>
      <SearchInput value={q} onChange={setQ} placeholder="Buscar elementos (formas, iconos, marcos…)" />
      <div className="mt-2">
        {shapesF.length > 0 && (
          <Section id="shapes" title="Formas" count={SHAPES.length}>
            <div className="grid grid-cols-5 gap-1.5">
              {limit(shapesF, 10).map((sh) => (
                <Tile key={sh.id} svg={sh.svg} label={sh.label} onClick={() => addShape(sh.id)} />
              ))}
            </div>
          </Section>
        )}
        {linesF.length > 0 && (
          <Section id="lines" title="Líneas" count={LINES.length}>
            <div className="grid grid-cols-5 gap-1.5">
              {linesF.map((sh) => (
                <Tile key={sh.id} svg={sh.svg} label={sh.label} onClick={() => addShape(sh.id)} />
              ))}
            </div>
          </Section>
        )}
        <Section id="icons" title="Gráficos e iconos" count={1}>
          <div className="grid grid-cols-6 gap-1">
            {iconResults.map((name) => (
              <button key={name} title={name} onClick={() => addIcon(name, iconColor)} className="flex aspect-square items-center justify-center rounded-md p-1.5 hover:bg-slate-100" dangerouslySetInnerHTML={{ __html: iconSvg(name, '#334155', 1.8, 22) }} />
            ))}
          </div>
          {iconResults.length === 0 && <p className="text-xs text-slate-500">Sin resultados.</p>}
        </Section>
        {framesF.length > 0 && (
          <Section id="frames" title="Marcos" count={FRAMES.length}>
            <div className="grid grid-cols-5 gap-1.5">
              {limit(framesF, 10).map((f) => (
                <Tile key={f.id} svg={f.svg} label={f.label} color="#94a3b8" onClick={() => addFrame(f.id)} />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Añade un marco y luego haz clic en una foto o arrástrala dentro. Doble clic en el marco abre tus subidas.</p>
          </Section>
        )}
        {(!s || 'cuadrícula'.includes(s) || 'grid'.includes(s)) && (
          <Section id="grids" title="Cuadrículas" count={0}>
            <div className="grid grid-cols-3 gap-1.5">
              {GRIDS.map((g) => (
                <button key={g.label} title={g.label} onClick={() => addGrid(g.cols, g.rows)} className="rounded-lg bg-slate-50 p-2 hover:bg-slate-100">
                  <div className="grid aspect-square gap-0.5" style={{ gridTemplateColumns: `repeat(${g.cols}, 1fr)`, gridTemplateRows: `repeat(${g.rows}, 1fr)` }}>
                    {Array.from({ length: g.cols * g.rows }).map((_, i) => (
                      <span key={i} className="rounded-sm bg-slate-300" />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}
        {(!s || 'gráfico'.includes(s) || 'chart'.includes(s) || 'datos'.includes(s)) && (
          <Section id="charts" title="Gráficos de datos" count={0}>
            <div className="grid grid-cols-5 gap-1.5">
              {(['column', 'bar', 'line', 'pie', 'donut'] as const).map((t) => (
                <button key={t} title={t} onClick={() => addChart({ ...DEFAULT_CHART, type: t })} className="flex aspect-square items-center justify-center rounded-lg bg-slate-50 p-2 text-slate-600 hover:bg-slate-100">
                  <ChartGlyph type={t} />
                </button>
              ))}
            </div>
            <button className="btn-secondary mt-2 w-full justify-center" onClick={() => setChartOpen(true)}>
              Crear gráfico con mis datos
            </button>
          </Section>
        )}
        {!s && !expanded && (
          <div className="mb-2">
            <SectionTitle action={<button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => useEditor.getState().set({ activeTab: 'graphics' })}>Ver todo</button>}>Stickers e ilustraciones</SectionTitle>
            <button className="card flex w-full items-center gap-3 p-3 text-left hover:border-brand-400" onClick={() => useEditor.getState().set({ activeTab: 'graphics' })}>
              <span className="text-2xl">🎉🐱🚀</span>
              <span className="text-xs text-slate-600">Miles de stickers, ilustraciones, logos y banderas (vectoriales)</span>
            </button>
          </div>
        )}
        {(!s || 'emoji'.includes(s)) && (
          <Section id="emojis" title="Emojis" count={emojisF.length}>
            {(expanded === 'emojis' ? EMOJI_SETS : EMOJI_SETS.slice(0, 1)).map((set) => (
              <div key={set.name} className="mb-2">
                {expanded === 'emojis' && <div className="panel-title mb-1">{set.name}</div>}
                <div className="grid grid-cols-8 gap-0.5">
                  {(expanded === 'emojis' ? set.items : set.items.slice(0, 16)).map((e) => (
                    <button key={e} className="rounded p-1 text-xl hover:bg-slate-100" onClick={() => addEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Section>
        )}
        {(!s || 'tabla'.includes(s)) && !expanded && (
          <Section id="tables" title="Tablas" count={0}>
            <button
              className="btn-secondary w-full justify-center"
              onClick={async () => {
                const { addTable } = await import('@/lib/table')
                addTable(3, 3)
                toast('Tabla añadida. Desagrúpala (Ctrl+Shift+G) para editar celdas.')
              }}
            >
              Insertar tabla 3×3
            </button>
          </Section>
        )}
      </div>
      {chartOpen && <ChartDialog onClose={() => setChartOpen(false)} />}
    </div>
  )
}

function ChartGlyph({ type }: { type: string }) {
  switch (type) {
    case 'column':
      return (
        <svg viewBox="0 0 48 48" className="h-full w-full" fill="currentColor">
          <rect x="6" y="20" width="8" height="22" /><rect x="20" y="8" width="8" height="34" /><rect x="34" y="26" width="8" height="16" />
        </svg>
      )
    case 'bar':
      return (
        <svg viewBox="0 0 48 48" className="h-full w-full" fill="currentColor">
          <rect x="6" y="6" width="22" height="8" /><rect x="6" y="20" width="34" height="8" /><rect x="6" y="34" width="16" height="8" />
        </svg>
      )
    case 'line':
      return (
        <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6,38 18,22 28,30 42,10" />
        </svg>
      )
    case 'pie':
      return (
        <svg viewBox="0 0 48 48" className="h-full w-full" fill="currentColor">
          <path d="M24 24 L24 4 A20 20 0 1 1 6.7 34 Z" /><path d="M24 24 L6.7 34 A20 20 0 0 1 24 4 Z" opacity="0.5" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="9">
          <circle cx="24" cy="24" r="15" />
        </svg>
      )
  }
}
