import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pipette, Search, X } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { collectDocumentColors, type GradientSpec } from '@/lib/fabricUtils'

// ----------------------------------------------------------------------------
// Popover
// ----------------------------------------------------------------------------
export function Popover({
  trigger,
  children,
  align = 'left',
  width = 280,
  open: controlledOpen,
  onOpenChange,
  className = '',
}: {
  trigger: (open: boolean) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right' | 'center'
  width?: number
  open?: boolean
  onOpenChange?: (o: boolean) => void
  className?: string
}) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = (o: boolean) => {
    setInnerOpen(o)
    onOpenChange?.(o)
  }
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation() // que no llegue al lienzo (deseleccionaría el objeto)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    let left = r.left
    if (align === 'right') left = r.right - width
    if (align === 'center') left = r.left + r.width / 2 - width / 2
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    setPos({ top: r.bottom + 6, left })
  }, [open, align, width])

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <div onClick={() => setOpen(!open)} className="inline-flex">
        {trigger(open)}
      </div>
      {open && pos && (
        <div
          className="fade-in fixed z-[80] max-h-[calc(100vh-80px)] overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          style={{ top: pos.top, left: pos.left, width }}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Botón icono con tooltip
// ----------------------------------------------------------------------------
export function IconBtn({
  title,
  onClick,
  active,
  disabled,
  children,
  className = '',
  size = 'md',
}: {
  title?: string
  onClick?: (e: React.MouseEvent) => void
  active?: boolean
  disabled?: boolean
  children: ReactNode
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`icon-btn ${size === 'sm' ? 'h-7 w-7' : ''} ${active ? 'active' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

// ----------------------------------------------------------------------------
// Slider con etiqueta
// ----------------------------------------------------------------------------
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  onCommit?: () => void
  format?: (v: number) => string
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <input
          type="number"
          className="input w-16 py-0.5 text-right text-xs"
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={onCommit}
        />
      </div>
      <input type="range" className="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onMouseUp={onCommit} onTouchEnd={onCommit} />
      {format && <div className="text-[10px] text-slate-400">{format(value)}</div>}
    </div>
  )
}

export function NumberField({ label, value, onChange, step = 1, min, max, suffix, className = '' }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; className?: string }) {
  const [txt, setTxt] = useState(String(Math.round(value * 100) / 100))
  useEffect(() => setTxt(String(Math.round(value * 100) / 100)), [value])
  const commit = () => {
    const v = parseFloat(txt)
    if (!Number.isNaN(v)) onChange(min !== undefined && v < min ? min : max !== undefined && v > max ? max : v)
  }
  return (
    <label className={`flex items-center gap-1 text-xs text-slate-600 ${className}`}>
      <span className="w-6 shrink-0 text-right">{label}</span>
      <input
        type="number"
        step={step}
        className="input w-full py-0.5 text-xs"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      {suffix && <span className="text-slate-400">{suffix}</span>}
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        autoFocus={autoFocus}
        className="input w-full rounded-lg py-2 pl-9 pr-8"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-3 flex border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center justify-between first:mt-0">
      <h4 className="text-sm font-semibold text-slate-800">{children}</h4>
      {action}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Color picker (estilo Canva)
// ----------------------------------------------------------------------------
export const DEFAULT_PALETTE = [
  '#000000', '#545454', '#737373', '#a6a6a6', '#d9d9d9', '#ffffff',
  '#ff3131', '#ff5757', '#ff66c4', '#cb6ce6', '#8c52ff', '#5e17eb',
  '#0097b2', '#0cc0df', '#5ce1e6', '#38b6ff', '#5271ff', '#004aad',
  '#00bf63', '#7ed957', '#c1ff72', '#ffde59', '#ffbd59', '#ff914d',
  '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
]

export const GRADIENT_PRESETS: { name: string; spec: GradientSpec }[] = [
  { name: 'Violeta rosa', spec: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#7c3aed' }, { offset: 1, color: '#ec4899' }] } },
  { name: 'Atardecer', spec: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#f97316' }, { offset: 1, color: '#ec4899' }] } },
  { name: 'Océano', spec: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#0ea5e9' }, { offset: 1, color: '#6366f1' }] } },
  { name: 'Menta', spec: { type: 'linear', angle: 45, stops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#84cc16' }] } },
  { name: 'Noche', spec: { type: 'linear', angle: 180, stops: [{ offset: 0, color: '#0f172a' }, { offset: 1, color: '#334155' }] } },
  { name: 'Melocotón', spec: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#fde68a' }, { offset: 1, color: '#fb7185' }] } },
  { name: 'Radial azul', spec: { type: 'radial', stops: [{ offset: 0, color: '#bae6fd' }, { offset: 1, color: '#1d4ed8' }] } },
  { name: 'Radial rosa', spec: { type: 'radial', stops: [{ offset: 0, color: '#fdf2f8' }, { offset: 1, color: '#f472b6' }] } },
  { name: 'Arcoíris', spec: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#ef4444' }, { offset: 0.5, color: '#facc15' }, { offset: 1, color: '#3b82f6' }] } },
]

export function gradientCss(spec: GradientSpec) {
  const stops = spec.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')
  return spec.type === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${spec.angle ?? 90}deg, ${stops})`
}

export function ColorSwatch({ color, size = 24, selected, onClick, title }: { color: string | GradientSpec | null; size?: number; selected?: boolean; onClick?: () => void; title?: string }) {
  const style: React.CSSProperties = { width: size, height: size }
  let cls = ''
  if (!color) cls = 'checker'
  else if (typeof color === 'string') style.background = color
  else style.background = gradientCss(color)
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`relative shrink-0 rounded-md border ${selected ? 'ring-2 ring-brand-500 ring-offset-1' : ''} ${cls} border-slate-200 hover:scale-105 transition-transform`}
      style={style}
    >
      {!color && <span className="absolute inset-0 flex items-center justify-center text-red-500 text-lg leading-none">/</span>}
    </button>
  )
}

export function ColorPicker({
  value,
  onChange,
  onCommit,
  allowTransparent = false,
  allowGradient = false,
  title = 'Color',
  trigger,
}: {
  value: string | GradientSpec | null
  onChange: (c: string | GradientSpec | null) => void
  onCommit?: () => void
  allowTransparent?: boolean
  allowGradient?: boolean
  title?: string
  trigger?: (open: boolean) => ReactNode
}) {
  const canvas = useEditor((s) => s.canvas)
  const version = useEditor((s) => s.version)
  const brand = useEditor((s) => s.brand)
  const [hex, setHex] = useState(typeof value === 'string' ? value : '#000000')
  useEffect(() => {
    if (typeof value === 'string') setHex(value)
  }, [value])
  const docColors = canvas ? collectDocumentColors(canvas) : []
  void version

  const pick = (c: string | GradientSpec | null) => {
    onChange(c)
    onCommit?.()
  }
  const eyedrop = async () => {
    const ED = (window as any).EyeDropper
    if (!ED) return
    try {
      const r = await new ED().open()
      pick(r.sRGBHex)
    } catch {
      /* cancelado */
    }
  }

  return (
    <Popover
      width={280}
      trigger={
        trigger ||
        ((open) => (
          <span title={title} className={`icon-btn ${open ? 'active' : ''}`}>
            <span
              className={`h-5 w-5 rounded-md border border-slate-300 ${!value ? 'checker' : ''}`}
              style={{ background: typeof value === 'string' ? value : value ? gradientCss(value) : undefined }}
            />
          </span>
        ))
      }
    >
      <div>
        <div className="mb-2 flex items-center gap-2">
          <input type="color" className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5" value={hex.length === 7 ? hex : '#000000'} onChange={(e) => { setHex(e.target.value); onChange(e.target.value) }} onBlur={onCommit} />
          <input
            className="input flex-1 font-mono text-xs"
            value={hex}
            onChange={(e) => {
              setHex(e.target.value)
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value)
            }}
            onBlur={onCommit}
          />
          {(window as any).EyeDropper && (
            <IconBtn title="Cuentagotas" onClick={eyedrop}>
              <Pipette size={16} />
            </IconBtn>
          )}
        </div>
        {allowTransparent && (
          <button className="mb-2 flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900" onClick={() => pick(null)}>
            <span className="checker inline-block h-5 w-5 rounded border border-slate-300" /> Sin color / transparente
          </button>
        )}
        {docColors.length > 0 && (
          <>
            <div className="panel-title mb-1">Colores del documento</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {docColors.map((c) => (
                <ColorSwatch key={c} color={c} selected={value === c} onClick={() => pick(c)} title={c} />
              ))}
            </div>
          </>
        )}
        {brand.colors.length > 0 && (
          <>
            <div className="panel-title mb-1">Colores de marca</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {brand.colors.map((c) => (
                <ColorSwatch key={c} color={c} selected={value === c} onClick={() => pick(c)} title={c} />
              ))}
            </div>
          </>
        )}
        <div className="panel-title mb-1">Colores por defecto</div>
        <div className="mb-2 grid grid-cols-6 gap-1.5">
          {DEFAULT_PALETTE.map((c) => (
            <ColorSwatch key={c} color={c} selected={value === c} onClick={() => pick(c)} title={c} size={32} />
          ))}
        </div>
        {allowGradient && (
          <>
            <div className="panel-title mb-1 mt-3">Degradados</div>
            <div className="grid grid-cols-6 gap-1.5">
              {GRADIENT_PRESETS.map((g) => (
                <ColorSwatch key={g.name} color={g.spec} onClick={() => pick(g.spec)} title={g.name} size={32} />
              ))}
            </div>
          </>
        )}
      </div>
    </Popover>
  )
}

// ----------------------------------------------------------------------------
// Modal
// ----------------------------------------------------------------------------
export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div data-modal="1" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fade-in max-h-[90vh] w-full overflow-auto rounded-2xl bg-white p-5 shadow-2xl" style={{ maxWidth: width }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <IconBtn title="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconBtn>
        </div>
        {children}
      </div>
    </div>
  )
}
