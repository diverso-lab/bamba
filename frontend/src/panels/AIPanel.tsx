import { useEffect, useState } from 'react'
import { Sparkles, Loader2, Image as ImageIcon, Type, Wand2 } from 'lucide-react'
import type { IText } from 'fabric'
import { api } from '@/lib/api'
import { useEditor } from '@/store/editor'
import { addImageFromUrl, addStyledText } from '@/lib/actions'
import { fireModified, isText } from '@/lib/fabricUtils'
import { Tabs } from '@/components/ui'
import type { UploadItem } from '@/lib/types'

const STYLES = ['Fotográfico', 'Ilustración plana', 'Acuarela', '3D render', 'Minimalista', 'Neón', 'Cómic', 'Pixel art', 'Óleo', 'Isométrico']
const RATIOS: { id: string; label: string; w: number; h: number }[] = [
  { id: '1:1', label: 'Cuadrado', w: 1024, h: 1024 },
  { id: '16:9', label: 'Horizontal', w: 1280, h: 720 },
  { id: '9:16', label: 'Vertical', w: 720, h: 1280 },
  { id: '4:3', label: '4:3', w: 1024, h: 768 },
]
const TEXT_MODES: { id: string; label: string; needsText: boolean }[] = [
  { id: 'generate', label: 'Escribir', needsText: false },
  { id: 'headline', label: 'Titulares', needsText: false },
  { id: 'hashtags', label: 'Hashtags', needsText: false },
  { id: 'rewrite', label: 'Reescribir', needsText: true },
  { id: 'shorten', label: 'Acortar', needsText: true },
  { id: 'expand', label: 'Ampliar', needsText: true },
  { id: 'summarize', label: 'Resumir', needsText: true },
  { id: 'translate', label: 'Traducir', needsText: true },
  { id: 'tone', label: 'Cambiar tono', needsText: true },
]

