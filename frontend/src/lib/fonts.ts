export interface FontDef {
  family: string
  category: 'sans' | 'serif' | 'display' | 'script' | 'mono'
  google?: boolean
}

export const FONTS: FontDef[] = [
  { family: 'Inter', category: 'sans', google: true },
  { family: 'Poppins', category: 'sans', google: true },
  { family: 'Montserrat', category: 'sans', google: true },
  { family: 'Raleway', category: 'sans', google: true },
  { family: 'Lato', category: 'sans', google: true },
  { family: 'Nunito', category: 'sans', google: true },
  { family: 'Rubik', category: 'sans', google: true },
  { family: 'Kanit', category: 'sans', google: true },
  { family: 'Quicksand', category: 'sans', google: true },
  { family: 'Josefin Sans', category: 'sans', google: true },
  { family: 'Space Grotesk', category: 'sans', google: true },
  { family: 'Comfortaa', category: 'sans', google: true },
  { family: 'Fredoka', category: 'sans', google: true },
  { family: 'Oswald', category: 'sans', google: true },
  { family: 'Playfair Display', category: 'serif', google: true },
  { family: 'Merriweather', category: 'serif', google: true },
  { family: 'DM Serif Display', category: 'serif', google: true },
  { family: 'Cormorant Garamond', category: 'serif', google: true },
  { family: 'Source Serif 4', category: 'serif', google: true },
  { family: 'Libre Baskerville', category: 'serif', google: true },
  { family: 'Abril Fatface', category: 'display', google: true },
  { family: 'Bebas Neue', category: 'display', google: true },
  { family: 'Anton', category: 'display', google: true },
  { family: 'Archivo Black', category: 'display', google: true },
  { family: 'Alfa Slab One', category: 'display', google: true },
  { family: 'Righteous', category: 'display', google: true },
  { family: 'Bangers', category: 'display', google: true },
  { family: 'Monoton', category: 'display', google: true },
  { family: 'Press Start 2P', category: 'display', google: true },
  { family: 'Lobster', category: 'script', google: true },
  { family: 'Pacifico', category: 'script', google: true },
  { family: 'Dancing Script', category: 'script', google: true },
  { family: 'Caveat', category: 'script', google: true },
  { family: 'Great Vibes', category: 'script', google: true },
  { family: 'Satisfy', category: 'script', google: true },
  { family: 'Yellowtail', category: 'script', google: true },
  { family: 'Amatic SC', category: 'script', google: true },
  { family: 'Permanent Marker', category: 'script', google: true },
  { family: 'Shadows Into Light', category: 'script', google: true },
  { family: 'Roboto Mono', category: 'mono', google: true },
  { family: 'Arial', category: 'sans' },
  { family: 'Helvetica', category: 'sans' },
  { family: 'Verdana', category: 'sans' },
  { family: 'Georgia', category: 'serif' },
  { family: 'Times New Roman', category: 'serif' },
  { family: 'Courier New', category: 'mono' },
]

const loaded = new Set<string>()
const customFonts = new Map<string, string>() // family -> url

export function registerCustomFont(family: string, url: string) {
  customFonts.set(family, url)
}

export function getCustomFonts(): { family: string; url: string }[] {
  return Array.from(customFonts.entries()).map(([family, url]) => ({ family, url }))
}

/** Asegura que una fuente está cargada antes de usarla en el canvas. */
export async function ensureFont(family: string, weight: string | number = 400): Promise<void> {
  const key = `${family}:${weight}`
  if (loaded.has(key)) return
  try {
    if (customFonts.has(family)) {
      const face = new FontFace(family, `url(${customFonts.get(family)})`)
      await face.load()
      document.fonts.add(face)
    } else {
      await document.fonts.load(`${weight} 16px "${family}"`)
      await document.fonts.load(`bold 16px "${family}"`)
      await document.fonts.load(`italic 16px "${family}"`)
    }
  } catch {
    /* fuente del sistema o no disponible: seguimos */
  }
  loaded.add(key)
}

/** Carga todas las fuentes que aparecen en un JSON de fabric. */
export async function ensureFontsInJson(json: any): Promise<void> {
  const fams = new Set<string>()
  const walk = (o: any) => {
    if (!o || typeof o !== 'object') return
    if (o.fontFamily) fams.add(o.fontFamily)
    if (Array.isArray(o.objects)) o.objects.forEach(walk)
  }
  walk(json)
  await Promise.all(Array.from(fams).map((f) => ensureFont(f)))
}
