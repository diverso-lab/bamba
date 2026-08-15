import { useEffect, useState } from 'react'
import { Copy, Link2, Trash2, UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
import { useEditor } from '@/store/editor'
import { Modal } from './ui'

export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const design = useEditor((s) => s.design)!
  const role = useEditor((s) => s.role)
  const toast = useEditor((s) => s.toast)
  const [info, setInfo] = useState<{ owner: { id: string; name: string; email: string }; role: string; users: { id: string; role: string; email: string; name: string }[] } | null>(null)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<'edit' | 'view'>('edit')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const url = window.location.href

  const load = () => api.getShare(design.id).then(setInfo).catch((e) => setError(e.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id])

  const invite = async () => {
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.addShare(design.id, email.trim(), newRole)
      setEmail('')
      await load()
      toast('Invitación añadida', 'success')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Compartir diseño" onClose={onClose} width={480}>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
        <Link2 size={16} className="text-slate-500" />
        <input className="flex-1 bg-transparent text-xs text-slate-700 focus:outline-none" readOnly value={url} onFocus={(e) => e.target.select()} />
        <button
          className="btn-secondary py-1 text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              toast('Enlace copiado', 'success')
            } catch {
              toast(url)
            }
          }}
        >
          <Copy size={12} /> Copiar
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">Solo las personas con acceso (abajo) pueden abrir el enlace. Los invitados deben tener cuenta en este servidor.</p>
      {role === 'owner' && (
        <div className="mb-4 flex gap-2">
          <input className="input flex-1" placeholder="email@ejemplo.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()} />
          <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
            <option value="edit">Puede editar</option>
            <option value="view">Puede ver</option>
          </select>
          <button className="btn-primary" onClick={invite} disabled={busy}>
            <UserPlus size={16} /> Invitar
          </button>
        </div>
      )}
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="panel-title mb-1">Personas con acceso</div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {info && (
          <li className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{info.owner.name.slice(0, 2).toUpperCase()}</span>
            <span className="flex-1">
              <span className="block font-medium">{info.owner.name}</span>
              <span className="block text-xs text-slate-500">{info.owner.email}</span>
            </span>
            <span className="text-xs text-slate-500">Propietario</span>
          </li>
        )}
        {info?.users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{(u.name || u.email).slice(0, 2).toUpperCase()}</span>
            <span className="flex-1">
              <span className="block font-medium">{u.name}</span>
              <span className="block text-xs text-slate-500">{u.email}</span>
            </span>
            <span className="text-xs text-slate-500">{u.role === 'edit' ? 'Editor' : 'Lector'}</span>
            {role === 'owner' && (
              <button
                className="icon-btn h-7 w-7"
                title="Quitar acceso"
                onClick={async () => {
                  await api.removeShare(design.id, u.id)
                  await load()
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {info && info.users.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">Todavía no has invitado a nadie.</li>}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">Los editores ven los cambios de los demás en tiempo real (cursores y contenido).</p>
    </Modal>
  )
}
