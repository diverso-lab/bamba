import { ChevronLeft, FolderOpen, Grid2X2, Image as ImageIcon, LayoutTemplate, Layers, Palette, Pencil, Shapes, Type, Upload, Boxes, Sticker, Sparkles } from 'lucide-react'
import { navigate } from '@/App'
import { saveDesign } from '@/lib/pages'
import type { SideTab } from '@/lib/types'
import { useEditor } from '@/store/editor'
import DesignPanel from '@/panels/DesignPanel'
import ElementsPanel from '@/panels/ElementsPanel'
import TextPanel from '@/panels/TextPanel'
import BrandPanel from '@/panels/BrandPanel'
import UploadsPanel from '@/panels/UploadsPanel'
import PhotosPanel from '@/panels/PhotosPanel'
import DrawPanel from '@/panels/DrawPanel'
import AppsPanel from '@/panels/AppsPanel'
import PositionPanel from '@/panels/PositionPanel'
import BackgroundPanel from '@/panels/BackgroundPanel'
import PhotoEditPanel from '@/panels/PhotoEditPanel'
import GraphicsPanel from '@/panels/GraphicsPanel'
import AIPanel from '@/panels/AIPanel'
import AnimatePanel from '@/panels/AnimatePanel'

const TABS: { id: SideTab; label: string; icon: any }[] = [
  { id: 'design', label: 'Diseño', icon: LayoutTemplate },
  { id: 'elements', label: 'Elementos', icon: Shapes },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'graphics', label: 'Stickers', icon: Sticker },
  { id: 'brand', label: 'Marca', icon: Palette },
  { id: 'uploads', label: 'Subidos', icon: Upload },
  { id: 'photos', label: 'Fotos', icon: ImageIcon },
  { id: 'draw', label: 'Dibujar', icon: Pencil },
  { id: 'ai', label: 'IA', icon: Sparkles },
  { id: 'apps', label: 'Apps', icon: Boxes },
]

export default function SideRail() {
  const activeTab = useEditor((s) => s.activeTab)
  const set = useEditor((s) => s.set)
  const drawing = useEditor((s) => s.drawing)

  const select = (id: SideTab) => {
    if (drawing && id !== 'draw') {
      import('@/lib/actions').then((m) => m.setDrawingMode(false))
    }
    set({ activeTab: activeTab === id ? null : id })
  }

  return (
    <div className="flex h-full shrink-0">
      <nav className="flex w-[72px] flex-col items-stretch border-r border-slate-200 bg-white">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} className={`side-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => select(t.id)}>
              <Icon size={20} />
              {t.label}
            </button>
          )
        })}
        <button
          className="side-tab"
          onClick={async () => {
            await saveDesign()
            navigate('/')
          }}
        >
          <FolderOpen size={20} />
          Proyectos
        </button>
        <div className="flex-1" />
        <button className={`side-tab ${activeTab === 'position' ? 'active' : ''}`} onClick={() => select('position')} title="Posición y capas">
          <Layers size={20} />
          Capas
        </button>
        <button className={`side-tab ${activeTab === 'background' ? 'active' : ''}`} onClick={() => select('background')} title="Fondo">
          <Grid2X2 size={20} />
          Fondo
        </button>
      </nav>
      {activeTab && (
        <div className="relative flex w-[340px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {activeTab === 'design' && <DesignPanel />}
            {activeTab === 'elements' && <ElementsPanel />}
            {activeTab === 'text' && <TextPanel />}
            {activeTab === 'brand' && <BrandPanel />}
            {activeTab === 'uploads' && <UploadsPanel />}
            {activeTab === 'photos' && <PhotosPanel />}
            {activeTab === 'draw' && <DrawPanel />}
            {activeTab === 'apps' && <AppsPanel />}
            {activeTab === 'position' && <PositionPanel />}
            {activeTab === 'background' && <BackgroundPanel />}
            {activeTab === 'photo' && <PhotoEditPanel />}
            {activeTab === 'graphics' && <GraphicsPanel />}
            {activeTab === 'ai' && <AIPanel />}
            {activeTab === 'animate' && <AnimatePanel />}
          </div>
          <button
            className="absolute -right-4 top-1/2 z-10 flex h-14 w-4 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-white text-slate-500 shadow hover:text-slate-800"
            onClick={() => set({ activeTab: null })}
            title="Ocultar panel"
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
