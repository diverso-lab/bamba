import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, X, RotateCcw } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { cancelCropIfAny, commitCurrentPage } from '@/lib/pages'
import { createPagePlayer, type AnimSpec, type PagePlayer } from '@/lib/animation'

/** Presentación a pantalla completa con animaciones y vídeos. */
export default function PresentMode() {
  const design = useEditor((s) => s.design)!
  const set = useEditor((s) => s.set)
  const startIndex = useEditor((s) => s.pageIndex)
  const [idx, setIdx] = useState(startIndex)
  const [autoplay, setAutoplay] = useState(false)
  const [ready, setReady] = useState(false)
  const holderRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PagePlayer | null>(null)
  const rafRef = useRef(0)
  const startRef = useRef(0)
  const idxRef = useRef(idx)
  idxRef.current = idx
  const autoplayRef = useRef(autoplay)
  autoplayRef.current = autoplay
  const pagesRef = useRef(design.pages)

  // preparar
  useEffect(() => {
    cancelCropIfAny()
    commitCurrentPage()
    pagesRef.current = useEditor.getState().design!.pages
    let entered = false
    document.documentElement
      .requestFullscreen?.()
      .then(() => {
        entered = true
      })
      .catch(() => {})
    const onFs = () => {
      if (entered && !document.fullscreenElement) set({ present: false })
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
      cancelAnimationFrame(rafRef.current)
      playerRef.current?.dispose()
    }
  }, [set])

  const restart = () => {
    startRef.current = performance.now()
    playerRef.current?.start()
  }

  // cargar página actual
  useEffect(() => {
    let alive = true
    setReady(false)
    cancelAnimationFrame(rafRef.current)
    playerRef.current?.dispose()
    playerRef.current = null
    const page = pagesRef.current[idx]
    const W = design.width
    const H = design.height
    const holder = holderRef.current!
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H)
    ;(async () => {
      const player = await createPagePlayer(page?.json, W, H, { scale, pageAnim: (page?.anim as AnimSpec) || null })
      if (!alive) {
        player.dispose()
        return
      }
      playerRef.current = player
      holder.innerHTML = ''
      const el = player.canvas.lowerCanvasEl
      el.style.width = `${W * scale}px`
      el.style.height = `${H * scale}px`
      holder.appendChild(el)
      setReady(true)
      startRef.current = performance.now()
      player.start()
      const dur = page?.duration || 5000
      const loop = () => {
        if (!alive || !playerRef.current) return
        const t = performance.now() - startRef.current
        playerRef.current.render(t)
        if (autoplayRef.current && t > Math.max(dur, playerRef.current.animEnd + 500)) {
          if (idxRef.current < pagesRef.current.length - 1) {
            setIdx(idxRef.current + 1)
            return
          }
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    })()
    return () => {
      alive = false
    }
  }, [idx, design.width, design.height])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set({ present: false })
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') setIdx((i) => Math.min(pagesRef.current.length - 1, i + 1))
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setIdx((i) => Math.max(0, i - 1))
      if (e.key.toLowerCase() === 'r') restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [set])

  const total = pagesRef.current.length
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black" onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}>
      <div ref={holderRef} className="flex items-center justify-center" />
      {!ready && <span className="absolute text-white/60">Preparando…</span>}
      <div className="absolute right-4 top-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" title="Repetir animaciones (R)" onClick={restart}>
          <RotateCcw size={18} />
        </button>
        <button className={`rounded-full p-2 text-white hover:bg-white/20 ${autoplay ? 'bg-brand-600' : 'bg-white/10'}`} title="Reproducción automática" onClick={() => setAutoplay(!autoplay)}>
          {autoplay ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => set({ present: false })}>
          <X size={20} />
        </button>
      </div>
      <button className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-20" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); setIdx(idx - 1) }}>
        <ChevronLeft size={24} />
      </button>
      <button className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-20" disabled={idx >= total - 1} onClick={(e) => { e.stopPropagation(); setIdx(idx + 1) }}>
        <ChevronRight size={24} />
      </button>
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
        {idx + 1} / {total}
      </span>
    </div>
  )
}
