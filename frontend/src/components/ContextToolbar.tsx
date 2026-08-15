import { useEffect, useMemo, useState } from 'react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, Copy, Crop, FlipHorizontal2, FlipVertical2, Group as GroupIcon, Italic, Layers, Lock, Minus, Plus, Replace, Sparkles, Strikethrough, Trash2, Underline, Ungroup, Unlock, Wand2, RotateCcw, SlidersHorizontal, CaseUpper, BarChart3, Droplets, Palette,
} from 'lucide-react'
import type { FabricImage, FabricObject, IText, Textbox } from 'fabric'
import { useEditor } from '@/store/editor'
import {
  applyTextEffect, asAny, deleteSelection, duplicateSelection, fireModified, flipSelection, getImageFilters, groupSelection, isActiveSelection, isFrame, isFramedImage, isGroup, isImage, isLocked, isText, setCanvasBackground, setImageFilters, setSelectionProps, TEXT_EFFECTS, toggleLock, ungroupSelection, DEFAULT_FILTERS, type GradientSpec, type TextEffect,
} from '@/lib/fabricUtils'
import { FONTS, ensureFont } from '@/lib/fonts'
import { isCurvedText, type CurvedText } from '@/lib/curvedText'
import { isVideo, type VideoImage } from '@/lib/video'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { curvedToText, textToCurved } from '@/lib/fabricUtils'
import { beginCrop, removeBackgroundOfSelection, restoreBackgroundOfSelection, resetCrop, replaceSelectedImage } from '@/lib/actions'
import { ColorPicker, IconBtn, Popover, Slider } from './ui'
import { ChartDialog } from './dialogs'
import { api } from '@/lib/api'
import type { UploadItem } from '@/lib/types'

