import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { removeBackground } from '@imgly/background-removal-node'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 90_000
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'image/tiff', 'image/gif', 'image/avif',
])

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Processing timed out')), ms)
    ),
  ])
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const file = fd.get('file') as File | null
    if (!file) return err('No file provided')

    const mime = file.type || 'image/jpeg'
    if (!ALLOWED_MIME.has(mime)) return err('Unsupported file type')
    if (file.size > MAX_BYTES) return err('File too large (max 10 MB)')

    const mode = (fd.get('mode') as string | null) ?? ''
    const buf = Buffer.from(await file.arrayBuffer())

    // ── Background removal ──────────────────────────────────────────
    if (mode === 'bgremove') {
      const blob = new Blob([buf], { type: mime })
      const resultBlob = await withTimeout(removeBackground(blob), TIMEOUT_MS)
      const out = Buffer.from(await resultBlob.arrayBuffer())
      return new NextResponse(new Uint8Array(out), {
        headers: { 'Content-Type': 'image/png' },
      })
    }

    // ── Resize ──────────────────────────────────────────────────────
    if (mode === 'resize') {
      const rawW = fd.get('width') as string | null
      const rawH = fd.get('height') as string | null
      const keepAspect = (fd.get('keepAspect') as string) !== 'false'

      const w = rawW ? parseInt(rawW, 10) : undefined
      const h = rawH ? parseInt(rawH, 10) : undefined
      if (!w && !h) return err('Provide at least width or height')

      const img = sharp(buf).resize(w, h, {
        fit: keepAspect ? 'inside' : 'fill',
        withoutEnlargement: false,
      })

      const out = await withTimeout(img.toBuffer(), TIMEOUT_MS)
      return new NextResponse(new Uint8Array(out), {
        headers: { 'Content-Type': mime },
      })
    }

    // ── Enhance ─────────────────────────────────────────────────────
    if (mode === 'enhance') {
      const sharpenVal = Number(fd.get('sharpen') ?? 0)
      const denoiseVal = Number(fd.get('denoise') ?? 0)
      const contrastVal = Number(fd.get('contrast') ?? 0)
      const glossy = (fd.get('glossy') as string) === 'true'

      if (!glossy && sharpenVal === 0 && denoiseVal === 0 && contrastVal === 0) {
        return err('Select at least one enhancement')
      }

      let img = sharp(buf)

      if (glossy) {
        // Glossy preset: denoise → sharpen → contrast → saturation + brightness
        img = img
          .median(3)                                      // mild denoise
          .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.2 })    // crisp edges, restrained halos
          .normalise({ lower: 4, upper: 4 })             // gentle contrast stretch
          .modulate({ saturation: 1.15, brightness: 1.04 }) // pop + slight lift
      } else {
        // Denoise first (before sharpening)
        if (denoiseVal > 0) {
          // Map 1-100 → aperture 3, 5, 7, 9, 11 (odd, capped at 11 for quality)
          const aperture = Math.max(3, Math.min(11, 3 + Math.round((denoiseVal / 100) * 4) * 2))
          img = img.median(aperture)
        }

        if (sharpenVal > 0) {
          // Map 1-100 → sigma 0.5–3.0
          const sigma = 0.5 + (sharpenVal / 100) * 2.5
          img = img.sharpen({ sigma })
        }

        if (contrastVal > 0) {
          // Map 1-100 → normalise lower percentile trim 0–20%
          const lower = Math.round((contrastVal / 100) * 20)
          img = img.normalise({ lower, upper: lower })
        }
      }

      const out = await withTimeout(img.toBuffer(), TIMEOUT_MS)
      return new NextResponse(new Uint8Array(out), {
        headers: { 'Content-Type': mime },
      })
    }

    return err('Unknown mode')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[process]', msg)
    return err(msg, 500)
  }
}
