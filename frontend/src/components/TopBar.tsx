import { useEffect, useState } from 'react'
import { Check, ChevronDown, Cloud, CloudOff, Download, FilePlus2, Home, Loader2, Maximize2, MonitorPlay, Redo2, Save, Undo2, Copy, Share2, Info } from 'lucide-react'
import { navigate } from '@/App'
import { api } from '@/lib/api'
import { saveDesign, scheduleSave } from '@/lib/pages'
import { useEditor } from '@/store/editor'
import { Popover, IconBtn } from './ui'
import { ExportDialog, ResizeDialog, ShortcutsDialog } from './dialogs'
import UserMenu from './UserMenu'
import ShareDialog from './ShareDialog'

export default function TopBar() {
  const design = useEditor((s) => s.design)!
  const set = useEditor((s) => s.set)
  const history = useEditor((s) => s.history)
  const canUndo = useEditor((s) => s.canUndo)
  const canRedo = useEditor((s) => s.canRedo)
  const saving = useEditor((s) => s.saving)
  const dirty = useEditor((s) => s.dirty)
  const lastSaved = useEditor((s) => s.lastSaved)
  const toast = useEditor((s) => s.toast)
  const [name, setName] = useState(design.name)
  const [exportOpen, setExportOpen] = useState(false)
  const [resizeOpen, setResizeOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const peers = useEditor((s) => s.peers)
  const collabStatus = useEditor((s) => s.collabStatus)
  const readOnly = useEditor((s) => s.readOnly)
  useEffect(() => setName(design.name), [design.name])

  const commitName = () => {
    const n = name.trim() || 'Sin título'
    if (n !== design.name) {
      set({ design: { ...design, name: n } })
      document.title = `${n} — bamba`
      scheduleSave(300)
      import('@/lib/collab').then((m) => m.broadcastDesignMeta())
    }
  }

  const goHome = async () => {
    await saveDesign()
    navigate('/')
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3">
      <button onClick={goHome} className="mr-1 flex items-center rounded-lg px-1.5 py-1 hover:bg-slate-100" title="Inicio">
        <img src="/logo-mark.svg" alt="bamba" className="h-9 w-9" />
      </button>
      <button onClick={goHome} className="btn-ghost hidden md:inline-flex">
        <Home size={16} /> Inicio
      </button>

      <Popover
        width={240}
        trigger={(open) => (
          <span className={`btn-ghost ${open ? 'bg-slate-200/70' : ''}`}>
            Archivo <ChevronDown size={14} />
          </span>
        )}
      >
        {(close) => (
          <div className="flex flex-col text-sm">
            <MenuItem icon={<FilePlus2 size={16} />} label="Crear un diseño nuevo" onClick={() => { close(); void goHome() }} />
            <MenuItem icon={<Save size={16} />} label="Guardar" hint="Ctrl+S" onClick={() => { close(); void saveDesign().then((ok) => ok && toast('Guardado', 'success')) }} />
            <MenuItem
              icon={<Copy size={16} />}
              label="Hacer una copia"
              onClick={async () => {
                close()
                await saveDesign()
                const d = await api.duplicateDesign(design.id)
                navigate(`/design/${d.id}`)
              }}
            />
            <MenuItem icon={<Maximize2 size={16} />} label="Redimensionar" onClick={() => { close(); setResizeOpen(true) }} />
            <MenuItem icon={<Download size={16} />} label="Descargar" onClick={() => { close(); setExportOpen(true) }} />
            <div className="my-1 border-t border-slate-100" />
            <MenuItem icon={<Info size={16} />} label="Atajos de teclado" onClick={() => { close(); setShortcutsOpen(true) }} />
          </div>
        )}
      </Popover>

      <button className="btn-ghost" onClick={() => setResizeOpen(true)}>
        <Maximize2 size={16} /> Redimensionar
      </button>

      <div className="divider" />
      <IconBtn title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={() => void history?.undo()}>
        <Undo2 size={18} />
      </IconBtn>
      <IconBtn title="Rehacer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => void history?.redo()}>
        <Redo2 size={18} />
      </IconBtn>
      <span className="ml-1 flex items-center gap-1 text-xs text-slate-500" title={lastSaved ? `Guardado ${new Date(lastSaved).toLocaleTimeString()}` : 'Sin guardar'}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : dirty ? <CloudOff size={16} /> : <Cloud size={16} />}
        <span className="hidden lg:inline">{saving ? 'Guardando…' : dirty ? 'Cambios sin guardar' : 'Guardado'}</span>
      </span>

      <div className="flex flex-1 justify-center px-2">
        <input
          className="w-full max-w-xs rounded-md border border-transparent bg-transparent px-2 py-1 text-center text-sm font-medium hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>

      {peers.length > 0 && (
        <div className="mr-1 flex -space-x-2" title={`Conectados: ${peers.map((p) => p.name).join(', ')}`}>
          {peers.slice(0, 5).map((p) => (
            <span key={p.clientId} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white" style={{ background: p.color }} title={p.name}>
              {p.name.slice(0, 2).toUpperCase()}
            </span>
          ))}
          {peers.length > 5 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-400 text-[11px] font-bold text-white">+{peers.length - 5}</span>}
        </div>
      )}
      {readOnly && <span className="mr-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Solo lectura</span>}
      <span className={`mr-1 h-2 w-2 rounded-full ${collabStatus === 'online' ? 'bg-emerald-500' : collabStatus === 'connecting' ? 'bg-amber-400' : 'bg-slate-300'}`} title={collabStatus === 'online' ? 'Colaboración en tiempo real activa' : 'Sin conexión en tiempo real'} />
      <button className="btn-ghost" onClick={() => set({ present: true })} title="Presentar">
        <MonitorPlay size={16} /> <span className="hidden md:inline">Presentar</span>
      </button>
      <button className="btn-secondary" onClick={() => setExportOpen(true)}>
        <Download size={16} /> <span className="hidden md:inline">Descargar</span>
      </button>
      <button
        className="btn-primary"
        onClick={async () => {
          await saveDesign()
          setShareOpen(true)
        }}
      >
        <Share2 size={16} /> Compartir
      </button>
      <div className="ml-1">
        <UserMenu compact />
      </div>

      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {resizeOpen && <ResizeDialog onClose={() => setResizeOpen(false)} />}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
    </header>
  )
}

function MenuItem({ icon, label, hint, onClick, checked }: { icon?: React.ReactNode; label: string; hint?: string; onClick: () => void; checked?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100">
      <span className="text-slate-500">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="kbd">{hint}</span>}
      {checked && <Check size={14} className="text-brand-600" />}
    </button>
  )
}
