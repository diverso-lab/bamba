import { useState } from 'react'
import type { FabricImage } from 'fabric'
import { Wand2, RotateCcw, Sparkles, Focus } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { DEFAULT_FILTERS, fireModified, getImageCornerRadius, getImageFilters, getImageShadow, isFramedImage, isImage, setImageBorder, setImageCornerRadius, setImageFilters, setImageShadow, type FilterValues, type ImageShadowKind } from '@/lib/fabricUtils'
import { DUOTONE_PRESETS } from '@/lib/imageEffects'
import { blurBackgroundOfSelection, removeBackgroundOfSelection, restoreBackgroundOfSelection, beginCrop } from '@/lib/actions'
import { ColorPicker, Slider, Tabs } from '@/components/ui'

export const PHOTO_PRESETS: { id: string; label: string; values: Partial<FilterValues> }[] = [
  { id: 'none', label: 'Original', values: {} },
  { id: 'auto', label: 'Auto', values: { contrast: 0.1, saturation: 0.15, vibrance: 0.15, brightness: 0.03 } },
  { id: 'vivid', label: 'Vivo', values: { saturation: 0.35, contrast: 0.12, vibrance: 0.3 } },
  { id: 'soft', label: 'Suave', values: { brightness: 0.08, contrast: -0.1, saturation: -0.15 } },
  { id: 'dramatic', label: 'Drama', values: { contrast: 0.35, brightness: -0.08, saturation: -0.1, vignette: 0.45 } },
  { id: 'cool', label: 'Frío', values: { hue: -0.08, saturation: -0.05, tint: '#3b82f6', tintAmount: 0.12 } },
  { id: 'warm', label: 'Cálido', values: { hue: 0.06, saturation: 0.1, brightness: 0.04, tint: '#f59e0b', tintAmount: 0.14 } },
  { id: 'bw', label: 'B/N', values: { grayscale: true, contrast: 0.1 } },
  { id: 'sepia', label: 'Sepia', values: { sepia: true } },
  { id: 'vintage', label: 'Vintage', values: { vintage: true, vignette: 0.35 } },
  { id: 'kodachrome', label: 'Kodak', values: { kodachrome: true } },
  { id: 'technicolor', label: 'Techni', values: { technicolor: true } },
  { id: 'polaroid', label: 'Polaroid', values: { polaroid: true } },
  { id: 'fade', label: 'Desvaído', values: { contrast: -0.2, brightness: 0.1, saturation: -0.25 } },
  { id: 'noir', label: 'Noir', values: { grayscale: true, contrast: 0.4, vignette: 0.6 } },
  { id: 'pop', label: 'Pop', values: { saturation: 0.6, contrast: 0.2, sharpen: 0.4 } },
]