export default function AIPanel() {
  const [tab, setTab] = useState<'text' | 'image'>('image')
  const [status, setStatus] = useState<{ text: string | null; textModel: string | null; image: string | null; hint: string | null } | null>(null)
  useEffect(() => {
    api.aiStatus().then(setStatus).catch(() => setStatus({ text: null, textModel: null, image: null, hint: 'No se pudo consultar el estado de la IA' }))
  }, [])
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <Sparkles size={18} className="text-brand-600" /> IA
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        Texto: {status ? status.text ? `${status.text}${status.textModel ? ` (${status.textModel})` : ''}` : 'no disponible' : '…'} · Imagen: {status ? status.image || 'no disponible' : '…'}
      </p>
      <Tabs
        tabs={[
          { id: 'image', label: 'Imagen mágica' },
          { id: 'text', label: 'Texto mágico' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'image' ? <MagicMedia available={!!status?.image} /> : <MagicWrite available={!!status?.text} hint={status?.hint || null} />}
      <p className="mt-6 text-[11px] text-slate-400">Los prompts se envían al proveedor configurado (por defecto un servicio gratuito externo para imágenes y, si está activo, un modelo local para texto). Configura tu propio proveedor en <code>docker-compose.yml</code>.</p>
    </div>
  )
}

function MagicMedia({ available }: { available: boolean }) {
  const toast = useEditor((s) => s.toast)
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<string | null>(null)
  const [ratio, setRatio] = useState(RATIOS[0])
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<UploadItem[]>([])

  useEffect(() => {
    api.listUploads('image').then((items) => setResults(items.filter((i: any) => i.ai).slice(0, 12))).catch(() => {})
  }, [])

  const generate = async () => {
    if (!prompt.trim()) return
    setBusy(true)
    try {
      const item = await api.aiImage({ prompt: prompt.trim(), width: ratio.w, height: ratio.h, style: style || undefined })
      setResults((r) => [item, ...r].slice(0, 12))
      await addImageFromUrl(item.url)
    } catch (e: any) {
      toast(`No se pudo generar la imagen: ${e.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <textarea className="input mb-2 h-20 w-full resize-none" placeholder="Describe la imagen que quieres (p. ej. «un gato astronauta flotando entre donuts»)" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <div className="mb-2 flex flex-wrap gap-1">
        {STYLES.map((s) => (
          <button key={s} onClick={() => setStyle(style === s ? null : s)} className={`rounded-full px-2 py-0.5 text-[11px] ${style === s ? 'bg-brand-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="mb-3 flex gap-1">
        {RATIOS.map((r) => (
          <button key={r.id} onClick={() => setRatio(r)} className={`flex-1 rounded-md border px-1 py-1 text-[11px] ${ratio.id === r.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
            {r.label}
          </button>
        ))}
      </div>
      <button className="btn-primary w-full justify-center py-2.5" onClick={generate} disabled={busy || !available || !prompt.trim()}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} {busy ? 'Generando…' : 'Generar imagen'}
      </button>
      {!available && <p className="mt-2 text-xs text-red-600">La generación de imágenes no está disponible en este servidor.</p>}
      {results.length > 0 && (
        <>
          <div className="panel-title mb-1 mt-4">Generadas recientemente</div>
          <div className="grid grid-cols-3 gap-1.5">
            {results.map((r) => (
              <button key={r.id} className="aspect-square overflow-hidden rounded-md border border-slate-200 hover:border-brand-400" title={(r as any).prompt || r.name} onClick={() => addImageFromUrl(r.url)} draggable onDragStart={(e) => e.dataTransfer.setData('text/bamba-image', r.url)}>
                <img src={r.url} className="h-full w-full object-cover" alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MagicWrite({ available, hint }: { available: boolean; hint: string | null }) {
  const canvas = useEditor((s) => s.canvas)
  const selection = useEditor((s) => s.selection)
  const toast = useEditor((s) => s.toast)
  const design = useEditor((s) => s.design)!
  const [mode, setMode] = useState('generate')
  const [prompt, setPrompt] = useState('')
  const [lang, setLang] = useState('inglés')
  const [tone, setTone] = useState('profesional')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const selText = selection.length === 1 && isText(selection[0]) ? (selection[0] as IText) : null
  const modeDef = TEXT_MODES.find((m) => m.id === mode)!

  const run = async () => {
    setBusy(true)
    try {
      const r = await api.aiText({ mode, prompt: prompt.trim() || undefined, text: modeDef.needsText ? selText?.text || prompt : undefined, lang, tone })
      setResult(r.text)
    } catch (e: any) {
      toast(`IA no disponible: ${e.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  const applyToSelected = () => {
    if (!canvas || !selText || !result) return
    selText.set('text', result)
    ;(selText as any).initDimensions?.()
    selText.setCoords()
    canvas.requestRenderAll()
    fireModified(canvas, selText)
  }
  const addAsText = async () => {
    if (!result) return
    await addStyledText(result, { fontFamily: 'Inter', fontSize: Math.round(design.width * 0.035), fill: '#111827', textAlign: 'left', width: design.width * 0.7 })
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {TEXT_MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={`rounded-full px-2 py-0.5 text-[11px] ${mode === m.id ? 'bg-brand-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
            {m.label}
          </button>
        ))}
      </div>
      {modeDef.needsText && (
        <div className={`mb-2 rounded-md p-2 text-xs ${selText ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-500'}`}>
          {selText ? `Se aplicará al texto seleccionado: «${(selText.text || '').slice(0, 60)}»` : 'Selecciona un texto del lienzo o escribe el texto abajo.'}
        </div>
      )}
      {mode === 'translate' && (
        <select className="select mb-2 w-full" value={lang} onChange={(e) => setLang(e.target.value)}>
          {['inglés', 'español', 'francés', 'alemán', 'italiano', 'portugués', 'catalán', 'euskera', 'gallego', 'chino', 'japonés', 'árabe'].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      )}
      {mode === 'tone' && (
        <select className="select mb-2 w-full" value={tone} onChange={(e) => setTone(e.target.value)}>
          {['profesional', 'divertido', 'cercano', 'formal', 'persuasivo', 'inspirador', 'urgente', 'poético'].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      )}
      <textarea className="input mb-2 h-20 w-full resize-none" placeholder={modeDef.needsText && selText ? 'Instrucciones adicionales (opcional)' : 'Escribe qué necesitas (p. ej. «texto para anunciar la apertura de mi cafetería»)'} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button className="btn-primary w-full justify-center py-2.5" onClick={run} disabled={busy || !available || (!prompt.trim() && !(modeDef.needsText && selText))}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {busy ? 'Pensando…' : 'Generar'}
      </button>
      {!available && <p className="mt-2 text-xs text-slate-500">{hint || 'La IA de texto no está disponible.'}</p>}
      {result && (
        <div className="mt-3">
          <textarea className="input h-32 w-full" value={result} onChange={(e) => setResult(e.target.value)} />
          <div className="mt-2 flex gap-2">
            {selText && (
              <button className="btn-secondary flex-1 justify-center" onClick={applyToSelected}>
                <Type size={14} /> Sustituir texto
              </button>
            )}
            <button className="btn-secondary flex-1 justify-center" onClick={addAsText}>
              <Type size={14} /> Añadir al diseño
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
