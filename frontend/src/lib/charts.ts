import { Circle, FabricText, Group, Line, Path, Polyline, Rect } from 'fabric'
import { asAny, uid } from './fabricUtils'

export type ChartType = 'column' | 'bar' | 'pie' | 'donut' | 'line'

export interface ChartData {
  type: ChartType
  labels: string[]
  values: number[]
  colors: string[]
  showValues: boolean
  fontFamily: string
  textColor: string
}

export const DEFAULT_CHART: ChartData = {
  type: 'column',
  labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May'],
  values: [12, 19, 8, 24, 15],
  colors: ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#8b5cf6'],
  showValues: true,
  fontFamily: 'Inter',
  textColor: '#111827',
}

const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })

export function createChart(data: ChartData, size = 520): Group {
  const W = size
  const H = size * 0.7
  const items: any[] = []
  const n = data.values.length
  const max = Math.max(...data.values, 1)
  const color = (i: number) => data.colors[i % data.colors.length]
  const font = { fontFamily: data.fontFamily, fill: data.textColor }
  const fs = Math.max(10, size * 0.028)

  if (data.type === 'column' || data.type === 'bar') {
    const pad = size * 0.06
    const axisColor = '#cbd5e1'
    if (data.type === 'column') {
      const chartH = H - pad * 2
      const slot = (W - pad * 2) / n
      const bw = slot * 0.62
      items.push(new Line([pad, H - pad, W - pad, H - pad], { stroke: axisColor, strokeWidth: 2 }))
      data.values.forEach((v, i) => {
        const h = (v / max) * chartH
        const x = pad + i * slot + (slot - bw) / 2
        items.push(new Rect({ left: x, top: H - pad - h, width: bw, height: h, fill: color(i), rx: bw * 0.08, ry: bw * 0.08 }))
        items.push(new FabricText(data.labels[i] ?? '', { ...font, fontSize: fs, left: x + bw / 2, top: H - pad + fs * 0.4, originX: 'center' }))
        if (data.showValues) items.push(new FabricText(String(v), { ...font, fontSize: fs, fontWeight: 'bold', left: x + bw / 2, top: H - pad - h - fs * 1.3, originX: 'center' }))
      })
    } else {
      const labelW = size * 0.16
      const chartW = W - pad * 2 - labelW
      const slot = (H - pad * 2) / n
      const bh = slot * 0.62
      items.push(new Line([pad + labelW, pad, pad + labelW, H - pad], { stroke: axisColor, strokeWidth: 2 }))
      data.values.forEach((v, i) => {
        const w = (v / max) * chartW
        const y = pad + i * slot + (slot - bh) / 2
        items.push(new Rect({ left: pad + labelW, top: y, width: w, height: bh, fill: color(i), rx: bh * 0.08, ry: bh * 0.08 }))
        items.push(new FabricText(data.labels[i] ?? '', { ...font, fontSize: fs, left: pad + labelW - fs * 0.5, top: y + bh / 2, originX: 'right', originY: 'center' }))
        if (data.showValues) items.push(new FabricText(String(v), { ...font, fontSize: fs, fontWeight: 'bold', left: pad + labelW + w + fs * 0.4, top: y + bh / 2, originY: 'center' }))
      })
    }
  } else if (data.type === 'pie' || data.type === 'donut') {
    const total = data.values.reduce((s, v) => s + Math.max(0, v), 0) || 1
    const cx = H / 2
    const cy = H / 2
    const r = H / 2 - size * 0.02
    const ri = data.type === 'donut' ? r * 0.55 : 0
    let a0 = -Math.PI / 2
    data.values.forEach((v, i) => {
      const frac = Math.max(0, v) / total
      const a1 = a0 + frac * Math.PI * 2
      const large = a1 - a0 > Math.PI ? 1 : 0
      const p0 = polar(cx, cy, r, a0)
      const p1 = polar(cx, cy, r, a1)
      let d: string
      if (ri > 0) {
        const q0 = polar(cx, cy, ri, a1)
        const q1 = polar(cx, cy, ri, a0)
        d = `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} L ${q0.x} ${q0.y} A ${ri} ${ri} 0 ${large} 0 ${q1.x} ${q1.y} Z`
      } else {
        d = `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`
      }
      if (frac >= 0.9999) {
        items.push(new Circle({ left: cx - r, top: cy - r, radius: r, fill: color(i) }))
        if (ri > 0) items.push(new Circle({ left: cx - ri, top: cy - ri, radius: ri, fill: '#ffffff' }))
      } else if (frac > 0) {
        items.push(new Path(d, { fill: color(i), stroke: '#ffffff', strokeWidth: 2 }))
      }
      if (data.showValues && frac > 0.04) {
        const mid = (a0 + a1) / 2
        const lp = polar(cx, cy, ri > 0 ? (r + ri) / 2 : r * 0.65, mid)
        items.push(new FabricText(`${Math.round(frac * 100)}%`, { fontFamily: data.fontFamily, fontSize: fs, fontWeight: 'bold', fill: '#ffffff', left: lp.x, top: lp.y, originX: 'center', originY: 'center' }))
      }
      a0 = a1
    })
    // leyenda
    const lx = H + size * 0.04
    data.labels.forEach((l, i) => {
      const y = size * 0.02 + i * fs * 1.9
      items.push(new Rect({ left: lx, top: y, width: fs, height: fs, fill: color(i), rx: 3, ry: 3 }))
      items.push(new FabricText(l, { ...font, fontSize: fs, left: lx + fs * 1.5, top: y + fs / 2, originY: 'center' }))
    })
  } else if (data.type === 'line') {
    const pad = size * 0.06
    const chartH = H - pad * 2
    const chartW = W - pad * 2
    items.push(new Line([pad, H - pad, W - pad, H - pad], { stroke: '#cbd5e1', strokeWidth: 2 }))
    items.push(new Line([pad, pad, pad, H - pad], { stroke: '#cbd5e1', strokeWidth: 2 }))
    const pts = data.values.map((v, i) => ({ x: pad + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2), y: H - pad - (v / max) * chartH }))
    items.push(new Polyline(pts, { fill: '', stroke: color(0), strokeWidth: Math.max(2, size * 0.008), strokeLineJoin: 'round', strokeLineCap: 'round' }))
    pts.forEach((p, i) => {
      items.push(new Circle({ left: p.x - fs * 0.35, top: p.y - fs * 0.35, radius: fs * 0.35, fill: '#ffffff', stroke: color(0), strokeWidth: 3 }))
      items.push(new FabricText(data.labels[i] ?? '', { ...font, fontSize: fs, left: p.x, top: H - pad + fs * 0.4, originX: 'center' }))
      if (data.showValues) items.push(new FabricText(String(data.values[i]), { ...font, fontSize: fs, fontWeight: 'bold', left: p.x, top: p.y - fs * 1.6, originX: 'center' }))
    })
  }

  const g = new Group(items, { subTargetCheck: false, interactive: false })
  asAny(g).set({ id: uid(), bambaType: 'chart', chartData: JSON.parse(JSON.stringify(data)), name: 'Gráfico' })
  return g
}
