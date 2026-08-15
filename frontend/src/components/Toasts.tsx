import { useEditor } from '@/store/editor'
import { X } from 'lucide-react'

export default function Toasts() {
  const toasts = useEditor((s) => s.toasts)
  const dismiss = useEditor((s) => s.dismissToast)
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`fade-in flex items-center gap-3 rounded-lg px-4 py-2 text-sm shadow-lg ${
            t.type === 'error' ? 'bg-red-600 text-white' : t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          <span>{t.msg}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
