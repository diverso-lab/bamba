import { useEditor } from '@/store/editor'
import { setCanvasBackground, type GradientSpec } from '@/lib/fabricUtils'
import { ColorSwatch, DEFAULT_PALETTE, GRADIENT_PRESETS, SectionTitle, ColorPicker } from '@/components/ui'
import { addImageFromUrl } from '@/lib/actions'
import { useState } from 'react'

export default function BackgroundPanel() {
  const canvas = useEditor((s) => s.canvas)
  const design = useEditor((s) => s.design)!
  const version = useEditor((s) => s.version)
  const brand = useEditor((s) => s.brand)
  const [angle, setAngle] = useState(135)
  const [c1, setC1] = useState('#7c3aed')
  const [c2, setC2] = useState('#ec4899')
  void version
  const current = canvas?.backgroundColor
  const currentStr = typeof current === 'string' ? current : null

  const apply = (fill: string | GradientSpec | null) => canvas && setCanvasBackground(canvas, fill, design.width, design.height)

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span>Color de fondo</span>
        <ColorPicker value={currentStr} onChange={(c) => apply(c)} allowTransparent allowGradient />
        <span className="font-mono text-xs text-slate-500">{currentStr || (current ? 'degradado' : 'transparente')}</span>
      </div>
      <SectionTitle>Colores</SectionTitle>
      <div className="grid grid-cols-6 gap-1.5">
        <ColorSwatch color={null} size={36} selected={!current} onClick={() => apply(null)} title="Transparente" />
        {[...brand.colors, ...DEFAULT_PALETTE].map((c, i) => (
          <ColorSwatch key={c + i} color={c} size={36} selected={currentStr === c} onClick={() => apply(c)} title={c} />
        ))}
      </div>
      <SectionTitle>Degradados</SectionTitle>
      <div className="grid grid-cols-3 gap-1.5">
        {GRADIENT_PRESETS.map((g) => (
          <ColorSwatch key={g.name} color={g.spec} size={92} onClick={() => apply(g.spec)} title={g.name} />
        ))}
      </div>
      <SectionTitle>Degradado personalizado</SectionTitle>
      <div className="flex items-center gap-2 text-sm">
        <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} />
        <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} />
        <input type="range" className="range flex-1" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
        <span className="w-8 text-xs">{angle}°</span>
      </div>
      <div className="mt-2 flex gap-2">
        <button className="btn-secondary flex-1 justify-center" onClick={() => apply({ type: 'linear', angle, stops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }] })}>
          Lineal
        </button>
        <button className="btn-secondary flex-1 justify-center" onClick={() => apply({ type: 'radial', stops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }] })}>
          Radial
        </button>
      </div>
      <SectionTitle>Imagen de fondo</SectionTitle>
      <p className="mb-2 text-xs text-slate-500">Añade una foto desde «Fotos» o «Subidos» y envíala al fondo (clic derecho → Enviar al fondo), o bloquéala para que no se mueva.</p>
      <button
        className="btn-secondary w-full justify-center"
        onClick={async () => {
          const url = prompt('URL de la imagen de fondo')
          if (url) await addImageFromUrl(url.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(url)}` : url)
        }}
      >
        Añadir imagen desde URL
      </button>
    </div>
  )
}
