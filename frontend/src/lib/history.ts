import type { Canvas } from 'fabric'
import { CUSTOM_PROPS } from './fabricUtils'

/**
 * Historial de deshacer/rehacer basado en snapshots JSON del canvas.
 * Sencillo y robusto: cada cambio "commit" guarda el estado completo.
 */
export class History {
  private stack: string[] = []
  private index = -1
  private paused = 0
  private loading = false
  private max = 80
  private timer: number | null = null

  constructor(private canvas: Canvas, private onChange: (reason: 'commit' | 'reset' | 'load') => void) {}

  serialize(): string {
    return JSON.stringify(this.canvas.toObject(CUSTOM_PROPS as any))
  }

  get canUndo() {
    return this.index > 0
  }
  get canRedo() {
    return this.index < this.stack.length - 1
  }
  get isLoading() {
    return this.loading
  }

  pause() {
    this.paused++
    if (this.timer) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
  }
  resume(commit = true) {
    this.paused = Math.max(0, this.paused - 1)
    if (commit && this.paused === 0) this.save()
  }

  /** Reinicia el historial con el estado actual como base. */
  reset() {
    if (this.timer) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    this.stack = [this.serialize()]
    this.index = 0
    this.onChange('reset')
  }

  /** Guarda un snapshot (con pequeño debounce para agrupar ráfagas). */
  save() {
    if (this.loading || this.paused > 0) return
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => this.commit(), 60)
  }

  commit() {
    if (this.loading || this.paused > 0) return
    const json = this.serialize()
    if (json === this.stack[this.index]) return
    this.stack = this.stack.slice(0, this.index + 1)
    this.stack.push(json)
    if (this.stack.length > this.max) this.stack.shift()
    this.index = this.stack.length - 1
    this.onChange('commit')
  }

  private async load(json: string) {
    this.loading = true
    try {
      this.canvas.discardActiveObject()
      await this.canvas.loadFromJSON(JSON.parse(json))
      this.canvas.requestRenderAll()
    } finally {
      this.loading = false
      this.onChange('load')
    }
  }

  async undo() {
    if (!this.canUndo) return
    this.index--
    await this.load(this.stack[this.index])
  }

  async redo() {
    if (!this.canRedo) return
    this.index++
    await this.load(this.stack[this.index])
  }
}