export default function ContextToolbar() {
  const canvas = useEditor((s) => s.canvas)
  const selection = useEditor((s) => s.selection)
  const version = useEditor((s) => s.version)
  const design = useEditor((s) => s.design)!
  const set = useEditor((s) => s.set)
  const cropSession = useEditor((s) => s.cropSession)
  void version
  const active = canvas?.getActiveObject() || null
  const first = selection[0] || null
  const [chartOpen, setChartOpen] = useState(false)

  if (!canvas) return <div className="h-12 border-b border-slate-200 bg-white" />
  if (useEditor.getState().readOnly) {
    return (
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 text-sm text-slate-600">
        Este diseño se ha compartido contigo en modo <b className="mx-1">solo lectura</b>. Puedes presentarlo, descargarlo o hacer una copia (Archivo → Hacer una copia).
      </div>
    )
  }

  if (cropSession) {
    return (
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 text-sm">
        <Crop size={16} className="text-brand-600" /> Ajusta el área de recorte y pulsa <span className="kbd">Enter</span> para aplicar o <span className="kbd">Esc</span> para cancelar.
      </div>
    )
  }

  // ---- Sin selección: fondo de página --------------------------------------
  if (!active || !first) {
    const bg = canvas.backgroundColor
    const bgStr = typeof bg === 'string' ? bg : null
    return (
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3">
        <ColorPicker
          title="Color de fondo"
          value={bgStr}
          allowTransparent
          allowGradient
          onChange={(c) => setCanvasBackground(canvas, c as string | GradientSpec | null, design.width, design.height)}
        />
        <span className="text-sm text-slate-600">Color de fondo</span>
        <button className="btn-ghost ml-2" onClick={() => set({ activeTab: 'background' })}>
          Más opciones de fondo
        </button>
        <span className="ml-auto text-xs text-slate-400">
          {design.width} × {design.height} px
        </span>
      </div>
    )
  }

  const allText = selection.every(isText)
  const allImages = selection.every((o) => isImage(o) && !isVideo(o))
  const single = selection.length === 1
  const locked = isLocked(first)
  const a = asAny(first)
  const isShapeLike = single && !isText(first) && !isImage(first) && !isGroup(first) && !isFrame(first) && !isCurvedText(first)
  const isLine = single && (first.isType('line') || a.bambaType === 'line' || a.bambaType === 'arrow')
  const isChart = single && a.bambaType === 'chart'

  const setProps = (p: Record<string, any>) => setSelectionProps(canvas, p)

  return (
    <div className="flex h-12 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-white px-2">
      {/* -------------------- Texto -------------------- */}
      {allText && <TextTools objs={selection as IText[]} setProps={setProps} />}
      {single && isCurvedText(first) && <CurvedTextTools obj={first as CurvedText} />}

      {/* -------------------- Imagen -------------------- */}
      {allImages && single && !isFramedImage(first) && a.bambaType !== 'qr' && (
        <>
          <button className={`btn-ghost ${useEditor.getState().activeTab === 'photo' ? 'bg-slate-200/70' : ''}`} onClick={() => set({ activeTab: 'photo' })}>
            <Palette size={16} /> Editar foto
          </button>
          <button className="btn-ghost" onClick={beginCrop} disabled={locked}>
            <Crop size={16} /> Recortar
          </button>
          <button className="btn-ghost" onClick={() => removeBackgroundOfSelection()} disabled={locked} title="Quitar fondo con IA">
            <Wand2 size={16} /> Quitar fondo
          </button>
          {a.bambaOriginalSrc && (
            <IconBtn title="Restaurar fondo original" onClick={() => restoreBackgroundOfSelection()}>
              <RotateCcw size={16} />
            </IconBtn>
          )}
          <ReplaceImageButton />
          <div className="divider" />
        </>
      )}
      {allImages && single && isFramedImage(first) && (
        <>
          <button className="btn-ghost" onClick={() => set({ activeTab: 'photo' })}>
            <Palette size={16} /> Editar foto
          </button>
          <button className="btn-ghost" onClick={() => removeBackgroundOfSelection()} disabled={locked}>
            <Wand2 size={16} /> Quitar fondo
          </button>
          <ReplaceImageButton />
          <div className="divider" />
        </>
      )}
      {single && isFrame(first) && (
        <>
          <span className="px-2 text-sm text-slate-600">Marco vacío</span>
          <button className="btn-ghost" onClick={() => set({ activeTab: 'uploads', frameTarget: first })}>
            Elegir imagen…
          </button>
          <button className="btn-ghost" onClick={() => set({ activeTab: 'photos', frameTarget: first })}>
            Buscar foto…
          </button>
          <div className="divider" />
        </>
      )}

      {/* -------------------- Formas / líneas -------------------- */}
      {(isShapeLike || (!single && !allText && !allImages)) && !isChart && (
        <>
          {!isLine && (
            <>
              <ColorPicker
                title="Color de relleno"
                value={typeof first.fill === 'string' ? first.fill : null}
                allowTransparent
                onChange={(c) => setProps({ fill: c ?? 'transparent' })}
              />
              <span className="mr-1 text-xs text-slate-500">Relleno</span>
            </>
          )}
          <StrokePopover objs={selection} setProps={setProps} isLine={!!isLine} />
          {single && first.isType('rect') && (
            <Popover
              width={220}
              trigger={(open) => (
                <span className={`btn-ghost ${open ? 'bg-slate-200/70' : ''}`} title="Esquinas redondeadas">
                  Esquinas
                </span>
              )}
            >
              <Slider label="Radio" value={(first as any).rx || 0} min={0} max={Math.min(first.width, first.height) / 2} onChange={(v) => { first.set({ rx: v, ry: v }); canvas.requestRenderAll() }} onCommit={() => fireModified(canvas)} />
            </Popover>
          )}
          <div className="divider" />
        </>
      )}
      {isChart && (
        <>
          <button className="btn-ghost" onClick={() => setChartOpen(true)}>
            <BarChart3 size={16} /> Editar datos
          </button>
          <div className="divider" />
        </>
      )}
      {single && (a.bambaType === 'icon' || a.bambaType === 'svg') && (
        <>
          <ColorPicker
            title="Color del icono"
            value={iconColor(first)}
            onChange={(c) => {
              if (typeof c !== 'string') return
              const apply = (o: FabricObject) => {
                if (isGroup(o)) o.getObjects().forEach(apply)
                else {
                  if (o.stroke) o.set('stroke', c)
                  if (o.fill && o.fill !== 'none' && o.fill !== 'transparent') o.set('fill', c)
                }
              }
              apply(first)
              first.set('dirty', true)
              canvas.requestRenderAll()
              fireModified(canvas)
            }}
          />
          <span className="mr-1 text-xs text-slate-500">Color</span>
          <div className="divider" />
        </>
      )}

      {/* -------------------- Comunes -------------------- */}
      {!isLine && (
        <>
          <IconBtn title="Voltear horizontal" onClick={() => flipSelection(canvas, 'x')} disabled={locked}>
            <FlipHorizontal2 size={16} />
          </IconBtn>
          <IconBtn title="Voltear vertical" onClick={() => flipSelection(canvas, 'y')} disabled={locked}>
            <FlipVertical2 size={16} />
          </IconBtn>
        </>
      )}
      {isActiveSelection(active) && (
        <button className="btn-ghost" onClick={() => groupSelection(canvas)}>
          <GroupIcon size={16} /> Agrupar
        </button>
      )}
      {single && isGroup(first) && !isActiveSelection(first) && a.bambaType !== 'icon' && a.bambaType !== 'chart' && a.bambaType !== 'arrow' && (
        <button className="btn-ghost" onClick={() => ungroupSelection(canvas)}>
          <Ungroup size={16} /> Desagrupar
        </button>
      )}

      {single && isVideo(first) && <VideoTools video={first as any} />}
      <div className="ml-auto flex items-center gap-0.5">
        <button className={`btn-ghost ${useEditor.getState().activeTab === 'animate' ? 'bg-slate-200/70' : ''}`} onClick={() => set({ activeTab: 'animate' })} title="Animar">
          <Sparkles size={16} /> Animar
        </button>
        <button className="btn-ghost" onClick={() => set({ activeTab: 'position' })}>
          <Layers size={16} /> Posición
        </button>
        <Popover
          width={240}
          align="right"
          trigger={(open) => (
            <span className={`icon-btn ${open ? 'active' : ''}`} title="Transparencia">
              <Droplets size={16} />
            </span>
          )}
        >
          <Slider label="Transparencia" value={Math.round((first.opacity ?? 1) * 100)} min={0} max={100} onChange={(v) => { selection.forEach((o) => o.set('opacity', v / 100)); canvas.requestRenderAll() }} onCommit={() => fireModified(canvas)} />
        </Popover>
        <IconBtn title={locked ? 'Desbloquear' : 'Bloquear'} onClick={() => toggleLock(canvas)} active={locked}>
          {locked ? <Lock size={16} /> : <Unlock size={16} />}
        </IconBtn>
        <IconBtn title="Duplicar (Ctrl+D)" onClick={() => duplicateSelection(canvas)} disabled={locked}>
          <Copy size={16} />
        </IconBtn>
        <IconBtn title="Eliminar (Supr)" onClick={() => deleteSelection(canvas)} disabled={locked}>
          <Trash2 size={16} />
        </IconBtn>
      </div>
      {chartOpen && <ChartDialog target={first} onClose={() => setChartOpen(false)} />}
    </div>
  )
}

