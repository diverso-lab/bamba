import { Canvas, Circle, FabricObject, Line, Rect, StaticCanvas, Textbox } from 'fabric'
import { asAny, createFrame, makeGradient, uid, type GradientSpec } from './fabricUtils'
import { ensureFont } from './fonts'

export interface Template {
  id: string
  name: string
  category: string
  tags: string[]
  /** color de fondo aproximado para tarjetas */
  swatch: string[]
  /** tamaño sugerido al crear un diseño desde la home */
  size?: { w: number; h: number }
  build: (W: number, H: number) => { background: string | GradientSpec; objects: FabricObject[] }
}

const T = (text: string, o: Record<string, any>) => {
  const t = new Textbox(text, { editable: true, lineHeight: 1.15, ...o })
  asAny(t).set({ id: uid(), bambaType: 'text' })
  return t
}
const R = (o: Record<string, any>) => {
  const r = new Rect({ strokeWidth: 0, ...o })
  asAny(r).set({ id: uid() })
  return r
}
const C = (o: Record<string, any>) => {
  const c = new Circle({ strokeWidth: 0, ...o })
  asAny(c).set({ id: uid() })
  return c
}
const L = (pts: [number, number, number, number], o: Record<string, any>) => {
  const l = new Line(pts, { strokeWidth: 3, ...o })
  asAny(l).set({ id: uid(), bambaType: 'line' })
  return l
}
const F = (kind: Parameters<typeof createFrame>[0], size: number, o: Record<string, any>) => {
  const f = createFrame(kind, size)
  f.set(o)
  return f
}

