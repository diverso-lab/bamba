import { icons } from 'lucide'

type IconNode = [string, Record<string, string | number>, IconNode?][] | any

const cache = new Map<string, string>()

export const ICON_NAMES: string[] = Object.keys(icons)

/** lucide ≥0.4xx: cada icono es ["svg", attrs, children]; versiones antiguas: lista de [tag, attrs]. */
function childrenOf(node: any): any[] {
  if (!Array.isArray(node)) return []
  if (typeof node[0] === 'string') return node[0] === 'svg' ? node[2] || [] : [node]
  return node
}

function nodeToSvg(list: any[], strokeAttrs: Record<string, string | number>): string {
  return list
    .map((el: any) => {
      if (!Array.isArray(el) || typeof el[0] !== 'string') return ''
      const [tag, attrs = {}, children] = el
      const merged = { ...strokeAttrs, ...attrs }
      const attrStr = Object.entries(merged)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      const inner = children ? nodeToSvg(childrenOf(children), strokeAttrs) : ''
      return `<${tag} ${attrStr}>${inner}</${tag}>`
    })
    .join('')
}

/** Devuelve el SVG (string) de un icono lucide con color/grosor dados. */
export function iconSvg(name: string, color = '#111827', strokeWidth = 2, size = 24): string {
  const key = `${name}|${color}|${strokeWidth}|${size}`
  const c = cache.get(key)
  if (c) return c
  const node = (icons as any)[name] as IconNode
  if (!node) return ''
  const strokeAttrs = { fill: 'none', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${nodeToSvg(childrenOf(node), strokeAttrs)}</svg>`
  cache.set(key, svg)
  return svg
}

export function searchIcons(q: string, limit = 160): string[] {
  const s = q.trim().toLowerCase()
  if (!s) return ICON_NAMES.slice(0, limit)
  const out: string[] = []
  for (const n of ICON_NAMES) {
    if (n.toLowerCase().includes(s)) {
      out.push(n)
      if (out.length >= limit) break
    }
  }
  return out
}

/** Emojis por categorías (se insertan como texto). */
export const EMOJI_SETS: { name: string; items: string[] }[] = [
  { name: 'Caras', items: ['😀', '😂', '🥰', '😎', '🤩', '😢', '😡', '🤔', '😴', '🤯', '🥳', '😇', '🤗', '🙃', '😉', '😍', '🤪', '😱', '🥺', '😤'] },
  { name: 'Gestos', items: ['👍', '👎', '👏', '🙌', '🙏', '💪', '👉', '👈', '☝️', '✌️', '🤝', '👋', '🫶', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤'] },
  { name: 'Objetos', items: ['🎉', '🎁', '🎈', '🏆', '⭐', '🔥', '💡', '📣', '📌', '✅', '❌', '⚡', '💰', '🛒', '📱', '💻', '📷', '🎵', '🎬', '📚'] },
  { name: 'Naturaleza', items: ['🌞', '🌙', '🌈', '🌸', '🌻', '🌿', '🍀', '🌊', '🔥', '❄️', '🐶', '🐱', '🦋', '🐝', '🌍', '⛰️', '🏖️', '🌵', '🍁', '🍓'] },
  { name: 'Comida', items: ['🍕', '🍔', '🍟', '🌮', '🍣', '🍩', '🍰', '☕', '🍺', '🍷', '🥑', '🍎', '🍋', '🥐', '🍦', '🍫', '🥗', '🍜', '🧁', '🥂'] },
]
