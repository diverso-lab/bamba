import { Color, classRegistry, filters } from 'fabric'
import type { T2DPipelineState, TWebGLUniformLocationMap } from 'fabric'

/**
 * Filtros personalizados (WebGL + fallback 2D) al estilo "Efectos" de Canva.
 * Se registran en classRegistry para que sobrevivan al JSON.
 */

// ----------------------------------------------------------------------------
// Duotono
// ----------------------------------------------------------------------------
type DuotoneProps = { dark: string; light: string }

export class Duotone extends filters.BaseFilter<'Duotone', DuotoneProps> {
  declare dark: string
  declare light: string
  static type = 'Duotone'
  static defaults: DuotoneProps = { dark: '#1e1b4b', light: '#f472b6' }
  static uniformLocations = ['uDark', 'uLight']

  getFragmentSource() {
    return `
      precision highp float;
      uniform sampler2D uTexture;
      uniform vec3 uDark;
      uniform vec3 uLight;
      varying vec2 vTexCoord;
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        float l = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(uDark, uLight, l);
        gl_FragColor = color;
      }`
  }

  applyTo2d({ imageData: { data } }: T2DPipelineState) {
    const d = new Color(this.dark).getSource()
    const l = new Color(this.light).getSource()
    for (let i = 0; i < data.length; i += 4) {
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
      data[i] = d[0] + (l[0] - d[0]) * lum
      data[i + 1] = d[1] + (l[1] - d[1]) * lum
      data[i + 2] = d[2] + (l[2] - d[2]) * lum
    }
  }

  sendUniformData(gl: WebGLRenderingContext, u: TWebGLUniformLocationMap) {
    const d = new Color(this.dark).getSource()
    const l = new Color(this.light).getSource()
    gl.uniform3fv(u.uDark, [d[0] / 255, d[1] / 255, d[2] / 255])
    gl.uniform3fv(u.uLight, [l[0] / 255, l[1] / 255, l[2] / 255])
  }
}
classRegistry.setClass(Duotone)

// ----------------------------------------------------------------------------
// Viñeta
// ----------------------------------------------------------------------------
type VignetteProps = { amount: number; size: number }

export class Vignette extends filters.BaseFilter<'Vignette', VignetteProps> {
  declare amount: number // 0..1 oscuridad
  declare size: number // 0..1 tamaño del área clara
  static type = 'Vignette'
  static defaults: VignetteProps = { amount: 0.5, size: 0.5 }
  static uniformLocations = ['uAmount', 'uSize']

  getFragmentSource() {
    return `
      precision highp float;
      uniform sampler2D uTexture;
      uniform float uAmount;
      uniform float uSize;
      varying vec2 vTexCoord;
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        float d = distance(vTexCoord, vec2(0.5, 0.5)) * 1.4142;
        float t = smoothstep(uSize, 1.15, d);
        color.rgb *= (1.0 - uAmount * t);
        gl_FragColor = color;
      }`
  }

  isNeutralState() {
    return this.amount === 0
  }

  applyTo2d({ imageData: { data, width, height } }: T2DPipelineState) {
    const size = this.size
    const amount = this.amount
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x / width - 0.5
        const dy = y / height - 0.5
        const d = Math.sqrt(dx * dx + dy * dy) * 1.4142
        let t = (d - size) / (1.15 - size)
        t = Math.max(0, Math.min(1, t))
        t = t * t * (3 - 2 * t)
        const f = 1 - amount * t
        const i = (y * width + x) * 4
        data[i] *= f
        data[i + 1] *= f
        data[i + 2] *= f
      }
    }
  }

  sendUniformData(gl: WebGLRenderingContext, u: TWebGLUniformLocationMap) {
    gl.uniform1f(u.uAmount, this.amount)
    gl.uniform1f(u.uSize, this.size)
  }
}
classRegistry.setClass(Vignette)

// ----------------------------------------------------------------------------
// Ayudas para enfoque / relieve (usan Convolute de fabric)
// ----------------------------------------------------------------------------
export function sharpenMatrix(amount: number) {
  const a = amount // 0..1
  return [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]
}
export const EMBOSS_MATRIX = [1, 1, 1, 1, 0.7, -1, -1, -1, -1]

export const DUOTONE_PRESETS: { name: string; dark: string; light: string }[] = [
  { name: 'Violeta', dark: '#1e1b4b', light: '#f472b6' },
  { name: 'Océano', dark: '#0c4a6e', light: '#67e8f9' },
  { name: 'Bosque', dark: '#052e16', light: '#a3e635' },
  { name: 'Ámbar', dark: '#431407', light: '#fde68a' },
  { name: 'Rojo', dark: '#450a0a', light: '#fca5a5' },
  { name: 'Noir', dark: '#000000', light: '#ffffff' },
  { name: 'Sepia', dark: '#3f2a14', light: '#f5deb3' },
  { name: 'Neón', dark: '#3b0764', light: '#22d3ee' },
]
