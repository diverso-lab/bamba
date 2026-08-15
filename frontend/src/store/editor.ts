import { create } from 'zustand'
import type { Canvas, FabricObject } from 'fabric'
import type { History } from '@/lib/history'
import type { CropSession } from '@/lib/crop'
import type { BrandKit, DesignData, SideTab } from '@/lib/types'

export interface Peer {
  clientId: string
  id: string
  name: string
  color: string
  role: string
  pageId: string | null
}

export interface Toast {
  id: number
  msg: string
  type: 'info' | 'error' | 'success'
}

interface EditorState {
  canvas: Canvas | null
  history: History | null
  design: DesignData | null
  pageIndex: number
  zoom: number
  selection: FabricObject[]
  version: number
  canUndo: boolean
  canRedo: boolean
  activeTab: SideTab | null
  busy: string | null
  toasts: Toast[]
  dirty: boolean
  saving: boolean
  lastSaved: number | null
  cropSession: CropSession | null
  drawing: boolean
  present: boolean
  brand: BrandKit
  showRulers: boolean
  frameTarget: FabricObject | null
  /** 'fit' = se reajusta al contenedor; 'manual' = el usuario fijó el zoom */
  zoomMode: 'fit' | 'manual'
  /** id de la página cargada realmente en el canvas (para no volcar contenido en la página equivocada) */
  loadedPageId: string | null
  changeSeq: number
  readOnly: boolean
  role: 'owner' | 'edit' | 'view'
  peers: Peer[]
  cursors: Record<string, { x: number; y: number; pageId: string | null; name: string; color: string; t: number }>
  collabStatus: 'off' | 'connecting' | 'online'

  set: (p: Partial<EditorState>) => void
  bump: () => void
  toast: (msg: string, type?: Toast['type']) => void
  dismissToast: (id: number) => void
}

let toastId = 1

export const useEditor = create<EditorState>((set, get) => ({
  canvas: null,
  history: null,
  design: null,
  pageIndex: 0,
  zoom: 1,
  selection: [],
  version: 0,
  canUndo: false,
  canRedo: false,
  activeTab: 'design',
  busy: null,
  toasts: [],
  dirty: false,
  saving: false,
  lastSaved: null,
  cropSession: null,
  drawing: false,
  present: false,
  brand: { colors: [], fonts: [], logos: [] },
  showRulers: false,
  frameTarget: null,
  zoomMode: 'fit',
  loadedPageId: null,
  changeSeq: 0,
  readOnly: false,
  role: 'owner',
  peers: [],
  cursors: {},
  collabStatus: 'off',

  set: (p) => set(p),
  bump: () => set((s) => ({ version: s.version + 1 })),
  toast: (msg, type = 'info') => {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }))
    window.setTimeout(() => get().dismissToast(id), type === 'error' ? 6000 : 3000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Tamaño de página actual (W/H) — helper. */
export function useDesignSize() {
  const design = useEditor((s) => s.design)
  return { W: design?.width || 1080, H: design?.height || 1080 }
}