export const TEMPLATES: Template[] = [
  {
    id: 'quote-dark',
    name: 'Cita inspiradora',
    category: 'Redes sociales',
    tags: ['cita', 'frase', 'instagram'],
    swatch: ['#0f172a', '#f8fafc', '#a78bfa'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#0f172a',
        objects: [
          R({ left: W * 0.08, top: H * 0.08, width: W * 0.84, height: H * 0.84, fill: 'transparent', stroke: '#a78bfa', strokeWidth: 3, strokeUniform: true }),
          T('“', { left: W * 0.14, top: H * 0.16, width: W * 0.3, fontSize: s * 0.22, fontFamily: 'Playfair Display', fill: '#a78bfa', textAlign: 'left' }),
          T('La creatividad es la inteligencia divirtiéndose.', { left: W * 0.14, top: H * 0.36, width: W * 0.72, fontSize: s * 0.075, fontFamily: 'Playfair Display', fill: '#f8fafc', textAlign: 'left', lineHeight: 1.2 }),
          L([W * 0.14, H * 0.7, W * 0.3, H * 0.7], { stroke: '#a78bfa', strokeWidth: 4 }),
          T('— Albert Einstein', { left: W * 0.14, top: H * 0.74, width: W * 0.72, fontSize: s * 0.035, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'left', charSpacing: 120 }),
        ],
      }
    },
  },
  {
    id: 'sale-yellow',
    name: 'Rebajas',
    category: 'Marketing',
    tags: ['oferta', 'descuento', 'venta', 'tienda'],
    swatch: ['#facc15', '#111827', '#ef4444'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#facc15',
        objects: [
          T('REBAJAS', { left: W * 0.08, top: H * 0.14, width: W * 0.84, fontSize: s * 0.17, fontFamily: 'Anton', fill: '#111827', textAlign: 'center', charSpacing: 60 }),
          C({ left: W * 0.5 - s * 0.24, top: H * 0.38, radius: s * 0.24, fill: '#ef4444' }),
          T('-50%', { left: W * 0.5 - s * 0.24, top: H * 0.38 + s * 0.13, width: s * 0.48, fontSize: s * 0.14, fontFamily: 'Anton', fill: '#ffffff', textAlign: 'center' }),
          T('SOLO ESTE FIN DE SEMANA', { left: W * 0.08, top: H * 0.82, width: W * 0.84, fontSize: s * 0.04, fontFamily: 'Montserrat', fontWeight: '800', fill: '#111827', textAlign: 'center', charSpacing: 200 }),
        ],
      }
    },
  },
  {
    id: 'event-gradient',
    size: { w: 1080, h: 1920 },
    name: 'Evento',
    category: 'Eventos',
    tags: ['evento', 'fiesta', 'concierto', 'cartel'],
    swatch: ['#7c3aed', '#ec4899', '#ffffff'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: { type: 'linear', angle: 135, stops: [{ offset: 0, color: '#7c3aed' }, { offset: 1, color: '#ec4899' }] },
        objects: [
          T('NOCHE DE', { left: W * 0.1, top: H * 0.18, width: W * 0.8, fontSize: s * 0.06, fontFamily: 'Montserrat', fontWeight: '600', fill: '#ffffff', textAlign: 'center', charSpacing: 400 }),
          T('MÚSICA', { left: W * 0.05, top: H * 0.26, width: W * 0.9, fontSize: s * 0.2, fontFamily: 'Bebas Neue', fill: '#ffffff', textAlign: 'center' }),
          R({ left: W * 0.25, top: H * 0.55, width: W * 0.5, height: s * 0.004, fill: '#ffffff' }),
          T('SÁBADO 24 · 22:00 h', { left: W * 0.1, top: H * 0.6, width: W * 0.8, fontSize: s * 0.05, fontFamily: 'Poppins', fontWeight: '600', fill: '#ffffff', textAlign: 'center' }),
          T('Sala Bamba · C/ Mayor 12', { left: W * 0.1, top: H * 0.68, width: W * 0.8, fontSize: s * 0.035, fontFamily: 'Poppins', fill: '#fdf2f8', textAlign: 'center' }),
          R({ left: W * 0.32, top: H * 0.8, width: W * 0.36, height: s * 0.09, fill: '#ffffff', rx: s * 0.045, ry: s * 0.045 }),
          T('ENTRADAS', { left: W * 0.32, top: H * 0.8 + s * 0.026, width: W * 0.36, fontSize: s * 0.035, fontFamily: 'Poppins', fontWeight: '700', fill: '#7c3aed', textAlign: 'center' }),
        ],
      }
    },
  },
  {
    id: 'minimal-serif',
    name: 'Minimalista',
    category: 'Redes sociales',
    tags: ['minimal', 'elegante', 'blanco'],
    swatch: ['#ffffff', '#111827', '#d1d5db'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#ffffff',
        objects: [
          R({ left: W * 0.06, top: H * 0.06, width: W * 0.88, height: H * 0.88, fill: 'transparent', stroke: '#111827', strokeWidth: 2, strokeUniform: true }),
          T('Menos es más', { left: W * 0.12, top: H * 0.4, width: W * 0.76, fontSize: s * 0.1, fontFamily: 'DM Serif Display', fill: '#111827', textAlign: 'center' }),
          T('UNA COLECCIÓN DE IDEAS SENCILLAS', { left: W * 0.12, top: H * 0.56, width: W * 0.76, fontSize: s * 0.028, fontFamily: 'Inter', fill: '#6b7280', textAlign: 'center', charSpacing: 300 }),
        ],
      }
    },
  },
  {
    id: 'presentation-cover',
    size: { w: 1920, h: 1080 },
    name: 'Portada de presentación',
    category: 'Presentaciones',
    tags: ['presentación', 'portada', 'empresa'],
    swatch: ['#0ea5e9', '#0f172a', '#ffffff'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#0f172a',
        objects: [
          R({ left: 0, top: 0, width: W * 0.04, height: H, fill: '#0ea5e9' }),
          T('Plan estratégico', { left: W * 0.1, top: H * 0.3, width: W * 0.7, fontSize: s * 0.11, fontFamily: 'Poppins', fontWeight: '700', fill: '#ffffff', textAlign: 'left' }),
          T('2026 · Presentación trimestral', { left: W * 0.1, top: H * 0.3 + s * 0.15, width: W * 0.7, fontSize: s * 0.04, fontFamily: 'Inter', fill: '#7dd3fc', textAlign: 'left' }),
          T('Preparado por el equipo de bamba', { left: W * 0.1, top: H * 0.82, width: W * 0.7, fontSize: s * 0.028, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'left' }),
          C({ left: W * 0.72, top: H * 0.1, radius: s * 0.28, fill: '#0ea5e9', opacity: 0.25 }),
        ],
      }
    },
  },
  {
    id: 'business-card',
    size: { w: 1050, h: 600 },
    name: 'Tarjeta de visita',
    category: 'Impresión',
    tags: ['tarjeta', 'contacto', 'negocio'],
    swatch: ['#ffffff', '#111827', '#7c3aed'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#ffffff',
        objects: [
          R({ left: 0, top: 0, width: W * 0.36, height: H, fill: '#7c3aed' }),
          T('b', { left: W * 0.08, top: H * 0.3, width: W * 0.2, fontSize: s * 0.42, fontFamily: 'Poppins', fontWeight: '800', fill: '#ffffff', textAlign: 'center' }),
          T('Ada Lovelace', { left: W * 0.42, top: H * 0.26, width: W * 0.52, fontSize: s * 0.13, fontFamily: 'Poppins', fontWeight: '700', fill: '#111827', textAlign: 'left' }),
          T('Directora creativa', { left: W * 0.42, top: H * 0.42, width: W * 0.52, fontSize: s * 0.07, fontFamily: 'Inter', fill: '#7c3aed', textAlign: 'left' }),
          T('hola@bamba.app\n+34 600 000 000\nbamba.app', { left: W * 0.42, top: H * 0.58, width: W * 0.52, fontSize: s * 0.06, fontFamily: 'Inter', fill: '#475569', textAlign: 'left', lineHeight: 1.4 }),
        ],
      }
    },
  },
  {
    id: 'polaroid',
    name: 'Foto polaroid',
    category: 'Fotos',
    tags: ['foto', 'marco', 'recuerdo'],
    swatch: ['#fef3c7', '#ffffff', '#111827'],
    build: (W, H) => {
      const s = Math.min(W, H)
      const cardW = s * 0.7
      const cardH = s * 0.86
      const left = (W - cardW) / 2
      const top = (H - cardH) / 2
      return {
        background: '#fef3c7',
        objects: [
          R({ left, top, width: cardW, height: cardH, fill: '#ffffff', angle: -3, shadow: { color: 'rgba(0,0,0,0.25)', blur: 30, offsetX: 0, offsetY: 12 } as any }),
          F('square', cardW * 0.86, { left: left + cardW * 0.07 + s * 0.02, top: top + cardW * 0.07 - s * 0.01, angle: -3 }),
          T('Verano 2026', { left: left + cardW * 0.07, top: top + cardH * 0.86, width: cardW * 0.86, fontSize: s * 0.05, fontFamily: 'Caveat', fill: '#111827', textAlign: 'center', angle: -3 }),
        ],
      }
    },
  },
  {
    id: 'menu',
    size: { w: 1240, h: 1754 },
    name: 'Menú del día',
    category: 'Impresión',
    tags: ['menú', 'restaurante', 'comida', 'carta'],
    swatch: ['#1c1917', '#fbbf24', '#fafaf9'],
    build: (W, H) => {
      const s = Math.min(W, H)
      const items = ['Ensalada de burrata ........ 9€', 'Risotto de setas ........... 12€', 'Lubina a la brasa ......... 16€', 'Tarta de queso ............. 6€']
      return {
        background: '#1c1917',
        objects: [
          T('MENÚ', { left: W * 0.1, top: H * 0.08, width: W * 0.8, fontSize: s * 0.14, fontFamily: 'Bebas Neue', fill: '#fbbf24', textAlign: 'center', charSpacing: 200 }),
          T('del día', { left: W * 0.1, top: H * 0.08 + s * 0.14, width: W * 0.8, fontSize: s * 0.06, fontFamily: 'Great Vibes', fill: '#fafaf9', textAlign: 'center' }),
          L([W * 0.2, H * 0.3, W * 0.8, H * 0.3], { stroke: '#fbbf24', strokeWidth: 2 }),
          T(items.join('\n\n'), { left: W * 0.12, top: H * 0.35, width: W * 0.76, fontSize: s * 0.04, fontFamily: 'Merriweather', fill: '#fafaf9', textAlign: 'left', lineHeight: 1.3 }),
          T('Menú completo 18€ · bebida incluida', { left: W * 0.1, top: H * 0.86, width: W * 0.8, fontSize: s * 0.03, fontFamily: 'Inter', fill: '#a8a29e', textAlign: 'center' }),
        ],
      }
    },
  },
  {
    id: 'certificate',
    size: { w: 1754, h: 1240 },
    name: 'Certificado',
    category: 'Educación',
    tags: ['certificado', 'diploma', 'curso'],
    swatch: ['#fffbeb', '#b45309', '#1c1917'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#fffbeb',
        objects: [
          R({ left: W * 0.04, top: H * 0.06, width: W * 0.92, height: H * 0.88, fill: 'transparent', stroke: '#b45309', strokeWidth: 6, strokeUniform: true }),
          R({ left: W * 0.055, top: H * 0.085, width: W * 0.89, height: H * 0.83, fill: 'transparent', stroke: '#b45309', strokeWidth: 2, strokeUniform: true }),
          T('CERTIFICADO', { left: W * 0.1, top: H * 0.16, width: W * 0.8, fontSize: s * 0.11, fontFamily: 'Cormorant Garamond', fontWeight: '700', fill: '#1c1917', textAlign: 'center', charSpacing: 250 }),
          T('de reconocimiento', { left: W * 0.1, top: H * 0.16 + s * 0.12, width: W * 0.8, fontSize: s * 0.045, fontFamily: 'Cormorant Garamond', fontStyle: 'italic', fill: '#78350f', textAlign: 'center' }),
          T('Se otorga a', { left: W * 0.1, top: H * 0.42, width: W * 0.8, fontSize: s * 0.03, fontFamily: 'Inter', fill: '#57534e', textAlign: 'center' }),
          T('Nombre Apellidos', { left: W * 0.1, top: H * 0.48, width: W * 0.8, fontSize: s * 0.09, fontFamily: 'Great Vibes', fill: '#1c1917', textAlign: 'center' }),
          L([W * 0.3, H * 0.62, W * 0.7, H * 0.62], { stroke: '#b45309', strokeWidth: 2 }),
          T('Por completar con éxito el curso de diseño con bamba', { left: W * 0.15, top: H * 0.66, width: W * 0.7, fontSize: s * 0.03, fontFamily: 'Inter', fill: '#57534e', textAlign: 'center' }),
          L([W * 0.15, H * 0.84, W * 0.4, H * 0.84], { stroke: '#1c1917', strokeWidth: 2 }),
          T('Firma', { left: W * 0.15, top: H * 0.855, width: W * 0.25, fontSize: s * 0.024, fontFamily: 'Inter', fill: '#57534e', textAlign: 'center' }),
          L([W * 0.6, H * 0.84, W * 0.85, H * 0.84], { stroke: '#1c1917', strokeWidth: 2 }),
          T('Fecha', { left: W * 0.6, top: H * 0.855, width: W * 0.25, fontSize: s * 0.024, fontFamily: 'Inter', fill: '#57534e', textAlign: 'center' }),
        ],
      }
    },
  },
  {
    id: 'birthday',
    name: 'Cumpleaños',
    category: 'Eventos',
    tags: ['cumpleaños', 'fiesta', 'invitación'],
    swatch: ['#fdf2f8', '#ec4899', '#facc15'],
    build: (W, H) => {
      const s = Math.min(W, H)
      const confetti: FabricObject[] = []
      const cols = ['#ec4899', '#facc15', '#7c3aed', '#22c55e', '#0ea5e9']
      const seed = [0.12, 0.31, 0.47, 0.66, 0.83, 0.2, 0.55, 0.9, 0.38, 0.72]
      seed.forEach((x, i) => {
        confetti.push(C({ left: W * x, top: H * ((i * 0.37) % 0.9), radius: s * (0.012 + (i % 3) * 0.006), fill: cols[i % cols.length], opacity: 0.85 }))
      })
      return {
        background: '#fdf2f8',
        objects: [
          ...confetti,
          T('¡Feliz cumpleaños!', { left: W * 0.08, top: H * 0.3, width: W * 0.84, fontSize: s * 0.11, fontFamily: 'Pacifico', fill: '#ec4899', textAlign: 'center' }),
          T('Ven a celebrarlo con nosotros', { left: W * 0.1, top: H * 0.52, width: W * 0.8, fontSize: s * 0.04, fontFamily: 'Poppins', fill: '#831843', textAlign: 'center' }),
          T('Sábado 12 · 18:00 h · Casa de Ana', { left: W * 0.1, top: H * 0.6, width: W * 0.8, fontSize: s * 0.032, fontFamily: 'Poppins', fontWeight: '600', fill: '#be185d', textAlign: 'center' }),
        ],
      }
    },
  },
  {
    id: 'webinar',
    size: { w: 1200, h: 630 },
    name: 'Webinar',
    category: 'Marketing',
    tags: ['webinar', 'online', 'charla', 'ponente'],
    swatch: ['#ecfeff', '#0e7490', '#111827'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#ecfeff',
        objects: [
          R({ left: 0, top: 0, width: W, height: H * 0.16, fill: '#0e7490' }),
          T('WEBINAR GRATUITO', { left: W * 0.06, top: H * 0.05, width: W * 0.88, fontSize: s * 0.045, fontFamily: 'Montserrat', fontWeight: '800', fill: '#ffffff', textAlign: 'left', charSpacing: 200 }),
          F('circle', s * 0.34, { left: W * 0.06, top: H * 0.26 }),
          T('Diseña como un pro sin pagar suscripciones', { left: W * 0.06 + s * 0.4, top: H * 0.27, width: W - (W * 0.12 + s * 0.4), fontSize: s * 0.06, fontFamily: 'Poppins', fontWeight: '700', fill: '#111827', textAlign: 'left' }),
          T('Con Ada Lovelace · Directora creativa', { left: W * 0.06 + s * 0.4, top: H * 0.27 + s * 0.22, width: W - (W * 0.12 + s * 0.4), fontSize: s * 0.03, fontFamily: 'Inter', fill: '#0e7490', textAlign: 'left' }),
          T('Jueves 20 · 18:00 h (CET)', { left: W * 0.06, top: H * 0.78, width: W * 0.88, fontSize: s * 0.04, fontFamily: 'Poppins', fontWeight: '600', fill: '#111827', textAlign: 'left' }),
          R({ left: W * 0.06, top: H * 0.86, width: s * 0.36, height: s * 0.08, fill: '#0e7490', rx: s * 0.02, ry: s * 0.02 }),
          T('RESERVA TU PLAZA', { left: W * 0.06, top: H * 0.86 + s * 0.024, width: s * 0.36, fontSize: s * 0.028, fontFamily: 'Poppins', fontWeight: '700', fill: '#ffffff', textAlign: 'center' }),
        ],
      }
    },
  },
  {
    id: 'launch-bold',
    name: 'Lanzamiento',
    category: 'Marketing',
    tags: ['lanzamiento', 'producto', 'nuevo'],
    swatch: ['#111827', '#a3e635', '#ffffff'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#111827',
        objects: [
          T('NUEVO', { left: W * 0.06, top: H * 0.1, width: W * 0.88, fontSize: s * 0.26, fontFamily: 'Archivo Black', fill: '#a3e635', textAlign: 'left', lineHeight: 0.9 }),
          T('LANZAMIENTO', { left: W * 0.06, top: H * 0.1 + s * 0.24, width: W * 0.88, fontSize: s * 0.13, fontFamily: 'Archivo Black', fill: '#ffffff', textAlign: 'left', lineHeight: 0.9 }),
          F('rounded', s * 0.4, { left: W * 0.55, top: H * 0.5 }),
          T('Ya disponible en bamba.app', { left: W * 0.06, top: H * 0.86, width: W * 0.88, fontSize: s * 0.035, fontFamily: 'Space Grotesk', fill: '#d1d5db', textAlign: 'left' }),
        ],
      }
    },
  },
  {
    id: 'steps',
    size: { w: 1080, h: 1350 },
    name: '3 pasos',
    category: 'Infografías',
    tags: ['pasos', 'infografía', 'proceso'],
    swatch: ['#f8fafc', '#7c3aed', '#111827'],
    build: (W, H) => {
      const s = Math.min(W, H)
      const objs: FabricObject[] = [T('Cómo funciona', { left: W * 0.08, top: H * 0.08, width: W * 0.84, fontSize: s * 0.08, fontFamily: 'Poppins', fontWeight: '700', fill: '#111827', textAlign: 'center' })]
      const steps = [
        ['Elige una plantilla', 'Cientos de diseños listos para personalizar.'],
        ['Personaliza', 'Cambia textos, colores, fotos y fuentes.'],
        ['Descarga', 'PNG, JPG, PDF o SVG en un clic.'],
      ]
      steps.forEach((st, i) => {
        const y = H * 0.28 + i * H * 0.2
        objs.push(C({ left: W * 0.1, top: y, radius: s * 0.05, fill: '#7c3aed' }))
        objs.push(T(String(i + 1), { left: W * 0.1, top: y + s * 0.02, width: s * 0.1, fontSize: s * 0.05, fontFamily: 'Poppins', fontWeight: '700', fill: '#ffffff', textAlign: 'center' }))
        objs.push(T(st[0], { left: W * 0.1 + s * 0.14, top: y, width: W * 0.7, fontSize: s * 0.045, fontFamily: 'Poppins', fontWeight: '600', fill: '#111827', textAlign: 'left' }))
        objs.push(T(st[1], { left: W * 0.1 + s * 0.14, top: y + s * 0.06, width: W * 0.7, fontSize: s * 0.03, fontFamily: 'Inter', fill: '#475569', textAlign: 'left' }))
      })
      return { background: '#f8fafc', objects: objs }
    },
  },
  {
    id: 'thanks',
    name: 'Gracias',
    category: 'Redes sociales',
    tags: ['gracias', 'agradecimiento'],
    swatch: ['#fdf4ff', '#a21caf', '#111827'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: { type: 'radial', stops: [{ offset: 0, color: '#fdf4ff' }, { offset: 1, color: '#f5d0fe' }] },
        objects: [
          T('gracias', { left: W * 0.08, top: H * 0.34, width: W * 0.84, fontSize: s * 0.2, fontFamily: 'Great Vibes', fill: '#a21caf', textAlign: 'center' }),
          T('POR ACOMPAÑARNOS', { left: W * 0.1, top: H * 0.6, width: W * 0.8, fontSize: s * 0.03, fontFamily: 'Montserrat', fontWeight: '600', fill: '#111827', textAlign: 'center', charSpacing: 400 }),
        ],
      }
    },
  },
  {
    id: 'yt-thumb',
    size: { w: 1280, h: 720 },
    name: 'Miniatura YouTube',
    category: 'Vídeo',
    tags: ['youtube', 'miniatura', 'vídeo'],
    swatch: ['#dc2626', '#ffffff', '#111827'],
    build: (W, H) => {
      const s = Math.min(W, H)
      return {
        background: '#dc2626',
        objects: [
          F('portrait', H * 0.9, { left: W * 0.62, top: H * 0.05 }),
          T('¡ADIÓS\nCANVA!', { left: W * 0.05, top: H * 0.15, width: W * 0.55, fontSize: s * 0.28, fontFamily: 'Anton', fill: '#ffffff', textAlign: 'left', lineHeight: 0.95, stroke: '#111827', strokeWidth: s * 0.01, paintFirst: 'stroke' }),
          R({ left: W * 0.05, top: H * 0.78, width: W * 0.4, height: H * 0.12, fill: '#facc15', rx: 12, ry: 12 }),
          T('TUTORIAL COMPLETO', { left: W * 0.05, top: H * 0.78 + H * 0.03, width: W * 0.4, fontSize: s * 0.06, fontFamily: 'Poppins', fontWeight: '800', fill: '#111827', textAlign: 'center' }),
        ],
      }
    },
  },
]

