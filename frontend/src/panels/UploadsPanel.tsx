import { useEffect, useRef, useState } from 'react'
import { Trash2, Upload, Wand2 } from 'lucide-react'
import { api } from '@/lib/api'
import { addImageFromUrl, uploadAndAdd } from '@/lib/actions'
import type { UploadItem } from '@/lib/types'
import { useEditor } from '@/store/editor'
import { SectionTitle } from '@/components/ui'

export default function UploadsPanel() {
  const [items, setItems] = useState<UploadItem[]>([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const frameTarget = useEditor((s) => s.frameTarget)
  const toast = useEditor((s) => s.toast)

  const load = async () => {
    try {
      const all = await api.listUploads()
      setItems(all.filter((i) => i.kind !== 'font'))
    } catch (e: any) {
      toast(`No se pudieron cargar las subidas: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    // Solo subimos (sin añadir) si hay más de uno; si es uno lo añadimos al lienzo
    if (files.length === 1) await uploadAndAdd(files)
    else {
      for (const f of Array.from(files)) {
        try {
          await api.upload(f)
        } catch (e: any) {
          toast(`Error al subir ${f.name}: ${e.message}`, 'error')
        }
      }
    }
    void load()
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void onFiles(e.dataTransfer.files)
      }}
    >
      <input ref={inputRef} type="file" accept="image/*,.svg,video/mp4,video/webm,.mp4,.webm,.mov" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <button className="btn-primary mb-3 w-full justify-center py-2.5" onClick={() => inputRef.current?.click()}>
        <Upload size={16} /> Subir archivos
      </button>
      {frameTarget && (
        <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50 p-2 text-xs text-brand-800">
          Elige una imagen para rellenar el marco seleccionado.
        </div>
      )}
      <p className="mb-3 text-xs text-slate-500">Arrastra imágenes o vídeos aquí o al lienzo. Formatos: PNG, JPG, WebP, GIF, SVG, MP4, WebM.</p>
      <SectionTitle>Imágenes y vídeos</SectionTitle>
      {loading ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400">Aún no has subido nada.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((it) => (
            <div key={it.id} className="group relative">
              <button
                className="checker flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 hover:border-brand-400"
                onClick={() => (it.kind === 'video' ? import('@/lib/actions').then((m) => m.addVideoFromUrl(it.url)) : addImageFromUrl(it.url))}
                draggable={it.kind !== 'video'}
                onDragStart={(e) => e.dataTransfer.setData('text/bamba-image', it.url)}
                title={it.name}
              >
                {it.kind === 'video' ? <video src={it.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={it.url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />}
              </button>
              {it.kind === 'video' && <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">▶ vídeo</span>}
              <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                <button
                  className="rounded-md bg-white/90 p-1 shadow hover:bg-white"
                  title="Añadir y quitar fondo"
                  onClick={async () => {
                    await addImageFromUrl(it.url)
                    const { removeBackgroundOfSelection } = await import('@/lib/actions')
                    await removeBackgroundOfSelection()
                  }}
                >
                  <Wand2 size={14} />
                </button>
                <button
                  className="rounded-md bg-white/90 p-1 shadow hover:bg-white"
                  title="Eliminar de subidas"
                  onClick={async () => {
                    if (!confirm('¿Eliminar este archivo de tus subidas?')) return
                    await api.deleteUpload(it.id)
                    void load()
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
