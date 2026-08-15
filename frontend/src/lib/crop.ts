import { Canvas, FabricImage, Rect } from 'fabric'
import { fireModified } from './fabricUtils'

/**
 * Modo recorte para imágenes: mostramos un rectángulo ajustable sobre la imagen
 * y al aplicar calculamos cropX/cropY/width/height en píxeles de la imagen.
 */
export interface CropSession {
  apply: () => void
  cancel: () => void
  rect: Rect
}

export function startCrop(canvas: Canvas, img: FabricImage): CropSession {
  const savedAngle = img.angle || 0
  const savedSelectable = canvas.getObjects().map((o) => [o, o.selectable, o.evented] as const)
  // Simplificación: recortamos con la imagen sin rotar
  img.set({ angle: 0 })
  img.setCoords()
  const br = img.getBoundingRect()

  const rect = new Rect({
    left: br.left,
    top: br.top,
    width: br.width,
    height: br.height,
    fill: 'rgba(124,58,237,0.12)',
    strokeWidth: 0, // el borde lo dibuja la propia selección de fabric (así el trazo no infla el área)
    lockRotation: true,
    hasRotatingPoint: false,
    cornerColor: '#7c3aed',
    cornerStrokeColor: '#fff',
    transparentCorners: false,
    excludeFromExport: true,
  } as any)
  rect.setControlsVisibility({ mtr: false })
  ;(rect as any).isCropRect = true

  savedSelectable.forEach(([o]) => o.set({ selectable: false, evented: false }))
  canvas.add(rect)
  canvas.setActiveObject(rect)
  canvas.requestRenderAll()

  // mantener el rect dentro de la imagen
  const clamp = () => {
    const w = rect.getScaledWidth()
    const h = rect.getScaledHeight()
    let l = rect.left
    let t = rect.top
    const maxW = br.width
    const maxH = br.height
    if (w > maxW) rect.set({ scaleX: maxW / rect.width })
    if (h > maxH) rect.set({ scaleY: maxH / rect.height })
    const w2 = rect.getScaledWidth()
    const h2 = rect.getScaledHeight()
    if (l < br.left) l = br.left
    if (t < br.top) t = br.top
    if (l + w2 > br.left + br.width) l = br.left + br.width - w2
    if (t + h2 > br.top + br.height) t = br.top + br.height - h2
    rect.set({ left: l, top: t })
    rect.setCoords()
  }
  const onMove = (e: any) => {
    if (e.target === rect) clamp()
  }
  canvas.on('object:moving', onMove)
  canvas.on('object:scaling', onMove)

  const cleanup = () => {
    canvas.off('object:moving', onMove)
    canvas.off('object:scaling', onMove)
    canvas.remove(rect)
    savedSelectable.forEach(([o, s, ev]) => o.set({ selectable: s, evented: ev }))
  }

  return {
    rect,
    cancel: () => {
      cleanup()
      img.set({ angle: savedAngle })
      img.setCoords()
      canvas.setActiveObject(img)
      canvas.requestRenderAll()
    },
    apply: () => {
      clamp()
      const sx = img.scaleX || 1
      const sy = img.scaleY || 1
      // rect en coords de escena → coords de imagen (px de la fuente)
      const rl = rect.left
      const rt = rect.top
      const rw = rect.getScaledWidth()
      const rh = rect.getScaledHeight()
      const imgLeft = br.left
      const imgTop = br.top
      const w = rw / sx
      const h = rh / sy
      // Con la imagen volteada, el borde visual izquierdo corresponde al derecho de la fuente
      const offX = img.flipX ? (imgLeft + br.width - (rl + rw)) / sx : (rl - imgLeft) / sx
      const offY = img.flipY ? (imgTop + br.height - (rt + rh)) / sy : (rt - imgTop) / sy
      const cropX = (img.cropX || 0) + offX
      const cropY = (img.cropY || 0) + offY
      cleanup()
      // Guardamos origen para poder recolocar tras el recorte
      const origin = img.originX === 'center' ? 'center' : 'left'
      img.set({ cropX, cropY, width: w, height: h })
      if (origin === 'center') {
        img.set({ left: rl + rw / 2, top: rt + rh / 2 })
      } else {
        img.set({ left: rl, top: rt })
      }
      img.set({ angle: savedAngle })
      img.setCoords()
      canvas.setActiveObject(img)
      canvas.requestRenderAll()
      fireModified(canvas, img)
    },
  }
}

export function resetCrop(canvas: Canvas, img: FabricImage) {
  const { width: nw, height: nh } = img.getOriginalSize()
  img.set({ cropX: 0, cropY: 0, width: nw || img.width, height: nh || img.height })
  img.setCoords()
  canvas.requestRenderAll()
  fireModified(canvas, img)
}
