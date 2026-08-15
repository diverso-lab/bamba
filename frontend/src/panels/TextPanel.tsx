import { addStyledText, addText } from '@/lib/actions'
import { useEditor } from '@/store/editor'
import { SectionTitle } from '@/components/ui'
import { Type } from 'lucide-react'
import { applyTextEffect } from '@/lib/fabricUtils'
import { ensureFont } from '@/lib/fonts'

const COMBOS: { name: string; lines: { text: string; props: Record<string, any> }[]; previewBg?: string }[] = [
  { name: 'Titular impacto', lines: [{ text: 'GRAN APERTURA', props: { fontFamily: 'Anton', fontSize: 120, fill: '#111827', charSpacing: 60 } }] },
  { name: 'Elegante', lines: [{ text: 'Colección de verano', props: { fontFamily: 'Playfair Display', fontSize: 84, fontStyle: 'italic', fill: '#111827' } }, { text: 'DISPONIBLE AHORA', props: { fontFamily: 'Montserrat', fontSize: 28, charSpacing: 400, fill: '#6b7280' } }] },
  { name: 'Manuscrito', lines: [{ text: 'gracias', props: { fontFamily: 'Great Vibes', fontSize: 140, fill: '#a21caf' } }] },
  { name: 'Neón', lines: [{ text: 'OPEN', props: { fontFamily: 'Monoton', fontSize: 120, fill: '#22d3ee', effect: 'neon' } }], previewBg: '#0f172a' },
  { name: 'Retro', lines: [{ text: 'RETRO WAVE', props: { fontFamily: 'Righteous', fontSize: 96, fill: '#f472b6', effect: 'echo', effectColor: '#7c3aed' } }] },
  { name: 'Contorno', lines: [{ text: 'BOLD', props: { fontFamily: 'Archivo Black', fontSize: 130, fill: '#facc15', effect: 'outline', effectColor: '#111827' } }] },
  { name: 'Hueco', lines: [{ text: 'HOLLOW', props: { fontFamily: 'Bebas Neue', fontSize: 140, fill: '#111827', effect: 'hollow' } }] },
  { name: 'Resaltado', lines: [{ text: ' Oferta especial ', props: { fontFamily: 'Poppins', fontWeight: '700', fontSize: 64, fill: '#111827', effect: 'background', effectColor: '#fde047' } }] },
  { name: 'Cita', lines: [{ text: '“Hazlo simple”', props: { fontFamily: 'Merriweather', fontSize: 72, fontStyle: 'italic', fill: '#334155' } }, { text: '— Autor', props: { fontFamily: 'Inter', fontSize: 28, fill: '#94a3b8' } }] },
  { name: 'Divertido', lines: [{ text: '¡Fiesta!', props: { fontFamily: 'Bangers', fontSize: 130, fill: '#f97316', effect: 'shadow' } }] },
]

export default function TextPanel() {
  const brand = useEditor((s) => s.brand)
  const design = useEditor((s) => s.design)!
  const canvas = useEditor((s) => s.canvas)

  const addCombo = async (combo: (typeof COMBOS)[number]) => {
    if (!canvas) return
    const scale = design.width / 1080
    let top = design.height * 0.4
    for (const line of combo.lines) {
      const { effect, effectColor, ...props } = line.props
      const fontSize = Math.round(props.fontSize * scale)
      const t = await addStyledText(line.text, { ...props, fontSize })
      if (!t) continue
      t.set({ top })
      if (effect) applyTextEffect(t as any, effect, { color: effectColor })
      t.setCoords()
      top += t.getScaledHeight() + 10 * scale
    }
    canvas.requestRenderAll()
  }

  return (
    <div>
      <button className="btn-primary mb-4 w-full justify-center py-2.5" onClick={() => addText('body')}>
        <Type size={16} /> Añadir un cuadro de texto
      </button>
      <SectionTitle>Estilos de texto por defecto</SectionTitle>
      <div className="space-y-2">
        <button className="card w-full px-3 py-3 text-left text-2xl font-bold hover:border-brand-400" onClick={() => addText('heading')}>
          Añade un título
        </button>
        <button className="card w-full px-3 py-2.5 text-left text-base font-semibold hover:border-brand-400" onClick={() => addText('subheading')}>
          Añade un subtítulo
        </button>
        <button className="card w-full px-3 py-2 text-left text-sm hover:border-brand-400" onClick={() => addText('body')}>
          Añade un poco de texto
        </button>
      </div>
      {brand.fonts.length > 0 && (
        <>
          <SectionTitle>Fuentes de marca</SectionTitle>
          <div className="space-y-1">
            {brand.fonts.map((f) => (
              <button
                key={f.family}
                className="card w-full px-3 py-2 text-left text-lg hover:border-brand-400"
                style={{ fontFamily: f.family }}
                onClick={async () => {
                  await ensureFont(f.family)
                  addText('heading', { fontFamily: f.family })
                }}
              >
                {f.family}
              </button>
            ))}
          </div>
        </>
      )}
      <SectionTitle>Combinaciones de fuentes</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {COMBOS.map((c) => (
          <button key={c.name} onClick={() => addCombo(c)} className="card flex aspect-[4/3] flex-col items-center justify-center overflow-hidden p-2 text-center hover:border-brand-400" style={{ background: c.previewBg || '#fff' }} title={c.name}>
            {c.lines.map((l, i) => (
              <span
                key={i}
                className="block max-w-full truncate leading-tight"
                style={{
                  fontFamily: l.props.fontFamily,
                  fontStyle: l.props.fontStyle,
                  fontWeight: l.props.fontWeight,
                  color: l.props.effect === 'hollow' ? 'transparent' : l.props.fill,
                  WebkitTextStroke: l.props.effect === 'hollow' ? `1px ${l.props.fill}` : l.props.effect === 'outline' ? `1px ${l.props.effectColor}` : undefined,
                  textShadow: l.props.effect === 'neon' ? `0 0 12px ${l.props.fill}` : l.props.effect === 'echo' ? `3px 3px 0 ${l.props.effectColor}` : l.props.effect === 'shadow' ? '2px 2px 4px rgba(0,0,0,.4)' : undefined,
                  background: l.props.effect === 'background' ? l.props.effectColor : undefined,
                  fontSize: i === 0 ? Math.min(26, l.props.fontSize / 4.5) : 11,
                  letterSpacing: l.props.charSpacing ? `${l.props.charSpacing / 1000}em` : undefined,
                }}
              >
                {l.text}
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  )
}
