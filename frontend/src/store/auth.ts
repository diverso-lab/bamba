import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string
  name: string
  createdAt?: number
}

interface AuthState {
  user: AuthUser | null
  status: 'loading' | 'anon' | 'authed'
  registrationOpen: boolean
  set: (p: Partial<AuthState>) => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  registrationOpen: true,
  set: (p) => set(p),
}))

/** Llamado por el cliente API cuando el servidor responde 401. */
export function handleUnauthorized() {
  const st = useAuth.getState()
  if (st.status === 'authed') st.set({ user: null, status: 'anon' })
}
