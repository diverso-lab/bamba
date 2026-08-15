export interface PageData {
  id: string
  json: any | null
  thumbnail?: string | null
  /** duración de la página en presentación / vídeo (ms) */
  duration?: number
  /** animación por defecto de la página (para elementos sin animación propia) */
  anim?: { type: string; duration: number; delay: number } | null
  transition?: 'none' | 'fade'
}

export interface DesignData {
  id: string
  name: string
  width: number
  height: number
  pages: PageData[]
  thumbnail?: string | null
  folder?: string | null
  createdAt?: number
  updatedAt?: number
  role?: 'owner' | 'edit' | 'view'
  ownerId?: string
  ownerName?: string
}

export interface DesignMeta {
  id: string
  name: string
  width: number
  height: number
  pageCount: number
  thumbnail?: string | null
  createdAt?: number
  updatedAt?: number
  folder?: string | null
  shared?: boolean
  owner?: string
  role?: string
}

export interface UploadItem {
  id: string
  name: string
  kind: 'image' | 'font' | 'video'
  url: string
  size: number
  width?: number | null
  height?: number | null
  createdAt: number
}

export interface StockPhoto {
  id: string
  title: string
  thumb: string
  url: string
  width?: number
  height?: number
  creator: string
  license: string
  source: string
  attribution: string
}

export interface BrandKit {
  colors: string[]
  fonts: { family: string; url?: string; uploadId?: string }[]
  logos: { url: string; name: string }[]
}

export type SideTab =
  | 'design'
  | 'elements'
  | 'text'
  | 'photos'
  | 'uploads'
  | 'draw'
  | 'brand'
  | 'background'
  | 'apps'
  | 'layers'
  | 'position'
  | 'photo'
  | 'graphics'
  | 'ai'
  | 'animate'
