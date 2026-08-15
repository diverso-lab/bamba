import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'

export default function AuthPage() {
  const registrationOpen = useAuth((s) => s.registrationOpen)
  const set = useAuth((s) => s.set)
  const [mode, setMode] = useState<'login' | 'register'>(registrationOpen ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = mode === 'login' ? await api.login(email, password) : await api.register(email, name, password)
      set({ user: r.user, status: 'authed' })
    } catch (err: any) {
      setError(err.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full">
      <div className="hidden w-1/2 flex-col items-center justify-center bg-gradient-to-br from-brand-700 via-fuchsia-600 to-pink-500 p-12 text-white lg:flex">
        <img src="/logo-white.svg" alt="bamba" className="w-72 max-w-full" />
        <p className="mt-8 text-2xl font-medium text-white/95">Diseña lo que quieras</p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <form onSubmit={submit} className="card w-full max-w-sm p-8">
          <div className="mb-6 lg:hidden">
            <img src="/logo.svg" alt="bamba" className="h-10" />
          </div>
          <h2 className="text-2xl font-bold">{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h2>
          <p className="mb-6 text-sm text-slate-500">{mode === 'login' ? 'Bienvenido de nuevo.' : 'Empieza a diseñar en un minuto.'}</p>
          {mode === 'register' && (
            <label className="mb-3 block text-sm">
              Nombre
              <input className="input mt-1 w-full py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
            </label>
          )}
          <label className="mb-3 block text-sm">
            Email
            <input className="input mt-1 w-full py-2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" autoFocus />
          </label>
          <label className="mb-4 block text-sm">
            Contraseña
            <input className="input mt-1 w-full py-2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </label>
          {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button className="btn-primary w-full justify-center py-2.5" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
          <div className="mt-4 text-center text-sm text-slate-500">
            {mode === 'login' ? (
              registrationOpen ? (
                <>
                  ¿No tienes cuenta?{' '}
                  <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setMode('register')}>
                    Regístrate
                  </button>
                </>
              ) : (
                'El registro está desactivado en este servidor.'
              )
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setMode('login')}>
                  Inicia sesión
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
