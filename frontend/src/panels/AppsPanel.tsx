import { useState } from 'react'
import { BarChart3, QrCode, Smile, Table2, Wand2, Frame, Palette, Type, Sparkles } from 'lucide-react'
import { ChartDialog, QrDialog } from '@/components/dialogs'
import { useEditor } from '@/store/editor'
import { removeBackgroundOfSelection } from '@/lib/actions'

export default function AppsPanel() {
  const [qr, setQr] = useState(false)
  const [chart, setChart] = useState(false)
  const set = useEditor((s) => s.set)
  const toast = useEditor((s) => s.toast)

  const APPS = [
    { id: 'ai-image', name: 'Imagen mágica (IA)', desc: 'Genera imágenes a partir de una descripción', icon: Sparkles, run: () => set({ activeTab: 'ai' }) },
    { id: 'ai-text', name: 'Texto mágico (IA)', desc: 'Escribe, reescribe, traduce o resume textos', icon: Sparkles, run: () => set({ activeTab: 'ai' }) },
    { id: 'photo', name: 'Editar foto', desc: 'Filtros, duotono, sombras, desenfocar fondo…', icon: Palette, run: () => set({ activeTab: 'photo' }) },
    { id: 'graphics', name: 'Stickers y gráficos', desc: 'Miles de stickers, ilustraciones, logos y banderas', icon: Smile, run: () => set({ activeTab: 'graphics' }) },
    { id: 'bg', name: 'Quitar fondo', desc: 'Elimina el fondo de la imagen seleccionada con IA', icon: Wand2, run: () => removeBackgroundOfSelection() },
    { id: 'qr', name: 'Código QR', desc: 'Genera un QR de una URL o texto', icon: QrCode, run: () => setQr(true) },
    { id: 'chart', name: 'Gráficos', desc: 'Barras, líneas, tarta y anillo con tus datos', icon: BarChart3, run: () => setChart(true) },
    { id: 'emoji', name: 'Emojis', desc: 'Emojis y stickers para tus diseños', icon: Smile, run: () => set({ activeTab: 'elements' }) },
    { id: 'frames', name: 'Marcos y cuadrículas', desc: 'Coloca fotos dentro de formas', icon: Frame, run: () => set({ activeTab: 'elements' }) },
    { id: 'table', name: 'Tablas', desc: 'Inserta una tabla editable', icon: Table2, run: async () => { const { addTable } = await import('@/lib/table'); addTable(3, 3); toast('Desagrupa la tabla (Ctrl+Shift+G) para editar sus celdas.') } },
    { id: 'palette', name: 'Paletas y estilos', desc: 'Aplica combinaciones de colores y fuentes', icon: Palette, run: () => set({ activeTab: 'design' }) },
    { id: 'texteffects', name: 'Efectos de texto', desc: 'Sombra, neón, contorno, hueco…', icon: Type, run: () => set({ activeTab: 'text' }) },
  ]

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">Herramientas integradas en bamba. Todas funcionan en local, sin servicios de pago.</p>
      <div className="space-y-2">
        {APPS.map((a) => {
          const Icon = a.icon
          return (
            <button key={a.id} onClick={a.run} className="card flex w-full items-center gap-3 p-3 text-left hover:border-brand-400">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon size={20} />
              </span>
              <span>
                <span className="block text-sm font-medium">{a.name}</span>
                <span className="block text-xs text-slate-500">{a.desc}</span>
              </span>
            </button>
          )
        })}
      </div>
      {qr && <QrDialog onClose={() => setQr(false)} />}
      {chart && <ChartDialog onClose={() => setChart(false)} />}
    </div>
  )
}
