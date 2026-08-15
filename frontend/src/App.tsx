import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Home from './components/Home'
import Editor from './components/Editor'
import Toasts from './components/Toasts'
import AuthPage from './components/AuthPage'
import { useAuth } from './store/auth'
import { api } from './lib/api'

type Route = { page: 'home' } | { page: 'editor'; id: string }

function parseHash(): Route {
  const h = window.location.hash.replace(/^#/, '')
  const m = h.match(/^\/design\/([a-zA-Z0-9_-]+)/)
  if (m) return { page: 'editor', id: m[1] }
  return { page: 'home' }
}

export function navigate(path: string) {
  window.location.hash = path
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)
  const status = useAuth((s) => s.status)
  const setAuth = useAuth((s) => s.set)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    api
      .me()
      .then((r) => setAuth({ user: r.user, status: r.user ? 'authed' : 'anon', registrationOpen: r.registrationOpen }))
      .catch(() => setAuth({ user: null, status: 'anon' }))
  }, [setAuth])

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-500">
        <Loader2 className="animate-spin" /> Cargando…
      </div>
    )
  }

  return (
    <>
      {status === 'anon' ? <AuthPage /> : route.page === 'home' ? <Home /> : <Editor key={route.id} designId={route.id} />}
      <Toasts />
    </>
  )
}
