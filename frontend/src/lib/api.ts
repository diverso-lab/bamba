import type { BrandKit, DesignData, DesignMeta, StockPhoto, UploadItem } from './types'
import { handleUnauthorized, type AuthUser } from '@/store/auth'

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = body.detail || JSON.stringify(body)
    } catch {
      /* ignore */
    }
    throw new Error(msg || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

export const api = {
  health: () => fetch('/api/health').then((r) => json<any>(r)),

  // auth
  me: () => fetch('/api/auth/me').then((r) => json<{ user: AuthUser | null; registrationOpen: boolean }>(r)),
  login: (email: string, password: string) =>
    fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then((r) => json<{ user: AuthUser }>(r)),
  register: (email: string, name: string, password: string) =>
    fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, password }) }).then((r) => json<{ user: AuthUser }>(r)),
  logout: () => fetch('/api/auth/logout', { method: 'POST' }).then((r) => json<{ ok: boolean }>(r)),
  updateMe: (payload: { name?: string; password?: string; currentPassword?: string }) =>
    fetch('/api/auth/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => json<{ user: AuthUser }>(r)),

  // designs
  listDesigns: () => fetch('/api/designs').then((r) => json<DesignMeta[]>(r)),
  getDesign: (id: string) => fetch(`/api/designs/${id}`).then((r) => json<DesignData>(r)),
  createDesign: (payload: Partial<DesignData>) =>
    fetch('/api/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => json<DesignData>(r)),
  updateDesign: (id: string, payload: Partial<Omit<DesignData, 'pages'>> & { pages?: any[] }) =>
    fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => json<DesignMeta>(r)),
  deleteDesign: (id: string) => fetch(`/api/designs/${id}`, { method: 'DELETE' }).then((r) => json<void>(r)),
  duplicateDesign: (id: string) => fetch(`/api/designs/${id}/duplicate`, { method: 'POST' }).then((r) => json<DesignData>(r)),

  updatePage: (designId: string, pageId: string, payload: { json?: any; thumbnail?: string | null; duration?: number; anim?: any }) =>
    fetch(`/api/designs/${designId}/pages/${pageId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => json<{ ok: boolean }>(r)),
  getShare: (id: string) => fetch(`/api/designs/${id}/share`).then((r) => json<{ owner: { id: string; name: string; email: string }; role: string; users: { id: string; role: string; email: string; name: string }[] }>(r)),
  addShare: (id: string, email: string, role: 'edit' | 'view') =>
    fetch(`/api/designs/${id}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) }).then((r) => json<{ id: string; role: string; email: string; name: string }>(r)),
  removeShare: (id: string, userId: string) => fetch(`/api/designs/${id}/share/${userId}`, { method: 'DELETE' }).then((r) => json<void>(r)),

  // uploads
  listUploads: (kind?: 'image' | 'font') => fetch(`/api/uploads${kind ? `?kind=${kind}` : ''}`).then((r) => json<UploadItem[]>(r)),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file, file.name)
    return fetch('/api/uploads', { method: 'POST', body: fd }).then((r) => json<UploadItem>(r))
  },
  deleteUpload: (id: string) => fetch(`/api/uploads/${id}`, { method: 'DELETE' }).then((r) => json<void>(r)),

  // photos
  searchPhotos: (q: string, page = 1) =>
    fetch(`/api/photos/search?q=${encodeURIComponent(q)}&page=${page}`).then((r) => json<{ results: StockPhoto[]; page: number; page_count: number }>(r)),

  // graphics (Iconify)
  graphicsSets: () => fetch('/api/graphics/sets').then((r) => json<{ id: string; label: string }[]>(r)),
  graphicsSearch: (q: string, set: string, limit = 64) => fetch(`/api/graphics/search?q=${encodeURIComponent(q)}&set=${set}&limit=${limit}`).then((r) => json<{ results: { id: string; url: string }[]; total: number }>(r)),
  graphicsCollection: (prefix: string, limit = 96) => fetch(`/api/graphics/collection?prefix=${prefix}&limit=${limit}`).then((r) => json<{ results: { id: string; url: string }[] }>(r)),
  graphicsSvg: async (icon: string) => {
    const r = await fetch(`/api/graphics/svg?icon=${encodeURIComponent(icon)}`)
    if (r.status === 401) handleUnauthorized()
    if (!r.ok) throw new Error('No se pudo cargar el gráfico')
    return r.text()
  },

  // IA
  aiStatus: () => fetch('/api/ai/status').then((r) => json<{ text: string | null; textModel: string | null; image: string | null; hint: string | null }>(r)),
  aiText: (payload: { mode: string; prompt?: string; text?: string; lang?: string; tone?: string }) =>
    fetch('/api/ai/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => json<{ text: string }>(r)),
  aiImage: (payload: { prompt: string; width: number; height: number; style?: string; seed?: number }) =>
    fetch('/api/ai/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => json<UploadItem & { prompt?: string }>(r)),

  // brand
  getBrand: () => fetch('/api/brand').then((r) => json<BrandKit>(r)),
  putBrand: (b: BrandKit) => fetch('/api/brand', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => json<BrandKit>(r)),

  blurBg: async (blob: Blob, opts: { radius?: number; mode?: 'blur' | 'color' | 'bw'; color?: string } = {}) => {
    const fd = new FormData()
    fd.append('file', blob, 'image.png')
    const params = new URLSearchParams()
    if (opts.radius) params.set('radius', String(opts.radius))
    if (opts.mode) params.set('mode', opts.mode)
    if (opts.color) params.set('color', opts.color)
    const res = await fetch(`/api/blur-bg?${params.toString()}`, { method: 'POST', body: fd })
    if (res.status === 401) handleUnauthorized()
    if (!res.ok) {
      let msg = res.statusText
      try {
        msg = (await res.json()).detail || msg
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }
    return res.blob()
  },

  // remove background
  removeBg: async (blob: Blob, opts: { model?: string; postProcess?: boolean; alphaMatting?: boolean } = {}) => {
    const fd = new FormData()
    fd.append('file', blob, 'image.png')
    const params = new URLSearchParams()
    if (opts.model) params.set('model', opts.model)
    if (opts.postProcess) params.set('post_process', 'true')
    if (opts.alphaMatting) params.set('alpha_matting', 'true')
    const res = await fetch(`/api/remove-bg?${params.toString()}`, { method: 'POST', body: fd })
    if (res.status === 401) handleUnauthorized()
    if (!res.ok) {
      let msg = res.statusText
      try {
        msg = (await res.json()).detail || msg
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }
    return res.blob()
  },
}
