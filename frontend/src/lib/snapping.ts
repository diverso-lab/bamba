import type { Canvas, FabricObject } from 'fabric'

/**
 * Guías inteligentes: alinea el objeto que se está moviendo con los bordes/centros
 * de la página y del resto de objetos, dibujando líneas magenta.
 */
export function attachSnapping(canvas: Canvas, getSize: () => { W: number; H: number }, threshold = 6) {
  let vLines: number[] = []
  let hLines: number[] = []

  const onMoving = (e: any) => {
    const target: FabricObject = e.target
    if (!target || (e.e && (e.e.altKey || e.e.metaKey))) {
      vLines = []
      hLines = []
      return
    }
    const zoom = canvas.getZoom() || 1
    const th = threshold / zoom
    const { W, H } = getSize()
    target.setCoords() // object:moving se dispara antes de que fabric actualice aCoords
    const br = target.getBoundingRect()
    const cx = br.left + br.width / 2
    const cy = br.top + br.height / 2

    const xs: number[] = [0, W / 2, W]
    const ys: number[] = [0, H / 2, H]
    const others = canvas.getObjects().filter((o) => o !== target && o.visible && !(target as any)._objects?.includes(o))
    for (const o of others) {
      const b = o.getBoundingRect()
      xs.push(b.left, b.left + b.width / 2, b.left + b.width)
      ys.push(b.top, b.top + b.height / 2, b.top + b.height)
    }

    let dx = 0,
      dy = 0
    let bestX = th,
      bestY = th
    vLines = []
    hLines = []
    const candX = [
      { v: br.left, d: 0 },
      { v: cx, d: 1 },
      { v: br.left + br.width, d: 2 },
    ]
    const candY = [
      { v: br.top, d: 0 },
      { v: cy, d: 1 },
      { v: br.top + br.height, d: 2 },
    ]
    let snapX: number | null = null
    let snapY: number | null = null
    for (const x of xs) {
      for (const c of candX) {
        const diff = x - c.v
        if (Math.abs(diff) < bestX) {
          bestX = Math.abs(diff)
          dx = diff
          snapX = x
        }
      }
    }
    for (const y of ys) {
      for (const c of candY) {
        const diff = y - c.v
        if (Math.abs(diff) < bestY) {
          bestY = Math.abs(diff)
          dy = diff
          snapY = y
        }
      }
    }
    if (snapX !== null) vLines.push(snapX)
    if (snapY !== null) hLines.push(snapY)
    if (dx || dy) {
      target.set({ left: target.left + dx, top: target.top + dy })
      target.setCoords()
    }
  }

  const clear = () => {
    vLines = []
    hLines = []
    canvas.requestRenderAll()
  }

  const onAfterRender = (e: any) => {
    if (!vLines.length && !hLines.length) return
    const ctx: CanvasRenderingContext2D = e.ctx || canvas.getContext()
    const vpt = canvas.viewportTransform
    const { W, H } = getSize()
    ctx.save()
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])
    ctx.strokeStyle = '#ec4899'
    ctx.lineWidth = 1 / (canvas.getZoom() || 1)
    ctx.setLineDash([6 / (canvas.getZoom() || 1), 4 / (canvas.getZoom() || 1)])
    for (const x of vLines) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    for (const y of hLines) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  canvas.on('object:moving', onMoving)
  canvas.on('mouse:up', clear)
  canvas.on('after:render', onAfterRender)
  return () => {
    canvas.off('object:moving', onMoving)
    canvas.off('mouse:up', clear)
    canvas.off('after:render', onAfterRender)
  }
}
