import { StaticCanvas } from 'fabric'
import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import { ensureFontsInJson } from './fonts'

export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf' | 'webp'

export interface ExportOptions {
  format: ExportFormat
  scale: number // 1 = tamaño original, 2 = @2x…
  quality: number // 0..1 (jpeg/webp)
  transparent: boolean // png: sin fondo
  pages: 'current' | 'all'
}

async function renderPage(json: any, W: number, H: number, opts: { transparent?: boolean; scale?: number; format?: 'png' | 'jpeg' | 'webp'; quality?: number }) {
  await ensureFontsInJson(json)
  const sc = new StaticCanvas(undefined, { width: W, height: H, enableRetinaScaling: false })
  if (json) await sc.loadFromJSON(json)
  if (opts.transparent) sc.backgroundColor = ''
  else if (!sc.backgroundColor) sc.backgroundColor = '#ffffff'
  sc.renderAll()
  const dataUrl = sc.toDataURL({
    format: (opts.format === 'webp' ? 'png' : opts.format) || 'png',
    multiplier: opts.scale || 1,
    quality: opts.quality ?? 0.92,
    enableRetinaScaling: false,
  } as any)
  let out = dataUrl
  if (opts.format === 'webp') {
    out = await convertDataUrl(dataUrl, 'image/webp', opts.quality ?? 0.92)
  }
  sc.dispose()
  return out
}

async function renderPageSvg(json: any, W: number, H: number, transparent: boolean) {
  await ensureFontsInJson(json)
  const sc = new StaticCanvas(undefined, { width: W, height: H })
  if (json) await sc.loadFromJSON(json)
  if (transparent) sc.backgroundColor = ''
  const svg = sc.toSVG({ width: `${W}`, height: `${H}`, viewBox: { x: 0, y: 0, width: W, height: H } } as any)
  sc.dispose()
  return svg
}

function convertDataUrl(dataUrl: string, mime: string, quality: number): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      c.getContext('2d')!.drawImage(img, 0, 0)
      res(c.toDataURL(mime, quality))
    }
    img.onerror = () => rej(new Error('convert'))
    img.src = dataUrl
  })
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'application/octet-stream'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'bamba'

export async function exportDesign(name: string, pagesJson: any[], currentIndex: number, W: number, H: number, opts: ExportOptions, onProgress?: (i: number, total: number) => void) {
  const pages = opts.pages === 'all' ? pagesJson : [pagesJson[currentIndex]]
  const base = slug(name)

  if (opts.format === 'pdf') {
    const pdf = new jsPDF({ orientation: W >= H ? 'landscape' : 'portrait', unit: 'px', format: [W, H], hotfixes: ['px_scaling'], compress: true })
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, pages.length)
      const url = await renderPage(pages[i], W, H, { format: 'jpeg', quality: 0.95, scale: Math.min(opts.scale, 2) })
      if (i > 0) pdf.addPage([W, H], W >= H ? 'landscape' : 'portrait')
      pdf.addImage(url, 'JPEG', 0, 0, W, H)
    }
    pdf.save(`${base}.pdf`)
    return
  }

  if (opts.format === 'svg') {
    if (pages.length === 1) {
      const svg = await renderPageSvg(pages[0], W, H, opts.transparent)
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${base}.svg`)
      return
    }
    const zip = new JSZip()
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, pages.length)
      zip.file(`${base}-${i + 1}.svg`, await renderPageSvg(pages[i], W, H, opts.transparent))
    }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}.zip`)
    return
  }

  const ext = opts.format === 'jpeg' ? 'jpg' : opts.format
  if (pages.length === 1) {
    const url = await renderPage(pages[0], W, H, { format: opts.format, quality: opts.quality, scale: opts.scale, transparent: opts.transparent && opts.format === 'png' })
    downloadDataUrl(url, `${base}.${ext}`)
    return
  }
  const zip = new JSZip()
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i + 1, pages.length)
    const url = await renderPage(pages[i], W, H, { format: opts.format, quality: opts.quality, scale: opts.scale, transparent: opts.transparent && opts.format === 'png' })
    zip.file(`${base}-${i + 1}.${ext}`, dataUrlToBlob(url))
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}.zip`)
}

/** Miniatura JPEG pequeña de una página (para la home / barra de páginas). */
export async function renderThumbnail(json: any, W: number, H: number, maxSide = 360): Promise<string> {
  const scale = maxSide / Math.max(W, H)
  return renderPage(json, W, H, { format: 'jpeg', quality: 0.7, scale })
}