export const TEMPLATE_CATEGORIES = Array.from(new Set(TEMPLATES.map((t) => t.category)))

/** Aplica una plantilla al canvas actual (reemplaza el contenido). */
export async function applyTemplate(canvas: Canvas, tpl: Template, W: number, H: number) {
  const { background, objects } = tpl.build(W, H)
  const fams = new Set<string>()
  objects.forEach((o) => (o as any).fontFamily && fams.add((o as any).fontFamily))
  await Promise.all(Array.from(fams).map((f) => ensureFont(f)))
  canvas.discardActiveObject()
  canvas.remove(...canvas.getObjects())
  canvas.backgroundColor = typeof background === 'string' ? background : (makeGradient(background, W, H) as any)
  objects.forEach((o) => {
    if ((o as any).initDimensions) (o as any).initDimensions()
    canvas.add(o)
  })
  canvas.requestRenderAll()
}

const previewCache = new Map<string, Promise<string>>()

/** Miniatura de plantilla renderizada en un StaticCanvas (cacheada). */
export function templatePreview(tpl: Template, W: number, H: number, maxSide = 260): Promise<string> {
  const key = `${tpl.id}:${W}x${H}`
  const cached = previewCache.get(key)
  if (cached) return cached
  const p = (async () => {
    const { background, objects } = tpl.build(W, H)
    const fams = new Set<string>()
    objects.forEach((o) => (o as any).fontFamily && fams.add((o as any).fontFamily))
    await Promise.all(Array.from(fams).map((f) => ensureFont(f)))
    const sc = new StaticCanvas(undefined, { width: W, height: H, enableRetinaScaling: false })
    sc.backgroundColor = typeof background === 'string' ? background : (makeGradient(background, W, H) as any)
    objects.forEach((o) => {
      if ((o as any).initDimensions) (o as any).initDimensions()
      sc.add(o)
    })
    sc.renderAll()
    const url = sc.toDataURL({ format: 'jpeg', quality: 0.8, multiplier: maxSide / Math.max(W, H) } as any)
    sc.dispose()
    return url
  })()
  previewCache.set(key, p)
  return p
}
