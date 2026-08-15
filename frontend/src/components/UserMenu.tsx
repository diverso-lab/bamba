import { useState } from 'react'
import { LogOut, User as UserIcon, KeyRound } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { useEditor } from '@/store/editor'
import { Modal, Popover } from './ui'

export default function UserMenu({ compact }: { compact?: boolean }) {
  const user = useAuth((s) => s.user)
  const set = useAuth((s) => s.set)
  const toast = useEditor((s) => s.toast)
  const [account, setAccount] = useState(false)
  if (!user) return null
  const initials = (user.name || user.email).slice(0, 2).toUpperCase()

  const logout = async () => {
    try {
      const { saveDesign } = await import('@/lib/pages')
      if (useEditor.getState().design) await saveDesign()
      await api.logout()
    } finally {
      set({ user: null, status: 'anon' })
      window.location.hash = '/'
    }
  }

  return (
    <>
      <Popover
        width={240}
        align="right"
        trigger={(open) => (
          <span className={`flex cursor-pointer items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-slate-100 ${open ? 'bg-slate-100' : ''}`} title={user.email}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-pink-500 text-xs font-bold text-white">{initials}</span>
            {!compact && <span className="hidden text-sm font-medium md:inline">{user.name}</span>}
          </span>
        )}
      >
        {(close) => (
          <div className="text-sm">
            <div className="mb-2 border-b border-slate-100 pb-2">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100" onClick={() => { close(); setAccount(true) }}>
              <UserIcon size={16} /> Mi cuenta
            </button>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-red-600 hover:bg-red-50" onClick={() => { close(); void logout() }}>
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        )}
      </Popover>
      {account && <AccountModal onClose={() => setAccount(false)} onSaved={(m) => toast(m, 'success')} />}
    </>
  )
}

function AccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const user = useAuth((s) => s.user)!
  const set = useAuth((s) => s.set)
  const [name, setName] = useState(user.name)
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal title="Mi cuenta" onClose={onClose} width={420}>
      <label className="mb-3 block text-sm">
        Nombre
        <input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="mb-1 flex items-center gap-1 text-sm font-medium"><KeyRound size={14} /> Cambiar contraseña (opcional)</div>
      <label className="mb-2 block text-sm">
        Contraseña actual
        <input className="input mt-1 w-full" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="mb-4 block text-sm">
        Nueva contraseña
        <input className="input mt-1 w-full" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} />
      </label>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button
        className="btn-primary w-full justify-center"
        onClick={async () => {
          try {
            const r = await api.updateMe({ name, password: pw || undefined, currentPassword: current || undefined })
            set({ user: r.user })
            onSaved('Cuenta actualizada')
            onClose()
          } catch (e: any) {
            setError(e.message)
          }
        }}
      >
        Guardar
      </button>
    </Modal>
  )
}
