export interface SizePreset {
  id: string
  name: string
  width: number
  height: number
  category: string
  unit?: 'px' | 'mm'
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: 'ig-post', name: 'Publicación de Instagram', width: 1080, height: 1080, category: 'Redes sociales' },
  { id: 'ig-story', name: 'Historia de Instagram', width: 1080, height: 1920, category: 'Redes sociales' },
  { id: 'ig-portrait', name: 'Instagram vertical', width: 1080, height: 1350, category: 'Redes sociales' },
  { id: 'fb-post', name: 'Publicación de Facebook', width: 1200, height: 630, category: 'Redes sociales' },
  { id: 'fb-cover', name: 'Portada de Facebook', width: 1640, height: 924, category: 'Redes sociales' },
  { id: 'x-post', name: 'Publicación de X / Twitter', width: 1600, height: 900, category: 'Redes sociales' },
  { id: 'linkedin-post', name: 'Publicación de LinkedIn', width: 1200, height: 1200, category: 'Redes sociales' },
  { id: 'linkedin-banner', name: 'Banner de LinkedIn', width: 1584, height: 396, category: 'Redes sociales' },
  { id: 'yt-thumb', name: 'Miniatura de YouTube', width: 1280, height: 720, category: 'Vídeo' },
  { id: 'yt-banner', name: 'Banner de YouTube', width: 2560, height: 1440, category: 'Vídeo' },
  { id: 'tiktok', name: 'Vídeo TikTok / Reel', width: 1080, height: 1920, category: 'Vídeo' },
  { id: 'presentation', name: 'Presentación 16:9', width: 1920, height: 1080, category: 'Presentaciones' },
  { id: 'presentation-43', name: 'Presentación 4:3', width: 1024, height: 768, category: 'Presentaciones' },
  { id: 'a4-portrait', name: 'Documento A4 vertical', width: 1240, height: 1754, category: 'Documentos' },
  { id: 'a4-landscape', name: 'Documento A4 horizontal', width: 1754, height: 1240, category: 'Documentos' },
  { id: 'letter', name: 'Carta US', width: 1275, height: 1650, category: 'Documentos' },
  { id: 'poster', name: 'Póster (42x59,4 cm)', width: 1587, height: 2245, category: 'Impresión' },
  { id: 'flyer-a5', name: 'Flyer A5', width: 874, height: 1240, category: 'Impresión' },
  { id: 'business-card', name: 'Tarjeta de visita', width: 1050, height: 600, category: 'Impresión' },
  { id: 'invitation', name: 'Invitación (5x7 in)', width: 1500, height: 2100, category: 'Impresión' },
  { id: 'menu', name: 'Menú', width: 1240, height: 1754, category: 'Impresión' },
  { id: 'certificate', name: 'Certificado', width: 1754, height: 1240, category: 'Impresión' },
  { id: 'logo', name: 'Logotipo', width: 500, height: 500, category: 'Marca' },
  { id: 'wallpaper', name: 'Fondo de escritorio', width: 1920, height: 1080, category: 'Otros' },
  { id: 'phone-wallpaper', name: 'Fondo de móvil', width: 1080, height: 2340, category: 'Otros' },
  { id: 'infographic', name: 'Infografía', width: 800, height: 2000, category: 'Marketing' },
  { id: 'email-header', name: 'Cabecera de email', width: 600, height: 200, category: 'Marketing' },
  { id: 'web-banner', name: 'Banner web', width: 1200, height: 400, category: 'Marketing' },
  { id: 'whiteboard', name: 'Pizarra', width: 2400, height: 1600, category: 'Otros' },
]

export const PRESET_CATEGORIES = Array.from(new Set(SIZE_PRESETS.map((p) => p.category)))
