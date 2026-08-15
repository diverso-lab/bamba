import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { uid } from '@/lib/fabricUtils'
import { flushSave, saveDesign } from '@/lib/pages'
import { useEditor } from '@/store/editor'
import TopBar from './TopBar'
import SideRail from './SideRail'
import ContextToolbar from './ContextToolbar'
import CanvasArea from './CanvasArea'
import BottomBar from './BottomBar'
import PresentMode from './PresentMode'

export default function Editor({ designId }: { designId: string }) {
  const set = useEditor((s) => s.set)
  const design = useEditor((s) => s.design)
  const busy = useEditor((s) => s.busy)
  const present = useEditor((s) => s.present)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    set({ design: null, pageIndex: 0, canvas: null, history: null, selection: [], activeTab: 'design', cropSession: null, drawing: false, present: false, dirty: false, frameTarget: null })
    api
      .getDesign(designId)
      .then((d) => {
        if (!alive) return
        if (!d.pages?.length) d.pages = [{ id: uid(), json: null, thumbnail: null }]
        const role = (d.role as any) || 'owner'
        set({ design: d, role, readOnly: role === 'view' })
        setStatus('ready')
        document.title = `${d.name} — bamba`
        import('@/lib/collab').then((m) => m.connectCollab(d.id))
      })
      .catch((e) => {
        if (!alive) return
        setErr(e.message)
        setStatus('error')
      })
    api
      .getBrand()
      .then((b) => alive && set({ brand: b }))
      .catch(() => {})
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty || useEditor.getState().cropSession) {
        flushSave()
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      alive = false
      window.removeEventListener('beforeunload', onBeforeUnload)
      // guardado de emergencia (p. ej. botón "atrás" del navegador) antes de que se destruya el canvas
      flushSave()
      import('@/lib/collab').then((m) => m.disconnectCollab())
      document.title = 'bamba — diseña lo que quieras'
    }
  }, [designId])

  if (status === 'loading' || !design) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-500">
        {status === 'error' ? (
          <div className="card p-6 text-center">
            <p className="text-red-600">No se pudo abrir el diseño: {err}</p>
            <a href="#/" className="btn-primary mt-4 inline-flex">
              Volver al inicio
            </a>
          </div>
        ) : (
          <>
            <Loader2 className="animate-spin" /> Cargando diseño…
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#ebecf0]">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <SideRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <ContextToolbar />
          <CanvasArea />
          <BottomBar />
        </div>
      </div>
      {busy && (
        <div className="pointer-events-auto fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/30">
          <div className="fade-in flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-xl">
            <Loader2 className="animate-spin text-brand-600" />
            <span className="text-sm">{busy}</span>
          </div>
        </div>
      )}
      {present && <PresentMode />}
    </div>
  )
}