function iconColor(o: FabricObject): string {
  let found = '#111827'
  const walk = (x: FabricObject) => {
    if (isGroup(x)) x.getObjects().forEach(walk)
    else if (typeof x.stroke === 'string' && x.stroke) found = x.stroke
    else if (typeof x.fill === 'string' && x.fill && x.fill !== 'none') found = x.fill
  }
  walk(o)
  return found
}

// ----------------------------------------------------------------------------
// Texto
// ----------------------------------------------------------------------------
function TextTools({ objs, setProps }: { objs: IText[]; setProps: (p: Record<string, any>) => void }) {
  const canvas = useEditor((s) => s.canvas)!
  const brand = useEditor((s) => s.brand)
  const t = objs[0]
  const [fontQ, setFontQ] = useState('')
  const [sizeTxt, setSizeTxt] = useState(String(Math.round(t.fontSize)))
  useEffect(() => setSizeTxt(String(Math.round(t.fontSize))), [t.fontSize, t])

  const fonts = useMemo(() => {
    const custom = brand.fonts.map((f) => ({ family: f.family, category: 'brand' as const }))
    const all = [...custom, ...FONTS]
    const s = fontQ.trim().toLowerCase()
    return s ? all.filter((f) => f.family.toLowerCase().includes(s)) : all
  }, [fontQ, brand.fonts])

  const applyFont = async (family: string) => {
    await ensureFont(family)
    setProps({ fontFamily: family })
  }
  const setSize = (v: number) => {
    const size = Math.max(4, Math.min(800, Math.round(v)))
    setSizeTxt(String(size))
    setProps({ fontSize: size })
  }
  const isBold = t.fontWeight === 'bold' || Number(t.fontWeight) >= 600
  const isItalic = t.fontStyle === 'italic'
  const effect: TextEffect = (t as any).textEffect || 'none'
  const fillStr = typeof t.fill === 'string' ? t.fill : '#000000'
  const baseFill = (t as any).textBaseFill || fillStr

  return (
    <>
      <Popover
        width={280}
        trigger={(open) => (
          <span className={`btn-ghost w-44 justify-between border border-slate-200 ${open ? 'bg-slate-200/70' : ''}`}>
            <span className="truncate" style={{ fontFamily: t.fontFamily }}>
              {t.fontFamily}
            </span>
            <ChevronDown size={14} />
          </span>
        )}
      >
        {(close) => (
          <div>
            <input autoFocus className="input mb-2 w-full" placeholder="Buscar fuente" value={fontQ} onChange={(e) => setFontQ(e.target.value)} />
            <div className="max-h-80 overflow-auto">
              {fonts.map((f) => (
                <button
                  key={f.family}
                  onClick={() => {
                    void applyFont(f.family)
                    close()
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-base hover:bg-slate-100 ${t.fontFamily === f.family ? 'bg-brand-50 text-brand-700' : ''}`}
                  style={{ fontFamily: f.family }}
                >
                  {f.family}
                  {f.category === 'brand' && <span className="rounded bg-brand-100 px-1 text-[10px] text-brand-700" style={{ fontFamily: 'Inter' }}>marca</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>
      <div className="mx-1 flex items-center rounded-md border border-slate-200">
        <button className="px-1.5 py-1 hover:bg-slate-100" onClick={() => setSize(t.fontSize - 2)}>
          <Minus size={14} />
        </button>
        <input
          className="w-10 border-x border-slate-200 py-1 text-center text-sm focus:outline-none"
          value={sizeTxt}
          onChange={(e) => setSizeTxt(e.target.value)}
          onBlur={() => setSize(Number(sizeTxt) || t.fontSize)}
          onKeyDown={(e) => e.key === 'Enter' && setSize(Number(sizeTxt) || t.fontSize)}
        />
        <button className="px-1.5 py-1 hover:bg-slate-100" onClick={() => setSize(t.fontSize + 2)}>
          <Plus size={14} />
        </button>
      </div>
      <ColorPicker
        title="Color del texto"
        value={effect === 'hollow' || effect === 'splice' ? baseFill : fillStr}
        onChange={(c) => {
          if (typeof c !== 'string') return
          objs.forEach((o) => {
            ;(o as any).textBaseFill = c
            const ef: TextEffect = (o as any).textEffect || 'none'
            if (ef !== 'none') applyTextEffect(o, ef, { color: (o as any).textEffectColor || undefined, intensity: (o as any).textEffectIntensity })
            else o.set('fill', c)
          })
          canvas.requestRenderAll()
        }}
        onCommit={() => fireModified(canvas)}
      />
      <IconBtn title="Negrita" active={isBold} onClick={() => setProps({ fontWeight: isBold ? 'normal' : 'bold' })}>
        <Bold size={16} />
      </IconBtn>
      <IconBtn title="Cursiva" active={isItalic} onClick={() => setProps({ fontStyle: isItalic ? 'normal' : 'italic' })}>
        <Italic size={16} />
      </IconBtn>
      <IconBtn title="Subrayado" active={!!t.underline} onClick={() => setProps({ underline: !t.underline })}>
        <Underline size={16} />
      </IconBtn>
      <IconBtn title="Tachado" active={!!t.linethrough} onClick={() => setProps({ linethrough: !t.linethrough })}>
        <Strikethrough size={16} />
      </IconBtn>
      <IconBtn
        title="Mayúsculas"
        onClick={() => {
          objs.forEach((o) => {
            const txt = o.text || ''
            const upper = txt === txt.toUpperCase()
            o.set('text', upper ? txt.toLowerCase() : txt.toUpperCase())
          })
          canvas.requestRenderAll()
          fireModified(canvas)
        }}
      >
        <CaseUpper size={16} />
      </IconBtn>
      <IconBtn
        title="Alineación"
        onClick={() => {
          const order = ['left', 'center', 'right', 'justify']
          const next = order[(order.indexOf(t.textAlign) + 1) % order.length]
          setProps({ textAlign: next })
        }}
      >
        {t.textAlign === 'center' ? <AlignCenter size={16} /> : t.textAlign === 'right' ? <AlignRight size={16} /> : t.textAlign === 'justify' ? <AlignJustify size={16} /> : <AlignLeft size={16} />}
      </IconBtn>
      <Popover
        width={260}
        trigger={(open) => (
          <span className={`icon-btn ${open ? 'active' : ''}`} title="Espaciado">
            <SlidersHorizontal size={16} />
          </span>
        )}
      >
        <Slider label="Espaciado entre letras" value={t.charSpacing || 0} min={-200} max={800} step={10} onChange={(v) => { objs.forEach((o) => o.set('charSpacing', v)); canvas.requestRenderAll() }} onCommit={() => fireModified(canvas)} />
        <Slider label="Interlineado" value={t.lineHeight || 1.16} min={0.5} max={3} step={0.01} onChange={(v) => { objs.forEach((o) => o.set('lineHeight', v)); canvas.requestRenderAll() }} onCommit={() => fireModified(canvas)} />
        {(t as Textbox).width !== undefined && objs.length === 1 && (
          <Slider label="Ancho de caja" value={Math.round(t.width)} min={20} max={5000} onChange={(v) => { (t as Textbox).set('width', v); (t as any).initDimensions?.(); canvas.requestRenderAll() }} onCommit={() => fireModified(canvas)} />
        )}
      </Popover>
      <Popover
        width={300}
        trigger={(open) => (
          <span className={`btn-ghost ${open ? 'bg-slate-200/70' : ''}`}>
            <Sparkles size={16} /> Efectos
          </span>
        )}
      >
        <TextEffectsPanel objs={objs} />
      </Popover>
      <div className="divider" />
    </>
  )
}

function VideoTools({ video }: { video: VideoImage }) {
  const canvas = useEditor((s) => s.canvas)!
  const [, force] = useState(0)
  const el = video.videoEl
  if (!el) return null
  const playing = !el.paused && !el.ended
  return (
    <>
      <IconBtn title={playing ? 'Pausar' : 'Reproducir'} onClick={async () => { if (playing) el.pause(); else await el.play().catch(() => {}); const { ensureVideoLoop } = await import('@/lib/video'); ensureVideoLoop(canvas); force((x) => x + 1) }}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </IconBtn>
      <IconBtn title={el.muted ? 'Activar sonido' : 'Silenciar'} onClick={() => { el.muted = !el.muted; (video as any).set('muted', el.muted); force((x) => x + 1) }}>
        {el.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </IconBtn>
      <span className="px-1 text-xs text-slate-500">{Math.round(el.duration || 0)} s</span>
      <div className="divider" />
    </>
  )
}

function CurvedTextTools({ obj }: { obj: CurvedText }) {
  const canvas = useEditor((s) => s.canvas)!
  const brand = useEditor((s) => s.brand)
  const [fontQ, setFontQ] = useState('')
  const [text, setText] = useState(obj.text)
  useEffect(() => setText(obj.text), [obj, obj.text])
  const upd = (p: Record<string, any>) => {
    obj.set(p)
    obj.setCoords()
    canvas.requestRenderAll()
  }
  const commit = () => fireModified(canvas, obj)
  const fonts = useMemo(() => {
    const all = [...brand.fonts.map((f) => ({ family: f.family })), ...FONTS]
    const s = fontQ.trim().toLowerCase()
    return s ? all.filter((f) => f.family.toLowerCase().includes(s)) : all
  }, [fontQ, brand.fonts])
  const isBold = obj.fontWeight === 'bold' || Number(obj.fontWeight) >= 600
  return (
    <>
      <Popover
        width={300}
        trigger={(open) => (
          <span className={`btn-ghost ${open ? 'bg-slate-200/70' : ''}`}>
            <CaseUpper size={16} /> Texto
          </span>
        )}
      >
        <label className="block text-xs text-slate-600">
          Contenido
          <input className="input mt-1 w-full" value={text} autoFocus onChange={(e) => { setText(e.target.value); upd({ text: e.target.value }) }} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
        </label>
      </Popover>
      <Popover
        width={280}
        trigger={(open) => (
          <span className={`btn-ghost w-40 justify-between border border-slate-200 ${open ? 'bg-slate-200/70' : ''}`}>
            <span className="truncate" style={{ fontFamily: obj.fontFamily }}>
              {obj.fontFamily}
            </span>
            <ChevronDown size={14} />
          </span>
        )}
      >
        {(close) => (
          <div>
            <input autoFocus className="input mb-2 w-full" placeholder="Buscar fuente" value={fontQ} onChange={(e) => setFontQ(e.target.value)} />
            <div className="max-h-80 overflow-auto">
              {fonts.map((f) => (
                <button key={f.family} onClick={async () => { await ensureFont(f.family); upd({ fontFamily: f.family }); commit(); close() }} className={`block w-full rounded-md px-2 py-1.5 text-left text-base hover:bg-slate-100 ${obj.fontFamily === f.family ? 'bg-brand-50 text-brand-700' : ''}`} style={{ fontFamily: f.family }}>
                  {f.family}
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>
      <div className="mx-1 flex items-center rounded-md border border-slate-200">
        <button className="px-1.5 py-1 hover:bg-slate-100" onClick={() => { upd({ fontSize: Math.max(4, obj.fontSize - 2) }); commit() }}>
          <Minus size={14} />
        </button>
        <span className="w-10 border-x border-slate-200 py-1 text-center text-sm">{Math.round(obj.fontSize)}</span>
        <button className="px-1.5 py-1 hover:bg-slate-100" onClick={() => { upd({ fontSize: obj.fontSize + 2 }); commit() }}>
          <Plus size={14} />
        </button>
      </div>
      <ColorPicker title="Color del texto" value={typeof obj.fill === 'string' ? obj.fill : '#000000'} onChange={(c) => typeof c === 'string' && upd({ fill: c })} onCommit={commit} />
      <IconBtn title="Negrita" active={isBold} onClick={() => { upd({ fontWeight: isBold ? 'normal' : 'bold' }); commit() }}>
        <Bold size={16} />
      </IconBtn>
      <IconBtn title="Cursiva" active={obj.fontStyle === 'italic'} onClick={() => { upd({ fontStyle: obj.fontStyle === 'italic' ? 'normal' : 'italic' }); commit() }}>
        <Italic size={16} />
      </IconBtn>
      <IconBtn title="Subrayado" active={!!obj.underline} onClick={() => { upd({ underline: !obj.underline }); commit() }}>
        <Underline size={16} />
      </IconBtn>
      <Popover
        width={280}
        trigger={(open) => (
          <span className={`btn-ghost ${open ? 'bg-slate-200/70' : ''}`}>
            <Sparkles size={16} /> Curva
          </span>
        )}
      >
        <Slider label="Curvatura" value={obj.curve} min={-100} max={100} onChange={(v) => upd({ curve: v })} onCommit={commit} />
        <Slider label="Espaciado" value={obj.charSpacing} min={-100} max={800} step={10} onChange={(v) => upd({ charSpacing: v })} onCommit={commit} />
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span>Contorno</span>
          <ColorPicker value={typeof obj.stroke === "string" && obj.stroke ? obj.stroke : null} allowTransparent onChange={(c) => upd({ stroke: typeof c === "string" ? c : "", strokeWidth: typeof c === 'string' ? Math.max(1, obj.strokeWidth || Math.round(obj.fontSize * 0.04)) : 0 })} onCommit={commit} />
          <input type="range" className="range flex-1" min={0} max={40} value={obj.strokeWidth || 0} onChange={(e) => upd({ strokeWidth: Number(e.target.value) })} onMouseUp={commit} />
        </div>
        <button className="btn-secondary w-full justify-center" onClick={() => curvedToText(canvas, obj)}>
          Quitar curva (texto normal)
        </button>
      </Popover>
      <div className="divider" />
    </>
  )
}

function TextEffectsPanel({ objs }: { objs: IText[] }) {
  const canvas = useEditor((s) => s.canvas)!
  const t = objs[0] as any
  const effect: TextEffect = t.textEffect || 'none'
  const [color, setColor] = useState<string>(t.textEffectColor || '')
  const [intensity, setIntensity] = useState<number>(t.textEffectIntensity ?? 50)
  const apply = (ef: TextEffect, opts?: { color?: string; intensity?: number }) => {
    objs.forEach((o) => applyTextEffect(o, ef, { color: opts?.color ?? (color || undefined), intensity: opts?.intensity ?? intensity }))
    canvas.requestRenderAll()
    fireModified(canvas)
  }
  const needsColor = ['splice', 'outline', 'echo', 'background'].includes(effect)
  const needsIntensity = effect !== 'none' && effect !== 'background'
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {TEXT_EFFECTS.map((e) => (
          <button key={e.id} onClick={() => apply(e.id)} className={`rounded-lg border p-2 text-center text-xs ${effect === e.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <span className="block text-lg font-bold" style={effectPreviewStyle(e.id)}>
              Aa
            </span>
            {e.label}
          </button>
        ))}
      </div>
      {needsIntensity && <Slider label="Intensidad" value={intensity} min={0} max={100} onChange={(v) => { setIntensity(v); apply(effect, { intensity: v }) }} />}
      {needsColor && (
        <div className="flex items-center gap-2 text-sm">
          <span>Color del efecto</span>
          <ColorPicker value={color || '#000000'} onChange={(c) => { if (typeof c === 'string') { setColor(c); apply(effect, { color: c }) } }} />
        </div>
      )}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="panel-title mb-1">Forma</div>
        <button className="btn-secondary w-full justify-center" onClick={() => objs.length === 1 && textToCurved(canvas, objs[0], 50)} disabled={objs.length !== 1}>
          Curvar texto
        </button>
        <p className="mt-1 text-[11px] text-slate-400">Convierte el texto en un arco; después ajusta la curvatura desde la barra.</p>
      </div>
    </div>
  )
}

function effectPreviewStyle(e: TextEffect): React.CSSProperties {
  switch (e) {
    case 'shadow':
      return { textShadow: '2px 2px 3px rgba(0,0,0,.45)' }
    case 'lift':
      return { textShadow: '0 4px 10px rgba(0,0,0,.35)' }
    case 'hollow':
      return { color: 'transparent', WebkitTextStroke: '1px #111827' }
    case 'splice':
      return { color: 'transparent', WebkitTextStroke: '1px #111827', textShadow: '3px 3px 0 #a78bfa' }
    case 'outline':
      return { WebkitTextStroke: '1px #7c3aed' }
    case 'echo':
      return { textShadow: '3px 3px 0 #a78bfa' }
    case 'neon':
      return { color: '#7c3aed', textShadow: '0 0 8px #a78bfa' }
    case 'background':
      return { background: '#fde047', padding: '0 4px' }
    default:
      return {}
  }
}

// ----------------------------------------------------------------------------
// Borde / trazo
// ----------------------------------------------------------------------------
function StrokePopover({ objs, setProps, isLine }: { objs: FabricObject[]; setProps: (p: Record<string, any>) => void; isLine: boolean }) {
  const canvas = useEditor((s) => s.canvas)!
  const first = objs[0]
  const target = isGroup(first) && asAny(first).bambaType === 'arrow' ? first.getObjects()[0] : first
  const stroke = typeof target.stroke === 'string' ? target.stroke : ''
  const dash = target.strokeDashArray
  const style = !dash || dash.length === 0 ? 'solid' : dash[0] <= 2 ? 'dotted' : 'dashed'
  const applyAll = (p: Record<string, any>) => {
    objs.forEach((o) => {
      if (isGroup(o) && asAny(o).bambaType === 'arrow') {
        o.getObjects().forEach((c) => {
          if (c.isType('line')) c.set(p)
          else if (p.stroke) c.set('fill', p.stroke)
        })
        o.set('dirty', true)
      } else o.set(p)
    })
    canvas.requestRenderAll()
    fireModified(canvas)
  }
  return (
    <Popover
      width={260}
      trigger={(open) => (
        <span className={`btn-ghost ${open ? 'bg-slate-200/70' : ''}`} title={isLine ? 'Estilo de línea' : 'Borde'}>
          <span className="inline-block h-4 w-4 rounded border-2" style={{ borderColor: stroke || '#cbd5e1', borderStyle: style === 'solid' ? 'solid' : style }} />
          {isLine ? 'Línea' : 'Borde'}
        </span>
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="w-16">Color</span>
        <ColorPicker value={stroke || null} allowTransparent={!isLine} onChange={(c) => applyAll({ stroke: typeof c === 'string' ? c : '' })} />
      </div>
      <Slider label="Grosor" value={target.strokeWidth || 0} min={0} max={80} onChange={(v) => { objs.forEach((o) => { if (isGroup(o) && asAny(o).bambaType === 'arrow') o.getObjects().forEach((c) => c.isType('line') && c.set('strokeWidth', v)); else o.set('strokeWidth', v); o.set('dirty', true) }); canvas.requestRenderAll() }} onCommit={() => fireModified(canvas)} />
      <div className="flex gap-1.5">
        {(['solid', 'dashed', 'dotted'] as const).map((s) => (
          <button
            key={s}
            onClick={() => applyAll({ strokeDashArray: s === 'solid' ? null : s === 'dashed' ? [Math.max(6, (target.strokeWidth || 4) * 3), Math.max(6, (target.strokeWidth || 4) * 2)] : [1, Math.max(6, (target.strokeWidth || 4) * 2)], strokeLineCap: 'round' })}
            className={`flex-1 rounded-md border px-2 py-1 text-xs ${style === s ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}
          >
            <span className="block h-0 w-full border-t-2 border-slate-700" style={{ borderStyle: s }} />
          </button>
        ))}
      </div>
      {!isLine && !stroke && <p className="mt-2 text-[11px] text-slate-400">Elige un color para añadir borde.</p>}
      <div className="mt-2">
        {isLine && (
          <button className="btn-ghost text-xs" onClick={() => setProps({ strokeLineCap: target.strokeLineCap === 'round' ? 'butt' : 'round' })}>
            Extremos: {target.strokeLineCap === 'round' ? 'redondos' : 'rectos'}
          </button>
        )}
      </div>
    </Popover>
  )
}

// ----------------------------------------------------------------------------
// Editar imagen (filtros)
// ----------------------------------------------------------------------------
const PRESETS: { id: string; label: string; values: Partial<import('@/lib/fabricUtils').FilterValues> }[] = [
  { id: 'none', label: 'Original', values: {} },
  { id: 'bw', label: 'B/N', values: { grayscale: true } },
  { id: 'sepia', label: 'Sepia', values: { sepia: true } },
  { id: 'vintage', label: 'Vintage', values: { vintage: true } },
  { id: 'kodachrome', label: 'Kodak', values: { kodachrome: true } },
  { id: 'technicolor', label: 'Techni', values: { technicolor: true } },
  { id: 'polaroid', label: 'Polaroid', values: { polaroid: true } },
  { id: 'vivid', label: 'Vivo', values: { saturation: 0.35, contrast: 0.12, vibrance: 0.3 } },
  { id: 'soft', label: 'Suave', values: { brightness: 0.08, contrast: -0.1, saturation: -0.15 } },
  { id: 'dramatic', label: 'Drama', values: { contrast: 0.35, brightness: -0.08, saturation: -0.1 } },
  { id: 'cool', label: 'Frío', values: { hue: -0.08, saturation: -0.05 } },
  { id: 'warm', label: 'Cálido', values: { hue: 0.06, saturation: 0.1, brightness: 0.04 } },
]

function ImageEditPopover({ img }: { img: FabricImage }) {
  const canvas = useEditor((s) => s.canvas)!
  const [, force] = useState(0)
  const v = getImageFilters(img)
  const setF = (patch: Partial<typeof v>) => {
    setImageFilters(img, patch)
    canvas.requestRenderAll()
    force((x) => x + 1)
  }
  const commit = () => fireModified(canvas, img)
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setImageFilters(img, { ...DEFAULT_FILTERS, ...p.values })
    canvas.requestRenderAll()
    force((x) => x + 1)
    commit()
  }
  return (
    <Popover
      width={320}
      trigger={(open) => (
        <span className={`btn-ghost ${open ? 'bg-slate-200/70' : ''}`}>
          <Palette size={16} /> Editar foto
        </span>
      )}
    >
      <div className="panel-title mb-1">Filtros</div>
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => applyPreset(p)} className="rounded-md border border-slate-200 px-1 py-1.5 text-[11px] hover:bg-slate-50">
            {p.label}
          </button>
        ))}
      </div>
      <div className="panel-title mb-1">Ajustes</div>
      <Slider label="Brillo" value={Math.round(v.brightness * 100)} min={-100} max={100} onChange={(x) => setF({ brightness: x / 100 })} onCommit={commit} />
      <Slider label="Contraste" value={Math.round(v.contrast * 100)} min={-100} max={100} onChange={(x) => setF({ contrast: x / 100 })} onCommit={commit} />
      <Slider label="Saturación" value={Math.round(v.saturation * 100)} min={-100} max={100} onChange={(x) => setF({ saturation: x / 100 })} onCommit={commit} />
      <Slider label="Intensidad" value={Math.round(v.vibrance * 100)} min={-100} max={100} onChange={(x) => setF({ vibrance: x / 100 })} onCommit={commit} />
      <Slider label="Tono" value={Math.round(v.hue * 100)} min={-100} max={100} onChange={(x) => setF({ hue: x / 100 })} onCommit={commit} />
      <Slider label="Desenfoque" value={Math.round(v.blur * 100)} min={0} max={100} onChange={(x) => setF({ blur: x / 100 })} onCommit={commit} />
      <Slider label="Pixelar" value={v.pixelate} min={0} max={40} onChange={(x) => setF({ pixelate: x })} onCommit={commit} />
      <Slider label="Ruido" value={v.noise} min={0} max={400} onChange={(x) => setF({ noise: x })} onCommit={commit} />
      <div className="flex gap-2">
        <button className="btn-secondary flex-1 justify-center" onClick={() => applyPreset(PRESETS[0])}>
          Restablecer
        </button>
        {(img.cropX || img.cropY || (img.getElement() as HTMLImageElement)?.naturalWidth !== img.width) && (
          <button className="btn-secondary flex-1 justify-center" onClick={resetCrop}>
            Quitar recorte
          </button>
        )}
      </div>
    </Popover>
  )
}

function ReplaceImageButton() {
  const [items, setItems] = useState<UploadItem[] | null>(null)
  return (
    <Popover
      width={300}
      trigger={(open) => (
        <span className={`btn-ghost ${open ? 'bg-slate-200/70' : ''}`}>
          <Replace size={16} /> Reemplazar
        </span>
      )}
      onOpenChange={(o) => o && !items && api.listUploads('image').then(setItems).catch(() => setItems([]))}
    >
      {(close) => (
        <div>
          <label className="btn-secondary mb-2 w-full cursor-pointer justify-center">
            Subir nueva imagen
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const it = await api.upload(f)
                setItems((prev) => [it, ...(prev || [])])
                await replaceSelectedImage(it.url)
                close()
              }}
            />
          </label>
          <div className="grid max-h-64 grid-cols-3 gap-1.5 overflow-auto">
            {(items || []).map((it) => (
              <button key={it.id} className="checker aspect-square overflow-hidden rounded-md border border-slate-200 hover:border-brand-400" onClick={async () => { await replaceSelectedImage(it.url); close() }}>
                <img src={it.url} className="h-full w-full object-cover" alt="" />
              </button>
            ))}
          </div>
          {items && items.length === 0 && <p className="text-xs text-slate-400">No hay subidas.</p>}
        </div>
      )}
    </Popover>
  )
}