export default function PhotoEditPanel() {
  const canvas = useEditor((s) => s.canvas)
  const selection = useEditor((s) => s.selection)
  const version = useEditor((s) => s.version)
  const set = useEditor((s) => s.set)
  const [tab, setTab] = useState<'adjust' | 'filters' | 'effects'>('effects')
  const [, force] = useState(0)
  void version
  const img = selection.length === 1 && isImage(selection[0]) ? (selection[0] as FabricImage) : null

  if (!canvas || !img) {
    return (
      <div>
        <h3 className="mb-2 text-base font-semibold">Editar foto</h3>
        <p className="text-sm text-slate-500">Selecciona una imagen del lienzo para editarla.</p>
        <button className="btn-secondary mt-3" onClick={() => set({ activeTab: 'uploads' })}>
          Ir a Subidos
        </button>
      </div>
    )
  }

  const v = getImageFilters(img)
  const setF = (patch: Partial<FilterValues>) => {
    setImageFilters(img, patch)
    canvas.requestRenderAll()
    force((x) => x + 1)
  }
  const commit = () => fireModified(canvas, img)
  const applyPreset = (p: (typeof PHOTO_PRESETS)[number]) => {
    setImageFilters(img, { ...DEFAULT_FILTERS, ...p.values })
    canvas.requestRenderAll()
    force((x) => x + 1)
    commit()
  }
  const shadow = getImageShadow(img)
  const radius = getImageCornerRadius(img)
  const framed = isFramedImage(img)
  const hasOriginal = !!(img as any).bambaOriginalSrc

  return (
    <div>
      <h3 className="mb-2 text-base font-semibold">Editar foto</h3>
      <Tabs
        tabs={[
          { id: 'effects', label: 'Efectos' },
          { id: 'adjust', label: 'Ajustar' },
          { id: 'filters', label: 'Filtros' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'filters' && (
        <div className="grid grid-cols-3 gap-2">
          {PHOTO_PRESETS.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p)} className="card overflow-hidden text-left hover:border-brand-400">
              <div className="h-14 w-full" style={{ backgroundImage: `url(${img.getSrc()})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: cssPreview(p.values) }} />
              <div className="truncate px-2 py-1 text-[11px]">{p.label}</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'adjust' && (
        <div>
          <Slider label="Brillo" value={Math.round(v.brightness * 100)} min={-100} max={100} onChange={(x) => setF({ brightness: x / 100 })} onCommit={commit} />
          <Slider label="Contraste" value={Math.round(v.contrast * 100)} min={-100} max={100} onChange={(x) => setF({ contrast: x / 100 })} onCommit={commit} />
          <Slider label="Saturación" value={Math.round(v.saturation * 100)} min={-100} max={100} onChange={(x) => setF({ saturation: x / 100 })} onCommit={commit} />
          <Slider label="Intensidad" value={Math.round(v.vibrance * 100)} min={-100} max={100} onChange={(x) => setF({ vibrance: x / 100 })} onCommit={commit} />
          <Slider label="Tono" value={Math.round(v.hue * 100)} min={-100} max={100} onChange={(x) => setF({ hue: x / 100 })} onCommit={commit} />
          <Slider label="Enfoque" value={Math.round(v.sharpen * 100)} min={0} max={100} onChange={(x) => setF({ sharpen: x / 100 })} onCommit={commit} />
          <Slider label="Desenfoque" value={Math.round(v.blur * 100)} min={0} max={100} onChange={(x) => setF({ blur: x / 100 })} onCommit={commit} />
          <Slider label="Viñeta" value={Math.round(v.vignette * 100)} min={0} max={100} onChange={(x) => setF({ vignette: x / 100 })} onCommit={commit} />
          <Slider label="Pixelar" value={v.pixelate} min={0} max={40} onChange={(x) => setF({ pixelate: x })} onCommit={commit} />
          <Slider label="Ruido" value={v.noise} min={0} max={400} onChange={(x) => setF({ noise: x })} onCommit={commit} />
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-600">
            <span className="w-16">Tinte</span>
            <ColorPicker value={v.tint} allowTransparent onChange={(c) => setF({ tint: typeof c === 'string' ? c : null })} onCommit={commit} />
            <input type="range" className="range flex-1" min={0} max={100} value={Math.round(v.tintAmount * 100)} onChange={(e) => setF({ tintAmount: Number(e.target.value) / 100 })} onMouseUp={commit} />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1 justify-center" onClick={() => applyPreset(PHOTO_PRESETS[0])}>
              <RotateCcw size={14} /> Restablecer
            </button>
            <button className="btn-secondary flex-1 justify-center" onClick={() => applyPreset(PHOTO_PRESETS[1])}>
              <Sparkles size={14} /> Autoajustar
            </button>
          </div>
        </div>
      )}

      {tab === 'effects' && (
        <div className="space-y-5">
          {/* IA */}
          <section>
            <div className="panel-title mb-2">Herramientas IA</div>
            <div className="grid grid-cols-2 gap-2">
              <button className="card flex flex-col items-center gap-1 p-3 text-xs hover:border-brand-400" onClick={() => removeBackgroundOfSelection()}>
                <Wand2 size={18} className="text-brand-600" /> Quitar fondo
              </button>
              <button className="card flex flex-col items-center gap-1 p-3 text-xs hover:border-brand-400" onClick={() => blurBackgroundOfSelection({ mode: 'blur', radius: 18 })}>
                <Focus size={18} className="text-brand-600" /> Desenfocar fondo
              </button>
              <button className="card flex flex-col items-center gap-1 p-3 text-xs hover:border-brand-400" onClick={() => blurBackgroundOfSelection({ mode: 'bw' })}>
                <span className="text-lg leading-none">◐</span> Fondo en B/N
              </button>
              <BgColorButton />
            </div>
            {hasOriginal && (
              <button className="btn-ghost mt-2 w-full justify-center text-xs" onClick={() => restoreBackgroundOfSelection()}>
                <RotateCcw size={14} /> Restaurar imagen original
              </button>
            )}
            {!framed && (
              <button className="btn-secondary mt-2 w-full justify-center" onClick={beginCrop}>
                Recortar
              </button>
            )}
          </section>

          {/* Duotono */}
          <section>
            <div className="panel-title mb-2">Duotono</div>
            <div className="grid grid-cols-4 gap-1.5">
              <button onClick={() => { setF({ duotone: null }); commit() }} className={`rounded-lg border p-1 text-[11px] ${!v.duotone ? 'border-brand-500' : 'border-slate-200'}`}>
                <div className="mb-1 h-8 rounded" style={{ backgroundImage: `url(${img.getSrc()})`, backgroundSize: 'cover' }} />
                Ninguno
              </button>
              {DUOTONE_PRESETS.map((d) => (
                <button key={d.name} onClick={() => { setF({ duotone: { dark: d.dark, light: d.light } }); commit() }} className={`rounded-lg border p-1 text-[11px] ${v.duotone?.dark === d.dark && v.duotone?.light === d.light ? 'border-brand-500' : 'border-slate-200'}`}>
                  <div className="mb-1 h-8 rounded" style={{ background: `linear-gradient(135deg, ${d.dark}, ${d.light})` }} />
                  {d.name}
                </button>
              ))}
            </div>
            {v.duotone && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span>Sombras</span>
                <ColorPicker value={v.duotone.dark} onChange={(c) => typeof c === 'string' && setF({ duotone: { ...v.duotone!, dark: c } })} onCommit={commit} />
                <span>Luces</span>
                <ColorPicker value={v.duotone.light} onChange={(c) => typeof c === 'string' && setF({ duotone: { ...v.duotone!, light: c } })} onCommit={commit} />
              </div>
            )}
          </section>

          {/* Sombras */}
          <section>
            <div className="panel-title mb-2">Sombras y brillo</div>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ['none', 'Ninguna'],
                  ['drop', 'Sombra'],
                  ['glow', 'Brillo'],
                  ['outline', 'Contorno'],
                ] as [ImageShadowKind, string][]
              ).map(([k, label]) => (
                <button key={k} onClick={() => { setImageShadow(img, k); canvas.requestRenderAll(); commit(); force((x) => x + 1) }} className={`rounded-lg border px-1 py-2 text-[11px] ${shadow.kind === k ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <span className="mx-auto mb-1 block h-6 w-6 rounded bg-slate-300" style={{ boxShadow: k === 'drop' ? '4px 4px 8px rgba(0,0,0,.45)' : k === 'glow' ? '0 0 10px #7c3aed' : k === 'outline' ? '0 0 0 2px #7c3aed' : undefined }} />
                  {label}
                </button>
              ))}
            </div>
            {shadow.kind !== 'none' && (
              <div className="mt-2">
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <span className="w-16">Color</span>
                  <ColorPicker value={shadow.color.startsWith('rgba') ? '#000000' : shadow.color} onChange={(c) => { if (typeof c === 'string') { setImageShadow(img, shadow.kind, { color: c }); canvas.requestRenderAll(); force((x) => x + 1) } }} onCommit={commit} />
                </div>
                {shadow.kind !== 'outline' && <Slider label="Desenfoque" value={shadow.blur} min={0} max={100} onChange={(x) => { setImageShadow(img, shadow.kind, { blur: x }); canvas.requestRenderAll(); force((y) => y + 1) }} onCommit={commit} />}
                {shadow.kind === 'drop' && <Slider label="Distancia" value={shadow.offset} min={0} max={100} onChange={(x) => { setImageShadow(img, shadow.kind, { offset: x }); canvas.requestRenderAll(); force((y) => y + 1) }} onCommit={commit} />}
              </div>
            )}
          </section>

          {/* Forma / borde */}
          {!framed && (
            <section>
              <div className="panel-title mb-2">Esquinas y borde</div>
              <Slider label="Esquinas redondeadas" value={radius} min={0} max={Math.round(Math.min(img.width, img.height) / 2)} onChange={(x) => { setImageCornerRadius(img, x); canvas.requestRenderAll(); force((y) => y + 1) }} onCommit={commit} />
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="w-16">Borde</span>
                <ColorPicker value={typeof img.stroke === 'string' && img.stroke ? img.stroke : null} allowTransparent onChange={(c) => { setImageBorder(img, typeof c === 'string' ? c : null, img.strokeWidth || 12); canvas.requestRenderAll(); force((y) => y + 1) }} onCommit={commit} />
                <input type="range" className="range flex-1" min={1} max={120} value={img.strokeWidth || 12} onChange={(e) => { setImageBorder(img, (img.stroke as string) || '#111827', Number(e.target.value)); canvas.requestRenderAll(); force((y) => y + 1) }} onMouseUp={commit} />
              </div>
              <button className={`btn-secondary w-full justify-center ${v.emboss ? 'bg-brand-50' : ''}`} onClick={() => { setF({ emboss: !v.emboss }); commit() }}>
                Relieve {v.emboss ? '✓' : ''}
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function BgColorButton() {
  const [color, setColor] = useState('#ffffff')
  return (
    <div className="card flex flex-col items-center gap-1 p-2 text-xs">
      <div className="flex items-center gap-1">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0" />
        <button className="btn-ghost px-1 py-0 text-xs" onClick={() => blurBackgroundOfSelection({ mode: 'color', color })}>
          Fondo de color
        </button>
      </div>
    </div>
  )
}

/** Aproximación CSS de un preset (solo para la miniatura). */
function cssPreview(v: Partial<FilterValues>) {
  const parts: string[] = []
  if (v.brightness) parts.push(`brightness(${1 + v.brightness})`)
  if (v.contrast) parts.push(`contrast(${1 + v.contrast})`)
  if (v.saturation) parts.push(`saturate(${1 + v.saturation})`)
  if (v.grayscale) parts.push('grayscale(1)')
  if (v.sepia) parts.push('sepia(1)')
  if (v.vintage) parts.push('sepia(.4) contrast(.9)')
  if (v.kodachrome) parts.push('saturate(1.3) contrast(1.1)')
  if (v.technicolor) parts.push('saturate(1.5) hue-rotate(-10deg)')
  if (v.polaroid) parts.push('brightness(1.1) saturate(.85)')
  if (v.hue) parts.push(`hue-rotate(${v.hue * 60}deg)`)
  return parts.join(' ') || 'none'
}
