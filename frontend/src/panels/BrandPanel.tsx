import { useRef, useState } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { registerCustomFont, ensureFont } from '@/lib/fonts'
import { useEditor } from '@/store/editor'
import { addImageFromUrl, addText } from '@/lib/actions'
import { ColorPicker, SectionTitle } from '@/components/ui'
import type { BrandKit } from '@/lib/types'

export default function BrandPanel() {
  const brand = useEditor((s) => s.brand)
  const set = useEditor((s) => s.set)
  const toast = useEditor((s) => s.toast)
  const [newColor, setNewColor] = useState('#7c3aed')
  const fontInput = useRef<HTMLInputElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  const save = async (b: BrandKit) => {
    set({ brand: b })
    try {
      await api.putBrand(b)
    } catch (e: any) {
      toast(`No se pudo guardar el kit de marca: ${e.message}`, 'error')
    }
  }

  const addFont = async (files: FileList | null) => {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      try {
        const item = await api.upload(f)
        const family = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
        registerCustomFont(family, item.url)
        await ensureFont(family)
        const cur = useEditor.getState().brand
        await save({ ...cur, fonts: [...cur.fonts, { family, url: item.url, uploadId: item.id }] })
      } catch (e: any) {
        toast(`Error con la fuente ${f.name}: ${e.message}`, 'error')
      }
    }
  }

  const addLogo = async (files: FileList | null) => {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      const item = await api.upload(f)
      const cur = useEditor.getState().brand
      await save({ ...cur, logos: [...cur.logos, { url: item.url, name: f.name }] })
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">Guarda tus colores, fuentes y logos para reutilizarlos en todos los diseños.</p>
      <SectionTitle
        action={
          <div className="flex items-center gap-1">
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0" />
            <button className="icon-btn h-7 w-7" title="Añadir color" onClick={() => !brand.colors.includes(newColor) && save({ ...brand, colors: [...brand.colors, newColor] })}>
              <Plus size={14} />
            </button>
          </div>
        }
      >
        Colores de marca
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        {brand.colors.map((c) => (
          <div key={c} className="group relative">
            <div className="h-9 w-9 rounded-lg border border-slate-200" style={{ background: c }} title={c} />
            <button className="absolute -right-1 -top-1 hidden rounded-full bg-white p-0.5 shadow group-hover:block" onClick={() => save({ ...brand, colors: brand.colors.filter((x) => x !== c) })}>
              <Trash2 size={10} />
            </button>
          </div>
        ))}
        {brand.colors.length === 0 && <span className="text-xs text-slate-400">Sin colores aún.</span>}
      </div>

      <SectionTitle
        action={
          <button className="btn-ghost text-xs" onClick={() => fontInput.current?.click()}>
            <Upload size={12} /> Subir fuente
          </button>
        }
      >
        Fuentes de marca
      </SectionTitle>
      <input ref={fontInput} type="file" accept=".ttf,.otf,.woff,.woff2" multiple hidden onChange={(e) => addFont(e.target.files)} />
      <div className="space-y-1">
        {brand.fonts.map((f) => (
          <div key={f.family} className="card group flex items-center justify-between px-3 py-2">
            <button className="text-left text-base" style={{ fontFamily: f.family }} onClick={async () => { await ensureFont(f.family); addText('heading', { fontFamily: f.family }) }}>
              {f.family}
            </button>
            <button className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => save({ ...brand, fonts: brand.fonts.filter((x) => x.family !== f.family) })}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {brand.fonts.length === 0 && <span className="text-xs text-slate-400">Sube archivos .ttf/.otf/.woff.</span>}
      </div>

      <SectionTitle
        action={
          <button className="btn-ghost text-xs" onClick={() => logoInput.current?.click()}>
            <Upload size={12} /> Subir logo
          </button>
        }
      >
        Logos
      </SectionTitle>
      <input ref={logoInput} type="file" accept="image/*" multiple hidden onChange={(e) => addLogo(e.target.files)} />
      <div className="grid grid-cols-3 gap-2">
        {brand.logos.map((l) => (
          <div key={l.url} className="group relative">
            <button className="checker flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 hover:border-brand-400" onClick={() => addImageFromUrl(l.url)}>
              <img src={l.url} alt={l.name} className="max-h-full max-w-full object-contain" />
            </button>
            <button className="absolute right-1 top-1 hidden rounded-full bg-white p-1 shadow group-hover:block" onClick={() => save({ ...brand, logos: brand.logos.filter((x) => x.url !== l.url) })}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6 text-xs text-slate-500">
        Consejo: en cualquier selector de color verás una sección «Colores de marca».
        <span className="ml-1 inline-flex align-middle">
          <ColorPicker value={newColor} onChange={(c) => typeof c === 'string' && setNewColor(c)} title="Probar selector" />
        </span>
      </div>
    </div>
  )
}
