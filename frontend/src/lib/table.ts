import { Group, Rect, Textbox } from 'fabric'
import { useEditor } from '@/store/editor'
import { addObject, asAny, uid } from './fabricUtils'

/** Tabla sencilla: grupo de celdas (rect + texto). Desagrupar para editar. */
export function addTable(rows: number, cols: number) {
  const st = useEditor.getState()
  const canvas = st.canvas
  if (!canvas || !st.design) return
  const W = st.design.width
  const H = st.design.height
  const tw = W * 0.8
  const cw = tw / cols
  const ch = Math.max(48, Math.min(H * 0.1, cw * 0.5))
  const items: any[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isHead = r === 0
      items.push(new Rect({ left: c * cw, top: r * ch, width: cw, height: ch, fill: isHead ? '#7c3aed' : r % 2 ? '#f8fafc' : '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 }))
      items.push(
        new Textbox(isHead ? `Columna ${c + 1}` : 'Texto', {
          left: c * cw + 12,
          top: r * ch + ch / 2,
          originY: 'center',
          width: cw - 24,
          fontSize: Math.max(12, ch * 0.32),
          fontFamily: 'Inter',
          fontWeight: isHead ? 'bold' : 'normal',
          fill: isHead ? '#ffffff' : '#111827',
          editable: true,
        }),
      )
    }
  }
  const g = new Group(items)
  asAny(g).set({ id: uid(), name: 'Tabla', bambaType: 'table' })
  addObject(canvas, g, W, H)
}
